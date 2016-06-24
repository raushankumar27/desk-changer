/**
 * Copyright (c) 2014-2015 Eric Gach <eric@php-oop.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const debug = Me.imports.utils.debug;

const DeskChangerDaemonInterface = '<node>\
    <interface name="org.gnome.Shell.Extensions.DeskChanger.Daemon">\
        <method name="LoadProfile">\
            <arg direction="in" name="profile" type="s" />\
        </method>\
        <method name="Next">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Prev">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Quit"></method>\
        <signal name="preview">\
            <arg direction="out" name="uri" type="s" />\
        </signal>\
        <property type="s" name="UpNext" access="read" />\
    </interface>\
</node>';
const DeskChangerDaemonProxy = Gio.DBusProxy.makeProxyWrapper(DeskChangerDaemonInterface);

const DBusInterface = '<node>\
  <interface name="org.freedesktop.DBus">\
    <method name="ListNames">\
      <arg direction="out" type="as"/>\
    </method>\
    <signal name="NameOwnerChanged">\
      <arg type="s"/>\
      <arg type="s"/>\
      <arg type="s"/>\
    </signal>\
  </interface>\
</node>';
const DBusProxy = Gio.DBusProxy.makeProxyWrapper(DBusInterface);

const DeskChangerDaemon = new Lang.Class({
    Name: 'DeskChangerDaemon',

    _init: function () {
        this.bus = new DeskChangerDaemonProxy(Gio.DBus.session, 'org.gnome.Shell.Extensions.DeskChanger.Daemon', '/org/gnome/Shell/Extensions/DeskChanger/Daemon');
        this._bus = new DBusProxy(Gio.DBus.session, 'org.freedesktop.DBus', '/org/freedesktop/DBus');
        this._owner_changed_id = this._bus.connectSignal('NameOwnerChanged', Lang.bind(this, function (emitter, signalName, params) {
            if (params[0] == "org.gnome.Shell.Extensions.DeskChanger.Daemon") {
                if (params[1] != "" && params[2] == "") {
                    this._off();
                }
                if (params[1] == "" && params[2] != "") {
                    this._on();
                }
            }
        }));
        this._bus.ListNamesRemote(Lang.bind(this, function (result, error) {
            result = String(result).split(',');
            for (let item in result) {
                if (result[item] == "org.gnome.Shell.Extensions.DeskChanger.Daemon") {
                    this._on();
                }
            }
        }));
        this._is_running = false;
        this._path = Me.dir.get_path();
    },

    destroy: function () {
        this._bus.disconnectSignal(this._owner_changed_id);
    },

    toggle: function () {
        if (this._is_running) {
            debug('stopping daeomn');
            this.bus.QuitSync();
        } else {
            debug('starting daemon');
            GLib.spawn_async(this._path, [this._path + '/desk-changer-daemon'], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
        }
    },

    _off: function () {
        this._is_running = false;
        debug('emit(\'toggled\', false)');
        this.emit('toggled', false);
    },

    _on: function () {
        debug('the desk-changer daemon is running');
        this._is_running = true;
        debug('emit(\'toggled\', true)');
        this.emit('toggled', true);
    },

    get is_running() {
        return this._is_running;
    }
});

Signals.addSignalMethods(DeskChangerDaemon.prototype);