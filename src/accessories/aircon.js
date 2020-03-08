const { get, isNumber } = require('lodash');
const HeaterCooler = require('../services/heater-cooler');
const Fan = require('../services/fan');
const FanModeSwitch = require('../services/fan-mode-switch');
const DryModeSwitch = require('../services/dry-mode-switch');
const Accessory = require('./accessory');

const POLLING_INTERVAL_CONFIG = 'pollingInterval';
const POLLING_INTERVAL_DEFAULT = 5; // minutes

class Aircon extends Accessory {
    constructor({ homebridge, log, airbase, config }) {
        super({ homebridge, log, airbase, config });

        const updateAllServices = this.updateAllServices.bind(this);

        this.addService(
            new HeaterCooler({
                homebridge,
                log,
                airbase,
                updateAllServices,
            })
        );

        if (airbase.info.fanRateSupported) {
            this.addService(
                new Fan({ homebridge, log, airbase, updateAllServices })
            );
        }

        this.addService(
            new FanModeSwitch({ homebridge, log, airbase, updateAllServices })
        );

        if (airbase.info.dryModeSupported) {
            this.addService(
                new DryModeSwitch({
                    homebridge,
                    log,
                    airbase,
                    updateAllServices,
                })
            );
        }

        const pollingInterval = Math.max(
            get(this.config, POLLING_INTERVAL_CONFIG, POLLING_INTERVAL_DEFAULT),
            0
        );

        if (pollingInterval && isNumber(pollingInterval)) {
            this.log.info(
                `Starting polling for Airbase state every ${pollingInterval} minute(s)`
            );

            // start polling
            this.poll(pollingInterval * 60 * 1000);
        } else {
            this.log.info('Polling for Airbase state disabled');
        }
    }

    poll(interval) {
        setInterval(() => {
            this.log.debug('Polling for Airbase state');
            this.updateAllServices();
        }, interval);
    }

    async updateAllServices({ controlInfo, sensorInfo } = {}) {
        controlInfo = controlInfo || (await this.airbase.getControlInfo());
        sensorInfo = sensorInfo || (await this.airbase.getSensorInfo());

        for (const service of this.getServices()) {
            service.updateState({ controlInfo, sensorInfo });
        }
    }
}

module.exports = Aircon;
