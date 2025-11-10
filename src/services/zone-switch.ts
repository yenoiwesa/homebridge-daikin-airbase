import { API, Characteristic, Logging } from 'homebridge';
import Service from './service';
import { UpdateStateParams, ZoneSetting } from '../types';
import DaikinAircon from '../airbase-controller';
import type Accessory from '../accessories/accessory';

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
        log: Logging;
        accessory: Accessory;
        zoneName: string;
    }) {
        super({
            api,
            log,
            accessory,
            descriptor: {
                type: api.hap.Service.Switch,
                name: zoneName,
                subType: `zone:${zoneName}`,
            },
        });

        this.zoneName = zoneName;

        // On
        // boolean
        this.on = this.getCharacteristic(this.api.hap.Characteristic.On)
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
        const power = (zoneSetting ||
            (await this.getAirbase().getZoneSetting()))[this.zoneName];

        return power === DaikinAircon.Power.ON;
    }

    async setOn(value: boolean): Promise<void> {
        const power = value ? DaikinAircon.Power.ON : DaikinAircon.Power.OFF;

        const zoneSetting = await this.getAirbase().setZoneSetting({
            [this.zoneName]: power,
        });

        // update side effect properties
        this.updateAllServices({ zoneSetting });
    }
}
