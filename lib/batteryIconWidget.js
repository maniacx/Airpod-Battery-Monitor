'use strict';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import {VectorImages} from './vectorImages.js';

const [major] = Config.PACKAGE_VERSION.split('.');
const shellVersion45 = Number.parseInt(major) < 46;

// Credits: to https://github.com/Deminder for this https://github.com/Deminder/battery-indicator-icon/blob/main/src/modules/drawicon.js

function addVectorImage(cr, path)  {
    cr.translate(0, 0);
    const vectorPath = path.split(' ');
    for (let i = 0; i < vectorPath.length; i++) {
        if (vectorPath[i] === 'M') {
            cr.moveTo(...vectorPath.slice(i + 1, i + 3));
            i += 2;
        } else if (vectorPath[i] === 'L') {
            cr.lineTo(...vectorPath.slice(i + 1, i + 3));
            i += 2;
        } else if (vectorPath[i] === 'C') {
            cr.curveTo(...vectorPath.slice(i + 1, i + 7));
            i += 2;
        } else if (vectorPath[i] === 'Z') {
            cr.closePath();
        }
    }
}

export const BatteryIcon = GObject.registerClass(
class BatteryIcon extends St.DrawingArea {
    _init(modelIconSize, modelPathName, {style_class}) {
        super._init({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style_class,
        });
        this.width = modelIconSize;
        this.height = modelIconSize;
        this._modelPathName = modelPathName;
    }

    updateValues(percentage, charging) {
        this._charging = charging;
        this._percentage = percentage;
        this.queue_repaint();
    }

    _circle(cr, style) {
        const {w, h, p, foregroundColor, chargingColor, disconnectedColor, strokeWidth} = style;
        const size = h;
        const radius = (size - strokeWidth) / 2;
        const [cw, ch] = [w / 2, h / 2];
        const bColor = foregroundColor.copy();
        bColor.alpha *= 0.3;

        cr.save();
        this._setSourceColor(cr, bColor);
        cr.setLineWidth(strokeWidth);
        cr.translate(cw, ch);
        cr.scale(w / size, h / size);
        cr.arc(0, 0, radius, 0, 2 * Math.PI);
        cr.stroke();

        this._setSourceColor(cr, chargingColor);
        const angleOffset = -0.5 * Math.PI;
        cr.arc(0, 0, radius, angleOffset, angleOffset + p * 2 * Math.PI);
        cr.stroke();
        cr.restore();

        const sw = (w / 1000) * 3.75; // Dont know why is this 3.75, Got it by trial and error, need to figure out what the actual calculation is and why it is not target width / original width
        const sh = (h / 1000) * 3.75; // Dont know why is this 3.75, Got it by trial and error, need to figure out what the actual calculation is and why it is not target width / original width
        cr.scale(sw, sh);

        const modelPath = VectorImages[this._modelPathName];
        const chargingPath = VectorImages['charging-bolt'];
        const disconnectedPath = VectorImages['disconnected'];

        this._setSourceColor(cr, foregroundColor);
        addVectorImage(cr, modelPath);

        if (this._percentage === -1) {
            this._setSourceColor(cr, disconnectedColor);
            addVectorImage(cr, disconnectedPath);
        } else if (this._charging) {
            this._setSourceColor(cr, foregroundColor);
            addVectorImage(cr, chargingPath);
        }
        cr.fill();
    }

    _setSourceColor(cr, color) {
        if (shellVersion45)
            Clutter.cairo_set_source_color(cr, color);
        else
            cr.setSourceColor(color);
    }

    get iconColors() {
        return this.get_theme_node().get_icon_colors();
    }

    vfunc_repaint() {
        const iconColors = this.iconColors;
        const foregroundColor = iconColors.foreground;
        const chargingColor = this._percentage > 10 || this._charging ? iconColors.success : iconColors.warning;
        const disconnectedColor = iconColors.error;
        const cr = this.get_context();
        const [w, h] = this.get_surface_size();
        const one = h / 16;
        const strokeWidth = 1.8 * one;
        const p = this._percentage <= 0 ? 0 : this._percentage / 100;
        const style = {w, h, p, foregroundColor, chargingColor, disconnectedColor, strokeWidth};
        this._circle(cr, style);
        cr.$dispose();
    }
}
);


