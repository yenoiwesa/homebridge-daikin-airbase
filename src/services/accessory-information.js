const Service = require('./service');

let Characteristic;

class AccessoryInformation extends Service {
    constructor({ homebridge, log, airbase, updateAllServices }) {
        super({
            log,
            airbase,
            service: new homebridge.hap.Service.AccessoryInformation(),
            updateAllServices,
        });

        Characteristic = homebridge.hap.Characteristic;

        this.service.setCharacteristic(
            Characteristic.Manufacturer,
            this.airbase.info.manufacturer
        );
        this.service.setCharacteristic(
            Characteristic.Model,
            this.airbase.info.model
        );
        this.service.setCharacteristic(
            Characteristic.SerialNumber,
            this.airbase.info.ssid
        );
        this.service.setCharacteristic(
            Characteristic.FirmwareRevision,
            this.airbase.info.version
        );
    }
}

module.exports = AccessoryInformation;
