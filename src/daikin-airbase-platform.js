const DaikinAircon = require('./daikin-controller');
const HeaterCooler = require('./heater-cooler');

let homebridge;

const PLUGIN_NAME = 'homebridge-daikin-airbase';
const PLATFORM_NAME = 'DaikinAirbase';

const DaikinAirbasePlatformFactory = homebridgeInstance => {
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
        this.aircon = new DaikinAircon(log, config);
    }

    /**
     * Called by Homebridge at platform init to list accessories.
     */
    async accessories(callback) {
        // retrieve devices defined in overkiz
        try {
            await this.aircon.init();

            const heaterCooler = new HeaterCooler({
                homebridge,
                log: this.log,
                aircon: this.aircon,
            });

            this.platformAccessories.push(heaterCooler.homekitAccessory);

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
