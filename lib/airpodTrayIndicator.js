'use strict';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageList from 'resource:///org/gnome/shell/ui/messageList.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {BatteryIcon} from './batteryIconWidget.js';
import {ModelList} from './devices.js';

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;

export const AirpodTrayIndicator = GObject.registerClass(
class AirpodTrayIndicator extends GObject.Object {
    constructor(settings, extensionObj, airpods) {
        super();
        this._mediaSection = Main.panel.statusArea.dateMenu._messageList._mediaSection;
        this._settings = settings;
        this._extensionObj = extensionObj;
        this._airpods = airpods;
        this._connectedAirpods = new Map();
        this._firstRun = true;

        this.updateDevices(airpods);
        this._settings.connectObject('changed::default-selected-path', () => {
            this.updateDevices(this._airpods);
        }, this);
    }

    updateDevices(airpods) {
        this._airpods = airpods;
        if (this._connectedAirpods.length > airpods) {
            for (const [path] of this._connectedAirpods) {
                if (!airpods.some(dev => dev.path === path)) {
                    this._connectedAirpods.get(path)?.indicator.destroy();
                    this._connectedAirpods.get(path)?.messageWidget.destroy();
                    this._connectedAirpods.delete(path);
                }
            }
        }
        for (const airpod of airpods) {
            const path = airpod.path;
            if (this._connectedAirpods.has(path)) {
                this._connectedAirpods.get(path)?.indicator.updateInfo(airpod.data);
                this._connectedAirpods.get(path)?.messageWidget.updateInfo(airpod.data);
                continue;
            }
            const model = ModelList.find(item => item.key === airpod.model);

            const indicator =  new AirpodIndicator(this._settings, this._extensionObj, path, model, airpod.data);
            QuickSettingsMenu.addExternalIndicator(indicator);
            const messageWidget = new AirpodMessage(this._settings, this._extensionObj, path, model, airpod.data);
            this._mediaSection.addMessage(messageWidget, true);
            this._connectedAirpods.set(path, {indicator, messageWidget, model});
        }
    }

    _removeItems() {
        this._connectedAirpods.forEach(airpod => {
            airpod?.indicator.destroy();
            this._mediaSection.removeMessage(airpod.messageWidget, true);
        });
        this._connectedAirpods.clear();
    }

    destroy() {
        this._removeItems();
    }
});

const AirpodIndicator = GObject.registerClass(
class AirpodIndicator extends QuickSettings.SystemIndicator {
    constructor(settings, extensionObj, path, model, data) {
        super();
        this._settings = settings;
        this._extensionObj = extensionObj;
        this._path = path;
        this._modelIcon = model.icon;
        this._multipleInfo = model.multipleInfo;
        this._indicator = this._addIndicator();
        this.updateInfo(data);
    }

    _getGicon(percent) {
        let iconPrefix = '';
        if (percent > 85)
            iconPrefix = '100';
        else if (percent <= 85 && percent > 60)
            iconPrefix = '75';
        else if (percent <= 60 && percent > 35)
            iconPrefix = '50';
        else if (percent <= 35 && percent > 20)
            iconPrefix = '25';
        else if (percent <= 20 && percent > 10)
            iconPrefix = '20';
        else if (percent <= 10 && percent >= 0)
            iconPrefix = '10';
        return Gio.icon_new_for_string(
            `${this._extensionObj.path}/icons/hicolor/scalable/actions/abm-${iconPrefix}-${this._modelIcon}-symbolic.svg`);
    }

    updateInfo(data) {
        let percent;
        if (this._multipleInfo) {
            if (data.leftLevel !== -2 && data.rightLevel !== -2) {
                percent = data.leftLevel < data.rightLevel ? data.leftLevel : data.rightLevel;
                this._indicator.gicon = this._getGicon(percent);
            }
        } else if (data.singleLevel !== -2) {
            percent = data.singleLevel;
            this._indicator.gicon = this._getGicon(percent);
        }
    }
});

const AirpodMessage = GObject.registerClass(
class AirpodMessage extends MessageList.Message {
    _init(settings, extensionObj, path, model, data) {
        super._init('', '');
        this._settings = settings;
        this._extensionObj = extensionObj;
        this._path = path;
        this._modelIcon = model.icon;
        this._multipleInfo = model.multipleInfo;
        this._theme = St.ThemeContext.get_for_stage(global.stage);
        const scaleFactor = this._theme.scaleFactor * 16;
        const modelIconSize =  scaleFactor * 4;
        const batteryIconSize = scaleFactor * 2;

        const modelIcon = new St.Icon({icon_size: modelIconSize});
        this.setIcon(modelIcon);
        modelIcon.gicon = this._getIcon(`abm-art-${model.icon}.png`);

        this._secondaryBin.hide();
        this._closeButton.hide();
        this._mediaControls.get_parent().get_children()[1].hide();
        this._mediaControls.x_expand = true;

        const box = new St.BoxLayout({style_class: 'abm-message-box',  x_expand: true, y_expand: true});
        this._mediaControls.add_child(box);
        const deviceInfoBox = new St.BoxLayout({vertical: true, x_expand: true});
        const timeDetailsBox =  new St.BoxLayout({vertical: true, y_expand: true});
        box.add_child(deviceInfoBox);
        box.add_child(timeDetailsBox);

        const topBox =  new St.BoxLayout({y_align: Clutter.ActorAlign.START, x_expand: true, y_expand: true});
        const bottomBox =  new St.BoxLayout({y_align: Clutter.ActorAlign.END, x_expand: true, y_expand: false});
        deviceInfoBox.add_child(topBox);
        deviceInfoBox.add_child(bottomBox);

        const modelLabel = new St.Label({style_class: 'abm-message-title', x_align: Clutter.ActorAlign.START});
        topBox.add_child(modelLabel);
        modelLabel.text = model.text;

        if (this._multipleInfo) {
            const leftBox =  new St.BoxLayout({x_align: Clutter.ActorAlign.START});
            const leftBin = new St.Bin({x_expand: true});
            const rightBox =  new St.BoxLayout({x_align: Clutter.ActorAlign.CENTER});
            const rightBin = new St.Bin({x_expand: true});
            const caseBox =  new St.BoxLayout({x_align: Clutter.ActorAlign.END});
            bottomBox.add_child(leftBox);
            bottomBox.add_child(leftBin);
            bottomBox.add_child(rightBox);
            bottomBox.add_child(rightBin);
            bottomBox.add_child(caseBox);

            const leftBatteryBox =  new St.BoxLayout();
            const rightBatteryBox =  new St.BoxLayout();
            const caseBatteryBox =  new St.BoxLayout();
            leftBox.add_child(leftBatteryBox);
            rightBox.add_child(rightBatteryBox);
            caseBox.add_child(caseBatteryBox);

            const leftModelVectorPathName = `${model.icon}-left`;
            this._leftBatteryIcon = new BatteryIcon(batteryIconSize, leftModelVectorPathName, {style_class: ''});
            this._leftPercentageLabel = new St.Label({style_class: 'abm-message-battery-label', y_align: Clutter.ActorAlign.CENTER});
            leftBatteryBox.add_child(this._leftBatteryIcon);
            leftBatteryBox.add_child(this._leftPercentageLabel);
            this._leftBatteryIcon.set(batteryIconSize, batteryIconSize);
            this._leftBatteryIcon.updateValues(0, false);

            const rightModelVectorPathName = `${model.icon}-right`;
            this._rightBatteryIcon = new BatteryIcon(batteryIconSize, rightModelVectorPathName, {style_class: ''});
            this._rightPercentageLabel = new St.Label({style_class: 'abm-message-battery-label', y_align: Clutter.ActorAlign.CENTER});
            rightBatteryBox.add_child(this._rightBatteryIcon);
            rightBatteryBox.add_child(this._rightPercentageLabel);
            this._rightBatteryIcon.set(batteryIconSize, batteryIconSize);
            this._rightBatteryIcon.updateValues(0, false);

            const caseModelVectorPathName = `${model.icon}-case`;
            this._caseBatteryIcon = new BatteryIcon(batteryIconSize, caseModelVectorPathName, {style_class: ''});
            this._casePercentageLabel = new St.Label({style_class: 'abm-message-battery-label', y_align: Clutter.ActorAlign.CENTER});
            caseBatteryBox.add_child(this._caseBatteryIcon);
            caseBatteryBox.add_child(this._casePercentageLabel);
            this._caseBatteryIcon.set(batteryIconSize, batteryIconSize);
            this._caseBatteryIcon.updateValues(0, false);
        } else {
            const singleBox =  new St.BoxLayout({x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.CENTER});
            bottomBox.add_child(singleBox);

            const singleBatteryBox =  new St.BoxLayout();
            singleBox.add_child(singleBatteryBox);

            const singleModelVectorPathName = `${model.icon}-single`;
            this._singleBatteryIcon = new BatteryIcon(batteryIconSize, singleModelVectorPathName, {style_class: ''});
            this._singlePercentageLabel = new St.Label({style_class: 'abm-message-battery-label', y_align: Clutter.ActorAlign.CENTER});
            singleBatteryBox.add_child(this._singleBatteryIcon);
            singleBatteryBox.add_child(this._singlePercentageLabel);
            this._singleBatteryIcon.set(batteryIconSize, batteryIconSize);
            this._singleBatteryIcon.updateValues(0, false);
        }

        const timeBin = new St.Bin({x_expand: true});
        bottomBox.add_child(timeBin);

        this._timeTitle = new St.Label({style_class: 'abm-message-time', x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.END});
        this._updatedDateLabel = new St.Label({style_class: 'abm-message-time', x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.END});
        this._updatedTimeLabel = new St.Label({style_class: 'abm-message-time', x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.END});
        timeDetailsBox.add_child(new St.Bin({y_expand: true}));
        timeDetailsBox.add_child(this._timeTitle);
        timeDetailsBox.add_child(this._updatedDateLabel);
        timeDetailsBox.add_child(this._updatedTimeLabel);

        this._timeTitle.text = _('Not detected');

        this.updateInfo(data);
    }

    _getIcon(icon) {
        return Gio.icon_new_for_string(
            `${this._extensionObj.path}/icons/hicolor/scalable/actions/${icon}`);
    }

    updateInfo(data) {
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
                this._casePercentageLabel.text = data.caseLevel === -1 ? '' : `${data.caseLevel}%`;
            }
        } else if (data.singleLevel !== -2) {
            this._singleBatteryIcon.updateValues(data.singleLevel, data.singleStatus);
            this._singlePercentageLabel.text = data.singleLevel === -1 ? '' : `${data.singleLevel}%`;
        }

        if (data.updatedTime !== -2) {
            this._timeTitle.text = _('Last updated: ');
            this._updatedDateLabel.text = data.updatedDate;
            this._updatedTimeLabel.text = data.updatedTime;
        }
    }
});
