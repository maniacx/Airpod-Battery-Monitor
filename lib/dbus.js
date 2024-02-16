'use strict';
import Gio from 'gi://Gio';

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
export const BluezAdapterProxy = Gio.DBusProxy.makeProxyWrapper(BluezAdapterInterface);


const BluezDeviceInterface = `
<node>
  <interface name="org.bluez.Device1">
    <property name="UUIDs" type="as" access="read"/>
  </interface>
</node>`;

export const BluezDeviceProxy = Gio.DBusProxy.makeProxyWrapper(BluezDeviceInterface);

const BluezObjectInterface = `
<node>
  <interface name='org.freedesktop.DBus.ObjectManager'>
    <method name='GetManagedObjects'>
      <arg type='a{oa{sa{sv}}}' name='objects' direction='out'/>
    </method>
  </interface>
</node>`;
export const BluezObjectProxy = Gio.DBusProxy.makeProxyWrapper(BluezObjectInterface);

