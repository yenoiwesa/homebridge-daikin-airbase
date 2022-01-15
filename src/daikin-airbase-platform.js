const { castArray, get } = require('lodash');
const retry = require('retry');
const Airbase = require('./airbase-controller');
const discover = require('./daikin-discovery');
const Aircon = require('./accessories/aircon');
const ZoneControl = require('./accessories/zone-control');

const PLUGIN_NAME = 'homebridge-daikin-airbase';
const PLATFORM_NAME = 'DaikinAirbase';
const USE_INDIVIDUAL_ZONE_CONTROLS_CONFIG = 'useIndividualZoneControls';
const USE_INDIVIDUAL_ZONE_CONTROLS_DEFAULT = false;

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
            let accessory;

            switch (type) {
                case Aircon.name:
                    accessory = new Aircon({
                        api: this.api,
                        log: this.log,
                        homekitAccessory,
                        config: this.config,
                    });
                    break;
                case ZoneControl.name:
                    accessory = new ZoneControl({
                        api: this.api,
                        log: this.log,
                        homekitAccessory,
                        config: this.config,
                        zoneName: homekitAccessory.context.zoneName,
                    });
                    break;
            }

            this.accessories.push(accessory);
        } catch (error) {
            this.log.error(
                `Failed to restore cached accessory ${homekitAccessory.displayName}`,
                error
            );
        }
    }

    async initAccessories() {
        const useIndividualZoneControls = get(
            this.config,
            USE_INDIVIDUAL_ZONE_CONTROLS_CONFIG,
            USE_INDIVIDUAL_ZONE_CONTROLS_DEFAULT
        );

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

                    this.initAircon(airbase);

                    const zoneNames = airbase.info.zoneNames;
                    if (zoneNames) {
                        if (useIndividualZoneControls) {
                            // add one zone control accessory per zone
                            // (one switch per accessory)
                            for (const zoneName of zoneNames) {
                                this.initZoneControl(airbase, zoneName);
                            }
                        }
                        // add one zone control accessory for all zones
                        // (multiple switches in one accessory)
                        else {
                            this.initZoneControl(airbase);
                        }
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
                    this.log.error(
                        "Couldn't find airbase modules with the following SSIDs",
                        [...missingSSIDs],
                        'The related homekit accessories will not work and might need to be manually deleted.'
                    );
                }
            } else {
                this.log.info(`Found ${this.accessories.length} devices`);
            }
        });
    }

    initAircon(airbase) {
        // find the existing accessory if one was restored from cache
        let aircon = this.accessories.find(
            ({ context }) =>
                context.airbase.ssid === airbase.info.ssid &&
                context.type === Aircon.name
        );

        // if none found, create a new one
        if (!aircon) {
            const uuid = this.api.hap.uuid.generate(
                `${airbase.info.ssid}:${Aircon.name}`
            );
            const homekitAccessory = new this.api.platformAccessory(
                airbase.info.name,
                uuid
            );
            homekitAccessory.context.airbase = airbase.toContext();
            aircon = new Aircon({
                api: this.api,
                log: this.log,
                homekitAccessory,
                config: this.config,
            });
            this.accessories.push(aircon);

            // register the new accessory
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
                aircon.getHomekitAccessory(),
            ]);
        }

        aircon.assignAirbase(airbase);
    }

    initZoneControl(airbase, zoneName = null) {
        // find the existing accessory if one was restored from cache
        let zoneControl = this.accessories.find(
            ({ context }) =>
                context.airbase.ssid === airbase.info.ssid &&
                context.type === ZoneControl.name &&
                (zoneName == null || context.zoneName === zoneName)
        );

        // if none found, create a new one
        if (!zoneControl) {
            const uuidBase = `${airbase.info.ssid}:${ZoneControl.name}`;
            const uuid = this.api.hap.uuid.generate(
                zoneName == null ? uuidBase : `${uuidBase}:${zoneName}`
            );
            const homekitAccessory = new this.api.platformAccessory(
                `${airbase.info.name} ${zoneName || 'Zones'}`,
                uuid
            );
            homekitAccessory.context.airbase = airbase.toContext();
            zoneControl = new ZoneControl({
                api: this.api,
                log: this.log,
                homekitAccessory,
                config: this.config,
                zoneName,
            });
            this.accessories.push(zoneControl);

            // register the new accessory
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
                zoneControl.getHomekitAccessory(),
            ]);
        }

        zoneControl.assignAirbase(airbase);
    }
}

module.exports = { PLUGIN_NAME, PLATFORM_NAME, DaikinAirbasePlatform };
