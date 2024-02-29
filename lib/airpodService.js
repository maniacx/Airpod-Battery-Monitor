'use strict';
const {Gio, GLib, GObject} = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {BluezAdapterProxy, BluezObjectProxy} = Me.imports.lib.dbus;
const {AirpodPanel} = Me.imports.lib.airpodPanel;
const {AirpodTrayIndicator} = Me.imports.lib.airpodTrayIndicator;

// Credits: to https://github.com/Toxblh for provide airpod detection code..

const DISCOVERY_DELAY = 60; // interval between stop and start discovery in seconds (min : 20secs)
const MIN_RSSI = -70;
const MANUFACTURER_ID = '76';
const MANUFACTURER_DATA_LENGTH = 27;

var AirpodService = GObject.registerClass(
class AirpodService extends GObject.Object {
    constructor(extensionObj, settings) {
        super();
        this._currentAirpods = [];
        this._oldAirpods = [];
        this._discoveryDelay = 3;
        this._discoveryStarted = false;
        this._doNotUpdateData = {'leftLevel': -2, 'rightLevel': -2, 'caseLevel': -2, 'singleLevel': -2, 'leftStatus': false, 'rightStatus': false, 'caseStatus': false, 'singleStatus': false, 'updatedTime': -2, 'updatedDate': -2};
        this._extensionObj = extensionObj;
        this._settings = settings;
        this._settings.connectObject(
            'changed::airpods-list', () => {
                if (this._timeoutID) {
                    this._stopTimer();
                    this._currentAirpods = [];
                    this.start();
                } else {
                    this.start();
                }
            },
            'changed::gui-interface', () => {
                if (this._timeoutID) {
                    this._removeGUI();
                    this._startGUI();
                }
            },
            this
        );
    }

    start() {
        if (!this._timeoutID && this._updateAirpodList())
            this._startTimer();
    }

    // Check if airpods are connected and model is assigned.
    _updateAirpodList() {
        const airpodListRaw = this._settings.get_strv('airpods-list');
        if (!airpodListRaw || airpodListRaw.length === 0)
            return false;
        const airpodList = airpodListRaw.map(JSON.parse);
        const airpodModel = [];
        for (const airpod of airpodList) {
            const {path, alias, model, connected, paired} = airpod;
            if (connected && model !== '-1')
                airpodModel.push({path, model, data: this._doNotUpdateData});
        }
        this._connectedAirpods = airpodModel;
        return this._connectedAirpods.length > 0;
    }

    // Timer to startdiscovery, check and update devices and stop discovery in loop.
    _startTimer() {
        this._startGUI();
        this._adapter = new BluezAdapterProxy(Gio.DBus.system, 'org.bluez', '/org/bluez/hci0');
        this._startDiscovery();
        let counter = 0;
        this._timeoutID = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 5, () => {
            if (counter === 1) {
                if (this._discoveryStarted)
                    this._scanBluetoothDevices();
            }
            if (counter === 2)
                this._stopDiscovery();
            if (counter === this._discoveryDelay)
                this._startDiscovery();
            counter = counter > this._discoveryDelay ? 0 : counter + 1;
            return GLib.SOURCE_CONTINUE;
        });
    }

    // Set discovery Filter for le and rssi and start BLE discovery
    // Filter by RSSI will reduced the amount of device scanned.
    async _startDiscovery() {
        try {
            const filters = {
                Transport: GLib.Variant.new_string('le'),
                RSSI: GLib.Variant.new_int16(MIN_RSSI),
            };
            await this._adapter.SetDiscoveryFilterRemote(filters);
        } catch {
            log('Airpod Battery Monitor: Applying discovery filter failed ');
        }
        try {
            await this._adapter.StartDiscoveryAsync();
            this._discoveryStarted = true;
        } catch {
            log('Airpod Battery Monitor: Start Discovery failed');
        }
    }

    // stop BLE discovery and Reset discovery Filter
    async _stopDiscovery() {
        if (this._discoveryStarted) {
            try {
                await this._adapter.StopDiscoveryAsync();
                this._discoveryStarted = false;
            } catch {
                log('Airpod Battery Monitor: Stop Discovery failed');
                this._discoveryStarted = false;
            }
            try {
                await this._adapter.SetDiscoveryFilterRemote({});
            } catch {
                log('Airpod Battery Monitor: Applying discovery filter reset failed');
            }
        }
    }

    _startGUI() {
        const airpods = this._currentAirpods.length > 0 ? this._currentAirpods : this._connectedAirpods;
        if (this._settings.get_boolean('gui-interface')) {
            if (!this._panel) {
                this._panel = new AirpodPanel(this._settings, this._extensionObj, airpods);
                Main.panel.addToStatusArea(this._extensionObj.metadata.uuid, this._panel);
            } else {
                this._panel.updateDevices(airpods);
            }
        } else {
            if (!this._indicator)
                this._indicator = new AirpodTrayIndicator(this._settings, this._extensionObj, airpods);
            else
                this._indicator.updateDevices(airpods);
        }
    }

    _correctLevel(value) {
        if (value === 15)
            return -1;
        else if (value === 0)
            return 5;
        else
            return value > 9 ? 100 : value * 10;
    }

    // Decode ManufacturerData
    _decodeManufacturerData(data) {
        // Level
        const flip = parseInt(`${data.charAt(10)}`, 16) & 0x02 == 0;
        const leftLevel = this._correctLevel(parseInt(`${data.charAt(flip ? 12 : 13)}`, 16));
        const rightLevel = this._correctLevel(parseInt(`${data.charAt(flip ? 13 : 12)}`, 16));
        const caseLevel = this._correctLevel(parseInt(`${data.charAt(15)}`, 16));
        const singleLevel = this._correctLevel(parseInt(`${data.charAt(13)}`, 16));

        // Charging Status
        const chargeStatus = parseInt(`${data.charAt(14)}`, 16);
        const leftStatus = (chargeStatus & (flip ? 0b00000010 : 0b00000001)) !== 0;
        const rightStatus = (chargeStatus & (flip ? 0b00000001 : 0b00000010)) !== 0;
        const caseStatus = (chargeStatus & 0b00000100) !== 0;
        const singleStatus = (chargeStatus & 0b00000001) !== 0;
        const dateTime = GLib.DateTime.new_now_local();
        const updatedTime = dateTime.format('%X');
        const updatedDate = dateTime.format('%d %a %Y');

        return {leftLevel, rightLevel, caseLevel, singleLevel, leftStatus, rightStatus, caseStatus, singleStatus, updatedTime, updatedDate};
    }

    // Find a close match between connected airpods and scanned airpod filtering by model and rssi and previous airpods
    _filterAirpods(rawScannedAirpods) {
        const connectedAirpods = this._connectedAirpods;
        const scannedAirpods = [];
        const filteredAirpods = [];
        const numberOfConnecedAirpod = connectedAirpods.length;
        let numberOfMatchedAirpod = 0;

        // Sort airpod by rssi
        rawScannedAirpods.sort((a, b) => b.rssi - a.rssi);

        for (let i = 0; i < rawScannedAirpods.length; i++) {
            const bytes = rawScannedAirpods[i].data;
            // convert byte array data to string
            let hex = '';
            for (let j = 0; j < bytes.length; j++)
                hex += `0${(bytes[j] & 0xFF).toString(16)}`.slice(-2);

            // if both pods are charging or powered-off remove them from the list of scanned devices, airpods only
            const airpodModels = ['0220', '0F20', '1320', '0E20', '1420', '2420', '1220'];
            if (airpodModels.includes(hex.substring(6, 10))) {
                const chargeStatus = parseInt(`${hex.charAt(14)}`, 16);
                const pod1charge = (chargeStatus & 0b00000001) !== 0;
                const pod2charge = (chargeStatus & 0b00000010) !== 0;
                if (pod1charge && pod2charge)
                    continue;
                const pod1disconnected = parseInt(`${hex.charAt(13)}`, 16) === 15;
                const pod2disconnected = parseInt(`${hex.charAt(12)}`, 16) === 15;
                if (pod1disconnected && pod2disconnected)
                    continue;
            }
            rawScannedAirpods[i].data = hex;
            scannedAirpods.push(rawScannedAirpods[i]);
        }

        // Link new scanned airpods with connected airpod based on model and rssi(sorted above)
        // and decode manufacurer data
        for (let i = 0; i < numberOfConnecedAirpod; i++) {
            let matchFound = false;
            for (let j = 0; j < scannedAirpods.length; j++) {
                let modelValue;
                if (connectedAirpods[i].model.length === 4)
                    modelValue = scannedAirpods[j].data.substring(6, 10);
                else if (connectedAirpods[i].model.length === 1)
                    modelValue = scannedAirpods[j].data.charAt(7);

                if (modelValue && modelValue.toUpperCase() === connectedAirpods[i].model.toUpperCase()) {
                    filteredAirpods.push({
                        path: connectedAirpods[i].path,
                        model: connectedAirpods[i].model,
                        data: this._decodeManufacturerData(scannedAirpods[j].data),
                    });
                    scannedAirpods.splice([j], 1);
                    numberOfMatchedAirpod++;
                    matchFound = true;
                    break;
                }
            }
            if (!matchFound) {
                filteredAirpods.push({
                    path: connectedAirpods[i].path,
                    model: connectedAirpods[i].model,
                    data: this._doNotUpdateData,
                });
            }
        }

        // DISCOVERY_DELAY=60 If all airpod found start next discovery after 40sec else rescan after 5sec to find missing airpod
        this._discoveryDelay = numberOfConnecedAirpod === numberOfMatchedAirpod ? DISCOVERY_DELAY / 5 : 3;

        if (filteredAirpods.length === 0)
            return;

        this._currentAirpods = filteredAirpods;
        this._startGUI();
    }

    // scan all airpod
    async _scanBluetoothDevices() {
        const bus = Gio.DBus.system;
        const bluezObjectManager = BluezObjectProxy(bus, 'org.bluez', '/');

        const scannedAirpods = await new Promise((resolve, reject) => {
            bluezObjectManager.GetManagedObjectsRemote((result, error) => {
                const devices = [];
                try {
                    const [objects] = result;
                    if (objects) {
                        for (const path in objects) {
                            const interfaces = objects[path];
                            for (const iface in interfaces) {
                                if (iface.endsWith('Device1')) {
                                    const properties = interfaces[iface];
                                    const rssi = properties.RSSI?.deep_unpack();
                                    const manufacturerData = properties['ManufacturerData'];
                                    // Althought set Discovery filter by rssi is enabled, some connected device with RSSI undefined do make it to the list.
                                    // Add another check for RSSI
                                    if (rssi && rssi >= MIN_RSSI && manufacturerData &&
                            (MANUFACTURER_ID in manufacturerData.deep_unpack())) {
                                        const rawData = manufacturerData.deep_unpack()[MANUFACTURER_ID].deep_unpack();
                                        if (rawData && rawData.length === MANUFACTURER_DATA_LENGTH && rawData[0] === 0x07 &&
                                            (rawData[1] === 0x19 || rawData[1] === 0x13))
                                            devices.push({rpath: path, data: rawData, rssi});
                                    }
                                }
                            }
                        }
                    }
                    resolve(devices);
                } catch (e) {
                    reject(devices);
                }
            });
        });
        this._filterAirpods(scannedAirpods);
    }

    _removeGUI() {
        if (this._panel) {
            this._panel.removeItems();
            this._panel.destroy();
            Main.panel.statusArea[this._extensionObj.metadata.uuid] = null;
        }
        this._panel = null;

        if (this._indicator)
            this._indicator.destroy();
        this._indicator = null;
    }

    _stopTimer() {
        if (this._timeoutID)
            GLib.source_remove(this._timeoutID);
        this._timeoutID = null;
        this._stopDiscovery();
    }

    stop() {
        this._stopTimer();
        this._removeGUI();
    }

    destroy() {
        this._settings.disconnectObject(this);
        this.stop();
        this._settings = null;
    }
});
