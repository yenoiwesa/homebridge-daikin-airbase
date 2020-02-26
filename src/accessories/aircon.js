const HeaterCooler = require('../services/heater-cooler');
const Fan = require('../services/fan');
const FanModeSwitch = require('../services/fan-mode-switch');
const DryModeSwitch = require('../services/dry-mode-switch');
const Accessory = require('./accessory');

class Aircon extends Accessory {
    constructor({ homebridge, log, airbase, config }) {
        super({ homebridge, log, airbase, config });

        const getAllServices = this.getServices.bind(this);

        this.addService(
            new HeaterCooler({
                homebridge,
                log,
                airbase,
                getAllServices,
            })
        );

        if (airbase.info.fanRateSupported) {
            this.addService(
                new Fan({ homebridge, log, airbase, getAllServices })
            );
        }

        this.addService(
            new FanModeSwitch({ homebridge, log, airbase, getAllServices })
        );

        if (airbase.info.dryModeSupported) {
            this.addService(
                new DryModeSwitch({ homebridge, log, airbase, getAllServices })
            );
        }
    }
}

module.exports = Aircon;
