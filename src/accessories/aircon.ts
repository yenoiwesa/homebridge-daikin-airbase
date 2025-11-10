import { API, Logging, PlatformAccessory } from 'homebridge';
import { get } from 'lodash';
import HeaterCooler from '../services/heater-cooler';
import Fan from '../services/fan';
import FanModeSwitch from '../services/fan-mode-switch';
import DryModeSwitch from '../services/dry-mode-switch';
import Accessory from './accessory';
import { AccessoryContext } from '../types';

export default class Aircon extends Accessory {
    constructor({
        api,
        log,
        homekitAccessory,
        config,
    }: {
        api: API;
        log: Logging;
        homekitAccessory: PlatformAccessory<AccessoryContext>;
        config: any;
    }) {
        super({ api, log, homekitAccessory, config });

        this.addService(
            new HeaterCooler({
                api,
                log,
                accessory: this,
            })
        );

        const isFanRateSupported = get(
            config,
            'overrides.fanRateSupported',
            this.context.airbase.fanRateSupported
        );
        if (isFanRateSupported) {
            this.addService(new Fan({ api, log, accessory: this }));
        }

        const isFanModeSupported = get(
            config,
            'overrides.fanModeSupported',
            true
        );
        if (isFanModeSupported) {
            this.addService(new FanModeSwitch({ api, log, accessory: this }));
        }

        const isDryModeSupported = get(
            config,
            'overrides.dryModeSupported',
            this.context.airbase.dryModeSupported
        );
        if (isDryModeSupported) {
            this.addService(
                new DryModeSwitch({
                    api,
                    log,
                    accessory: this,
                })
            );
        }
    }
}
