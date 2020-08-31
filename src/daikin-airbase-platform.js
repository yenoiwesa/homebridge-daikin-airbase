const { castArray, remove } = require('lodash');
const retry = require('retry');
const Airbase = require('./airbase-controller');
const discover = require('./daikin-discovery');
const Aircon = require('./accessories/aircon');
const ZoneControl = require('./accessories/zone-control');

const PLUGIN_NAME = 'homebridge-daikin-airbase';
const PLATFORM_NAME = 'DaikinAirbase';

const AccessoriesMap = {
    [Aircon.name]: { class: Aircon, nameFormat: '#' },
    [ZoneControl.name]: { class: ZoneControl, nameFormat: '# Zones' },
};

class DaikinAirbasePlatform {
    constructor(log, config = {}, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.accessories = [];

        this.log(`${PLATFORM_NAME} Init`);

        /**
         * Platforms should wait until the "didFinishLaunching" event has fired before
         * registering any new accessories.
         */
        api.on('didFinishLaunching', () => this.initAccessories());
    }

    /**
     * Homebridge will call the "configureAccessory" method once for every cached
     * accessory restored
     */
    configureAccessory(homekitAccessory) {
        this.log.info(
            `Restoring cached accessory ${homekitAccessory.displayName}`
        );
        try {
            const type = homekitAccessory.context.type;
            const accessory = new AccessoriesMap[type].class({
                api: this.api,
                log: this.log,
                homekitAccessory,
                config: this.config,
            });

            this.accessories.push(accessory);
        } catch (error) {
            this.log.error(
                `Failed to restore cached accessory ${homekitAccessory.displayName}`,
                error
            );
        }
    }

    async initAccessories() {
        const expectedSSIDs = new Set(
            this.accessories.map((accessory) => accessory.context.airbase.ssid)
        );
        const foundSSIDs = new Set();

        const operation = retry.operation({
            retries: 10,
            factor: 2,
            minTimeout: 5 * 1000,
        });

        operation.attempt(async () => {
            let hostnames = [];
            try {
                // use hostnames from the configuration or auto discover if none listed
                hostnames =
                    (this.config.hostname && castArray(this.config.hostname)) ||
                    (await discover(this.log));
            } catch (error) {
                this.log.error(error);
            }

            for (const hostname of hostnames) {
                try {
                    const airbase = new Airbase({
                        hostname,
                        log: this.log,
                    });

                    await airbase.init();

                    foundSSIDs.add(airbase.info.ssid);

                    const aircon = this.getOrCreateAccessory(
                        Aircon.name,
                        airbase
                    );
                    aircon.assignAirbase(airbase);

                    if (airbase.info.zoneNames) {
                        // add zone control accessory
                        const zoneControl = this.getOrCreateAccessory(
                            ZoneControl.name,
                            airbase
                        );
                        zoneControl.assignAirbase(airbase);
                    }

                    this.log.info(
                        `Registered device: ${airbase.info.name} (SSID: ${airbase.info.ssid})`
                    );
                } catch (error) {
                    this.log.error(error);
                }
            }

            const missingSSIDs = new Set(
                [...expectedSSIDs].filter((ssid) => !foundSSIDs.has(ssid))
            );

            if (missingSSIDs.size) {
                if (operation.retry(true)) {
                    this.log.info(
                        'Will retry to find missing airbase modules with SSIDs',
                        [...missingSSIDs]
                    );
                } else {
                    // if we have still not found all SSIDs that were previously registered
                    // and have reached the maximum number of attempts, unregister the accessories
                    // that have no airbase associated to them
                    const orphanAccessories = remove(
                        this.accessories,
                        (accessory) => !accessory.airbase
                    );
                    this.log.info(
                        `Unregistering ${orphanAccessories.length} orphan accessories`
                    );
                    this.api.unregisterPlatformAccessories(
                        PLUGIN_NAME,
                        PLATFORM_NAME,
                        orphanAccessories.map((accessory) =>
                            accessory.getHomekitAccessory()
                        )
                    );
                }
            } else {
                this.log.info(`Found ${this.accessories.length} devices`);
            }
        });
    }

    getOrCreateAccessory(type, airbase) {
        // find the existing accessory if one was restored from cache
        let accessory = this.accessories.find(
            (accessory) =>
                accessory.context.airbase.ssid === airbase.info.ssid &&
                accessory.context.type === type
        );

        // if none found, create a new one
        if (!accessory) {
            const uuid = this.api.hap.uuid.generate(
                `${airbase.info.ssid}:${type}`
            );
            const homekitAccessory = new this.api.platformAccessory(
                AccessoriesMap[type].nameFormat.replace('#', airbase.info.name),
                uuid
            );
            homekitAccessory.context.airbase = airbase.toContext();
            accessory = new AccessoriesMap[type].class({
                api: this.api,
                log: this.log,
                homekitAccessory,
                config: this.config,
            });
            this.accessories.push(accessory);

            // register the new accessory
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
                accessory.getHomekitAccessory(),
            ]);
        }

        return accessory;
    }
}

module.exports = { PLUGIN_NAME, PLATFORM_NAME, DaikinAirbasePlatform };
