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

/**
 * Manages updating all registered accessories when device state changes.
 * This ensures accessories are updated immediately when control info is set,
 * not just during polling intervals.
 */
export class AccessoryUpdateManager {
    private accessories: AccessoryWithUpdate[] = [];

    constructor(
        private readonly airbase: DaikinAircon,
        private readonly log: Logger
    ) {}

    registerAccessory(accessory: AccessoryWithUpdate): void {
        this.accessories.push(accessory);
    }

    /**
     * Update all registered accessories with the latest device state.
     * If controlInfo is provided, it will be used; otherwise it will be fetched.
     */
    async updateAll(providedControlInfo?: ControlInfo): Promise<void> {
        try {
            const controlInfo =
                providedControlInfo || (await this.airbase.getControlInfo());
            const sensorInfo = await this.airbase.getSensorInfo();
            let zoneSetting: ZoneSetting | undefined;

            const info = this.airbase.getInfo();
            if (info.zonesSupported) {
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
            this.log.error('Error updating accessories:', error);
        }
    }
}
