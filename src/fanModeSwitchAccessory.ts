import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DaikinAirbasePlatform } from './platform';
import DaikinAircon from './airbase-controller';
import { ControlInfo } from './types';
import { UpdateCharacteristicsParams } from './pollingManager';

export class FanModeSwitchAccessory {
    private switchService: Service;
    private airbase: DaikinAircon;

    constructor(
        private readonly platform: DaikinAirbasePlatform,
        private readonly accessory: PlatformAccessory,
        airbase: DaikinAircon
    ) {
        this.airbase = airbase;

        // Get info (throws if not initialized)
        const info = airbase.getInfo();

        // Get or create Switch service for Fan Mode
        const uuid = this.platform.api.hap.uuid.generate(
            `${info.ssid}:fan-mode-switch-service`
        );
        this.switchService =
            this.accessory.getService(this.platform.Service.Switch) ||
            this.accessory.addService(
                this.platform.Service.Switch,
                'Fan Mode',
                uuid
            );

        this.switchService.setCharacteristic(
            this.platform.Characteristic.Name,
            'Fan Mode'
        );

        // Register handlers for characteristics
        this.switchService
            .getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));
    }

    updateCharacteristics({ controlInfo }: UpdateCharacteristicsParams) {
        this.switchService.updateCharacteristic(
            this.platform.Characteristic.On,
            this.calculateOn(controlInfo)
        );
    }

    async getOn(): Promise<CharacteristicValue> {
        const controlInfo = await this.airbase.getControlInfo();
        return this.calculateOn(controlInfo);
    }

    private calculateOn(controlInfo: ControlInfo): boolean {
        const { power, mode } = controlInfo;
        return (
            power === DaikinAircon.Power.ON && mode === DaikinAircon.Mode.FAN
        );
    }

    async setOn(value: CharacteristicValue) {
        if (value === true) {
            await this.airbase.setControlInfo({
                power: DaikinAircon.Power.ON,
                mode: DaikinAircon.Mode.FAN,
            });
        } else {
            await this.airbase.setControlInfo({
                power: DaikinAircon.Power.OFF,
            });
        }
    }
}
