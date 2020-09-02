const ZoneSwitch = require('../services/zone-switch');
const Accessory = require('./accessory');

class ZoneControl extends Accessory {
    constructor({ api, log, homekitAccessory, config }) {
        super({ api, log, homekitAccessory, config });

        for (const zoneName of this.context.airbase.zoneNames) {
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

    async doUpdateAllServices({ zoneSetting } = {}) {
        zoneSetting = zoneSetting || (await this.airbase.getZoneSetting());

        for (const service of this.getServices()) {
            service.updateState({ zoneSetting });
        }
    }
}

module.exports = ZoneControl;
