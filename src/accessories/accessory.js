const AccessoryInformation = require('../services/accessory-information');

class Accessory {
    constructor({ homebridge, log, airbase, config }) {
        this.airbase = airbase;
        this.log = log;
        this.config = config;
        this.services = [];

        const UUIDGen = homebridge.hap.uuid;

        this.accessory = {
            name: this.name,
            displayName: this.name,
            uuid_base: UUIDGen.generate(this.airbase.info.ssid),
            services: [],
            getServices: () => this.getHomekitServices(),
        };

        this.addService(
            new AccessoryInformation({
                homebridge,
                log,
                airbase,
            })
        );

        this.log.debug(`Found ${this.constructor.name} ${this.name}`);
    }

    getServices() {
        return this.services;
    }

    addService(service) {
        this.services.push(service);
    }

    getHomekitAccessory() {
        return this.accessory;
    }

    getHomekitServices() {
        return this.services.map(service => service.getHomekitService());
    }

    get name() {
        return this.airbase.info.name;
    }
}

module.exports = Accessory;
