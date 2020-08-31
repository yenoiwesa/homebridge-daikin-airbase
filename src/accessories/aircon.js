const HeaterCooler = require('../services/heater-cooler');
const Fan = require('../services/fan');
const FanModeSwitch = require('../services/fan-mode-switch');
const DryModeSwitch = require('../services/dry-mode-switch');
const Accessory = require('./accessory');

class Aircon extends Accessory {
    constructor({ api, log, homekitAccessory, config }) {
        super({ api, log, homekitAccessory, config });

        this.addService(
            new HeaterCooler({
                api,
                log,
                accessory: this,
            })
        );

        if (this.context.airbase.fanRateSupported) {
            this.addService(new Fan({ api, log, accessory: this }));
        }

        this.addService(new FanModeSwitch({ api, log, accessory: this }));

        if (this.context.airbase.dryModeSupported) {
            this.addService(
                new DryModeSwitch({
                    api,
                    log,
                    accessory: this,
                })
            );
        }
    }

    async doUpdateAllServices({ controlInfo, sensorInfo } = {}) {
        controlInfo = controlInfo || (await this.airbase.getControlInfo());
        sensorInfo = sensorInfo || (await this.airbase.getSensorInfo());

        for (const service of this.getServices()) {
            service.updateState({ controlInfo, sensorInfo });
        }
    }
}

module.exports = Aircon;
