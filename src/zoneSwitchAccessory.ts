import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DaikinAirbasePlatform } from './platform';
import DaikinAircon from './airbase-controller';
import { ZoneSetting } from './types';

export class ZoneSwitchAccessory {
    private switchService: Service;
    private airbase: DaikinAircon;
    private zoneName: string;

    constructor(
        private readonly platform: DaikinAirbasePlatform,
        private readonly accessory: PlatformAccessory,
        airbase: DaikinAircon,
        zoneName: string
    ) {
        this.airbase = airbase;
        this.zoneName = zoneName;

        // Get or create Switch service for Zone
        const uuid = this.platform.api.hap.uuid.generate(
            `${airbase.info.ssid}:zone-${zoneName}-service`
        );
        this.switchService =
            this.accessory.getService(this.platform.Service.Switch) ||
            this.accessory.addService(
                this.platform.Service.Switch,
                zoneName,
                uuid
            );

        this.switchService.setCharacteristic(
            this.platform.Characteristic.Name,
            zoneName
        );

        // Register handlers for characteristics
        this.switchService
            .getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));
    }

    updateCharacteristics(zoneSetting: ZoneSetting) {
        this.switchService.updateCharacteristic(
            this.platform.Characteristic.On,
            this.calculateOn(zoneSetting)
        );
    }

    async getOn(): Promise<CharacteristicValue> {
        const zoneSetting = await this.airbase.getZoneSetting();
        return this.calculateOn(zoneSetting);
    }

    private calculateOn(zoneSetting: ZoneSetting): boolean {
        const power = zoneSetting[this.zoneName];
        return power === DaikinAircon.Power.ON;
    }

    async setOn(value: CharacteristicValue) {
        const power =
            value === true ? DaikinAircon.Power.ON : DaikinAircon.Power.OFF;

        await this.airbase.setZoneSetting({
            [this.zoneName]: power,
        });
    }
}
