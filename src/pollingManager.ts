import { Logger } from 'homebridge';
import DaikinAircon from './airbase-controller';
import { ControlInfo, SensorInfo, ZoneSetting } from './types';

export interface UpdateCharacteristicsParams {
    controlInfo: ControlInfo;
    sensorInfo: SensorInfo;
    zoneSetting?: ZoneSetting;
}

interface AccessoryWithUpdate {
    updateCharacteristics(params: UpdateCharacteristicsParams): void;
}

export class PollingManager {
    private intervalId?: NodeJS.Timeout;
    private accessories: AccessoryWithUpdate[] = [];

    constructor(
        private readonly airbase: DaikinAircon,
        private readonly log: Logger,
        private readonly pollingInterval: number = 30000
    ) {}

    registerAccessory(accessory: AccessoryWithUpdate): void {
        this.accessories.push(accessory);
    }

    start(): void {
        if (this.intervalId) {
            return; // Already started
        }

        this.log.debug(
            `Starting polling for ${this.airbase.info.name} every ${
                this.pollingInterval / 1000
            }s`
        );

        this.intervalId = setInterval(async () => {
            try {
                const controlInfo = await this.airbase.getControlInfo();
                const sensorInfo = await this.airbase.getSensorInfo();
                let zoneSetting: ZoneSetting | undefined;

                if (this.airbase.info.zonesSupported) {
                    zoneSetting = await this.airbase.getZoneSetting();
                }

                // Update all registered accessories
                for (const accessory of this.accessories) {
                    accessory.updateCharacteristics({
                        controlInfo,
                        sensorInfo,
                        zoneSetting,
                    });
                }
            } catch (error) {
                this.log.error(
                    `Error polling device ${this.airbase.info.name}:`,
                    error
                );
            }
        }, this.pollingInterval);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            this.log.debug(`Stopped polling for ${this.airbase.info.name}`);
        }
    }
}
