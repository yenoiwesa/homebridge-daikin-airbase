const AccessoryInformation = require('../services/accessory-information');

class Accessory {
    constructor({ api, log, homekitAccessory, config }) {
        this.api = api;
        this.log = log;
        this.accessory = homekitAccessory;
        this.config = config;
        this.services = [];

        // assign the accessory type to the context
        // so we can deserialise it at init
        this.context.type = this.constructor.name;

        this.addService(
            new AccessoryInformation({
                api,
                log,
                accessory: this,
            })
        );

        this.log.debug(`Found ${this.constructor.name} ${this.name}`);
    }

    assignAirbase(airbase) {
        this.airbase = airbase;

        // use the most up to date airbase details in the accessory context
        this.context.airbase = airbase.toContext();

        // subscribe services
        for (const service of this.services) {
            this.airbase.subscribeService(service);
        }
    }

    addService(service) {
        this.services.push(service);
    }

    getHomekitAccessory() {
        return this.accessory;
    }

    get context() {
        return this.accessory.context;
    }

    get name() {
        return this.accessory.displayName;
    }
}

module.exports = Accessory;
