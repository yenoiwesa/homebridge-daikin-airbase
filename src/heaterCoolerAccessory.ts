import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DaikinAirbasePlatform } from './platform';
import DaikinAircon from './airbase-controller';
import { ControlInfo, SensorInfo } from './types';
import { UpdateCharacteristicsParams } from './pollingManager';

export class HeaterCoolerAccessory {
    private heaterCoolerService: Service;
    private informationService: Service;
    private airbase: DaikinAircon;

    constructor(
        private readonly platform: DaikinAirbasePlatform,
        private readonly accessory: PlatformAccessory,
        airbase: DaikinAircon
    ) {
        this.airbase = airbase;

        // Get info (throws if not initialized)
        const info = airbase.getInfo();

        // Set accessory information
        this.informationService =
            this.accessory.getService(
                this.platform.Service.AccessoryInformation
            ) ||
            this.accessory.addService(
                this.platform.Service.AccessoryInformation
            );

        this.informationService
            .setCharacteristic(
                this.platform.Characteristic.Manufacturer,
                info.manufacturer
            )
            .setCharacteristic(this.platform.Characteristic.Model, info.model)
            .setCharacteristic(
                this.platform.Characteristic.SerialNumber,
                info.ssid
            )
            .setCharacteristic(
                this.platform.Characteristic.FirmwareRevision,
                info.version
            );

        // Get or create HeaterCooler service
        const heaterCoolerUUID = this.platform.api.hap.uuid.generate(
            `${info.ssid}:heater-cooler-service`
        );
        this.heaterCoolerService =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
            this.accessory.addService(
                this.platform.Service.HeaterCooler,
                info.name,
                heaterCoolerUUID
            );

        this.heaterCoolerService.setCharacteristic(
            this.platform.Characteristic.Name,
            accessory.context.name || info.name
        );

        // Register handlers for characteristics
        this.heaterCoolerService
            .getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.getActive.bind(this))
            .onSet(this.setActive.bind(this));

        this.heaterCoolerService
            .getCharacteristic(
                this.platform.Characteristic.CurrentHeaterCoolerState
            )
            .onGet(this.getCurrentHeaterCoolerState.bind(this));

        this.heaterCoolerService
            .getCharacteristic(
                this.platform.Characteristic.TargetHeaterCoolerState
            )
            .onGet(this.getTargetHeaterCoolerState.bind(this))
            .onSet(this.setTargetHeaterCoolerState.bind(this));

        this.heaterCoolerService
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));

        this.heaterCoolerService
            .getCharacteristic(
                this.platform.Characteristic.CoolingThresholdTemperature
            )
            .setProps({
                minValue: info.coolMinTemperature,
                maxValue: info.coolMaxTempertature,
                minStep: 1,
            })
            .onGet(this.getCoolingThresholdTemperature.bind(this))
            .onSet(this.setCoolingThresholdTemperature.bind(this));

        this.heaterCoolerService
            .getCharacteristic(
                this.platform.Characteristic.HeatingThresholdTemperature
            )
            .setProps({
                minValue: info.heatMinTemperature,
                maxValue: info.heatMaxTemperature,
                minStep: 1,
            })
            .onGet(this.getHeatingThresholdTemperature.bind(this))
            .onSet(this.setHeatingThresholdTemperature.bind(this));
    }

    updateCharacteristics({
        controlInfo,
        sensorInfo,
    }: UpdateCharacteristicsParams) {
        this.heaterCoolerService.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.calculateActive(controlInfo)
        );
        this.heaterCoolerService.updateCharacteristic(
            this.platform.Characteristic.CurrentHeaterCoolerState,
            this.calculateCurrentState(controlInfo, sensorInfo)
        );
        this.heaterCoolerService.updateCharacteristic(
            this.platform.Characteristic.TargetHeaterCoolerState,
            this.calculateTargetState(controlInfo)
        );
        this.heaterCoolerService.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            sensorInfo.indoorTemperature
        );
    }

    async getActive(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return this.calculateActive(controlInfo);
    }

    private calculateActive(controlInfo: ControlInfo): number {
        const { power, mode } = controlInfo;
        return power === DaikinAircon.Power.ON &&
            mode !== DaikinAircon.Mode.FAN &&
            mode !== DaikinAircon.Mode.DRY
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }

    async setActive(value: CharacteristicValue) {
        const power =
            value === this.platform.Characteristic.Active.ACTIVE
                ? DaikinAircon.Power.ON
                : DaikinAircon.Power.OFF;

        await this.airbase.setControlInfo({ power });
    }

    async getCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        const sensorInfo = await this.airbase.getSensorInfo();
        return this.calculateCurrentState(controlInfo, sensorInfo);
    }

    private calculateCurrentState(
        controlInfo: ControlInfo,
        sensorInfo: SensorInfo
    ): number {
        const { power, mode, targetTemperature, modeTargetTemperature } =
            controlInfo;
        const { indoorTemperature } = sensorInfo;

        if (
            power !== DaikinAircon.Power.ON ||
            mode === DaikinAircon.Mode.FAN ||
            mode === DaikinAircon.Mode.DRY
        ) {
            return this.platform.Characteristic.CurrentHeaterCoolerState
                .INACTIVE;
        }

        if (mode === DaikinAircon.Mode.HEAT) {
            const target =
                modeTargetTemperature[DaikinAircon.Mode.HEAT] ||
                targetTemperature;
            return indoorTemperature < target
                ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING
                : this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }

        if (mode === DaikinAircon.Mode.COOL) {
            const target =
                modeTargetTemperature[DaikinAircon.Mode.COOL] ||
                targetTemperature;
            return indoorTemperature > target
                ? this.platform.Characteristic.CurrentHeaterCoolerState.COOLING
                : this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }

        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return this.calculateTargetState(controlInfo);
    }

    private calculateTargetState(controlInfo: ControlInfo): number {
        const { mode } = controlInfo;

        if (mode === DaikinAircon.Mode.HEAT) {
            return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
        }
        if (mode === DaikinAircon.Mode.AUTO) {
            return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
        }
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
    }

    async setTargetHeaterCoolerState(value: CharacteristicValue) {
        let mode: number;

        switch (value) {
            case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
                mode = DaikinAircon.Mode.HEAT;
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
                mode = DaikinAircon.Mode.COOL;
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
                mode = DaikinAircon.Mode.AUTO;
                break;
            default:
                return;
        }

        await this.airbase.setControlInfo({ mode });
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        const sensorInfo = await this.airbase.getSensorInfo();
        return sensorInfo.indoorTemperature;
    }

    async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return (
            controlInfo.modeTargetTemperature[DaikinAircon.Mode.COOL] ||
            controlInfo.targetTemperature
        );
    }

    async setCoolingThresholdTemperature(value: CharacteristicValue) {
        await this.airbase.setControlInfo({
            modeTargetTemperature: {
                [DaikinAircon.Mode.COOL]: value as number,
            },
        });
    }

    async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return (
            controlInfo.modeTargetTemperature[DaikinAircon.Mode.HEAT] ||
            controlInfo.targetTemperature
        );
    }

    async setHeatingThresholdTemperature(value: CharacteristicValue) {
        await this.airbase.setControlInfo({
            modeTargetTemperature: {
                [DaikinAircon.Mode.HEAT]: value as number,
            },
        });
    }
}
