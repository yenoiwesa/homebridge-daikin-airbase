const Airbase = require('../airbase-controller');
const Service = require('./service');

let Characteristic;

class ZoneSwitch extends Service {
    constructor({ homebridge, log, airbase, updateAllServices, zoneName }) {
        super({
            log,
            airbase,
            service: new homebridge.hap.Service.Switch(
                zoneName,
                `zone:${zoneName}`
            ),
            updateAllServices,
        });

        Characteristic = homebridge.hap.Characteristic;

        this.zoneName = zoneName;

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

    async updateState({ zoneSetting }) {
        this.on.updateValue(await this.getOn(zoneSetting));
    }

    async getOn(zoneSetting = null) {
        const power = (zoneSetting || (await this.airbase.getZoneSetting()))[
            this.zoneName
        ];

        return power === Airbase.Power.ON;
    }

    async setOn(value) {
        const power = value ? Airbase.Power.ON : Airbase.Power.OFF;

        const zoneSetting = await this.airbase.setZoneSetting({
            [this.zoneName]: power,
        });

        // update side effect properties
        this.updateAllServices({ zoneSetting });
    }
}

module.exports = ZoneSwitch;
