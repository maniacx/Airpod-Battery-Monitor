'use strict';
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const BluetoothClient = Me.imports.lib.bluetoothClient;

function init() {
    ExtensionUtils.initTranslations(Me.metadata.uuid);
    return new AirpodBatteryMonitorExtension();
}

class AirpodBatteryMonitorExtension {
    enable() {
        this._settings = ExtensionUtils.getSettings();
        this._bluetoothClient = new BluetoothClient.BluetoothClient(Me, this._settings);
    }

    disable() {
        this._bluetoothClient.destroy();
        this._bluetoothClient = null;
        this._settings = null;
    }
}
