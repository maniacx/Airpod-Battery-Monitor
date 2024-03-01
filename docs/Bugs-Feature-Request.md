---
layout: default
title: Bugs / Feature Request
nav_order: 3
permalink: /bugs-feature-request
---

# Bugs and Debugging

Encountering issues with this extension? Please follow the steps below for troubleshooting and reporting:

1. Check if there are any other Gnome extension installed and enabled that might conflict with this extension.
2. Reset the `gsettings` for this extension. First, disable the extension using the `Extensions` or `Extension Manager` app. To reset `gsettings` for the Airpod Battery Monitor extension, use the command below in the `terminal`:
```bash
gsettings --schemadir /home/$USER/.local/share/gnome-shell/extensions/Airpod-Battery-Monitor@maniacx.github.com/schemas reset-recursively org.gnome.shell.extensions.Airpod-Battery-Monitor
```
3. If the issue still persists, [Raise an issue on Github](https://github.com/maniacx/Airpod-Battery-Monitor/issues){: .btn .btn-purple .v-align-bottom .fs-2}.
4. When reporting the issue, include the following details:
   * Gnome Version (found in the `about` section of your desktop settings (Gnome Control Center))
   * Operating system (e.g., Ubuntu 23.10)
   * Bluetooth device make, model and type

# Script for getting Manufacturer Data
This script can be helpful to get raw data in case you AirPods/Beats model is not detecting or is different model that is not yet supported by this extension. The script starts discovery and prints manufacturer data and other details of all AirPods found nearby.
* Download the [test.js](./resources/test.js){:download="test.js"}
* Disable Airpod-Battery-Monitor extension and close the Gnome Settings App > Bluetooth if opened. 
* Open terminal and type.
```
gjs-console /path/to/your/test.js
```
* Post output data along with OS name and Gnome shell version.


# General Extension Debugging.

Although there are no logs included in this extension, you can still monitor for any errors in the log by using the following commands in the `terminal`:

For Gnome Shell - logs related to the extension:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

For GJS - logs related to extension preferences:
```bash
journalctl -f -o cat /usr/bin/gjs
```

### Command Line Tips
```
#List UUID of all extensions installed
gnome-extensions list

#Enable extension using UUID
gnome-extensions enable Airpod-Battery-Monitor@maniacx.github.com

# Open extension prefs using UUID
gnome-extensions prefs Airpod-Battery-Monitor@maniacx.github.com

#Disable extension using UUID
gnome-extensions disable Airpod-Battery-Monitor@maniacx.github.com

#Disable all extensions
gsettings set org.gnome.shell disable-user-extensions true

#Enable all extensions
gsettings set org.gnome.shell disable-user-extensions false

# Kill gnome-shell
killall -3 gnome-shell

# Force shutdown
sudo reboot -f
```
This can be helpful if gnome shell freezes (GUI stops). You can always move to terminal session using keys `CTRL+ALT+F3`, login, disable extension (if you know extension causing the problem) or disable all extension, kill gnome shell. Use `CTRL+ALT+F1` to login to display session.

# Feature Request

If still need to request a new feature [Raise an issue on Github](https://github.com/maniacx/Airpod-Battery-Monitor/issues){: .btn .btn-purple .v-align-bottom .fs-2}.


