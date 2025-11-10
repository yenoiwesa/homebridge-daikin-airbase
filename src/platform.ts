import {
    API,
    DynamicPlatformPlugin,
    Logger,
    Logging,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic,
} from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { HeaterCoolerAccessory } from './heaterCoolerAccessory';
import { FanAccessory } from './fanAccessory';
import { FanModeSwitchAccessory } from './fanModeSwitchAccessory';
import { DryModeSwitchAccessory } from './dryModeSwitchAccessory';
import { ZoneSwitchAccessory } from './zoneSwitchAccessory';
import DaikinAircon from './airbase-controller';
import discover from './daikin-discovery';
import { castArray } from 'lodash';
import retry from 'retry';

export interface DaikinPlatformConfig extends PlatformConfig {
    hostname?: string | string[];
}

export interface AccessoryContext {
    ssid: string;
    hostname: string;
    zoneName?: string;
}

export class DaikinAirbasePlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic =
        this.api.hap.Characteristic;

    public readonly accessories: PlatformAccessory[] = [];

    constructor(
        public readonly log: Logger,
        public readonly config: DaikinPlatformConfig,
        public readonly api: API
    ) {
        this.log.debug('Finished initializing platform:', this.config.name);

        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback');
            this.discoverDevices();
        });
    }

    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }

    async discoverDevices() {
        const operation = retry.operation({
            retries: 10,
            factor: 2,
            minTimeout: 5 * 1000,
        });

        operation.attempt(async () => {
            let hostnames: string[] = [];
            try {
                hostnames =
                    (this.config.hostname && castArray(this.config.hostname)) ||
                    Array.from(await discover(this.log as unknown as Logging));
            } catch (error) {
                this.log.error('Discovery error:', error);
                if (operation.retry(error as Error)) {
                    return;
                }
            }

            for (const hostname of hostnames) {
                try {
                    const airbase = new DaikinAircon({
                        hostname,
                        log: this.log as unknown as Logging,
                    });

                    airbase.config = this.config;
                    await airbase.init();

                    // Create main HeaterCooler accessory
                    const mainUuid = this.api.hap.uuid.generate(
                        `${airbase.info.ssid}:heater-cooler`
                    );
                    let mainAccessory = this.accessories.find(
                        (accessory) => accessory.UUID === mainUuid
                    );

                    if (mainAccessory) {
                        this.log.info(
                            'Restoring HeaterCooler accessory from cache:',
                            mainAccessory.displayName
                        );
                        mainAccessory.context.hostname = hostname;
                        this.api.updatePlatformAccessories([mainAccessory]);
                    } else {
                        this.log.info(
                            'Adding new HeaterCooler accessory:',
                            airbase.info.name
                        );
                        mainAccessory = new this.api.platformAccessory(
                            airbase.info.name,
                            mainUuid
                        );
                        mainAccessory.context.ssid = airbase.info.ssid;
                        mainAccessory.context.hostname = hostname;
                        this.api.registerPlatformAccessories(
                            PLUGIN_NAME,
                            PLATFORM_NAME,
                            [mainAccessory]
                        );
                    }

                    new HeaterCoolerAccessory(this, mainAccessory, airbase);

                    // Create Fan accessory if supported
                    if (airbase.info.fanRateSupported) {
                        const fanUuid = this.api.hap.uuid.generate(
                            `${airbase.info.ssid}:fan`
                        );
                        let fanAccessory = this.accessories.find(
                            (accessory) => accessory.UUID === fanUuid
                        );

                        if (fanAccessory) {
                            this.log.info(
                                'Restoring Fan accessory from cache:',
                                fanAccessory.displayName
                            );
                            fanAccessory.context.hostname = hostname;
                            this.api.updatePlatformAccessories([fanAccessory]);
                        } else {
                            this.log.info(
                                'Adding new Fan accessory:',
                                `${airbase.info.name} Fan`
                            );
                            fanAccessory = new this.api.platformAccessory(
                                `${airbase.info.name} Fan`,
                                fanUuid
                            );
                            fanAccessory.context.ssid = airbase.info.ssid;
                            fanAccessory.context.hostname = hostname;
                            this.api.registerPlatformAccessories(
                                PLUGIN_NAME,
                                PLATFORM_NAME,
                                [fanAccessory]
                            );
                        }

                        new FanAccessory(this, fanAccessory, airbase);

                        // Create Fan Mode switch
                        const fanModeUuid = this.api.hap.uuid.generate(
                            `${airbase.info.ssid}:fan-mode`
                        );
                        let fanModeAccessory = this.accessories.find(
                            (accessory) => accessory.UUID === fanModeUuid
                        );

                        if (fanModeAccessory) {
                            this.log.info(
                                'Restoring Fan Mode switch from cache:',
                                fanModeAccessory.displayName
                            );
                            fanModeAccessory.context.hostname = hostname;
                            this.api.updatePlatformAccessories([
                                fanModeAccessory,
                            ]);
                        } else {
                            this.log.info(
                                'Adding new Fan Mode switch:',
                                `${airbase.info.name} Fan Mode`
                            );
                            fanModeAccessory = new this.api.platformAccessory(
                                `${airbase.info.name} Fan Mode`,
                                fanModeUuid
                            );
                            fanModeAccessory.context.ssid = airbase.info.ssid;
                            fanModeAccessory.context.hostname = hostname;
                            this.api.registerPlatformAccessories(
                                PLUGIN_NAME,
                                PLATFORM_NAME,
                                [fanModeAccessory]
                            );
                        }

                        new FanModeSwitchAccessory(
                            this,
                            fanModeAccessory,
                            airbase
                        );
                    }

                    // Create Dry Mode switch if supported
                    if (airbase.info.dryModeSupported) {
                        const dryModeUuid = this.api.hap.uuid.generate(
                            `${airbase.info.ssid}:dry-mode`
                        );
                        let dryModeAccessory = this.accessories.find(
                            (accessory) => accessory.UUID === dryModeUuid
                        );

                        if (dryModeAccessory) {
                            this.log.info(
                                'Restoring Dry Mode switch from cache:',
                                dryModeAccessory.displayName
                            );
                            dryModeAccessory.context.hostname = hostname;
                            this.api.updatePlatformAccessories([
                                dryModeAccessory,
                            ]);
                        } else {
                            this.log.info(
                                'Adding new Dry Mode switch:',
                                `${airbase.info.name} Dry Mode`
                            );
                            dryModeAccessory = new this.api.platformAccessory(
                                `${airbase.info.name} Dry Mode`,
                                dryModeUuid
                            );
                            dryModeAccessory.context.ssid = airbase.info.ssid;
                            dryModeAccessory.context.hostname = hostname;
                            this.api.registerPlatformAccessories(
                                PLUGIN_NAME,
                                PLATFORM_NAME,
                                [dryModeAccessory]
                            );
                        }

                        new DryModeSwitchAccessory(
                            this,
                            dryModeAccessory,
                            airbase
                        );
                    }

                    // Create zone switch accessories if zones are supported
                    if (airbase.info.zonesSupported && airbase.info.zoneNames) {
                        for (const zoneName of airbase.info.zoneNames) {
                            const zoneUuid = this.api.hap.uuid.generate(
                                `${airbase.info.ssid}:zone-${zoneName}`
                            );
                            let zoneAccessory = this.accessories.find(
                                (accessory) => accessory.UUID === zoneUuid
                            );

                            if (zoneAccessory) {
                                this.log.info(
                                    'Restoring Zone switch from cache:',
                                    zoneAccessory.displayName
                                );
                                zoneAccessory.context.hostname = hostname;
                                this.api.updatePlatformAccessories([
                                    zoneAccessory,
                                ]);
                            } else {
                                this.log.info(
                                    'Adding new Zone switch:',
                                    `${airbase.info.name} ${zoneName}`
                                );
                                zoneAccessory = new this.api.platformAccessory(
                                    `${airbase.info.name} ${zoneName}`,
                                    zoneUuid
                                );
                                zoneAccessory.context.ssid = airbase.info.ssid;
                                zoneAccessory.context.hostname = hostname;
                                zoneAccessory.context.zoneName = zoneName;
                                this.api.registerPlatformAccessories(
                                    PLUGIN_NAME,
                                    PLATFORM_NAME,
                                    [zoneAccessory]
                                );
                            }

                            new ZoneSwitchAccessory(
                                this,
                                zoneAccessory,
                                airbase,
                                zoneName
                            );
                        }
                    }

                    this.log.info(
                        `Registered device: ${airbase.info.name} (SSID: ${airbase.info.ssid})`
                    );
                } catch (error) {
                    this.log.error(
                        `Error initializing device at ${hostname}:`,
                        error
                    );
                }
            }
        });
    }
}
