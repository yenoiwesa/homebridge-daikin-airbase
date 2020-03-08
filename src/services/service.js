class Service {
    constructor({ log, airbase, service, updateAllServices }) {
        this.log = log;
        this.airbase = airbase;
        this.service = service;
        this.updateAllServices = updateAllServices;
    }

    // eslint-disable-next-line no-unused-vars
    updateState({ controlInfo, sensorInfo }) {
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
