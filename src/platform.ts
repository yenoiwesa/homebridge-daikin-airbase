import {
    API,
    DynamicPlatformPlugin,
    Logger,
    Logging,
    PlatformAccessory,
    Service,
    Characteristic,
} from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { DaikinPlatformConfig } from './types';
import { HeaterCoolerAccessory } from './heaterCoolerAccessory';
import { FanAccessory } from './fanAccessory';
import { FanModeSwitchAccessory } from './fanModeSwitchAccessory';
import { DryModeSwitchAccessory } from './dryModeSwitchAccessory';
import { ZoneSwitchAccessory } from './zoneSwitchAccessory';
import { PollingManager } from './pollingManager';
import DaikinAircon from './airbase-controller';
import discover from './daikin-discovery';
import { castArray } from 'lodash';
import retry from 'retry';

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

            // Determine if we need to prefix accessory names with airbase name
            const usePrefix = hostnames.length > 1;

            for (const hostname of hostnames) {
                try {
                    const airbase = new DaikinAircon({
                        hostname,
                        log: this.log as unknown as Logging,
                    });

                    await airbase.init();

                    // Get airbase info (throws if not initialized)
                    const info = airbase.getInfo();

                    // Determine name prefix for accessories
                    const prefix = usePrefix ? `${info.name} ` : '';

                    // Create polling manager for this airbase
                    const pollingIntervalSeconds =
                        this.config.pollingInterval ?? 300;
                    const pollingIntervalMs = pollingIntervalSeconds * 1000;
                    const pollingManager = new PollingManager(
                        airbase,
                        this.log,
                        pollingIntervalMs
                    );

                    // Create main HeaterCooler accessory
                    const mainUuid = this.api.hap.uuid.generate(
                        `${info.ssid}:heater-cooler`
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
                        const displayName = `${prefix}Aircon`;
                        this.log.info(
                            'Adding new HeaterCooler accessory:',
                            displayName
                        );
                        mainAccessory = new this.api.platformAccessory(
                            displayName,
                            mainUuid
                        );
                        mainAccessory.context.ssid = info.ssid;
                        mainAccessory.context.hostname = hostname;
                        this.api.registerPlatformAccessories(
                            PLUGIN_NAME,
                            PLATFORM_NAME,
                            [mainAccessory]
                        );
                    }

                    const heaterCooler = new HeaterCoolerAccessory(
                        this,
                        mainAccessory,
                        airbase
                    );
                    pollingManager.registerAccessory(heaterCooler);

                    // Create Fan accessory if supported
                    if (info.fanRateSupported) {
                        const fanUuid = this.api.hap.uuid.generate(
                            `${info.ssid}:fan`
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
                            const displayName = `${prefix}Fan Speed`;
                            this.log.info(
                                'Adding new Fan accessory:',
                                displayName
                            );
                            fanAccessory = new this.api.platformAccessory(
                                displayName,
                                fanUuid
                            );
                            fanAccessory.context.ssid = info.ssid;
                            fanAccessory.context.hostname = hostname;
                            this.api.registerPlatformAccessories(
                                PLUGIN_NAME,
                                PLATFORM_NAME,
                                [fanAccessory]
                            );
                        }

                        const fan = new FanAccessory(
                            this,
                            fanAccessory,
                            airbase
                        );
                        pollingManager.registerAccessory(fan);

                        // Create Fan Mode switch
                        const fanModeUuid = this.api.hap.uuid.generate(
                            `${info.ssid}:fan-mode`
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
                            const displayName = `${prefix}Fan Mode`;
                            this.log.info(
                                'Adding new Fan Mode switch:',
                                displayName
                            );
                            fanModeAccessory = new this.api.platformAccessory(
                                displayName,
                                fanModeUuid
                            );
                            fanModeAccessory.context.ssid = info.ssid;
                            fanModeAccessory.context.hostname = hostname;
                            this.api.registerPlatformAccessories(
                                PLUGIN_NAME,
                                PLATFORM_NAME,
                                [fanModeAccessory]
                            );
                        }

                        const fanModeSwitch = new FanModeSwitchAccessory(
                            this,
                            fanModeAccessory,
                            airbase
                        );
                        pollingManager.registerAccessory(fanModeSwitch);
                    }

                    // Create Dry Mode switch if supported
                    if (info.dryModeSupported) {
                        const dryModeUuid = this.api.hap.uuid.generate(
                            `${info.ssid}:dry-mode`
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
                            const displayName = `${prefix}Dry Mode`;
                            this.log.info(
                                'Adding new Dry Mode switch:',
                                displayName
                            );
                            dryModeAccessory = new this.api.platformAccessory(
                                displayName,
                                dryModeUuid
                            );
                            dryModeAccessory.context.ssid = info.ssid;
                            dryModeAccessory.context.hostname = hostname;
                            this.api.registerPlatformAccessories(
                                PLUGIN_NAME,
                                PLATFORM_NAME,
                                [dryModeAccessory]
                            );
                        }

                        const dryModeSwitch = new DryModeSwitchAccessory(
                            this,
                            dryModeAccessory,
                            airbase
                        );
                        pollingManager.registerAccessory(dryModeSwitch);
                    }

                    // Create zone switch accessories if zones are supported
                    if (info.zonesSupported && info.zoneNames) {
                        for (const zoneName of info.zoneNames) {
                            const zoneUuid = this.api.hap.uuid.generate(
                                `${info.ssid}:zone-${zoneName}`
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
                                const displayName = `${prefix}${zoneName} Zone`;
                                this.log.info(
                                    'Adding new Zone switch:',
                                    displayName
                                );
                                zoneAccessory = new this.api.platformAccessory(
                                    displayName,
                                    zoneUuid
                                );
                                zoneAccessory.context.ssid = info.ssid;
                                zoneAccessory.context.hostname = hostname;
                                zoneAccessory.context.zoneName = zoneName;
                                this.api.registerPlatformAccessories(
                                    PLUGIN_NAME,
                                    PLATFORM_NAME,
                                    [zoneAccessory]
                                );
                            }

                            const zoneSwitch = new ZoneSwitchAccessory(
                                this,
                                zoneAccessory,
                                airbase,
                                zoneName
                            );
                            pollingManager.registerAccessory(zoneSwitch);
                        }
                    }

                    // Start polling for this airbase
                    pollingManager.start();

                    this.log.info(
                        `Registered device: ${info.name} (SSID: ${info.ssid})`
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
