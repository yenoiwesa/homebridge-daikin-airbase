import { API, Characteristic } from 'homebridge';
import Service from './service';
import { UpdateStateParams, ZoneSetting } from '../types';
import DaikinAircon from '../airbase-controller';

let CharacteristicType: typeof Characteristic;

export default class ZoneSwitch extends Service {
    private on: Characteristic;
    private zoneName: string;

    constructor({
        api,
        log,
        accessory,
        zoneName,
    }: {
        api: API;
        log: any;
        accessory: any;
        zoneName: string;
    }) {
        super({
            log,
            accessory,
            descriptor: {
                type: api.hap.Service.Switch,
                name: zoneName,
                subType: `zone:${zoneName}`,
            },
        });

        CharacteristicType = api.hap.Characteristic;

        this.zoneName = zoneName;

        // On
        // boolean
        this.on = this.getCharacteristic(CharacteristicType.On)
            .on('get', (cb: any) =>
                this.getHomekitState('on state', this.getOn.bind(this), cb)
            )
            .on('set', (value: any, cb: any) =>
                this.setHomekitState(
                    'on state',
                    value,
                    this.setOn.bind(this),
                    cb
                )
            );
    }

    async updateState({ zoneSetting }: UpdateStateParams): Promise<void> {
        if (zoneSetting) {
            this.on.updateValue(await this.getOn(zoneSetting));
        }
    }

    async getOn(zoneSetting?: ZoneSetting): Promise<boolean> {
        const power = (zoneSetting || (await this.airbase.getZoneSetting()))[
            this.zoneName
        ];

        return power === DaikinAircon.Power.ON;
    }

    async setOn(value: boolean): Promise<void> {
        const power = value ? DaikinAircon.Power.ON : DaikinAircon.Power.OFF;

        const zoneSetting = await this.airbase.setZoneSetting({
            [this.zoneName]: power,
        });

        // update side effect properties
        this.updateAllServices({ zoneSetting });
    }
}
