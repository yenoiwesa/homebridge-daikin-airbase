import {
    API,
    Logging,
    Service as HAPService,
    Characteristic as HAPCharacteristic,
    WithUUID,
} from 'homebridge';
import { ServiceDescriptor, UpdateStateParams } from '../types';

export default class Service {
    protected log: Logging;
    protected api: API;
    protected accessory: any;
    protected service: HAPService;

    constructor({
        api,
        log,
        accessory,
        descriptor,
    }: {
        api: API;
        log: Logging;
        accessory: any;
        descriptor: ServiceDescriptor;
    }) {
        this.api = api;
        this.log = log;
        this.accessory = accessory;
        this.service = this.getOrCreateHomekitService(descriptor);
    }

    protected getOrCreateHomekitService({
        type,
        name,
        subType,
    }: ServiceDescriptor): HAPService {
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

    protected get airbase(): any {
        return this.accessory.airbase;
    }

    protected async updateAllServices(
        values: UpdateStateParams
    ): Promise<void> {
        return this.airbase.updateSubscribedServices(values);
    }

    updateState(_values: UpdateStateParams): void {
        // to be implemented in children classes
    }

    getHomekitService(): HAPService {
        return this.service;
    }

    protected getCharacteristic(
        characteristic: WithUUID<new () => HAPCharacteristic>
    ): HAPCharacteristic {
        return this.service.getCharacteristic(characteristic);
    }

    protected async getHomekitState(
        state: string,
        getStateFn: () => Promise<any>,
        callback: (error: any, value?: any) => void
    ): Promise<void> {
        this.log.debug(`Get ${this.constructor.name} ${state}`);

        if (!this.airbase) {
            callback('No airbase is associated to this service');
            this.log.debug(
                `No airbase is associated to ${this.accessory.name}`
            );
            return;
        }

        try {
            const value = await getStateFn();

            this.log.debug(
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

    protected async setHomekitState(
        state: string,
        value: any,
        setStateFn: (value: any) => Promise<void>,
        callback: (error?: any) => void
    ): Promise<void> {
        this.log.debug(
            `Set ${this.constructor.name} ${state} with value: ${value}`
        );

        if (!this.airbase) {
            callback('No airbase is associated to this service');
            this.log.debug(
                `No airbase is associated to ${this.accessory.name}`
            );
            return;
        }

        try {
            await setStateFn(value);

            this.log.debug(
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
