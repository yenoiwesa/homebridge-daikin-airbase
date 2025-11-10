import { API } from 'homebridge';
import Service from './service';

export default class AccessoryInformation extends Service {
    constructor({
        api,
        log,
        accessory,
    }: {
        api: API;
        log: any;
        accessory: any;
    }) {
        super({
            log,
            accessory,
            descriptor: { type: api.hap.Service.AccessoryInformation },
        });

        const Characteristic = api.hap.Characteristic;

        this.service.setCharacteristic(
            Characteristic.Manufacturer,
            accessory.context.airbase.manufacturer
        );
        this.service.setCharacteristic(
            Characteristic.Model,
            accessory.context.airbase.model
        );
        this.service.setCharacteristic(
            Characteristic.SerialNumber,
            accessory.context.airbase.ssid
        );
        this.service.setCharacteristic(
            Characteristic.FirmwareRevision,
            accessory.context.airbase.version
        );
    }
}
