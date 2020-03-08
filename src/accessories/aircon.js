const HeaterCooler = require('../services/heater-cooler');
const Fan = require('../services/fan');
const FanModeSwitch = require('../services/fan-mode-switch');
const DryModeSwitch = require('../services/dry-mode-switch');
const Accessory = require('./accessory');

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
