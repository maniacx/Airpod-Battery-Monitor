'use strict';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import GnomeBluetooth from 'gi://GnomeBluetooth';

import {BluezDeviceProxy} from './dbus.js';
import {AirpodService} from './airpodService.js';

export const BluetoothClient = GObject.registerClass({
}, class BluetoothClient extends GObject.Object {
    constructor(extensionObj, settings) {
        super();
        this._extensionObj = extensionObj;
        this._settings = settings;
        this._client = new GnomeBluetooth.Client();
        this._airpodService = new AirpodService(this._extensionObj, this._settings);
        this._pairedDevices = new Map();
        this._deviceNotifyConnected = new Set();
        this._removedDeviceList = [];
        const deviceStore = this._client.get_devices();
        for (let i = 0; i < deviceStore.get_n_items(); i++)
            this._connectDeviceNotify(deviceStore.get_item(i));

        this._client.connect('device-added', (c, device) => {
            this._connectDeviceNotify(device);
            this._sync();
        });
        this._client.connect('device-removed', (c, path) => {
            this._deviceNotifyConnected.delete(path);
            this._removeDevice(path);
        });
        this._sync();
    }

    _queueDevicesChanged() {
        if (this._devicesChangedId)
            return;
        this._devicesChangedId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            delete this._devicesChangedId;
            this._sync();
            return GLib.SOURCE_REMOVE;
        });
    }

    _connectDeviceNotify(device) {
        const path = device.get_object_path();
        if (this._deviceNotifyConnected.has(path))
            return;
        device.connectObject(
            'notify::paired', () => this._queueDevicesChanged(),
            'notify::trusted', () => this._queueDevicesChanged(),
            'notify::connected', () => this._queueDevicesChanged(),
            this);
        this._deviceNotifyConnected.add(path);
    }

    *getDevices() {
        if (!this._client.default_adapter_powered)
            return;
        const deviceStore = this._client.get_devices();
        for (let i = 0; i < deviceStore.get_n_items(); i++) {
            const device = deviceStore.get_item(i);
            if (device.paired || device.trusted)
                yield device;
        }
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
            const isAirpod = this._pairedDevices.get(path);
            if (isAirpod) {
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
            this._removedDeviceList.push(path);
        }
        this._pairedDevices.delete(path);
    }

    _sync() {
        let connectedAirpods = 0;
        const devices = [...this.getDevices()];
        if (this._removedDeviceList.length > 0) {
            const pathsInDevices = new Set(devices.map(dev => dev.get_object_path()));
            this._removedDeviceList = this._removedDeviceList.filter(path => pathsInDevices.has(path));
        }

        for (const dev of devices) {
            const path = dev.get_object_path();
            if (this._pairedDevices.has(path)) {
                const isAirpod = this._pairedDevices.get(path);
                if (isAirpod) {
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
        if (this._client)
            this._client.disconnectObject(this);
        this._settings.disconnectObject(this);
        if (this._airpodService)
            this._airpodService.destroy();
        this._pairedDevices.clear();
        this._settings = null;
        this._client = null;
    }
});


