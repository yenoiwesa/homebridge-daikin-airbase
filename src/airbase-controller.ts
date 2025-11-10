import fetch from 'node-fetch';
import { setWith, forEach, merge } from 'lodash';
import debounce from 'debounce-promise';
import { Logging } from 'homebridge';
import { cachePromise } from './utils';
import { QUERIES_MAPPING, RESPONSES_MAPPING } from './constants';
import {
    AirbaseInfo,
    ControlInfo,
    SensorInfo,
    ZoneSetting,
    RawZoneSetting,
} from './types';

const RETRY_ATTEMPTS = 3;
const GET_CONTROL_INFO_CACHE_DURATION = 2 * 1000;
const GET_SENSOR_INFO_CACHE_DURATION = 30 * 1000;
const GET_ZONE_SETTING_CACHE_DURATION = 2 * 1000;
const SET_CONTROL_INFO_DEBOUNCE_DELAY = 500;

export default class DaikinAircon {
    static get Power() {
        return {
            OFF: 0,
            ON: 1,
        };
    }

    static get Mode() {
        return {
            FAN: 0,
            HEAT: 1,
            COOL: 2,
            AUTO: 3,
            DRY: 7,
        };
    }

    static get FanSpeed() {
        return {
            AUTO: 0,
            LOW: 1,
            MEDIUM: 3,
            HIGH: 5,
        };
    }

    private log: Logging;
    private hostname: string;
    private info: AirbaseInfo | null = null;

    public getControlInfo: () => Promise<ControlInfo>;
    private setControlInfoCache: (
        value: Promise<ControlInfo>
    ) => Promise<ControlInfo>;
    public getSensorInfo: () => Promise<SensorInfo>;
    public setControlInfo: (
        values: Partial<ControlInfo>
    ) => Promise<ControlInfo>;
    private getRawZoneSetting: () => Promise<RawZoneSetting>;
    private setRawZoneSettingCache: (
        value: Promise<RawZoneSetting>
    ) => Promise<RawZoneSetting>;

    constructor({ log, hostname }: { log: Logging; hostname: string }) {
        this.log = log;
        this.hostname = hostname;

        const { exec: getControlInfo, set: setControlInfoCache } = cachePromise(
            this.doGetControlInfo.bind(this),
            GET_CONTROL_INFO_CACHE_DURATION
        );
        this.getControlInfo = getControlInfo;
        this.setControlInfoCache = setControlInfoCache;

        this.getSensorInfo = cachePromise(
            this.doGetSensorInfo.bind(this),
            GET_SENSOR_INFO_CACHE_DURATION
        ).exec;

        this.setControlInfo = debounce(
            this.doSetAccumulatedControlInfo.bind(this),
            SET_CONTROL_INFO_DEBOUNCE_DELAY,
            { accumulate: true }
        ) as any;

        const { exec: getRawZoneSetting, set: setRawZoneSettingCache } =
            cachePromise(
                this.doGetRawZoneSetting.bind(this),
                GET_ZONE_SETTING_CACHE_DURATION
            );
        this.getRawZoneSetting = getRawZoneSetting;
        this.setRawZoneSettingCache = setRawZoneSettingCache;
    }

    private normalizeResponse(path: string, response: string): any {
        const mapping = RESPONSES_MAPPING[path];

        if (!mapping) {
            return null;
        }

        return response.split(',').reduce((acc, pair) => {
            const [key, value] = pair.split('=');

            if (key in mapping) {
                const { key: normalizedKey, parse } = mapping[key];
                setWith(acc, normalizedKey, parse(value), Object);
            }

            return acc;
        }, {} as any);
    }

    private getUrl(path: string, params?: any): string {
        let url = `http://${this.hostname}/skyfi/${path}`;

        if (params) {
            const mapping = QUERIES_MAPPING[path];
            const encodedParams: string[] = [];

            forEach(params, (value, key) => {
                if (key in mapping) {
                    const { key: normalizedKey, encode } = mapping[key];
                    encodedParams.push(`${normalizedKey}=${encode(value)}`);
                }
            });

            url += '?' + encodedParams.join('&');
        }

        return url;
    }

    private async sendRequest(path: string, values?: any): Promise<any> {
        const url = this.getUrl(path, values);
        let response;

        for (let count = 0; count < RETRY_ATTEMPTS; count++) {
            try {
                response = await fetch(url);

                break;
            } catch (error) {
                if (!(error instanceof Error) || error.name !== 'FetchError') {
                    throw error;
                }
            }
        }

        if (!response) {
            throw new Error(
                `Maximum retry attempts (${RETRY_ATTEMPTS}) reached, bailing out`
            );
        }

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const result = this.normalizeResponse(path, await response.text());
        this.log.debug(
            'Sent:',
            url.toString(),
            'With Values:',
            values,
            'Response:',
            result
        );
        return result;
    }

    async init(): Promise<void> {
        const [basicInfo, modelInfo] = await Promise.all([
            this.sendRequest('common/basic_info'),
            this.sendRequest('aircon/get_model_info'),
        ]);

        const info: AirbaseInfo = {
            manufacturer: 'Daikin',
            hostname: this.hostname,
            ...basicInfo,
            ...modelInfo,
        };

        if (info.zonesSupported && info.zoneCount) {
            // retrieve zone names
            const { zoneNames } = await this.getRawZoneSetting();

            // add zone control accessory
            info.zoneNames = Array.from(
                new Set(zoneNames.slice(0, info.zoneCount))
            );
        }

        this.info = info;
    }

    getInfo(): AirbaseInfo {
        if (!this.info) {
            throw new Error('Airbase info not initialized. Call init() first.');
        }
        return this.info;
    }

    private async doGetControlInfo(): Promise<ControlInfo> {
        return this.sendRequest('aircon/get_control_info');
    }

    private async doSetAccumulatedControlInfo(
        accArgs: [Partial<ControlInfo>][]
    ): Promise<ControlInfo[]> {
        const deltas = accArgs.map((args) => args[0]);
        const values = merge({}, ...deltas);

        const controlInfo = await this.doSetControlInfo(values);

        return new Array(accArgs.length).fill(controlInfo);
    }

    private async doSetControlInfo(
        values: Partial<ControlInfo>
    ): Promise<ControlInfo> {
        // must send the complete list of values to the controller
        const controlInfo = await this.getControlInfo();
        const newControlInfo = merge({}, controlInfo, values);

        const { mode, modeTargetTemperature } = newControlInfo;

        // if the mode is set to heating or cooling, set the target temperature as the mode temperature for that mode
        if (
            (mode === DaikinAircon.Mode.COOL ||
                mode === DaikinAircon.Mode.HEAT) &&
            modeTargetTemperature[mode] != null
        ) {
            newControlInfo.targetTemperature = modeTargetTemperature[mode];
        }

        await this.sendRequest('aircon/set_control_info', newControlInfo);

        this.setControlInfoCache(Promise.resolve(newControlInfo));

        return newControlInfo;
    }

    private async doGetSensorInfo(): Promise<SensorInfo> {
        return this.sendRequest('aircon/get_sensor_info');
    }

    private async doGetRawZoneSetting(): Promise<RawZoneSetting> {
        return this.sendRequest('aircon/get_zone_setting');
    }

    async getZoneSetting(
        rawZoneSetting?: RawZoneSetting
    ): Promise<ZoneSetting> {
        const { zoneNames, zoneStatuses } =
            rawZoneSetting || (await this.getRawZoneSetting());

        const result: ZoneSetting = {};
        for (let index = 0; index < zoneNames.length; index++) {
            const zoneName = zoneNames[index];
            const zoneStatus = zoneStatuses[index];

            result[zoneName] = zoneStatus;
        }

        return result;
    }

    async setZoneSetting(values: ZoneSetting): Promise<ZoneSetting> {
        // must send the complete list of values to the controller
        const { zoneNames, zoneStatuses } = await this.getRawZoneSetting();

        forEach(values, (zoneStatus, zoneName) => {
            const zoneIndex = zoneNames.indexOf(zoneName);

            zoneStatuses[zoneIndex] = zoneStatus;
        });

        const newZoneSetting: RawZoneSetting = { zoneNames, zoneStatuses };

        await this.sendRequest('aircon/set_zone_setting', newZoneSetting);

        this.setRawZoneSettingCache(Promise.resolve(newZoneSetting));

        return this.getZoneSetting(newZoneSetting);
    }
}
