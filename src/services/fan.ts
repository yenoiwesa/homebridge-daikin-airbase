import { API, Characteristic } from 'homebridge';
import Service from './service';
import { ControlInfo, UpdateStateParams } from '../types';
import DaikinAircon from '../airbase-controller';

export default class Fan extends Service {
    private on: Characteristic;
    private rotationSpeed: Characteristic;
    private fanSpeedSteps: number;

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
                type: api.hap.Service.Fan,
                name: 'Fan Speed',
                subType: 'fan-speed',
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

        // Fan Rotation Speed
        // Percentage
        this.fanSpeedSteps = parseFloat(
            (100 / accessory.context.airbase.fanRateSteps).toFixed(2)
        );

        this.rotationSpeed = this.getCharacteristic(
            this.api.hap.Characteristic.RotationSpeed
        )
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: this.fanSpeedSteps,
            })
            .on('get', (cb: any) =>
                this.getHomekitState(
                    'fan rotation speed',
                    this.getRotationSpeed.bind(this),
                    cb
                )
            )
            .on('set', (value: any, cb: any) =>
                this.setHomekitState(
                    'fan rotation speed',
                    value,
                    this.setRotationSpeed.bind(this),
                    cb
                )
            );
    }

    async updateState({ controlInfo }: UpdateStateParams): Promise<void> {
        if (controlInfo) {
            this.on.updateValue(await this.getOn(controlInfo));
            this.rotationSpeed.updateValue(
                await this.getRotationSpeed(controlInfo)
            );
        }
    }

    async getOn(controlInfo?: ControlInfo): Promise<boolean> {
        const { power } = controlInfo || (await this.airbase.getControlInfo());

        return power === DaikinAircon.Power.ON;
    }

    async setOn(value: boolean): Promise<void> {
        const controlInfo = await this.airbase.setControlInfo({
            power: value ? DaikinAircon.Power.ON : DaikinAircon.Power.OFF,
        });

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }

    async getRotationSpeed(controlInfo?: ControlInfo): Promise<number> {
        const { power, fanRate } =
            controlInfo || (await this.airbase.getControlInfo());

        // make sure to map power off to zero speed
        // otherwise the Home app has display consistency issues
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

    async setRotationSpeed(value: number): Promise<void> {
        let fanRate: number;
        switch (Math.round(value)) {
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

        const controlInfo = await this.airbase.setControlInfo({
            fanRate,
        });

        // update side effect properties
        this.updateAllServices({ controlInfo });
    }
}
