'use strict';
/**
 * Replacement index.js (compatible with Homebridge v1.x and v2.x)
 * - Supports both v1 and v2 by using the passed-in API object which exposes .hap and .registerPlatform
 * - Uses api.hap.* within platform to access Units/Formats/Perms when needed
 *
 * NOTE: This is a conservative drop-in replacement. If your original plugin had device-specific
 * network code (HTTP/UDP), you should merge that logic into fetchStateFromHost/sendCommand below.
 */

const dgram = require('dgram');
const { EventEmitter } = require('events');

const PLUGIN_NAME = 'homebridge-daikin-airbase';
const PLATFORM_NAME = 'DaikinAirbase';

let Service, Characteristic; // will be set during registration

module.exports = (homebridgeApi) => {
  // homebridgeApi may be the Homebridge v1 "homebridge" object or the v2 "api" object.
  // Both provide `hap` and `registerPlatform`, so this approach works for both versions.
  if (!homebridgeApi) {
    throw new Error('Homebridge API object not provided to plugin.');
  }

  Service = homebridgeApi.hap.Service;
  Characteristic = homebridgeApi.hap.Characteristic;

  // registerPlatform: (pluginName, platformName, constructor, dynamic)
  // dynamic true -> platform supports dynamic accessories
  homebridgeApi.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DaikinAirbasePlatform, true);
};

class DaikinAirbasePlatform {
  constructor(log, config = {}, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.hap = api.hap;
    this.Service = this.hap.Service;
    this.Characteristic = this.hap.Characteristic;
    this.Units = this.hap.Units;
    this.Formats = this.hap.Formats;
    this.Perms = this.hap.Perms;

    this.accessories = new Map();
    this.devices = new Map();
    this.emitter = new EventEmitter();

    this.pollingInterval = (this.config.pollingInterval === undefined) ? 5 : this.config.pollingInterval;
    this.overrides = this.config.overrides || {};

    api.on('didFinishLaunching', () => {
      this.log.info('[DaikinAirbase] didFinishLaunching — starting discovery & polling (if configured)');
      this.startDiscovery();
      if (this.pollingInterval > 0) {
        this.startPolling(this.pollingInterval);
      }
    });
  }

  configureAccessory(accessory) {
    this.log.info(`[DaikinAirbase] configureAccessory: ${accessory.displayName}`);
    this.accessories.set(accessory.UUID, accessory);
  }

  /***** Discovery & probing *****/
  startDiscovery() {
    if (this.config.hostname) {
      const hosts = Array.isArray(this.config.hostname) ? this.config.hostname : [this.config.hostname];
      hosts.forEach(h => {
        this.probeHost(h).catch(err => this.log.debug('[DaikinAirbase] probeHost error: ' + (err && err.message ? err.message : err)));
      });
    }

    // Basic UDP listener — best-effort
    try {
      this.discoverySocket = dgram.createSocket('udp4');
      this.discoverySocket.on('error', err => this.log.debug('[DaikinAirbase] discovery socket error: ' + err.message));
      this.discoverySocket.on('message', (msg, rinfo) => {
        const s = msg.toString();
        if (s.toLowerCase().includes('airbase') || s.toLowerCase().includes('brp15')) {
          this.log.info(`[DaikinAirbase] discovered UDP candidate at ${rinfo.address}`);
          this.probeHost(rinfo.address).catch(e => this.log.debug('[DaikinAirbase] probeHost failed: ' + (e && e.message)));
        }
      });
      this.discoverySocket.bind(() => this.discoverySocket.setBroadcast(true));
    } catch (e) {
      this.log.debug('[DaikinAirbase] could not start UDP discovery socket: ' + e.message);
    }
  }

  async probeHost(host) {
    const deviceInfo = await this.fetchStateFromHost(host);
    if (!deviceInfo) {
      this.log.debug(`[DaikinAirbase] No device info returned for host ${host}`);
      return;
    }
    const uuid = this.api.hap.uuid.generate(deviceInfo.id || host);
    deviceInfo.uuid = uuid;
    deviceInfo.host = host;
    this.devices.set(uuid, deviceInfo);
    this.createOrUpdateAccessory(deviceInfo);
  }

  // Placeholder: replace with actual device protocol code if available
  async fetchStateFromHost(host) {
    this.log.debug('[DaikinAirbase] fetchStateFromHost placeholder for ' + host);
    // Return a minimal deviceInfo structure so the rest of the plugin can function.
    return {
      id: `daikin-${host}`,
      name: `Daikin @ ${host}`,
      supports: { autoMode: true, fanRate: true, dryMode: true, zoneController: false },
      state: { power: false, mode: 'cool', targetTemp: 22, fanRate: 'medium', zones: [] }
    };
  }

  createOrUpdateAccessory(deviceInfo) {
    const uuid = deviceInfo.uuid;
    let accessory = this.accessories.get(uuid);
    if (!accessory) {
      this.log.info(`[DaikinAirbase] Creating accessory for ${deviceInfo.name}`);
      accessory = new this.api.platformAccessory(deviceInfo.name, uuid);
      accessory.context.deviceInfo = deviceInfo;

      accessory.addService(this.Service.HeaterCooler, deviceInfo.name, 'main');
      accessory.addService(this.Service.Switch, `${deviceInfo.name} Fan`, 'fanSwitch');
      if (deviceInfo.supports && deviceInfo.supports.fanRate) {
        accessory.addService(this.Service.Fanv2 || this.Service.Fan, `${deviceInfo.name} Fan Speed`, 'fanSpeed');
      }
      if (deviceInfo.supports && deviceInfo.supports.dryMode) {
        accessory.addService(this.Service.Switch, `${deviceInfo.name} Dry`, 'drySwitch');
      }

      this.accessories.set(uuid, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

      this.setupServicesForAccessory(accessory, deviceInfo);
    } else {
      this.log.info(`[DaikinAirbase] Updating cached accessory for ${deviceInfo.name}`);
      accessory.context.deviceInfo = Object.assign(accessory.context.deviceInfo || {}, deviceInfo);
      this.setupServicesForAccessory(accessory, deviceInfo);
      accessory.displayName = deviceInfo.name || accessory.displayName;
    }
  }

  setupServicesForAccessory(accessory, deviceInfo) {
    const hc = accessory.getService(this.Service.HeaterCooler) || accessory.addService(this.Service.HeaterCooler, deviceInfo.name, 'main');

    hc.getCharacteristic(this.Characteristic.Active)
      .onGet(() => {
        const dev = this.devices.get(accessory.UUID);
        return (dev && dev.state && dev.state.power) ? this.Characteristic.Active.ACTIVE : this.Characteristic.Active.INACTIVE;
      })
      .onSet(async (value) => {
        const on = (value === this.Characteristic.Active.ACTIVE);
        await this.setPower(accessory, on);
      });

    hc.getCharacteristic(this.Characteristic.CurrentHeaterCoolerState)
      .onGet(() => {
        const dev = this.devices.get(accessory.UUID);
        if (!dev || !dev.state || !dev.state.power) return this.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        const m = (dev.state.mode || 'cool').toLowerCase();
        if (m === 'cool') return this.Characteristic.CurrentHeaterCoolerState.COOLING;
        if (m === 'heat') return this.Characteristic.CurrentHeaterCoolerState.HEATING;
        return this.Characteristic.CurrentHeaterCoolerState.IDLE;
      });

    hc.getCharacteristic(this.Characteristic.TargetHeaterCoolerState)
      .onGet(() => {
        const dev = this.devices.get(accessory.UUID);
        const mode = (dev && dev.state && dev.state.mode) ? dev.state.mode.toLowerCase() : 'auto';
        if (mode === 'heat') return this.Characteristic.TargetHeaterCoolerState.HEAT;
        if (mode === 'cool') return this.Characteristic.TargetHeaterCoolerState.COOL;
        return this.Characteristic.TargetHeaterCoolerState.AUTO;
      })
      .onSet(async (value) => {
        let mode = 'auto';
        if (value === this.Characteristic.TargetHeaterCoolerState.COOL) mode = 'cool';
        if (value === this.Characteristic.TargetHeaterCoolerState.HEAT) mode = 'heat';
        await this.setMode(accessory, mode);
      });

    const minTemp = 16;
    const maxTemp = 30;
    hc.getCharacteristic(this.Characteristic.CoolingThresholdTemperature)
      .setProps({ minValue: minTemp, maxValue: maxTemp, minStep: 0.5 })
      .onGet(() => {
        const dev = this.devices.get(accessory.UUID);
        return dev && dev.state && dev.state.targetTemp ? dev.state.targetTemp : 22;
      })
      .onSet(async (value) => {
        await this.setTargetTemperature(accessory, value);
      });

    hc.getCharacteristic(this.Characteristic.HeatingThresholdTemperature)
      .setProps({ minValue: minTemp, maxValue: maxTemp, minStep: 0.5 })
      .onGet(() => {
        const dev = this.devices.get(accessory.UUID);
        return dev && dev.state && dev.state.targetTemp ? dev.state.targetTemp : 22;
      })
      .onSet(async (value) => {
        await this.setTargetTemperature(accessory, value);
      });

    const fanSwitch = accessory.getServiceById(this.Service.Switch, 'fanSwitch') || accessory.addService(this.Service.Switch, `${deviceInfo.name} Fan`, 'fanSwitch');
    fanSwitch.getCharacteristic(this.Characteristic.On)
      .onGet(() => {
        const dev = this.devices.get(accessory.UUID);
        return !!(dev && dev.state && dev.state.mode === 'fan');
      })
      .onSet(async (value) => {
        await this.setFanOnOff(accessory, value);
      });

    const fanSpeedService = accessory.getService(this.Service.Fanv2) || accessory.getService(this.Service.Fan) || accessory.getServiceById(this.Service.Fanv2 || this.Service.Fan, 'fanSpeed');
    if (fanSpeedService && this.Characteristic.RotationSpeed) {
      fanSpeedService.getCharacteristic(this.Characteristic.RotationSpeed)
        .onGet(() => {
          const dev = this.devices.get(accessory.UUID);
          const map = { low: 33, medium: 66, high: 100 };
          if (!dev || !dev.state) return 66;
          const r = dev.state.fanRate || 'medium';
          if (typeof r === 'number') return r;
          return map[r] || 66;
        })
        .onSet(async (value) => {
          await this.setFanSpeed(accessory, value);
        });
    }

    const dryService = accessory.getServiceById(this.Service.Switch, 'drySwitch') || accessory.addService(this.Service.Switch, `${deviceInfo.name} Dry`, 'drySwitch');
    dryService.getCharacteristic(this.Characteristic.On)
      .onGet(() => {
        const dev = this.devices.get(accessory.UUID);
        return !!(dev && dev.state && dev.state.mode === 'dry');
      })
      .onSet(async (value) => {
        if (value) await this.setMode(accessory, 'dry');
        else await this.setMode(accessory, 'cool');
      });

    if (deviceInfo.state && Array.isArray(deviceInfo.state.zones)) {
      deviceInfo.state.zones.forEach((z, idx) => {
        const sid = `zone-${idx}`;
        const s = accessory.getServiceById(this.Service.Switch, sid) || accessory.addService(this.Service.Switch, `Zone ${z.name || idx}`, sid);
        s.getCharacteristic(this.Characteristic.On)
          .onGet(() => {
            const dev = this.devices.get(accessory.UUID);
            return !!(dev && dev.state && dev.state.zones && dev.state.zones[idx] && dev.state.zones[idx].enabled);
          })
          .onSet(async (value) => {
            await this.setZone(accessory, idx, value);
          });
      });
    }

    this.emitter.on(`update:${accessory.UUID}`, (newState) => {
      this.devices.set(accessory.UUID, Object.assign(this.devices.get(accessory.UUID) || {}, newState));
      try {
        hc.updateCharacteristic(this.Characteristic.Active, (newState.state && newState.state.power) ? this.Characteristic.Active.ACTIVE : this.Characteristic.Active.INACTIVE);
        hc.updateCharacteristic(this.Characteristic.TargetHeaterCoolerState, this.mapModeToTargetState(newState.state && newState.state.mode));
        hc.updateCharacteristic(this.Characteristic.CoolingThresholdTemperature, newState.state.targetTemp);
        hc.updateCharacteristic(this.Characteristic.HeatingThresholdTemperature, newState.state.targetTemp);
        const fanS = accessory.getServiceById(this.Service.Fanv2 || this.Service.Fan, 'fanSpeed');
        if (fanS && this.Characteristic.RotationSpeed) {
          const map = { low: 33, medium: 66, high: 100 };
          const fanVal = (newState.state && newState.state.fanRate) ? (typeof newState.state.fanRate === 'number' ? newState.state.fanRate : map[newState.state.fanRate]) : 66;
          fanS.updateCharacteristic(this.Characteristic.RotationSpeed, fanVal);
        }
      } catch (e) {
        this.log.debug('[DaikinAirbase] error updating characteristics: ' + e.message);
      }
    });
  }

  mapModeToTargetState(mode) {
    if (!mode) return this.Characteristic.TargetHeaterCoolerState.AUTO;
    mode = mode.toLowerCase();
    if (mode === 'heat') return this.Characteristic.TargetHeaterCoolerState.HEAT;
    if (mode === 'cool') return this.Characteristic.TargetHeaterCoolerState.COOL;
    return this.Characteristic.TargetHeaterCoolerState.AUTO;
  }

  /***** Command methods (placeholders) *****/
  async setPower(accessory, on) {
    this.log.info(`[DaikinAirbase] setPower ${accessory.displayName} -> ${on}`);
    const dev = this.devices.get(accessory.UUID);
    dev.state.power = !!on;
    await this.sendCommand(dev.host, { action: 'power', value: dev.state.power });
    this.emitter.emit(`update:${accessory.UUID}`, { state: dev.state });
  }

  async setMode(accessory, mode) {
    this.log.info(`[DaikinAirbase] setMode ${accessory.displayName} -> ${mode}`);
    const dev = this.devices.get(accessory.UUID);
    dev.state.mode = mode;
    await this.sendCommand(dev.host, { action: 'mode', value: mode });
    this.emitter.emit(`update:${accessory.UUID}`, { state: dev.state });
  }

  async setTargetTemperature(accessory, value) {
    this.log.info(`[DaikinAirbase] setTargetTemperature ${accessory.displayName} -> ${value}`);
    const dev = this.devices.get(accessory.UUID);
    dev.state.targetTemp = value;
    await this.sendCommand(dev.host, { action: 'setTemp', value });
    this.emitter.emit(`update:${accessory.UUID}`, { state: dev.state });
  }

  async setFanOnOff(accessory, on) {
    this.log.info(`[DaikinAirbase] setFanOnOff ${accessory.displayName} -> ${on}`);
    const dev = this.devices.get(accessory.UUID);
    dev.state.mode = on ? 'fan' : 'cool';
    await this.sendCommand(dev.host, { action: 'fanOn', value: !!on });
    this.emitter.emit(`update:${accessory.UUID}`, { state: dev.state });
  }

  async setFanSpeed(accessory, value) {
    this.log.info(`[DaikinAirbase] setFanSpeed ${accessory.displayName} -> ${value}`);
    const dev = this.devices.get(accessory.UUID);
    let rate = 'medium';
    if (value <= 33) rate = 'low';
    else if (value >= 66) rate = 'high';
    dev.state.fanRate = rate;
    await this.sendCommand(dev.host, { action: 'setFanRate', value: rate });
    this.emitter.emit(`update:${accessory.UUID}`, { state: dev.state });
  }

  async setZone(accessory, zoneIndex, enabled) {
    this.log.info(`[DaikinAirbase] setZone ${accessory.displayName} zone ${zoneIndex} -> ${enabled}`);
    const dev = this.devices.get(accessory.UUID);
    if (!dev.state.zones || !dev.state.zones[zoneIndex]) return;
    dev.state.zones[zoneIndex].enabled = !!enabled;
    await this.sendCommand(dev.host, { action: 'setZone', index: zoneIndex, value: !!enabled });
    this.emitter.emit(`update:${accessory.UUID}`, { state: dev.state });
  }

  async sendCommand(host, payload) {
    this.log.debug(`[DaikinAirbase] sendCommand placeholder to ${host}: ${JSON.stringify(payload)}`);
    await new Promise(r => setTimeout(r, 80));
    return true;
  }

  /***** Polling *****/
  startPolling(minutes) {
    const ms = Math.max(1, minutes) * 60 * 1000;
    this.log.info(`[DaikinAirbase] Starting polling every ${minutes} minute(s).`);
    setInterval(async () => {
      for (const [uuid, dev] of this.devices.entries()) {
        try {
          const latest = await this.fetchStateFromHost(dev.host);
          if (latest) {
            const merged = Object.assign({}, dev, latest);
            this.devices.set(uuid, merged);
            this.emitter.emit(`update:${uuid}`, merged);
          }
        } catch (e) {
          this.log.debug('[DaikinAirbase] Polling fetchStateFromHost failed for ' + dev.host + ': ' + (e && e.message));
        }
      }
    }, ms);
  }

  async removeCachedAccessory(accessory) {
    try {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.delete(accessory.UUID);
    } catch (e) {
      this.log.debug('[DaikinAirbase] removeCachedAccessory error: ' + e.message);
    }
  }
}