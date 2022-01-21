const Airbase = require('../airbase-controller');
const Service = require('./service');

let Characteristic;

class FanModeSwitch extends Service {
    constructor({ api, log, accessory }) {
        super({
            log,
            accessory,
            descriptor: {
                type: api.hap.Service.Switch,
                name: 'Fan Mode',
                subType: 'fan',
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

        return power === Airbase.Power.ON && mode === Airbase.Mode.FAN;
    }

    async setOn(value) {
        let controlInfo;

        if (value) {
            controlInfo = await this.airbase.setControlInfo({
                power: Airbase.Power.ON,
                mode: Airbase.Mode.FAN,
            });
        } else {
            controlInfo = await this.airbase.setControlInfo({
                power: Airbase.Power.OFF,
            });
        }

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }
}

module.exports = FanModeSwitch;
