class Service {
    constructor({ log, accessory, descriptor }) {
        this.log = log;
        this.accessory = accessory;
        this.service = this.getOrCreateHomekitService(descriptor);
    }

    getOrCreateHomekitService({ type, name, subType }) {
        const homekitAccessory = this.accessory.getHomekitAccessory();

        // get the service from the accessory if it exists
        // use the name first as it is more specific than the type
        let service = homekitAccessory.getService(name || type);

        // otherwise create it
        if (!service) {
            service = homekitAccessory.addService(type, name, subType);
        }

        return service;
    }

    get airbase() {
        return this.accessory.airbase;
    }

    async updateAllServices(values) {
        return this.accessory.updateAllServices(values);
    }

    // eslint-disable-next-line no-unused-vars
    updateState(values) {
        // to be implemented in children classes
    }

    getHomekitService() {
        return this.service;
    }

    getCharacteristic(characteristic) {
        return this.service.getCharacteristic(characteristic);
    }

    async getHomekitState(state, getStateFn, callback) {
        this.log.debug(`Get ${this.constructor.name} ${state}`);

        if (!this.airbase) {
            callback('No airbase is associated to this service');
            this.log.error(
                `No airbase is associated to ${this.accessory.name}`
            );
            return;
        }

        try {
            const value = await getStateFn();

            this.log.info(
                `Get ${this.constructor.name} ${state} success: ${value}`
            );
            callback(null, value);
        } catch (error) {
            this.log.error(
                `Could not fetch ${this.constructor.name} ${state}`,
                error
            );

            callback(error);
        }
    }

    async setHomekitState(state, value, setStateFn, callback) {
        this.log.debug(
            `Set ${this.constructor.name} ${state} with value: ${value}`
        );

        if (!this.airbase) {
            callback('No airbase is associated to this service');
            this.log.error(
                `No airbase is associated to ${this.accessory.name}`
            );
            return;
        }

        try {
            await setStateFn(value);

            this.log.info(
                `Set ${this.constructor.name} ${state} success: ${value}`
            );
            callback();
        } catch (error) {
            this.log.error(
                `Could not set ${this.constructor.name} ${state}`,
                error
            );

            callback(error);
        }
    }
}

module.exports = Service;
