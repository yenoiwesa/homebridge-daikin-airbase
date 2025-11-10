import { API, Logging, PlatformAccessory } from 'homebridge';
import AccessoryInformation from '../services/accessory-information';
import { AccessoryContext } from '../types';
import DaikinAircon from '../airbase-controller';

export default class Accessory {
    protected api: API;
    protected log: Logging;
    protected accessory: PlatformAccessory<AccessoryContext>;
    protected config: any;
    protected services: any[];
    public airbase?: DaikinAircon;

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
        this.api = api;
        this.log = log;
        this.accessory = homekitAccessory;
        this.config = config;
        this.services = [];

        // assign the accessory type to the context
        // so we can deserialise it at init
        this.context.type = this.constructor.name;

        this.addService(
            new AccessoryInformation({
                api,
                log,
                accessory: this,
            })
        );

        this.log.debug(`Found ${this.constructor.name} ${this.name}`);
    }

    assignAirbase(airbase: DaikinAircon): void {
        this.airbase = airbase;

        // use the most up to date airbase details in the accessory context
        this.context.airbase = airbase.toContext();

        // subscribe services
        for (const service of this.services) {
            this.airbase.subscribeService(service);
        }
    }

    addService(service: any): void {
        this.services.push(service);
    }

    getHomekitAccessory(): PlatformAccessory<AccessoryContext> {
        return this.accessory;
    }

    get context(): AccessoryContext {
        return this.accessory.context;
    }

    get name(): string {
        return this.accessory.displayName;
    }
}
