import { PlatformConfig } from 'homebridge';

export interface DaikinPlatformConfig extends PlatformConfig {
    hostname?: string | string[];
}

export interface AirbaseInfo {
    manufacturer: string;
    hostname: string;
    name: string;
    version: string;
    ssid: string;
    zonesSupported: boolean;
    model: string;
    type: string;
    isHumidifierSupported: boolean;
    zoneCount?: number;
    setTemperatureSupported: boolean;
    fanRateSupported: boolean;
    fanDirectionSupported: boolean;
    autoModeSupported: boolean;
    dryModeSupported: boolean;
    coolMinTemperature: number;
    coolMaxTempertature: number;
    heatMinTemperature: number;
    heatMaxTemperature: number;
    fanRateSteps: number;
    autoFanRateSupported: boolean;
    zoneNames?: string[];
}

export interface ControlInfo {
    power: number;
    mode: number;
    targetTemperature: number;
    fanRate: number;
    fanAirside: number;
    fanAuto: number;
    fanDirection: number;
    modeTargetTemperature: {
        [mode: number]: number;
    };
}

export interface SensorInfo {
    indoorTemperature: number;
    outdoorTemperature: number;
}

export interface ZoneSetting {
    [zoneName: string]: number;
}

export interface RawZoneSetting {
    zoneNames: string[];
    zoneStatuses: number[];
}

export interface UpdateStateParams {
    controlInfo?: ControlInfo;
    sensorInfo?: SensorInfo;
    zoneSetting?: ZoneSetting;
}
