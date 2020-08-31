const Service = require('./service');

let Characteristic;

class AccessoryInformation extends Service {
    constructor({ api, log, accessory }) {
        super({
            log,
            accessory,
            descriptor: { type: api.hap.Service.AccessoryInformation },
        });

        Characteristic = api.hap.Characteristic;

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

module.exports = AccessoryInformation;
