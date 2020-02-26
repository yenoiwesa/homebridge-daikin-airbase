const Airbase = require('../airbase-controller');
const Service = require('./service');

let Characteristic;

class Fan extends Service {
    constructor({ homebridge, log, airbase, getAllServices }) {
        super({
            log,
            airbase,
            service: new homebridge.hap.Service.Fan('Fan Speed'),
            getAllServices,
        });

        Characteristic = homebridge.hap.Characteristic;

        // On
        // boolean
        this.on = this.getCharacteristic(Characteristic.On)
            .on('get', cb =>
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

        // Fan Rotation Speed
        // Percentage
        this.fanSpeedSteps = parseFloat(
            (100 / this.airbase.info.fanRateSteps).toFixed(2)
        );

        this.rotationSpeed = this.getCharacteristic(
            Characteristic.RotationSpeed
        )
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: this.fanSpeedSteps,
            })
            .on('get', cb =>
                this.getHomekitState(
                    'fan rotation speed',
                    this.getRotationSpeed.bind(this),
                    cb
                )
            )
            .on('set', (value, cb) =>
                this.setHomekitState(
                    'fan rotation speed',
                    value,
                    this.setRotationSpeed.bind(this),
                    cb
                )
            );
    }

    async updateState(controlInfo) {
        this.on.updateValue(await this.getOn(controlInfo));
        this.rotationSpeed.updateValue(
            await this.getRotationSpeed(controlInfo)
        );
    }

    async getOn(controlInfo = null) {
        const { power } = controlInfo || (await this.airbase.getControlInfo());

        return power === Airbase.Power.ON;
    }

    async setOn(value) {
        const controlInfo = await this.airbase.setControlInfo({
            power: value ? Airbase.Power.ON : Airbase.Power.OFF,
        });

        // update side effect properties
        this.updateAll(controlInfo);
    }

    async getRotationSpeed(controlInfo = null) {
        const { fanRate } =
            controlInfo || (await this.airbase.getControlInfo());

        let fanStep;
        switch (fanRate) {
            default:
            case Airbase.FanSpeed.LOW:
                fanStep = 1;
                break;
            case Airbase.FanSpeed.MEDIUM:
                fanStep = 2;
                break;
            case Airbase.FanSpeed.HIGH:
                fanStep = 3;
                break;
        }

        return fanStep * this.fanSpeedSteps;
    }

    async setRotationSpeed(value) {
        let fanRate;
        switch (Math.round(value)) {
            case 100:
                fanRate = Airbase.FanSpeed.HIGH;
                break;
            case Math.round(this.fanSpeedSteps * 2):
                fanRate = Airbase.FanSpeed.MEDIUM;
                break;
            default:
            case Math.round(this.fanSpeedSteps):
                fanRate = Airbase.FanSpeed.LOW;
                break;
        }

        const controlInfo = await this.airbase.setControlInfo({
            fanRate,
        });

        // update side effect properties
        this.updateAll(controlInfo);
    }
}

module.exports = Fan;
