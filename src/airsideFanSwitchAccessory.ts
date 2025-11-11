import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DaikinAirbasePlatform } from './platform';
import DaikinAircon from './airbase-controller';
import { ControlInfo } from './types';
import { UpdateCharacteristicsParams } from './accessoryUpdateManager';

export class AirsideFanSwitchAccessory {
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

        // Get or create Switch service for Airside Fan
        const uuid = this.platform.api.hap.uuid.generate(
            `${info.ssid}:airside-fan-switch-service`
        );
        this.switchService =
            this.accessory.getService(this.platform.Service.Switch) ||
            this.accessory.addService(
                this.platform.Service.Switch,
                'Airside Fan',
                uuid
            );

        this.switchService.setCharacteristic(
            this.platform.Characteristic.Name,
            'Airside Fan'
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
        const { fanAirside } = controlInfo;
        return fanAirside === DaikinAircon.FanAirside.ON;
    }

    async setOn(value: CharacteristicValue) {
        if (value === true) {
            await this.airbase.setControlInfo({
                fanAirside: DaikinAircon.FanAirside.ON,
                fanAuto: DaikinAircon.FanAuto.OFF,
            });
        } else {
            await this.airbase.setControlInfo({
                fanAirside: DaikinAircon.FanAirside.OFF,
            });
        }
    }
}
