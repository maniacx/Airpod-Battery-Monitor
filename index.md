---
title: Home
layout: default
nav_order: 1
description: "Airpod Battery Monitor"
permalink: /
---
# Airpod Battery Monitor
[<img src="./assets/images/home/get-it-on-gnome-extension.png" width="45%">](https://extensions.gnome.org/extension/6670/airpod-battery-monitor/)
[<img src="./assets/images/home/view-sources-on-github.png" width="45%" class="float-right">](https://github.com/maniacx/Airpod-Battery-Monitor)

{: .important-title }
> Currently supported on Gnome Versions:
> 
> `43, 44, 45`

**Airpod Battery Monitor is a Gnome Extension to report Airpod/Beats headphone battery level, using indicator icons as battery meter in system tray and message tray, or using Panel button with PopupMenus**
<br>
<br>

<img src="./assets/images/home/main.png" width="100%">

---

# Feature

* Display Battery information status for Airpods and Beats headphone
* Option to choose user interface. Panel labels with popupmenu and Meter Indicator Icon with information on Message tray.

---

# How does it work

* Airpods do not provide battery information through Bluetooth Battery Service (BAS) like other Bluetooth headsets/devices.
* Instead, Airpods utilize BLE advertising packets containing Battery Information and model.
* To address privacy concerns, the BLE MAC address of Airpods is randomized every 15 minutes.
* This randomization makes it challenging to identify whether the broadcasting Airpod is the one connected to the device or a different Airpod nearby.
* The extension functions by searching for all nearby broadcasting Airpods, filtering them based on the matching model, and selecting the one with the strongest signal.
* Finally, the extension displays the Battery information of the chosen Airpod.

<br>

{: .note }
>
> * If there are two Airpods of the same model, the extension will choose the one with the strongest signal. Therefore, there is no guarantee which Airpod will be displayed if they report the same signal strength.
> * Scanning and discovering Airpods takes time, so the extension may take up to a minute to display battery information.
> * In Gnome, when the screen is locked, extensions are disabled. When the screen is unlocked, the extension is enabled. Therefore, do not expect the Airpod battery information to be displayed instantaneously during screen lock.

---

# How to use
* Enable the extension in your system settings.
* Once Airpods are connected to your system, they will be listed in the extension preferences.
* Choose the specific Airpod model in the preferences, and the extension will commence scanning for the BLE beacon advertising that model.
* The extension will then display the battery information of the Airpod with the strongest Bluetooth signal.


