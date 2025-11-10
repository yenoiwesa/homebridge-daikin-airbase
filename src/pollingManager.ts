import { Logger } from 'homebridge';
import DaikinAircon from './airbase-controller';
import { AccessoryUpdateManager } from './accessoryUpdateManager';

export class PollingManager {
    private intervalId?: NodeJS.Timeout;

    constructor(
        private readonly airbase: DaikinAircon,
        private readonly log: Logger,
        private readonly updateManager: AccessoryUpdateManager,
        private readonly pollingInterval: number = 30000
    ) {}

    private get info() {
        return this.airbase.getInfo();
    }

    start(): void {
        if (this.intervalId) {
            return; // Already started
        }

        if (this.pollingInterval <= 0) {
            this.log.info(`Polling disabled for ${this.info.name}`);
            return;
        }

        this.log.info(
            `Starting polling for ${this.info.name} every ${
                this.pollingInterval / 1000
            }s`
        );

        this.intervalId = setInterval(async () => {
            await this.updateManager.updateAll();
        }, this.pollingInterval);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            this.log.debug(`Stopped polling for ${this.info.name}`);
        }
    }
}
