import { API, Characteristic } from 'homebridge';
import { get } from 'lodash';
import Service from './service';
import { ControlInfo, SensorInfo, UpdateStateParams } from '../types';
import DaikinAircon from '../airbase-controller';

let CharacteristicType: typeof Characteristic;

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
            log,
            accessory,
            descriptor: {
                type: api.hap.Service.HeaterCooler,
                name: 'Heat & Cool',
                subType: 'heater-cooler',
            },
        });

        CharacteristicType = api.hap.Characteristic;

        // Active
        // INACTIVE (0) | ACTIVE (1)
        this.active = this.getCharacteristic(CharacteristicType.Active)
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
            CharacteristicType.CurrentHeaterCoolerState
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
            CharacteristicType.TargetHeaterCoolerState.COOL,
            CharacteristicType.TargetHeaterCoolerState.HEAT,
        ];
        if (accessory.context.airbase.autoModeSupported) {
            validTargetHeaterCoolerStates.push(
                CharacteristicType.TargetHeaterCoolerState.AUTO
            );
        }

        this.targetHeaterCoolerState = this.getCharacteristic(
            CharacteristicType.TargetHeaterCoolerState
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
            CharacteristicType.CurrentTemperature
        ).on('get', (cb: any) =>
            this.getHomekitState(
                'current temperature',
                this.getCurrentTemperature.bind(this),
                cb
            )
        );

        // Cooling Threshold Temperature
        this.coolingThresholdTemperature = this.getCharacteristic(
            CharacteristicType.CoolingThresholdTemperature
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
            CharacteristicType.HeatingThresholdTemperature
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
            CharacteristicType.TemperatureDisplayUnits
        )
            .setProps({
                validValues: [
                    CharacteristicType.TemperatureDisplayUnits.CELSIUS,
                ],
            })
            .updateValue(CharacteristicType.TemperatureDisplayUnits.CELSIUS);
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
            ? CharacteristicType.Active.ACTIVE
            : CharacteristicType.Active.INACTIVE;
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
            value === CharacteristicType.Active.ACTIVE
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
            CharacteristicType.CurrentHeaterCoolerState.IDLE;

        const setHeating = () => {
            const heatingTarget = get(
                modeTargetTemperature,
                DaikinAircon.Mode.HEAT,
                targetTemperature
            );

            currentHeaterCoolerState =
                indoorTemperature < heatingTarget
                    ? CharacteristicType.CurrentHeaterCoolerState.HEATING
                    : CharacteristicType.CurrentHeaterCoolerState.IDLE;
        };

        const setCooling = () => {
            const coolingTarget = get(
                modeTargetTemperature,
                DaikinAircon.Mode.COOL,
                targetTemperature
            );

            currentHeaterCoolerState =
                indoorTemperature > coolingTarget
                    ? CharacteristicType.CurrentHeaterCoolerState.COOLING
                    : CharacteristicType.CurrentHeaterCoolerState.IDLE;
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
                    CharacteristicType.CurrentHeaterCoolerState.IDLE
                ) {
                    setCooling();
                }
                break;
            default:
                currentHeaterCoolerState =
                    CharacteristicType.CurrentHeaterCoolerState.IDLE;
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

        if (active === CharacteristicType.Active.INACTIVE) {
            currentHeaterCoolerState =
                CharacteristicType.CurrentHeaterCoolerState.INACTIVE;
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
                    CharacteristicType.TargetHeaterCoolerState.HEAT;
                break;

            case DaikinAircon.Mode.AUTO:
                targetHeaterCoolerState =
                    CharacteristicType.TargetHeaterCoolerState.AUTO;
                break;
            case DaikinAircon.Mode.DRY:
            case DaikinAircon.Mode.FAN:
            case DaikinAircon.Mode.COOL:
                targetHeaterCoolerState =
                    CharacteristicType.TargetHeaterCoolerState.COOL;
                break;
            default:
                targetHeaterCoolerState =
                    CharacteristicType.TargetHeaterCoolerState.COOL;
                break;
        }

        return targetHeaterCoolerState;
    }

    async setTargetHeaterCoolerState(value: number): Promise<void> {
        let mode: number | undefined;

        switch (value) {
            case CharacteristicType.TargetHeaterCoolerState.HEAT:
                mode = DaikinAircon.Mode.HEAT;
                break;
            case CharacteristicType.TargetHeaterCoolerState.COOL:
                mode = DaikinAircon.Mode.COOL;
                break;
            case CharacteristicType.TargetHeaterCoolerState.AUTO:
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
