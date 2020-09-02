const Airbase = require('../airbase-controller');
const Service = require('./service');

let Characteristic;

class DryModeSwitch extends Service {
    constructor({ api, log, accessory }) {
        super({
            log,
            accessory,
            descriptor: {
                type: api.hap.Service.Switch,
                name: 'Dry Mode',
                subType: 'dry',
            },
        });

        Characteristic = api.hap.Characteristic;

        // On
        // boolean
        this.on = this.getCharacteristic(Characteristic.On)
            .on('get', (cb) =>
                this.getHomekitState('on state', this.getOn.bind(this), cb)
            )
            .on('set', (value, cb) =>
                this.setHomekitState(
                    'on state',
                    value,
                    this.setOn.bind(this),
                    cb
                )
            );
    }

    async updateState({ controlInfo }) {
        this.on.updateValue(await this.getOn(controlInfo));
    }

    async getOn(controlInfo = null) {
        const { power, mode } =
            controlInfo || (await this.airbase.getControlInfo());

        return power === Airbase.Power.ON && mode === Airbase.Mode.DRY;
    }

    async setOn(value) {
        let controlInfo;

        // setting priority to this request to make sure it overrides the mode
        // from Heater/Cooler's setActive during the properties merge
        if (value) {
            controlInfo = await this.airbase.setControlInfo({
                power: Airbase.Power.ON,
                mode: Airbase.Mode.DRY,
                priority: 1,
            });
        } else {
            controlInfo = await this.airbase.setControlInfo({
                power: Airbase.Power.OFF,
                priority: 1,
            });
        }

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }
}

module.exports = DryModeSwitch;
