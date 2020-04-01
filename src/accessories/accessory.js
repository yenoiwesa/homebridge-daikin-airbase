const { get, isNumber } = require('lodash');
const AccessoryInformation = require('../services/accessory-information');

const POLLING_INTERVAL_CONFIG = 'pollingInterval';
const POLLING_INTERVAL_DEFAULT = 5; // minutes

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
            uuid_base: UUIDGen.generate(
                `${this.airbase.info.ssid}:${this.constructor.name}`
            ),
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
        return this.services.map((service) => service.getHomekitService());
    }

    get name() {
        return this.airbase.info.name;
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
        setInterval(() => {
            this.log.debug(`Polling for ${this.constructor.name} state`);
            this.updateAllServices();
        }, interval);
    }

    // eslint-disable-next-line no-unused-vars
    async updateAllServices(values) {
        // to be implemented in children classes
    }
}

module.exports = Accessory;
