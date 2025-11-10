import { API, Characteristic } from 'homebridge';
import Service from './service';
import { ControlInfo, UpdateStateParams } from '../types';
import DaikinAircon from '../airbase-controller';

export default class DryModeSwitch extends Service {
    private on: Characteristic;

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
            api,
            log,
            accessory,
            descriptor: {
                type: api.hap.Service.Switch,
                name: 'Dry Mode',
                subType: 'dry',
            },
        });

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

    async updateState({ controlInfo }: UpdateStateParams): Promise<void> {
        if (controlInfo) {
            this.on.updateValue(await this.getOn(controlInfo));
        }
    }

    async getOn(controlInfo?: ControlInfo): Promise<boolean> {
        const { power, mode } =
            controlInfo || (await this.getAirbase().getControlInfo());

        return (
            power === DaikinAircon.Power.ON && mode === DaikinAircon.Mode.DRY
        );
    }

    async setOn(value: boolean): Promise<void> {
        let controlInfo: ControlInfo;

        if (value) {
            controlInfo = await this.getAirbase().setControlInfo({
                power: DaikinAircon.Power.ON,
                mode: DaikinAircon.Mode.DRY,
            });
        } else {
            controlInfo = await this.getAirbase().setControlInfo({
                power: DaikinAircon.Power.OFF,
            });
        }

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }
}
