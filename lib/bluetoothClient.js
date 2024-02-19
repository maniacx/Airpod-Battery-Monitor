'use strict';
const {Gio, GLib, GObject} = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {BluezDeviceProxy} = Me.imports.lib.dbus;
const {AirpodService} = Me.imports.lib.airpodService;

var BluetoothClient = GObject.registerClass({
}, class BluetoothClient extends GObject.Object {
    constructor(extensionObj, settings) {
        super();
        this._extensionObj = extensionObj;
        this._settings = settings;

        this._idleTimerId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            if (!Main.panel.statusArea.quickSettings._bluetooth)
                return GLib.SOURCE_CONTINUE;
            this._bluetoothToggle = Main.panel.statusArea.quickSettings._bluetooth.quickSettingsItems[0];
            this._startBluetoothClient();
            return GLib.SOURCE_REMOVE;
        });
    }

    _startBluetoothClient() {
        this._airpodService = new AirpodService(this._extensionObj, this._settings);
        this._idleTimerId = null;
        this._pairedDevices = new Map();
        this._removedDeviceList = [];
        this._bluetoothToggle._client._client.connectObject(
            'notify::active', () => this._sync(),
            'device-added', () => this._sync(),
            'device-removed', (c, path) => this._removeDevice(path),
            this);
        this._sync();
    }

    _isAirpod(path) {
        const UUID1 = '74ec2172-0bad-4d01-8f77-997b2be0722a';
        const UUID2 = '2a72e02b-7b99-778f-014d-ad0b7221ec74';
        const devProperties = new BluezDeviceProxy(Gio.DBus.system, 'org.bluez', path);
        const isAirpod = devProperties.UUIDs &&
            (devProperties.UUIDs.includes(UUID1) || devProperties.UUIDs.includes(UUID2));
        return isAirpod;
    }

    _updateGsettingDevices(path, dev) {
        let arrayUpdated = false;
        const pairedAirpods = this._settings.get_strv('airpods-list');
        const existingPathIndex = pairedAirpods.findIndex(item => JSON.parse(item).path === path);
        if (existingPathIndex === -1) {
            pairedAirpods.push(JSON.stringify({path, alias: dev.alias, model: '-1', connected: dev.connected, paired: dev.paired}));
            arrayUpdated = true;
        } else {
            const existingItem = JSON.parse(pairedAirpods[existingPathIndex]);

            const devProperties = ['alias', 'connected', 'paired'];
            for (const property of devProperties) {
                if (existingItem[property] !== dev[property]) {
                    existingItem[property] = dev[property];
                    arrayUpdated = true;
                }
            }

            if (arrayUpdated)
                pairedAirpods[existingPathIndex] = JSON.stringify(existingItem);
        }
        if (arrayUpdated)
            this._settings.set_strv('airpods-list', pairedAirpods);
    }

    _removeDevice(path) {
        if (this._pairedDevices.has(path)) {
            const pairedAirpods = this._settings.get_strv('airpods-list');
            const existingPathIndex = pairedAirpods.findIndex(item => JSON.parse(item).path === path);
            if (existingPathIndex !== -1) {
                const existingItem = JSON.parse(pairedAirpods[existingPathIndex]);
                existingItem['connected'] = false;
                existingItem['paired'] = false;
                pairedAirpods[existingPathIndex] = JSON.stringify(existingItem);
                this._settings.set_strv('airpods-list', pairedAirpods);
            }
        }
        this._pairedDevices.delete(path);
        this._removedDeviceList.push(path);
    }

    _sync() {
        let connectedAirpods = 0;
        const devices = [...this._bluetoothToggle._client.getDevices()];
        if (this._removedDeviceList.length > 0) {
            const pathsInDevices = new Set(devices.map(dev => dev.get_object_path()));
            this._removedDeviceList = this._removedDeviceList.filter(path => pathsInDevices.has(path));
        }

        for (const dev of devices) {
            const path = dev.get_object_path();
            if (this._pairedDevices.has(path)) {
                const airpodDevice = this._pairedDevices.get(path);
                if (airpodDevice) {
                    if (dev.connected)
                        connectedAirpods++;
                    this._updateGsettingDevices(path, dev);
                }
                continue;
            }
            if (this._removedDeviceList.length > 0) {
                const pathIndex = this._removedDeviceList.indexOf(path);
                if (pathIndex > -1) {
                    if (dev.connected)
                        this._removedDeviceList.splice(pathIndex, 1);
                    else
                        continue;
                }
            }
            const isAirpod = this._isAirpod(path);
            this._pairedDevices.set(path, isAirpod);
            if (isAirpod) {
                if (dev.connected)
                    connectedAirpods++;
                this._updateGsettingDevices(path, dev);
            }
        }
        if (connectedAirpods !== 0)
            this._airpodService.start();
        else
            this._airpodService.stop();
    }

    destroy() {
        if (this._idleTimerId)
            GLib.source_remove(this._idleTimerId);
        this._idleTimerId = null;
        if (this._bluetoothToggle._client)
            this._bluetoothToggle._client.disconnectObject(this);
        this._settings.disconnectObject(this);
        if (this._airpodService)
            this._airpodService.destroy();
        this._pairedDevices.clear();
        this._settings = null;
    }
});


