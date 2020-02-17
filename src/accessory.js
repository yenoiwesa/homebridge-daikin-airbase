class Accessory {
    constructor({ homebridge, log, aircon }) {
        this.aircon = aircon;
        this.log = log;

        const UUIDGen = homebridge.hap.uuid;
        const Service = homebridge.hap.Service;
        const Characteristic = homebridge.hap.Characteristic;

        const informationService = new Service.AccessoryInformation();
        informationService.setCharacteristic(
            Characteristic.Manufacturer,
            this.aircon.info.manufacturer
        );
        informationService.setCharacteristic(
            Characteristic.Model,
            this.aircon.info.model
        );
        informationService.setCharacteristic(
            Characteristic.SerialNumber,
            this.aircon.info.name
        );
        informationService.setCharacteristic(
            Characteristic.FirmwareRevision,
            String(this.aircon.info.version)
                .split('_')
                .join('.')
        );

        this.homekitAccessory = {
            name: this.name,
            displayName: this.name,
            uuid_base: UUIDGen.generate(this.aircon.info.name),
            services: [informationService],
            getServices: () => this.homekitAccessory.services,
        };

        this.log.debug(`Found ${this.constructor.name} ${this.name}`);
    }

    addService(service) {
        this.homekitAccessory.services.push(service);
        return service;
    }

    get name() {
        throw 'must be overridden';
    }
}

module.exports = Accessory;
