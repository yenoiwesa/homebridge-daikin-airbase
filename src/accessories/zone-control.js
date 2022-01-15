const ZoneSwitch = require('../services/zone-switch');
const Accessory = require('./accessory');

class ZoneControl extends Accessory {
    constructor({ api, log, homekitAccessory, config, zoneName = null }) {
        super({ api, log, homekitAccessory, config });

        // assign the zone name to the context
        // so we can deserialise it at init
        this.context.zoneName = zoneName;

        // if no zone name is passed, map all zones to this accessory
        const zoneNames =
            zoneName == null ? this.context.airbase.zoneNames : [zoneName];

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

module.exports = ZoneControl;
