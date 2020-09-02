const { get, isNumber } = require('lodash');
const AccessoryInformation = require('../services/accessory-information');

const POLLING_INTERVAL_CONFIG = 'pollingInterval';
const POLLING_INTERVAL_DEFAULT = 5; // minutes

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

        this.initPolling();
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

    get context() {
        return this.accessory.context;
    }

    get name() {
        return this.accessory.displayName;
    }

    initPolling() {
        const pollingInterval = Math.max(
            get(this.config, POLLING_INTERVAL_CONFIG, POLLING_INTERVAL_DEFAULT),
            0
        );

        if (pollingInterval && isNumber(pollingInterval)) {
            this.log.info(
                `Starting polling for ${this.constructor.name} state every ${pollingInterval} minute(s)`
            );

            // start polling
            this.poll(pollingInterval * 60 * 1000);
        } else {
            this.log.info(
                `Polling for ${this.constructor.name} state disabled`
            );
        }
    }

    poll(interval) {
        if (this.pollIntervalId) {
            clearInterval(this.pollIntervalId);
        }

        this.pollIntervalId = setInterval(() => {
            this.log.debug(`Polling for ${this.constructor.name} state`);
            this.updateAllServices();
        }, interval);
    }

    async updateAllServices(values) {
        if (this.airbase) {
            return this.doUpdateAllServices(values);
        }
    }

    // eslint-disable-next-line no-unused-vars
    async doUpdateAllServices(values) {
        // to be implemented in children classes
    }
}

module.exports = Accessory;
