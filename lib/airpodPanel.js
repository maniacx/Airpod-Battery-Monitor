'use strict';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Spinner} from 'resource:///org/gnome/shell/ui/animation.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {BatteryIcon} from './batteryIconWidget.js';
import {ModelList} from './devices.js';

export const AirpodPanel = GObject.registerClass({
    Signals: {'menu-opened': {param_types: [GObject.TYPE_BOOLEAN]}},
}, class AirpodPanel extends PanelMenu.Button {
    constructor(settings, extensionObj, airpods) {
        super(0.5, _('AirPods Battery Monitor'));
        this._settings = settings;
        this._extensionObj = extensionObj;
        this._airpods = airpods;
        this._connectedAirpods = new Map();
        this._currentIndicatorPath = {};
        this._indicatorBox = new St.BoxLayout();
        this.add_child(this._indicatorBox);
        const battInfoMenu = new PopupMenu.PopupMenuItem(_('Headphone Battery Information'), {reactive: false, style_class: 'abm-panel-title-label'});
        battInfoMenu.label.x_expand = true;
        this.menu.addMenuItem(battInfoMenu);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.connectObject('open-state-changed', (o, isOpen) => {
            this.emit('menu-opened', isOpen);
        }, this);

        this.updateDevices(airpods);
        this._settings.connectObject('changed::default-selected-path', () => {
            this._updateIndicator(this._settings.get_string('default-selected-path'));
            this.updateDevices(this._airpods);
        }, this);
    }

    _multipleBattInfo() {
        this._leftAirpodLabel = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'power-status',
        });
        this._mulitpleIcon = new St.Icon({
            style_class: 'system-status-icon',
        });
        this._rightAirpodLabel = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'power-status',
        });
        this._indicatorBox.add_child(this._leftAirpodLabel);
        this._indicatorBox.add_child(this._mulitpleIcon);
        this._indicatorBox.add_child(this._rightAirpodLabel);
    }

    _singleBattInfo() {
        this._singleIcon = new St.Icon({
            style_class: 'system-status-icon',
        });
        this._singleLabel = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'power-status',
        });
        this._indicatorBox.add_child(this._singleIcon);
        this._indicatorBox.add_child(this._singleLabel);
    }

    _updateIndicator(path) {
        if (path === '' || !this._connectedAirpods.has(path)) {
            if (this._currentIndicatorPath.path && this._connectedAirpods.has(this._currentIndicatorPath.path)) {
                path = this._currentIndicatorPath.path;
            } else {
                const firstEntry = this._connectedAirpods.entries().next().value;
                [path] = firstEntry;
            }
        }
        const model = this._connectedAirpods.get(path).model;
        this._currentIndicatorPath = {path, model};
        if (!this._multipleInfo || this._multipleInfo !== model.multipleInfo) {
            this._multipleInfo = model.multipleInfo;
            if (this._multipleInfo) {
                this._indicatorBox.remove_all_children();
                this._multipleBattInfo();
            } else {
                this._indicatorBox.remove_all_children();
                this._singleBattInfo();
            }
        }
        this._updateIndicatorValues();
    }

    _updateIndicatorValues() {
        const airpod = this._airpods.find(item => item.path === this._currentIndicatorPath.path);
        const gIcon = `${this._extensionObj.path}/icons/hicolor/scalable/actions/abm-model-${this._currentIndicatorPath.model.icon}-symbolic.svg`;
        if (this._currentIndicatorPath.model.multipleInfo) {
            this._mulitpleIcon.gicon = Gio.icon_new_for_string(gIcon);
            if (airpod.data.leftLevel !== -2)
                this._leftAirpodLabel.text = airpod.data.leftLevel === -1 ? '...' : `${airpod.data.leftLevel}%`;
            if (airpod.data.rightLevel !== -2)
                this._rightAirpodLabel.text =  airpod.data.rightLevel === -1 ? '...' : `${airpod.data.rightLevel}%`;
        } else {
            this._singleIcon.gicon = Gio.icon_new_for_string(gIcon);
            if (airpod.data.singleLevel !== -2)
                this._singleLabel.text =  airpod.data.singleLevel === -1 ? '...' : `${airpod.data.singleLevel}%`;
        }
    }

    updateDevices(airpods) {
        this._airpods = airpods;
        this._airpodLength = airpods.length;
        if (this._connectedAirpods.size > this._airpodLength) {
            for (const [path] of this._connectedAirpods) {
                if (!airpods.some(dev => dev.path === path)) {
                    this._connectedAirpods.get(path)?.item.destroy();
                    this._connectedAirpods.get(path)?.seperator.destroy();
                    this._connectedAirpods.delete(path);
                }
            }
        }
        for (const airpod of airpods) {
            const path = airpod.path;
            if (this._connectedAirpods.has(path)) {
                this._connectedAirpods.get(path)?.item.updateInfo(airpod.data);
                continue;
            }
            const model = ModelList.find(item => item.key === airpod.model);
            const item =  new DeviceItem(this, path, model, airpod.data);
            const seperator = new PopupMenu.PopupSeparatorMenuItem();
            this.menu.addMenuItem(item);
            this.menu.addMenuItem(seperator);
            this._connectedAirpods.set(path, {item, seperator, model});
        }
        this._updateIndicator(this._settings.get_string('default-selected-path'));
    }

    removeItems() {
        this._connectedAirpods.forEach(airpod => {
            airpod?.item.destroy();
            airpod?.seperator.destroy();
        });
        this._connectedAirpods.clear();
    }
});

const DeviceItem = GObject.registerClass({
}, class DeviceItem extends PopupMenu.PopupBaseMenuItem {
    constructor(airpodPanel, path, model, data) {
        super();
        this._airpodPanel = airpodPanel;
        this._settings = airpodPanel._settings;
        this._extensionObj = airpodPanel._extensionObj;
        this._path = path;
        this._multipleInfo = model.multipleInfo;
        this._levelNotUpdated = true;
        this.add_style_class_name('abm-panel-popup-menu');
        this._theme = St.ThemeContext.get_for_stage(global.stage);
        const scaleFactor = this._theme.scaleFactor * 16;
        const batteryIconSize = scaleFactor * 2;

        const vbox = new St.BoxLayout({vertical: true, x_expand: true});
        this.add_child(vbox);
        const titleHbox = new St.BoxLayout({x_expand: true});
        vbox.add_child(titleHbox);

        const modelLabel = new St.Label({style_class: 'abm-panel-label-model'});
        modelLabel.text = model.text;
        titleHbox.add_child(modelLabel);
        this._checkBox = new St.Icon({style_class: 'abm-panel-icon-check', icon_name: 'ornament-check-symbolic', icon_size: 16});
        titleHbox.add_child(this._checkBox);

        const infoHbox = new St.BoxLayout({style_class: 'abm-panel-hbox', x_expand: true});
        vbox.add_child(infoHbox);

        this._timeLabel = new St.Label({style_class: 'abm-panel-time-label'});
        this._spinner = new Spinner(16, {hideOnStop: true});
        this._spinner.add_style_class_name('spinner');
        const timeBox = new St.BoxLayout();
        timeBox.add_child(this._timeLabel);
        timeBox.add_child(this._spinner);
        vbox.add_child(timeBox);

        const modelIcon = new St.Icon({
            style_class: 'abm-panel-icon',
            icon_size: 56,
            y_expand: true,
        });
        infoHbox.add_child(modelIcon);
        modelIcon.gicon = this._getIcon(`abm-art-${model.icon}.png`);
        const batteryBox =  new St.BoxLayout({x_expand: true});
        infoHbox.add_child(batteryBox);
        const startBin = new St.Bin({style_class: 'abm-panel-start-bin'});
        batteryBox.add_child(startBin);

        if (this._multipleInfo) {
            const leftBox =  new St.BoxLayout({x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.CENTER});
            const leftBin = new St.Bin({style_class: 'abm-panel-space-bin'});
            const rightBox =  new St.BoxLayout({x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.CENTER});
            const rightBin = new St.Bin({style_class: 'abm-panel-space-bin'});
            const caseBox =  new St.BoxLayout({x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.CENTER});
            batteryBox.add_child(leftBox);
            batteryBox.add_child(leftBin);
            batteryBox.add_child(rightBox);
            batteryBox.add_child(rightBin);
            batteryBox.add_child(caseBox);

            const leftBatteryBox =  new St.BoxLayout({vertical: true});
            const rightBatteryBox =  new St.BoxLayout({vertical: true});
            const caseBatteryBox =  new St.BoxLayout({vertical: true});
            leftBox.add_child(leftBatteryBox);
            rightBox.add_child(rightBatteryBox);
            caseBox.add_child(caseBatteryBox);

            const leftModelVectorPathName = `${model.icon}-left`;
            this._leftBatteryIcon = new BatteryIcon(batteryIconSize, leftModelVectorPathName, {style_class: ''});
            this._leftPercentageLabel = new St.Label({style_class: 'abm-panel-battery-label', y_align: Clutter.ActorAlign.CENTER});
            leftBatteryBox.add_child(this._leftBatteryIcon);
            leftBatteryBox.add_child(this._leftPercentageLabel);
            this._leftBatteryIcon.updateValues(0, false);

            const rightModelVectorPathName = `${model.icon}-right`;
            this._rightBatteryIcon = new BatteryIcon(batteryIconSize, rightModelVectorPathName, {style_class: ''});
            this._rightPercentageLabel = new St.Label({style_class: 'abm-panel-battery-label', y_align: Clutter.ActorAlign.CENTER});
            rightBatteryBox.add_child(this._rightBatteryIcon);
            rightBatteryBox.add_child(this._rightPercentageLabel);
            this._rightBatteryIcon.updateValues(0, false);

            const caseModelVectorPathName = `${model.icon}-case`;
            this._caseBatteryIcon = new BatteryIcon(batteryIconSize, caseModelVectorPathName, {style_class: ''});
            this._casePercentageLabel = new St.Label({style_class: 'abm-panel-battery-label', y_align: Clutter.ActorAlign.CENTER});
            caseBatteryBox.add_child(this._caseBatteryIcon);
            caseBatteryBox.add_child(this._casePercentageLabel);
            this._caseBatteryIcon.updateValues(0, false);
        } else {
            const singleBox =  new St.BoxLayout({x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.CENTER});
            batteryBox.add_child(singleBox);

            const singleBatteryBox =  new St.BoxLayout({vertical: true});
            singleBox.add_child(singleBatteryBox);

            const singleModelVectorPathName = `${model.icon}-single`;
            this._singleBatteryIcon = new BatteryIcon(batteryIconSize, singleModelVectorPathName, {style_class: ''});
            this._singlePercentageLabel = new St.Label({style_class: 'abm-panel-battery-label', y_align: Clutter.ActorAlign.CENTER});
            singleBatteryBox.add_child(this._singleBatteryIcon);
            singleBatteryBox.add_child(this._singlePercentageLabel);
            this._singleBatteryIcon.updateValues(0, false);
        }

        this._timeLabel.text = _('Scanning...');
        this._airpodPanel.connectObject('menu-opened', (o, isOpen) => {
            if (isOpen)
                this._spinner.play();
            else
                this._spinner.stop();
        }, this);

        this.updateInfo(data);

        this.connectObject('activate', () => {
            if (this._airpodPanel._airpodLength > 1)
                this._settings.set_string('default-selected-path', path);
        }, this);
    }

    _getIcon(icon) {
        return Gio.icon_new_for_string(
            `${this._extensionObj.path}/icons/hicolor/scalable/actions/${icon}`);
    }

    updateInfo(data) {
        if (this._airpodPanel._airpodLength > 1)
            this._checkBox.visible = this._path === this._settings.get_string('default-selected-path');
        else
            this._checkBox.visible = false;

        if (this._multipleInfo) {
            if (data.leftLevel !== -2) {
                this._leftBatteryIcon.updateValues(data.leftLevel, data.leftStatus);
                this._leftPercentageLabel.text = data.leftLevel === -1 ? '' : `${data.leftLevel}%`;
            }
            if (data.rightLevel !== -2) {
                this._rightBatteryIcon.updateValues(data.rightLevel, data.rightStatus);
                this._rightPercentageLabel.text = data.rightLevel === -1 ? '' : `${data.rightLevel}%`;
            }
            if (data.caseLevel !== -2) {
                this._caseBatteryIcon.updateValues(data.caseLevel, data.caseStatus);
                this._casePercentageLabel.text = `${data.caseLevel}%`;
                this._caseBatteryIcon.visible = data.caseLevel !== -1;
                this._casePercentageLabel.visible = data.caseLevel !== -1;
            }
        } else if (data.singleLevel !== -2) {
            this._singleBatteryIcon.updateValues(data.singleLevel, data.singleStatus);
            this._singlePercentageLabel.text = data.singleLevel === -1 ? '' : `${data.singleLevel}%`;
        }

        if (data.updatedTime !== -2) {
            if (this._levelNotUpdated) {
                this._airpodPanel.disconnectObject(this);
                this._spinner.stop();
            }
            this._levelNotUpdated = false;
            const lastUpdateString = _('Last updated: ');
            this._timeLabel.text = `${lastUpdateString} ${data.updatedDate} ${data.updatedTime}`;
        }
    }
});
