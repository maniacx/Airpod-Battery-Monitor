'use strict';
const {Gio} = imports.gi;

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
var BluezAdapterProxy = Gio.DBusProxy.makeProxyWrapper(BluezAdapterInterface);


const BluezDeviceInterface = `
<node>
  <interface name="org.bluez.Device1">
    <property name="UUIDs" type="as" access="read"/>
  </interface>
</node>`;

var BluezDeviceProxy = Gio.DBusProxy.makeProxyWrapper(BluezDeviceInterface);

const BluezObjectInterface = `
<node>
  <interface name='org.freedesktop.DBus.ObjectManager'>
    <method name='GetManagedObjects'>
      <arg type='a{oa{sa{sv}}}' name='objects' direction='out'/>
    </method>
  </interface>
</node>`;
var BluezObjectProxy = Gio.DBusProxy.makeProxyWrapper(BluezObjectInterface);

