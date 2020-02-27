const { get } = require('lodash');
const Airbase = require('../airbase-controller');
const Service = require('./service');

let Characteristic;

class HeaterCooler extends Service {
    constructor({ homebridge, log, airbase, getAllServices }) {
        super({
            log,
            airbase,
            service: new homebridge.hap.Service.HeaterCooler(
                'Heating & Cooling'
            ),
            getAllServices,
        });

        Characteristic = homebridge.hap.Characteristic;

        // Active
        // INACTIVE (0) | ACTIVE (1)
        this.active = this.getCharacteristic(Characteristic.Active)
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
        this.currentHeaterCoolerState = this.getCharacteristic(
            Characteristic.CurrentHeaterCoolerState
        ).on('get', cb =>
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
        if (this.airbase.info.autoModeSupported) {
            validTargetHeaterCoolerStates.push(
                Characteristic.TargetHeaterCoolerState.AUTO
            );
        }

        this.targetHeaterCoolerState = this.getCharacteristic(
            Characteristic.TargetHeaterCoolerState
        )
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
        this.currentTemperature = this.getCharacteristic(
            Characteristic.CurrentTemperature
        ).on('get', cb =>
            this.getHomekitState(
                'current temperature',
                this.getCurrentTemperature.bind(this),
                cb
            )
        );

        // Cooling Threshold Temperature
        this.coolingThresholdTemperature = this.getCharacteristic(
            Characteristic.CoolingThresholdTemperature
        )
            .setProps({
                minValue: this.airbase.info.coolMinTemperature,
                maxValue: this.airbase.info.coolMaxTemperature,
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
        this.heatingThresholdTemperature = this.getCharacteristic(
            Characteristic.HeatingThresholdTemperature
        )
            .setProps({
                minValue: this.airbase.info.heatMinTemperature,
                maxValue: this.airbase.info.heatMaxTemperature,
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
        this.temperatureDisplayUnits = this.getCharacteristic(
            Characteristic.TemperatureDisplayUnits
        )
            .setProps({
                validValues: [Characteristic.TemperatureDisplayUnits.CELSIUS],
            })
            .updateValue(Characteristic.TemperatureDisplayUnits.CELSIUS);
    }

    async updateState(controlInfo) {
        this.active.updateValue(await this.getActive(controlInfo));
        this.currentHeaterCoolerState.updateValue(
            await this.getCurrentHeaterCoolerState(controlInfo)
        );
        this.targetHeaterCoolerState.updateValue(
            await this.getTargetHeaterCoolerState(controlInfo)
        );
        this.coolingThresholdTemperature.updateValue(
            await this.getCoolingThresholdTemperature(controlInfo)
        );
        this.heatingThresholdTemperature.updateValue(
            await this.getHeatingThresholdTemperature(controlInfo)
        );
    }

    async getActive(controlInfo = null) {
        const { power, mode } =
            controlInfo || (await this.airbase.getControlInfo());

        // the heater cooler is active only if:
        // - powered
        // - not in fan mode
        // - not in dry mode
        return power === Airbase.Power.ON &&
            mode !== Airbase.Mode.FAN &&
            mode !== Airbase.Mode.DRY
            ? Characteristic.Active.ACTIVE
            : Characteristic.Active.INACTIVE;
    }

    async setActive(value) {
        const active = await this.getActive();

        if (active === value) {
            // if the value is not changing, do not send any request
            // (the home app sends setActive when opening
            // the accessories details)
            return;
        }

        let controlInfo;

        if (value === Characteristic.Active.ACTIVE) {
            // must set the mode here to force the airbase
            // to leave fan/dry mode if it is the active mode
            controlInfo = await this.airbase.setControlInfo({
                power: Airbase.Power.ON,
                mode: Airbase.Mode.COOL,
            });
        } else {
            controlInfo = await this.airbase.setControlInfo({
                power: Airbase.Power.OFF,
            });
        }

        // update side effect properties
        this.updateAll(controlInfo);
    }

    async calculateHeatingCoolingState({
        mode,
        targetTemperature,
        modeTargetTemperature,
    }) {
        let currentHeaterCoolerState;

        const { indoorTemperature } = await this.airbase.getSensorInfo();

        const setHeating = () => {
            const heatingTarget = get(
                modeTargetTemperature,
                Airbase.Mode.HEAT,
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
                Airbase.Mode.COOL,
                targetTemperature
            );

            currentHeaterCoolerState =
                indoorTemperature > coolingTarget
                    ? Characteristic.CurrentHeaterCoolerState.COOLING
                    : Characteristic.CurrentHeaterCoolerState.IDLE;
        };

        switch (mode) {
            case Airbase.Mode.HEAT:
                setHeating();
                break;
            case Airbase.Mode.COOL:
                setCooling();
                break;
            case Airbase.Mode.AUTO:
                setHeating();
                if (
                    currentHeaterCoolerState ===
                    Characteristic.CurrentHeaterCoolerState.IDLE
                ) {
                    setCooling();
                }
                break;
            default:
                currentHeaterCoolerState =
                    Characteristic.CurrentHeaterCoolerState.IDLE;
                break;
        }

        return currentHeaterCoolerState;
    }

    async getCurrentHeaterCoolerState(controlInfo = null) {
        let currentHeaterCoolerState;

        controlInfo = controlInfo || (await this.airbase.getControlInfo());

        const active = await this.getActive(controlInfo);

        if (active === Characteristic.Active.INACTIVE) {
            currentHeaterCoolerState =
                Characteristic.CurrentHeaterCoolerState.INACTIVE;
        } else {
            currentHeaterCoolerState = await this.calculateHeatingCoolingState(
                controlInfo
            );
        }

        return currentHeaterCoolerState;
    }

    async getTargetHeaterCoolerState(controlInfo = null) {
        let targetHeaterCoolerState;

        const { mode } = controlInfo || (await this.airbase.getControlInfo());

        switch (mode) {
            case Airbase.Mode.HEAT:
                targetHeaterCoolerState =
                    Characteristic.TargetHeaterCoolerState.HEAT;
                break;
            case Airbase.Mode.COOL:
                targetHeaterCoolerState =
                    Characteristic.TargetHeaterCoolerState.COOL;
                break;
            case Airbase.Mode.AUTO:
                targetHeaterCoolerState =
                    Characteristic.TargetHeaterCoolerState.AUTO;
                break;
            case Airbase.Mode.DRY:
            case Airbase.Mode.FAN:
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
        } = await this.airbase.getControlInfo();

        let mode;

        switch (value) {
            case Characteristic.TargetHeaterCoolerState.HEAT:
                mode = Airbase.Mode.HEAT;
                break;
            case Characteristic.TargetHeaterCoolerState.COOL:
                mode = Airbase.Mode.COOL;
                break;
            case Characteristic.TargetHeaterCoolerState.AUTO:
                mode = Airbase.Mode.AUTO;
                break;
        }

        if (!mode) {
            this.log.info(
                `Unmapped value for target heater/cooler state, doing nothing: ${value}`
            );

            return;
        }

        // setting priority to this request to make sure it overrides the mode
        // from setActive during the properties merge
        const controlInfo = await this.airbase.setControlInfo({
            mode,
            targetTemperature: modeTargetTemperature[mode] || targetTemperature,
            priority: 1,
        });

        // update side effect properties
        this.updateAll(controlInfo);
    }

    async getCurrentTemperature() {
        const { indoorTemperature } = await this.airbase.getSensorInfo();

        return indoorTemperature;
    }

    async getCoolingThresholdTemperature(controlInfo = null) {
        const { targetTemperature, modeTargetTemperature } =
            controlInfo || (await this.airbase.getControlInfo());

        return modeTargetTemperature[Airbase.Mode.COOL] || targetTemperature;
    }

    async getHeatingThresholdTemperature(controlInfo = null) {
        const { targetTemperature, modeTargetTemperature } =
            controlInfo || (await this.airbase.getControlInfo());

        return modeTargetTemperature[Airbase.Mode.HEAT] || targetTemperature;
    }

    async setCoolingThresholdTemperature(value) {
        const controlInfo = await this.airbase.setControlInfo({
            targetTemperature: value,
        });

        // update side effect properties
        this.updateAll(controlInfo);
    }

    async setHeatingThresholdTemperature(value) {
        const controlInfo = await this.airbase.setControlInfo({
            targetTemperature: value,
        });

        // update side effect properties
        this.updateAll(controlInfo);
    }
}

module.exports = HeaterCooler;
