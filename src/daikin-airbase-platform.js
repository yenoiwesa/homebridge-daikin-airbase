const { castArray } = require('lodash');
const Airbase = require('./airbase-controller');
const discover = require('./daikin-discovery');
const Aircon = require('./accessories/aircon');
const ZoneControl = require('./accessories/zone-control');

let homebridge;

const PLUGIN_NAME = 'homebridge-daikin-airbase';
const PLATFORM_NAME = 'DaikinAirbase';

const DaikinAirbasePlatformFactory = (homebridgeInstance) => {
    homebridge = homebridgeInstance;

    return DaikinAirbasePlatform;
};

class DaikinAirbasePlatform {
    constructor(log, config = {}, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.platformAccessories = [];

        this.log(`${PLATFORM_NAME} Init`);
    }

    /**
     * Called by Homebridge at platform init to list accessories.
     */
    async accessories(callback) {
        // retrieve devices defined in overkiz
        try {
            // use hostnames from the configuration or auto discover if none listed
            const hostnames =
                (this.config.hostname && castArray(this.config.hostname)) ||
                (await discover(this.log));

            for (const hostname of hostnames) {
                const airbase = new Airbase({
                    hostname,
                    log: this.log,
                });

                await airbase.init();

                const aircon = new Aircon({
                    homebridge,
                    airbase,
                    log: this.log,
                    config: this.config,
                });

                this.platformAccessories.push(aircon.getHomekitAccessory());

                if (airbase.info.zonesSupported && airbase.info.zoneCount) {
                    // retrieve zone names
                    const { zoneNames } = await airbase.getRawZoneSetting();

                    // add zone control accessory
                    const zoneControl = new ZoneControl({
                        homebridge,
                        airbase,
                        log: this.log,
                        config: this.config,
                        zoneNames: new Set(
                            zoneNames.slice(0, airbase.info.zoneCount)
                        ),
                    });

                    this.platformAccessories.push(
                        zoneControl.getHomekitAccessory()
                    );
                }

                this.log.info(
                    `Registered device: ${airbase.info.name} (SSID: ${airbase.info.ssid})`
                );
            }

            this.log.debug(`Found ${this.platformAccessories.length} devices`);
        } catch (error) {
            // do nothing in case of error
            this.log.error(error);
        } finally {
            callback(this.platformAccessories);
        }
    }
}

module.exports = { PLUGIN_NAME, PLATFORM_NAME, DaikinAirbasePlatformFactory };
