'use strict';
const {Adw, GLib, Gtk, GObject} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const gettextDomain = Me.metadata['gettext-domain'];
const Gettext = imports.gettext.domain(gettextDomain);
const _ = Gettext.gettext;

const {ModelList} = Me.imports.lib.devices;

const  DeviceItem = GObject.registerClass({
}, class DeviceItem extends Adw.ActionRow {
    constructor(settings, deviceItem, path, alias, model, connected, paired) {
        super({});
        this._macAddesss = this._pathToMacAddress(path);


        const list = new Gtk.StringList();
        for (const airpod of ModelList)
            list.append(airpod.text);

        const airpodModelDropDown = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: list,
        });

        const currentModelIndex = ModelList.findIndex(item => item.key === model);
        airpodModelDropDown.set_selected(currentModelIndex);

        airpodModelDropDown.connect('notify::selected', () => {
            const selectedModel = ModelList[airpodModelDropDown.get_selected()].key;
            const pairedAirpods = settings.get_strv('airpods-list');
            const existingPathIndex = pairedAirpods.findIndex(item => JSON.parse(item).path === path);
            const existingItem = JSON.parse(pairedAirpods[existingPathIndex]);
            existingItem.model = selectedModel;
            pairedAirpods[existingPathIndex] = JSON.stringify(existingItem);
            settings.set_strv('airpods-list', pairedAirpods);
        });

        this._deleteButton = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            tooltip_text: 'Delete Device',
            css_classes: ['destructive-action'],
            valign: Gtk.Align.CENTER,
        });

        this._deleteButton.connect('clicked', () => {
            const pairedAirpods = settings.get_strv('airpods-list');
            const existingPathIndex = pairedAirpods.findIndex(entry => {
                const parsedEntry = JSON.parse(entry);
                return parsedEntry.path === path;
            });

            if (existingPathIndex !== -1) {
                pairedAirpods.splice(existingPathIndex, 1);
                settings.set_strv('airpods-list', pairedAirpods);
            }
            this.get_parent().remove(this);
            deviceItem.delete(path);
        });

        const box = new Gtk.Box({spacing: 16});
        box.append(airpodModelDropDown);
        box.append(this._deleteButton);

        this.add_suffix(box);
        this.updateProperites(alias, connected, paired);
    }

    updateProperites(alias, connected, paired) {
        const pairedLabel = _('(Paired)');
        const connectedLabel = _('(Connected)');
        const label = paired ? `${this._macAddesss} ${pairedLabel}` : this._macAddesss;
        this.subtitle = connected ? `${this._macAddesss} ${connectedLabel}` : label;
        this.title = alias;
        this._deleteButton.sensitive = !paired;
    }

    _pathToMacAddress(path) {
        const indexMacAddess = path.indexOf('dev_') + 4;
        const macAddress = path.substring(indexMacAddess);
        return macAddress.replace(/_/g, ':');
    }
});

var General = GObject.registerClass({
    GTypeName: 'ABM_General',
    Template: `file://${GLib.build_filenamev([Me.path, 'ui', 'general.ui'])}`,
    InternalChildren: [
        'gui_interface',
        'model_group',
        'no_paired_row',
    ],
}, class General extends Adw.PreferencesPage {
    constructor(settings) {
        super({});
        this._settings = settings;
        this._deviceItems = new Map();
        this._createDevices();
        const guiInterface = this._settings.get_boolean('gui-interface') ? 1 : 0;
        this._gui_interface.set_selected(guiInterface);
        this._settings.connect('changed::airpods-list', () => this._createDevices());
        this._gui_interface.connect('notify::selected', item => {
            this._settings.set_boolean('gui-interface', item.selected === 1);
        });
    }

    _createDevices() {
        const pathsString = this._settings.get_strv('airpods-list').map(JSON.parse);
        if (!pathsString || pathsString.length === 0) {
            this._no_paired_row.visible  = true;
            return;
        }
        this._no_paired_row.visible  = false;
        for (const pathInfo of pathsString) {
            const {path, alias, model, connected, paired} = pathInfo;
            if (this._deviceItems.has(path)) {
                const row = this._deviceItems.get(path);
                row.updateProperites(alias, connected, paired);
            } else {
                const deviceItem = new DeviceItem(this._settings, this._deviceItems, path, alias, model, connected, paired);
                this._deviceItems.set(path, deviceItem);
                this._model_group.add(deviceItem);
            }
        }
    }
});





