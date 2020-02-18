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
            this.aircon.info.ssid
        );
        informationService.setCharacteristic(
            Characteristic.FirmwareRevision,
            this.aircon.info.version
        );

        this.homekitAccessory = {
            name: this.name,
            displayName: this.name,
            uuid_base: UUIDGen.generate(this.aircon.info.ssid),
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
        return this.aircon.info.name;
    }

    async getHomekitState(state, getStateFn, callback) {
        this.log.debug(`Get ${state}`);

        try {
            const value = await getStateFn();

            this.log.info(`Get ${state} success: ${value}`);
            callback(null, value);
        } catch (error) {
            this.log.error(`Could not fetch ${state}`, error);

            callback(error);
        }
    }

    async setHomekitState(state, value, setStateFn, callback) {
        this.log.debug(`Set ${state} with value: ${value}`);

        try {
            await setStateFn(value);

            this.log.info(`Set ${state} success: ${value}`);
            callback();
        } catch (error) {
            this.log.error(`Could not set ${state}`, error);

            callback(error);
        }
    }
}

module.exports = Accessory;
