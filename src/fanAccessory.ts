import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DaikinAirbasePlatform } from './platform';
import DaikinAircon from './airbase-controller';
import { ControlInfo } from './types';
import { UpdateCharacteristicsParams } from './accessoryUpdateManager';

export class FanAccessory {
    private fanService: Service;
    private airbase: DaikinAircon;
    private fanSpeedSteps: number;
    private supportsAutoFan: boolean;

    constructor(
        private readonly platform: DaikinAirbasePlatform,
        private readonly accessory: PlatformAccessory,
        airbase: DaikinAircon
    ) {
        this.airbase = airbase;

        // Get info (throws if not initialized)
        const info = airbase.getInfo();

        // Check if auto fan is supported
        this.supportsAutoFan = info.autoFanRateSupported;

        // Calculate fan speed steps
        this.fanSpeedSteps = parseFloat((100 / info.fanRateSteps).toFixed(2));

        // Get or create FanV2 service
        const uuid = this.platform.api.hap.uuid.generate(
            `${info.ssid}:fan-service`
        );
        this.fanService =
            this.accessory.getService(this.platform.Service.Fanv2) ||
            this.accessory.addService(
                this.platform.Service.Fanv2,
                'Fan Speed',
                uuid
            );

        this.fanService.setCharacteristic(
            this.platform.Characteristic.Name,
            'Fan Speed'
        );

        // Register handlers for Active characteristic
        this.fanService
            .getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.getActive.bind(this))
            .onSet(this.setActive.bind(this));

        // Register handlers for RotationSpeed
        this.fanService
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: this.fanSpeedSteps,
            })
            .onGet(this.getRotationSpeed.bind(this))
            .onSet(this.setRotationSpeed.bind(this));

        // Add TargetFanState characteristic if auto fan is supported
        if (this.supportsAutoFan) {
            this.fanService
                .getCharacteristic(this.platform.Characteristic.TargetFanState)
                .onGet(this.getTargetFanState.bind(this))
                .onSet(this.setTargetFanState.bind(this));

            this.fanService
                .getCharacteristic(this.platform.Characteristic.CurrentFanState)
                .onGet(this.getCurrentFanState.bind(this));
        }
    }

    updateCharacteristics({ controlInfo }: UpdateCharacteristicsParams) {
        this.fanService.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.calculateActive(controlInfo)
        );
        this.fanService.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            this.calculateRotationSpeed(controlInfo)
        );

        if (this.supportsAutoFan) {
            this.fanService.updateCharacteristic(
                this.platform.Characteristic.TargetFanState,
                this.calculateTargetFanState(controlInfo)
            );
            this.fanService.updateCharacteristic(
                this.platform.Characteristic.CurrentFanState,
                this.calculateCurrentFanState(controlInfo)
            );
        }
    }

    async getActive(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return this.calculateActive(controlInfo);
    }

    private calculateActive(controlInfo: ControlInfo): number {
        // If airside fan is on, the fan accessory should show as inactive
        if (controlInfo.fanAirside === DaikinAircon.FanAirside.ON) {
            return this.platform.Characteristic.Active.INACTIVE;
        }
        return controlInfo.power === DaikinAircon.Power.ON
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }

    async setActive(value: CharacteristicValue) {
        const power =
            value === this.platform.Characteristic.Active.ACTIVE
                ? DaikinAircon.Power.ON
                : DaikinAircon.Power.OFF;

        // When turning on the fan accessory, disable airside fan
        if (value === this.platform.Characteristic.Active.ACTIVE) {
            await this.airbase.setControlInfo({
                power,
                fanAirside: DaikinAircon.FanAirside.OFF,
            });
        } else {
            await this.airbase.setControlInfo({ power });
        }
    }

    async getRotationSpeed(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return this.calculateRotationSpeed(controlInfo);
    }

    private calculateRotationSpeed(controlInfo: ControlInfo): number {
        const { power, fanRate, fanAirside } = controlInfo;

        // If airside fan is on, show rotation speed as 0
        if (fanAirside === DaikinAircon.FanAirside.ON) {
            return 0;
        }

        // Make sure to map power off to zero speed
        if (power !== DaikinAircon.Power.ON) {
            return 0;
        }

        let fanStep: number;
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

        return Math.min(Math.ceil(fanStep * this.fanSpeedSteps), 100);
    }

    async setRotationSpeed(value: CharacteristicValue) {
        let fanRate: number;
        switch (Math.round(value as number)) {
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

        // When adjusting fan speed, disable airside fan
        await this.airbase.setControlInfo({
            fanRate,
            fanAirside: DaikinAircon.FanAirside.OFF,
        });
    }

    async getTargetFanState(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return this.calculateTargetFanState(controlInfo);
    }

    private calculateTargetFanState(controlInfo: ControlInfo): number {
        return controlInfo.fanAuto === DaikinAircon.FanAuto.ON
            ? this.platform.Characteristic.TargetFanState.AUTO
            : this.platform.Characteristic.TargetFanState.MANUAL;
    }

    async setTargetFanState(value: CharacteristicValue) {
        const fanAuto =
            value === this.platform.Characteristic.TargetFanState.AUTO
                ? DaikinAircon.FanAuto.ON
                : DaikinAircon.FanAuto.OFF;

        await this.airbase.setControlInfo({
            fanAuto,
            fanAirside: DaikinAircon.FanAirside.OFF,
        });
    }

    async getCurrentFanState(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return this.calculateCurrentFanState(controlInfo);
    }

    private calculateCurrentFanState(controlInfo: ControlInfo): number {
        // If not active, return INACTIVE
        if (controlInfo.power !== DaikinAircon.Power.ON) {
            return this.platform.Characteristic.CurrentFanState.INACTIVE;
        }

        // If airside fan is on, return INACTIVE
        if (controlInfo.fanAirside === DaikinAircon.FanAirside.ON) {
            return this.platform.Characteristic.CurrentFanState.INACTIVE;
        }

        // Otherwise return BLOWING_AIR (idle state doesn't apply to fans)
        return this.platform.Characteristic.CurrentFanState.BLOWING_AIR;
    }
}
