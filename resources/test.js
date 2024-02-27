const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
// Credits: to https://github.com/Toxblh for provide airpod detection code..
// https://github.com/delphiki/AirStatus/blob/master/main.py
// https://github.com/adolfintel/OpenPods/blob/master/app%2Fsrc%2Fmain%2Fjava%2Fcom%2Fdosse%2Fairpods%2Fpods%2FPodsStatus.java

/*
 * Description from OpenPods
 *
 * Decoding the beacon:
 * This was done through reverse engineering. Hopefully it's correct.
 * - The beacon coming from a pair of AirPods/Beats contains a manufacturer specific data field n°76 of 27 bytes
 * - We convert this data to a hexadecimal string
 * - The 12th and 13th characters in the string represent the charge of the left and right pods.
 * Under unknown circumstances[1], they are right and left instead (see isFlipped). Values between 0 and 10 are battery 0-100%; Value 15 means it's disconnected
 * - The 15th character in the string represents the charge of the case. Values between 0 and 10 are battery 0-100%; Value 15 means it's disconnected
 * - The 14th character in the string represents the "in charge" status.
 * Bit 0 (LSB) is the left pod; Bit 1 is the right pod; Bit 2 is the case. Bit 3 might be case open/closed but I'm not sure and it's not used
 * - The 11th character in the string represents the in-ear detection status. Bit 1 is the left pod; Bit 3 is the right pod.
 * - The 7th character in the string represents the model
 *
 * Notes:
 * 1) - isFlipped set by bit 1 of 10th character in the string; seems to be related to in-ear detection;
 */


const BluezAdapterInterface = `
<node>
  <interface name="org.bluez.Adapter1">
    <method name="StartDiscovery"></method>
    <method name="SetDiscoveryFilter">
      <arg name="properties" type="a{sv}" direction="in"/>
    </method>
    <method name="StopDiscovery"></method>
  </interface>
</node>`;
const AdapterProxy = Gio.DBusProxy.makeProxyWrapper(BluezAdapterInterface);

const BluezObjectInterface = `
<node>
  <interface name='org.freedesktop.DBus.ObjectManager'>
    <method name='GetManagedObjects'>
      <arg type='a{oa{sa{sv}}}' name='objects' direction='out'/>
    </method>
  </interface>
</node>`;
const BluezObjectProxy = Gio.DBusProxy.makeProxyWrapper(BluezObjectInterface);
const adapter = new AdapterProxy(Gio.DBus.system, 'org.bluez', '/org/bluez/hci0');

const MIN_RSSI = -70;
const MANUFACTURER_ID = '76';
const MANUFACTURER_DATA_LENGTH = 27;


// correctLevel function:
function correctLevel(value) {
    if (value === 15)
        return -1;
    else if (value === 0)
        return 5;
    else
        return value > 9 ? 100 : value * 10;
}

function formatManufacturerData(bytes, rssi) {
    try {
        let data = '';
        for (let i = 0; i < bytes.length; i++)
            data += `0${(bytes[i] & 0xFF).toString(16)}`.slice(-2);

        // Level
        const flip = parseInt(`${data.charAt(10)}`, 16) & 0x02 == 0;
        const leftLevel = correctLevel(parseInt(`${data.charAt(flip ? 12 : 13)}`, 16));
        const rightLevel = correctLevel(parseInt(`${data.charAt(flip ? 13 : 12)}`, 16));
        const caseLevel = correctLevel(parseInt(`${data.charAt(15)}`, 16));
        const singleLevel = correctLevel(parseInt(`${data.charAt(13)}`, 16));

        // Charging Status
        const chargeStatus = parseInt(`${data.charAt(14)}`, 16);
        const leftStatus = (chargeStatus & (flip ? 0b00000010 : 0b00000001)) !== 0;
        const rightStatus = (chargeStatus & (flip ? 0b00000001 : 0b00000010)) !== 0;
        const caseStatus = (chargeStatus & 0b00000100) !== 0;
        const singleStatus = (chargeStatus & 0b00000001) !== 0;

        log('------------------------------------------');
        log(`ManufacturerData                   : ${data}`);
        log(`Rssi                               : ${rssi}`);
        log(`Model 4 Character                  : ${data.substring(6, 10)}`);
        log(`Model 1 Character                  : ${data.charAt(7)}`);
        log(`Left Battery Level                 : ${leftLevel}`);
        log(`Right Battery Level                : ${rightLevel}`);
        log(`Case Battery Level                 : ${caseLevel}`);
        log(`Single Battery Level               : ${singleLevel}`);
        log(`Left Battery Charging Status       : ${leftStatus}`);
        log(`Right Battery Charging Status      : ${rightStatus}`);
        log(`Case Battery Charging Status       : ${caseStatus}`);
        log(`Single Battery Charging Status     : ${singleStatus}`);
        log('------------------------------------------');
    } catch (e) {
        log(e);
    }
}

function listBluetoothDevices() {
    try {
        const bus = Gio.DBus.system;
        const bluezObjectManager = BluezObjectProxy(bus, 'org.bluez', '/');
        bluezObjectManager.GetManagedObjectsRemote((result, error) => {
            if (error) {
                log(`Error retrieving list of devices: ${error.message}`);
                return;
            }
            let foundDevices = false;
            const [objects] = result;
            if (objects) {
                log('Scanning Bluetooth devices...');

                for (const path in objects) {
                    const interfaces = objects[path];
                    for (const iface in interfaces) {
                        if (iface.endsWith('Device1')) {
                            const properties = interfaces[iface];
                            const rssi = properties.RSSI?.deep_unpack();
                            const manufacturerData = properties['ManufacturerData'];
                            if (rssi && rssi >= MIN_RSSI && manufacturerData &&
                            (MANUFACTURER_ID in manufacturerData.deep_unpack())) {
                                const rawData = manufacturerData.deep_unpack()[MANUFACTURER_ID].deep_unpack();
                                if (rawData && rawData.length === MANUFACTURER_DATA_LENGTH && rawData[0] === 0x11) {
                                    foundDevices = true;
                                    formatManufacturerData(rawData, rssi);
                                }
                            }
                        }
                    }
                }
            }
            if (!foundDevices)
                log('No information about objects was obtained.');
        });
    } catch (e) {
        log(e);
    }
}

async function startDiscovery() {
    try {
        const filters = {
            Transport: GLib.Variant.new_string('le'),
            RSSI: GLib.Variant.new_int16(MIN_RSSI),
        };
        await adapter.SetDiscoveryFilterRemote(filters);
        log('StartDiscoveryAsync');
        await adapter.StartDiscoveryAsync();
    } catch {
        log('StartDiscoveryAsync failed ');
    }
}

async function stopDiscovery() {
    try {
        log('StopDiscoveryAsync');
        await adapter.StopDiscoveryAsync();
    } catch {
        log('StopDiscoveryAsync failed');
    }
}

function startMonitoring() {
    startDiscovery();
    let counter = 0;
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
        if (counter === 1)
            listBluetoothDevices();
        if (counter === 2)
            stopDiscovery();
        if (counter === 4)
            startDiscovery();
        counter = counter > 4 ? 0 : counter + 1;
        return GLib.SOURCE_CONTINUE;
    });
}
startMonitoring();

GLib.MainLoop.new(null, false).run();
