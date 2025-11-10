import { API, Logging, PlatformAccessory } from 'homebridge';
import ZoneSwitch from '../services/zone-switch';
import Accessory from './accessory';
import { AccessoryContext } from '../types';

export default class ZoneControl extends Accessory {
    constructor({
        api,
        log,
        homekitAccessory,
        config,
        zoneName = null,
    }: {
        api: API;
        log: Logging;
        homekitAccessory: PlatformAccessory<AccessoryContext>;
        config: any;
        zoneName?: string | null;
    }) {
        super({ api, log, homekitAccessory, config });

        // assign the zone name to the context
        // so we can deserialise it at init
        this.context.zoneName = zoneName || undefined;

        // if no zone name is passed, map all zones to this accessory
        const zoneNames =
            zoneName == null ? this.context.airbase.zoneNames : [zoneName];

        if (zoneNames) {
            for (const zoneName of zoneNames) {
                this.addService(
                    new ZoneSwitch({
                        api,
                        log,
                        accessory: this,
                        zoneName,
                    })
                );
            }
        }
    }
}
