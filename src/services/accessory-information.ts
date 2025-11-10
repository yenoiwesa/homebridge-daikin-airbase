import { API, Logging } from 'homebridge';
import Service from './service';
import type Accessory from '../accessories/accessory';

export default class AccessoryInformation extends Service {
    constructor({
        api,
        log,
        accessory,
    }: {
        api: API;
        log: Logging;
        accessory: Accessory;
    }) {
        super({
            api,
            log,
            accessory,
            descriptor: { type: api.hap.Service.AccessoryInformation },
        });

        this.service.setCharacteristic(
            this.api.hap.Characteristic.Manufacturer,
            accessory.context.airbase.manufacturer
        );
        this.service.setCharacteristic(
            this.api.hap.Characteristic.Model,
            accessory.context.airbase.model
        );
        this.service.setCharacteristic(
            this.api.hap.Characteristic.SerialNumber,
            accessory.context.airbase.ssid
        );
        this.service.setCharacteristic(
            this.api.hap.Characteristic.FirmwareRevision,
            accessory.context.airbase.version
        );
    }
}
