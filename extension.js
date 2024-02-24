'use strict';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as BluetoothClient from './lib/bluetoothClient.js';

export default class AirpodBatteryMonitorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._bluetoothClient = new BluetoothClient.BluetoothClient(this, this._settings);
    }

    disable() {
        this._bluetoothClient.destroy();
        this._bluetoothClient = null;
        this._settings = null;
    }
}

