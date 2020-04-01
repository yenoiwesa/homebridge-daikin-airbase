const ZoneSwitch = require('../services/zone-switch');
const Accessory = require('./accessory');

class ZoneControl extends Accessory {
    constructor({ homebridge, log, airbase, config, zoneNames }) {
        super({ homebridge, log, airbase, config });

        const updateAllServices = this.updateAllServices.bind(this);

        for (const zoneName of zoneNames) {
            this.addService(
                new ZoneSwitch({
                    homebridge,
                    log,
                    airbase,
                    updateAllServices,
                    zoneName,
                })
            );
        }

        this.initPolling();
    }

    async updateAllServices({ zoneSetting } = {}) {
        zoneSetting = zoneSetting || (await this.airbase.getZoneSetting());

        for (const service of this.getServices()) {
            service.updateState({ zoneSetting });
        }
    }

    get name() {
        return `${this.airbase.info.name} Zones`;
    }
}

module.exports = ZoneControl;
