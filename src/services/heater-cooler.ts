import { API, Characteristic } from 'homebridge';
import { get } from 'lodash';
import Service from './service';
import { ControlInfo, SensorInfo, UpdateStateParams } from '../types';
import DaikinAircon from '../airbase-controller';

export default class HeaterCooler extends Service {
    private active: Characteristic;
    private currentHeaterCoolerState: Characteristic;
    private targetHeaterCoolerState: Characteristic;
    private currentTemperature: Characteristic;
    private coolingThresholdTemperature: Characteristic;
    private heatingThresholdTemperature: Characteristic;
    private temperatureDisplayUnits: Characteristic;

    constructor({
        api,
        log,
        accessory,
    }: {
        api: API;
        log: any;
        accessory: any;
    }) {
        super({
            api,
            log,
            accessory,
            descriptor: {
                type: api.hap.Service.HeaterCooler,
                name: 'Heat & Cool',
                subType: 'heater-cooler',
            },
        });

        // Active
        // INACTIVE (0) | ACTIVE (1)
        this.active = this.getCharacteristic(this.api.hap.Characteristic.Active)
            .on('get', (cb: any) =>
                this.getHomekitState(
                    'active state',
                    this.getActive.bind(this),
                    cb
                )
            )
            .on('set', (value: any, cb: any) =>
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
            this.api.hap.Characteristic.CurrentHeaterCoolerState
        ).on('get', (cb: any) =>
            this.getHomekitState(
                'current heater/cooler state',
                this.getCurrentHeaterCoolerState.bind(this),
                cb
            )
        );

        // Target Heater Cooler State
        // AUTO (0) | HEAT (1) | COOL (2)
        const validTargetHeaterCoolerStates = [
            this.api.hap.Characteristic.TargetHeaterCoolerState.COOL,
            this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT,
        ];
        if (accessory.context.airbase.autoModeSupported) {
            validTargetHeaterCoolerStates.push(
                this.api.hap.Characteristic.TargetHeaterCoolerState.AUTO
            );
        }

        this.targetHeaterCoolerState = this.getCharacteristic(
            this.api.hap.Characteristic.TargetHeaterCoolerState
        )
            .setProps({
                validValues: validTargetHeaterCoolerStates,
            })
            .on('get', (cb: any) =>
                this.getHomekitState(
                    'target heater/cooler state',
                    this.getTargetHeaterCoolerState.bind(this),
                    cb
                )
            )
            .on('set', (value: any, cb: any) =>
                this.setHomekitState(
                    'target heater/cooler state',
                    value,
                    this.setTargetHeaterCoolerState.bind(this),
                    cb
                )
            );

        // Current Temperature
        this.currentTemperature = this.getCharacteristic(
            this.api.hap.Characteristic.CurrentTemperature
        ).on('get', (cb: any) =>
            this.getHomekitState(
                'current temperature',
                this.getCurrentTemperature.bind(this),
                cb
            )
        );

        // Cooling Threshold Temperature
        this.coolingThresholdTemperature = this.getCharacteristic(
            this.api.hap.Characteristic.CoolingThresholdTemperature
        )
            .setProps({
                minValue: accessory.context.airbase.coolMinTemperature,
                maxValue: accessory.context.airbase.coolMaxTemperature,
                minStep: 1,
            })
            .on('get', (cb: any) =>
                this.getHomekitState(
                    'cooling threshold temperature',
                    this.getCoolingThresholdTemperature.bind(this),
                    cb
                )
            )
            .on('set', (value: any, cb: any) =>
                this.setHomekitState(
                    'cooling threshold temperature',
                    value,
                    this.setCoolingThresholdTemperature.bind(this),
                    cb
                )
            );

        // Heating Threshold Temperature
        this.heatingThresholdTemperature = this.getCharacteristic(
            this.api.hap.Characteristic.HeatingThresholdTemperature
        )
            .setProps({
                minValue: accessory.context.airbase.heatMinTemperature,
                maxValue: accessory.context.airbase.heatMaxTemperature,
                minStep: 1,
            })
            .on('get', (cb: any) =>
                this.getHomekitState(
                    'heating threshold temperature',
                    this.getHeatingThresholdTemperature.bind(this),
                    cb
                )
            )
            .on('set', (value: any, cb: any) =>
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
            this.api.hap.Characteristic.TemperatureDisplayUnits
        )
            .setProps({
                validValues: [
                    this.api.hap.Characteristic.TemperatureDisplayUnits.CELSIUS,
                ],
            })
            .updateValue(
                this.api.hap.Characteristic.TemperatureDisplayUnits.CELSIUS
            );
    }

    async updateState({
        controlInfo,
        sensorInfo,
    }: UpdateStateParams): Promise<void> {
        if (controlInfo && sensorInfo) {
            this.active.updateValue(await this.getActive(controlInfo));
            this.currentHeaterCoolerState.updateValue(
                await this.getCurrentHeaterCoolerState({
                    controlInfo,
                    sensorInfo,
                })
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
            this.currentTemperature.updateValue(
                await this.getCurrentTemperature(sensorInfo)
            );
        }
    }

    async getActive(controlInfo?: ControlInfo): Promise<number> {
        const { power, mode } =
            controlInfo || (await this.airbase.getControlInfo());

        // the heater cooler is active only if:
        // - powered
        // - not in fan mode
        // - not in dry mode
        return power === DaikinAircon.Power.ON &&
            mode !== DaikinAircon.Mode.FAN &&
            mode !== DaikinAircon.Mode.DRY
            ? this.api.hap.Characteristic.Active.ACTIVE
            : this.api.hap.Characteristic.Active.INACTIVE;
    }

    async setActive(value: number): Promise<void> {
        const active = await this.getActive();

        if (active === value) {
            // if the value is not changing, do not send any request
            // (the home app sends setActive when opening
            // the accessories details)
            return;
        }

        const power =
            value === this.api.hap.Characteristic.Active.ACTIVE
                ? DaikinAircon.Power.ON
                : DaikinAircon.Power.OFF;

        const controlInfo = await this.airbase.setControlInfo({
            power,
        });

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }

    async calculateHeatingCoolingState(
        controlInfo: ControlInfo,
        sensorInfo: SensorInfo
    ): Promise<number> {
        const { mode, targetTemperature, modeTargetTemperature } = controlInfo;
        const { indoorTemperature } = sensorInfo;

        let currentHeaterCoolerState: number =
            this.api.hap.Characteristic.CurrentHeaterCoolerState.IDLE;

        const setHeating = () => {
            const heatingTarget = get(
                modeTargetTemperature,
                DaikinAircon.Mode.HEAT,
                targetTemperature
            );

            currentHeaterCoolerState =
                indoorTemperature < heatingTarget
                    ? this.api.hap.Characteristic.CurrentHeaterCoolerState
                          .HEATING
                    : this.api.hap.Characteristic.CurrentHeaterCoolerState.IDLE;
        };

        const setCooling = () => {
            const coolingTarget = get(
                modeTargetTemperature,
                DaikinAircon.Mode.COOL,
                targetTemperature
            );

            currentHeaterCoolerState =
                indoorTemperature > coolingTarget
                    ? this.api.hap.Characteristic.CurrentHeaterCoolerState
                          .COOLING
                    : this.api.hap.Characteristic.CurrentHeaterCoolerState.IDLE;
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
                    this.api.hap.Characteristic.CurrentHeaterCoolerState.IDLE
                ) {
                    setCooling();
                }
                break;
            default:
                currentHeaterCoolerState =
                    this.api.hap.Characteristic.CurrentHeaterCoolerState.IDLE;
                break;
        }

        return currentHeaterCoolerState;
    }

    async getCurrentHeaterCoolerState({
        controlInfo,
        sensorInfo,
    }: Partial<UpdateStateParams> = {}): Promise<number> {
        let currentHeaterCoolerState: number;

        const resolvedControlInfo =
            controlInfo || (await this.airbase.getControlInfo());

        const active = await this.getActive(resolvedControlInfo);

        if (active === this.api.hap.Characteristic.Active.INACTIVE) {
            currentHeaterCoolerState =
                this.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        } else {
            const resolvedSensorInfo =
                sensorInfo || (await this.airbase.getSensorInfo());

            currentHeaterCoolerState = await this.calculateHeatingCoolingState(
                resolvedControlInfo,
                resolvedSensorInfo
            );
        }

        return currentHeaterCoolerState;
    }

    async getTargetHeaterCoolerState(
        controlInfo?: ControlInfo
    ): Promise<number> {
        let targetHeaterCoolerState: number;

        const { mode } = controlInfo || (await this.airbase.getControlInfo());

        switch (mode) {
            case DaikinAircon.Mode.HEAT:
                targetHeaterCoolerState =
                    this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
                break;

            case DaikinAircon.Mode.AUTO:
                targetHeaterCoolerState =
                    this.api.hap.Characteristic.TargetHeaterCoolerState.AUTO;
                break;
            case DaikinAircon.Mode.DRY:
            case DaikinAircon.Mode.FAN:
            case DaikinAircon.Mode.COOL:
                targetHeaterCoolerState =
                    this.api.hap.Characteristic.TargetHeaterCoolerState.COOL;
                break;
            default:
                targetHeaterCoolerState =
                    this.api.hap.Characteristic.TargetHeaterCoolerState.COOL;
                break;
        }

        return targetHeaterCoolerState;
    }

    async setTargetHeaterCoolerState(value: number): Promise<void> {
        let mode: number | undefined;

        switch (value) {
            case this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT:
                mode = DaikinAircon.Mode.HEAT;
                break;
            case this.api.hap.Characteristic.TargetHeaterCoolerState.COOL:
                mode = DaikinAircon.Mode.COOL;
                break;
            case this.api.hap.Characteristic.TargetHeaterCoolerState.AUTO:
                mode = DaikinAircon.Mode.AUTO;
                break;
        }

        if (!mode) {
            this.log.debug(
                `Unmapped value for target heater/cooler state, doing nothing: ${value}`
            );

            return;
        }

        const controlInfo = await this.airbase.setControlInfo({
            mode,
        });

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }

    async getCurrentTemperature(sensorInfo?: SensorInfo): Promise<number> {
        const { indoorTemperature } =
            sensorInfo || (await this.airbase.getSensorInfo());

        return indoorTemperature;
    }

    async getCoolingThresholdTemperature(
        controlInfo?: ControlInfo
    ): Promise<number> {
        const { targetTemperature, modeTargetTemperature } =
            controlInfo || (await this.airbase.getControlInfo());

        return (
            modeTargetTemperature[DaikinAircon.Mode.COOL] || targetTemperature
        );
    }

    async getHeatingThresholdTemperature(
        controlInfo?: ControlInfo
    ): Promise<number> {
        const { targetTemperature, modeTargetTemperature } =
            controlInfo || (await this.airbase.getControlInfo());

        return (
            modeTargetTemperature[DaikinAircon.Mode.HEAT] || targetTemperature
        );
    }

    async setCoolingThresholdTemperature(value: number): Promise<void> {
        const controlInfo = await this.airbase.setControlInfo({
            modeTargetTemperature: {
                [DaikinAircon.Mode.COOL]: value,
            },
        });

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }

    async setHeatingThresholdTemperature(value: number): Promise<void> {
        const controlInfo = await this.airbase.setControlInfo({
            modeTargetTemperature: {
                [DaikinAircon.Mode.HEAT]: value,
            },
        });

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }
}
