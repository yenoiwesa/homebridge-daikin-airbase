import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DaikinAirbasePlatform } from './platform';
import DaikinAircon from './airbase-controller';
import { ControlInfo } from './types';
import { UpdateCharacteristicsParams } from './accessoryUpdateManager';

export class AutoFanSwitchAccessory {
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

        // Get or create Switch service for Auto Fan
        const uuid = this.platform.api.hap.uuid.generate(
            `${info.ssid}:auto-fan-switch-service`
        );
        this.switchService =
            this.accessory.getService(this.platform.Service.Switch) ||
            this.accessory.addService(
                this.platform.Service.Switch,
                'Auto Fan',
                uuid
            );

        this.switchService.setCharacteristic(
            this.platform.Characteristic.Name,
            'Auto Fan'
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
        return controlInfo.fanAuto === DaikinAircon.FanAuto.ON;
    }

    async setOn(value: CharacteristicValue) {
        if (value === true) {
            await this.airbase.setControlInfo({
                fanAuto: DaikinAircon.FanAuto.ON,
                fanAirside: DaikinAircon.FanAirside.OFF,
            });
        } else {
            await this.airbase.setControlInfo({
                fanAuto: DaikinAircon.FanAuto.OFF,
            });
        }
    }
}
