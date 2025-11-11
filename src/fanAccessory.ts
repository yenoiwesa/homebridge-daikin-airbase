import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DaikinAirbasePlatform } from './platform';
import DaikinAircon from './airbase-controller';
import { ControlInfo } from './types';
import { UpdateCharacteristicsParams } from './accessoryUpdateManager';

export class FanAccessory {
    private fanService: Service;
    private airbase: DaikinAircon;
    private fanSpeedSteps: number;

    constructor(
        private readonly platform: DaikinAirbasePlatform,
        private readonly accessory: PlatformAccessory,
        airbase: DaikinAircon
    ) {
        this.airbase = airbase;

        // Get info (throws if not initialized)
        const info = airbase.getInfo();

        // Calculate fan speed steps
        this.fanSpeedSteps = parseFloat((100 / info.fanRateSteps).toFixed(2));

        // Get or create Fan service
        const uuid = this.platform.api.hap.uuid.generate(
            `${info.ssid}:fan-service`
        );
        this.fanService =
            this.accessory.getService(this.platform.Service.Fan) ||
            this.accessory.addService(
                this.platform.Service.Fan,
                'Fan Speed',
                uuid
            );

        this.fanService.setCharacteristic(
            this.platform.Characteristic.Name,
            'Fan Speed'
        );

        // Register handlers for characteristics
        this.fanService
            .getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));

        this.fanService
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: this.fanSpeedSteps,
            })
            .onGet(this.getRotationSpeed.bind(this))
            .onSet(this.setRotationSpeed.bind(this));
    }

    updateCharacteristics({ controlInfo }: UpdateCharacteristicsParams) {
        this.fanService.updateCharacteristic(
            this.platform.Characteristic.On,
            this.calculateOn(controlInfo)
        );
        this.fanService.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            this.calculateRotationSpeed(controlInfo)
        );
    }

    async getOn(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return this.calculateOn(controlInfo);
    }

    private calculateOn(controlInfo: ControlInfo): boolean {
        // If airside fan is on, the fan accessory should show as off
        if (controlInfo.fanAirside === DaikinAircon.FanAirside.ON) {
            return false;
        }
        return controlInfo.power === DaikinAircon.Power.ON;
    }

    async setOn(value: CharacteristicValue) {
        const power =
            value === true ? DaikinAircon.Power.ON : DaikinAircon.Power.OFF;

        // When turning on the fan accessory, disable airside fan and fan auto
        if (value === true) {
            await this.airbase.setControlInfo({
                power,
                fanAirside: DaikinAircon.FanAirside.OFF,
                fanAuto: DaikinAircon.FanAuto.OFF,
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

        // When adjusting fan speed, disable airside fan and fan auto
        await this.airbase.setControlInfo({
            fanRate,
            fanAirside: DaikinAircon.FanAirside.OFF,
            fanAuto: DaikinAircon.FanAuto.OFF,
        });
    }
}
