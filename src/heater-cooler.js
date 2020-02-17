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

        // Active
        // INACTIVE (0) | ACTIVE (1)
        this.active = null;

        // Current Temperature
        this.currentTemperature = null;

        // Target Temperature
        this.coolingThresholdTemperature = null;
        this.heatingThresholdTemperature = null;

        // Heater Cooler State
        // INACTIVE (0) | IDLE (1) | HEATING (2) | COOLING (3)
        this.currentHeaterCoolerState = null;
        // AUTO (0) | HEAT (1) | COOL (2)
        this.targetHeaterCoolerState = null;

        // Temperature Unit
        // CELSIUS | FAHRENHEIT
        this.temperatureDisplayUnits =
            Characteristic.TemperatureDisplayUnits.CELSIUS;

        // Percentage
        this.fanRotationSpeed = null;

        const service = new Service.HeaterCooler(this.name);

        service
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        service
            .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .on('get', this.getCurrentHeaterCoolerState.bind(this));

        service
            .getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                validValues: [
                    Characteristic.TargetHeaterCoolerState.COOL,
                    Characteristic.TargetHeaterCoolerState.HEAT,
                ],
            })
            .on('get', this.getTargetHeaterCoolerState.bind(this))
            .on('set', this.setTargetHeaterCoolerState.bind(this));

        service
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCurrentTemperature.bind(this));

        service
            .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: this.aircon.info.coolMinTemperature,
                maxValue: this.aircon.info.coolMaxTemperature,
                minStep: 1,
            })
            .on('get', this.getCoolingThresholdTemperature.bind(this))
            .on('set', this.setCoolingThresholdTemperature.bind(this));

        service
            .getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: this.aircon.info.heatMinTemperature,
                maxValue: this.aircon.info.heatMaxTemperature,
                minStep: 1,
            })
            .on('get', this.getHeatingThresholdTemperature.bind(this))
            .on('set', this.setHeatingThresholdTemperature.bind(this));

        service
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .setProps({
                validValues: [Characteristic.TemperatureDisplayUnits.CELSIUS],
            })
            .on('get', this.getTemperatureDisplayUnits.bind(this))
            .on('set', this.setTemperatureDisplayUnits.bind(this));

        if (this.aircon.info.fanRateSupported) {
            this.fanSpeedSteps = parseFloat(
                (100 / this.aircon.info.fanRateSteps).toFixed(2)
            );

            service
                .getCharacteristic(Characteristic.RotationSpeed)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: this.fanSpeedSteps,
                })
                .on('get', this.getFanRotationSpeed.bind(this))
                .on('set', this.setFanRotationSpeed.bind(this));
        }

        this.addService(service);

        // initialise the values
        this.getCurrentHeaterCoolerState(() => {});
        this.getCurrentTemperature(() => {});
    }

    get name() {
        return 'Aircon';
    }

    async getActive(callback) {
        this.log.debug('Get active state');

        try {
            const { power } = await this.aircon.getControlInfo();

            this.active =
                power === DaikinAircon.Power.ON
                    ? Characteristic.Active.ACTIVE
                    : Characteristic.Active.INACTIVE;

            this.log.debug(`Get active state success: ${this.active}`);
            callback(null, this.active);
        } catch (error) {
            this.log.error('Could not fetch active state', error);

            callback(error);
        }
    }

    async setActive(value, callback) {
        this.log.debug(`Set active state with value: ${value}`);

        const power =
            value === Characteristic.Active.ACTIVE
                ? DaikinAircon.Power.ON
                : DaikinAircon.Power.OFF;

        try {
            await this.aircon.setControlInfo({
                power,
            });

            this.log.debug(`Set active state success: ${power}`);
            callback();
        } catch (error) {
            this.log.error('Could not set active state', error);

            callback(error);
        }
    }

    async getCurrentHeaterCoolerState(callback) {
        this.log.debug('Get current heater/cooler state');

        try {
            const { power, mode } = await this.aircon.getControlInfo();

            if (!power) {
                this.currentHeaterCoolerState =
                    Characteristic.CurrentHeaterCoolerState.INACTIVE;
            } else {
                switch (mode) {
                    case DaikinAircon.Mode.HEAT:
                        this.currentHeaterCoolerState =
                            Characteristic.CurrentHeaterCoolerState.HEATING;
                        break;
                    case DaikinAircon.Mode.COOL:
                        this.currentHeaterCoolerState =
                            Characteristic.CurrentHeaterCoolerState.COOLING;
                        break;
                    case DaikinAircon.Mode.DRY:
                    case DaikinAircon.Mode.FAN:
                    default:
                        this.currentHeaterCoolerState =
                            Characteristic.CurrentHeaterCoolerState.IDLE;
                        break;
                }
            }

            this.log.debug(
                `Get current heater/cooler state success: ${this.currentHeaterCoolerState}`
            );
            callback(null, this.currentHeaterCoolerState);
        } catch (error) {
            this.log.error(
                'Could not fetch current heater/cooler state',
                error
            );

            callback(error);
        }
    }

    async getTargetHeaterCoolerState(callback) {
        this.log.debug('Get target heater/cooler state');

        try {
            const { mode } = await this.aircon.getControlInfo();

            switch (mode) {
                case DaikinAircon.Mode.HEAT:
                    this.targetHeaterCoolerState =
                        Characteristic.TargetHeaterCoolerState.HEAT;
                    break;
                case DaikinAircon.Mode.COOL:
                    this.targetHeaterCoolerState =
                        Characteristic.TargetHeaterCoolerState.COOL;
                    break;
                case DaikinAircon.Mode.DRY:
                case DaikinAircon.Mode.FAN:
                default:
                    this.targetHeaterCoolerState = null;
                    break;
            }

            this.log.debug(
                `Get target heater/cooler state success: ${this.targetHeaterCoolerState}`
            );
            callback(null, this.targetHeaterCoolerState);
        } catch (error) {
            this.log.error('Could not fetch target heater/cooler state', error);

            callback(error);
        }
    }

    async setTargetHeaterCoolerState(value, callback) {
        this.log.debug(`Set target heater/cooler state with value: ${value}`);

        let mode;

        switch (value) {
            case Characteristic.TargetHeaterCoolerState.HEAT:
                mode = DaikinAircon.Mode.HEAT;
                break;
            case Characteristic.TargetHeaterCoolerState.COOL:
                mode = DaikinAircon.Mode.COOL;
                break;
        }

        if (!mode) {
            this.log.info(
                `Unmapped value for target heater/cooler state, doing nothing: ${value}`
            );
        }

        try {
            await this.aircon.setControlInfo({
                mode,
            });

            this.log.debug(`Set target heater/cooler state success: ${mode}`);
            callback();
        } catch (error) {
            this.log.error('Could not set target heater/cooler state', error);

            callback(error);
        }
    }

    async getCurrentTemperature(callback) {
        this.log.debug('Get current temperature');

        try {
            const { indoorTemperature } = await this.aircon.getSensorInfo();

            this.currentTemperature = indoorTemperature;

            this.log.debug(
                `Get current temperature success: ${this.currentTemperature}`
            );
            callback(null, this.currentTemperature);
        } catch (error) {
            this.log.error('Could not fetch current temperature', error);

            callback(error);
        }
    }

    async getCoolingThresholdTemperature(callback) {
        return this.getTargetTemperature('cooling', callback);
    }

    async getHeatingThresholdTemperature(callback) {
        return this.getTargetTemperature('heating', callback);
    }

    async getTargetTemperature(mode, callback) {
        this.log.debug(`Get ${mode} threshold temperature`);

        try {
            const { targetTemperature } = await this.aircon.getControlInfo();

            this.targetTemperature = targetTemperature;

            this.log.debug(
                `Get ${mode} threshold temperature success: ${this.targetTemperature}`
            );
            callback(null, this.targetTemperature);
        } catch (error) {
            this.log.error(
                `Could not fetch ${mode} threshold temperature`,
                error
            );

            callback(error);
        }
    }

    async setCoolingThresholdTemperature(value, callback) {
        return this.setTargetTemperature('cooling', value, callback);
    }

    async setHeatingThresholdTemperature(value, callback) {
        return this.setTargetTemperature('heating', value, callback);
    }

    async setTargetTemperature(mode, value, callback) {
        this.log.debug(
            `Set ${mode} threshold temperature with value: ${value}`
        );

        try {
            await this.aircon.setControlInfo({
                targetTemperature: value,
            });

            this.log.debug(
                `Set ${mode} threshold temperature success: ${value}`
            );
            callback();
        } catch (error) {
            this.log.error(
                `Could not set ${mode} threshold temperature`,
                error
            );

            callback(error);
        }
    }

    getTemperatureDisplayUnits(callback) {
        this.log.debug(
            `Get temperature display units success: ${this.temperatureDisplayUnits}`
        );
        callback(null, this.temperatureDisplayUnits);
    }

    setTemperatureDisplayUnits(value, callback) {
        this.log.debug(`Set temperature display units with value: ${value}`);
        this.temperatureDisplayUnits = value;
        callback(null);
    }

    async getFanRotationSpeed(callback) {
        this.log.debug('Get fan rotation speed');

        try {
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

            this.fanRotationSpeed = fanStep * this.fanSpeedSteps;

            this.log.debug(
                `Get fan rotation speed success: ${this.fanRotationSpeed}`
            );
            callback(null, this.fanRotationSpeed);
        } catch (error) {
            this.log.error('Could not fetch fan rotation speed', error);

            callback(error);
        }
    }

    async setFanRotationSpeed(value, callback) {
        this.log.debug(`Set fan rotation speed with value: ${value}`);

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

        try {
            await this.aircon.setControlInfo({
                fanRate,
            });

            this.log.debug(`Set fan rotation speed success: ${fanRate}`);
            callback();
        } catch (error) {
            this.log.error(
                `Could not set fan rotation speed temperature`,
                error
            );

            callback(error);
        }
    }
}

module.exports = HeaterCooler;
