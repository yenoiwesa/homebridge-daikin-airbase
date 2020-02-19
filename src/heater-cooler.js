const { get } = require('lodash');
const Accessory = require('./accessory');
const DaikinAircon = require('./daikin-controller');

let Service;
let Characteristic;

class HeaterCooler extends Accessory {
    constructor({ homebridge, log, aircon }) {
        super({ homebridge, log, aircon });

        // Service and Characteristic are from hap-nodejs
        Service = homebridge.hap.Service;
        Characteristic = homebridge.hap.Characteristic;

        const service = new Service.HeaterCooler(this.name);

        // Active
        // INACTIVE (0) | ACTIVE (1)
        this.active = service
            .getCharacteristic(Characteristic.Active)
            .on('get', cb =>
                this.getHomekitState(
                    'active state',
                    this.getActive.bind(this),
                    cb
                )
            )
            .on('set', (value, cb) =>
                this.setHomekitState(
                    'active state',
                    value,
                    this.setActive.bind(this),
                    cb
                )
            );

        // Current Heater Cooler State
        // INACTIVE (0) | IDLE (1) | HEATING (2) | COOLING (3)
        this.currentHeaterCoolerState = service
            .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .on('get', cb =>
                this.getHomekitState(
                    'current heater/cooler state',
                    this.getCurrentHeaterCoolerState.bind(this),
                    cb
                )
            );

        // Target Heater Cooler State
        // AUTO (0) | HEAT (1) | COOL (2)
        const validTargetHeaterCoolerStates = [
            Characteristic.TargetHeaterCoolerState.COOL,
            Characteristic.TargetHeaterCoolerState.HEAT,
        ];
        if (this.aircon.info.autoModeSupported) {
            validTargetHeaterCoolerStates.push(
                Characteristic.TargetHeaterCoolerState.AUTO
            );
        }

        this.targetHeaterCoolerState = service
            .getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                validValues: validTargetHeaterCoolerStates,
            })
            .on('get', cb =>
                this.getHomekitState(
                    'target heater/cooler state',
                    this.getTargetHeaterCoolerState.bind(this),
                    cb
                )
            )
            .on('set', (value, cb) =>
                this.setHomekitState(
                    'target heater/cooler state',
                    value,
                    this.setTargetHeaterCoolerState.bind(this),
                    cb
                )
            );

        // Current Temperature
        this.currentTemperature = service
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', cb =>
                this.getHomekitState(
                    'current temperature',
                    this.getCurrentTemperature.bind(this),
                    cb
                )
            );

        // Cooling Threshold Temperature
        this.coolingThresholdTemperature = service
            .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: this.aircon.info.coolMinTemperature,
                maxValue: this.aircon.info.coolMaxTemperature,
                minStep: 1,
            })
            .on('get', cb =>
                this.getHomekitState(
                    'cooling threshold temperature',
                    this.getCoolingThresholdTemperature.bind(this),
                    cb
                )
            )
            .on('set', (value, cb) =>
                this.setHomekitState(
                    'cooling threshold temperature',
                    value,
                    this.setCoolingThresholdTemperature.bind(this),
                    cb
                )
            );

        // Heating Threshold Temperature
        this.heatingThresholdTemperature = service
            .getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: this.aircon.info.heatMinTemperature,
                maxValue: this.aircon.info.heatMaxTemperature,
                minStep: 1,
            })
            .on('get', cb =>
                this.getHomekitState(
                    'heating threshold temperature',
                    this.getHeatingThresholdTemperature.bind(this),
                    cb
                )
            )
            .on('set', (value, cb) =>
                this.setHomekitState(
                    'heating threshold temperature',
                    value,
                    this.setHeatingThresholdTemperature.bind(this),
                    cb
                )
            );

        // Temperature Unit
        // CELSIUS | FAHRENHEIT
        this.temperatureDisplayUnits = service
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .setProps({
                validValues: [Characteristic.TemperatureDisplayUnits.CELSIUS],
            })
            .updateValue(Characteristic.TemperatureDisplayUnits.CELSIUS);

        // Fan Rotation Speed
        // Percentage
        if (this.aircon.info.fanRateSupported) {
            this.fanSpeedSteps = parseFloat(
                (100 / this.aircon.info.fanRateSteps).toFixed(2)
            );

            this.fanRotationSpeed = service
                .getCharacteristic(Characteristic.RotationSpeed)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: this.fanSpeedSteps,
                })
                .on('get', cb =>
                    this.getHomekitState(
                        'fan rotation speed',
                        this.getFanRotationSpeed.bind(this),
                        cb
                    )
                )
                .on('set', (value, cb) =>
                    this.setHomekitState(
                        'fan rotation speed',
                        value,
                        this.setFanRotationSpeed.bind(this),
                        cb
                    )
                );
        }

        this.addService(service);
    }

    async getActive() {
        const { power } = await this.aircon.getControlInfo();

        return power === DaikinAircon.Power.ON
            ? Characteristic.Active.ACTIVE
            : Characteristic.Active.INACTIVE;
    }

    async setActive(value) {
        const power =
            value === Characteristic.Active.ACTIVE
                ? DaikinAircon.Power.ON
                : DaikinAircon.Power.OFF;

        return this.aircon.setControlInfo({
            power,
        });
    }

    async calculateHeatingCoolingState(
        mode,
        targetTemperature,
        modeTargetTemperature
    ) {
        let currentHeaterCoolerState;

        const { indoorTemperature } = await this.aircon.getSensorInfo();

        const setHeating = () => {
            const heatingTarget = get(
                modeTargetTemperature,
                DaikinAircon.Mode.HEAT,
                targetTemperature
            );

            currentHeaterCoolerState =
                indoorTemperature < heatingTarget
                    ? Characteristic.CurrentHeaterCoolerState.HEATING
                    : Characteristic.CurrentHeaterCoolerState.IDLE;
        };

        const setCooling = () => {
            const coolingTarget = get(
                modeTargetTemperature,
                DaikinAircon.Mode.COOL,
                targetTemperature
            );

            currentHeaterCoolerState =
                indoorTemperature > coolingTarget
                    ? Characteristic.CurrentHeaterCoolerState.COOLING
                    : Characteristic.CurrentHeaterCoolerState.IDLE;
        };

        switch (mode) {
            case DaikinAircon.Mode.HEAT:
                setHeating();
                break;
            case DaikinAircon.Mode.COOL:
                setCooling();
                break;
            case DaikinAircon.Mode.AUTO:
                setHeating();
                if (
                    currentHeaterCoolerState ===
                    Characteristic.CurrentHeaterCoolerState.IDLE
                ) {
                    setCooling();
                }
                break;
            case DaikinAircon.Mode.DRY:
            case DaikinAircon.Mode.FAN:
            default:
                currentHeaterCoolerState =
                    Characteristic.CurrentHeaterCoolerState.IDLE;
                break;
        }

        return currentHeaterCoolerState;
    }

    async getCurrentHeaterCoolerState() {
        let currentHeaterCoolerState;

        const {
            power,
            mode,
            targetTemperature,
            modeTargetTemperature,
        } = await this.aircon.getControlInfo();

        if (!power) {
            currentHeaterCoolerState =
                Characteristic.CurrentHeaterCoolerState.INACTIVE;
        } else {
            currentHeaterCoolerState = await this.calculateHeatingCoolingState(
                mode,
                targetTemperature,
                modeTargetTemperature
            );
        }

        return currentHeaterCoolerState;
    }

    async getTargetHeaterCoolerState() {
        let targetHeaterCoolerState;

        const { mode } = await this.aircon.getControlInfo();

        switch (mode) {
            case DaikinAircon.Mode.HEAT:
                targetHeaterCoolerState =
                    Characteristic.TargetHeaterCoolerState.HEAT;
                break;
            case DaikinAircon.Mode.COOL:
                targetHeaterCoolerState =
                    Characteristic.TargetHeaterCoolerState.COOL;
                break;
            case DaikinAircon.Mode.AUTO:
                targetHeaterCoolerState =
                    Characteristic.TargetHeaterCoolerState.AUTO;
                break;
            case DaikinAircon.Mode.DRY:
            case DaikinAircon.Mode.FAN:
            default:
                targetHeaterCoolerState = null;
                break;
        }

        return targetHeaterCoolerState;
    }

    async setTargetHeaterCoolerState(value) {
        const {
            targetTemperature,
            modeTargetTemperature,
        } = await this.aircon.getControlInfo();

        let mode;

        switch (value) {
            case Characteristic.TargetHeaterCoolerState.HEAT:
                mode = DaikinAircon.Mode.HEAT;
                break;
            case Characteristic.TargetHeaterCoolerState.COOL:
                mode = DaikinAircon.Mode.COOL;
                break;
            case Characteristic.TargetHeaterCoolerState.AUTO:
                mode = DaikinAircon.Mode.AUTO;
                break;
        }

        if (!mode) {
            this.log.info(
                `Unmapped value for target heater/cooler state, doing nothing: ${value}`
            );

            return;
        }

        await this.aircon.setControlInfo({
            mode,
            targetTemperature: modeTargetTemperature[mode] || targetTemperature,
        });

        // update side effect properties
        this.active.updateValue(Characteristic.Active.ACTIVE);
        this.currentHeaterCoolerState.updateValue(
            await this.calculateHeatingCoolingState(
                mode,
                targetTemperature,
                modeTargetTemperature
            )
        );
    }

    async getCurrentTemperature() {
        const { indoorTemperature } = await this.aircon.getSensorInfo();

        return indoorTemperature;
    }

    async getCoolingThresholdTemperature() {
        const {
            targetTemperature,
            modeTargetTemperature,
        } = await this.aircon.getControlInfo();

        return (
            modeTargetTemperature[DaikinAircon.Mode.COOL] || targetTemperature
        );
    }

    async getHeatingThresholdTemperature() {
        const {
            targetTemperature,
            modeTargetTemperature,
        } = await this.aircon.getControlInfo();

        return (
            modeTargetTemperature[DaikinAircon.Mode.HEAT] || targetTemperature
        );
    }

    async setCoolingThresholdTemperature(value) {
        const { mode } = await this.aircon.getControlInfo();

        await this.aircon.setControlInfo({
            targetTemperature: value,
        });

        // update side effect properties
        this.currentHeaterCoolerState.updateValue(
            await this.calculateHeatingCoolingState(mode, value)
        );
    }

    async setHeatingThresholdTemperature(value) {
        const { mode } = await this.aircon.getControlInfo();

        await this.aircon.setControlInfo({
            targetTemperature: value,
        });

        // update side effect properties
        this.currentHeaterCoolerState.updateValue(
            await this.calculateHeatingCoolingState(mode, value)
        );
    }

    async getFanRotationSpeed() {
        const { fanRate } = await this.aircon.getControlInfo();

        let fanStep;
        switch (fanRate) {
            default:
            case DaikinAircon.FanSpeed.LOW:
                fanStep = 1;
                break;
            case DaikinAircon.FanSpeed.MEDIUM:
                fanStep = 2;
                break;
            case DaikinAircon.FanSpeed.HIGH:
                fanStep = 3;
                break;
        }

        return fanStep * this.fanSpeedSteps;
    }

    async setFanRotationSpeed(value) {
        let fanRate;
        switch (Math.round(value)) {
            case 100:
                fanRate = DaikinAircon.FanSpeed.HIGH;
                break;
            case Math.round(this.fanSpeedSteps * 2):
                fanRate = DaikinAircon.FanSpeed.MEDIUM;
                break;
            default:
            case Math.round(this.fanSpeedSteps):
                fanRate = DaikinAircon.FanSpeed.LOW;
                break;
        }

        return this.aircon.setControlInfo({
            fanRate,
        });
    }
}

module.exports = HeaterCooler;
