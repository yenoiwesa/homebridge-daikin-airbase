const fetch = require('node-fetch');
const { setWith, forEach, merge, orderBy } = require('lodash');
const debounce = require('debounce-promise');
const { cachePromise } = require('./utils');
const { QUERIES_MAPPING, RESPONSES_MAPPING } = require('./constants');

const RETRY_ATTEMPTS = 3;
const GET_CONTROL_INFO_CACHE_DURATION = 2 * 1000;
const GET_SENSOR_INFO_CACHE_DURATION = 30 * 1000;
const GET_ZONE_SETTING_CACHE_DURATION = 2 * 1000;
const SET_CONTROL_INFO_DEBOUNCE_DELAY = 500;

class DaikinAircon {
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

    constructor({ log, hostname }) {
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
        );

        const {
            exec: getRawZoneSetting,
            set: setRawZoneSettingCache,
        } = cachePromise(
            this.doGetRawZoneSetting.bind(this),
            GET_ZONE_SETTING_CACHE_DURATION
        );
        this.getRawZoneSetting = getRawZoneSetting;
        this.setRawZoneSettingCache = setRawZoneSettingCache;
    }

    normalizeResponse(path, response) {
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
        }, {});
    }

    getUrl(path, params) {
        let url = `http://${this.hostname}/skyfi/${path}`;

        if (params) {
            const mapping = QUERIES_MAPPING[path];
            const encodedParams = [];

            forEach(params, (value, key) => {
                if (key in mapping) {
                    const { key: normalizedKey, encode } = mapping[key];
                    encodedParams.append(`${normalizedKey}=${encode(value)}`);
                }
            });

            url += '?' + encodedParams.join('&');
        }

        return url;
    }

    async sendRequest(path, values) {
        const url = this.getUrl(path, values);
        let response;

        for (let count = 0; count < RETRY_ATTEMPTS; count++) {
            try {
                response = await fetch(url);

                break;
            } catch (error) {
                if (!(error instanceof fetch.FetchError)) {
                    throw error;
                }
            }
        }

        if (!response.ok) {
            throw response.status;
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

    async init() {
        const [basicInfo, modelInfo] = await Promise.all([
            this.sendRequest('common/basic_info'),
            this.sendRequest('aircon/get_model_info'),
        ]);

        this.info = {
            manufacturer: 'Daikin',
            ...basicInfo,
            ...modelInfo,
        };
    }

    async doGetControlInfo() {
        return this.sendRequest('aircon/get_control_info');
    }

    async doSetAccumulatedControlInfo(accArgs) {
        const deltas = accArgs.map((args) => args[0]);
        const prioritisedDeltas = orderBy(
            deltas,
            (delta) => delta.priority || 0
        );

        const values = merge({}, ...prioritisedDeltas);

        const controlInfo = await this.doSetControlInfo(values);

        return new Array(accArgs.length).fill(controlInfo);
    }

    async doSetControlInfo(values) {
        // must send the complete list of values to the controller
        const controlInfo = await this.getControlInfo();
        const newControlInfo = merge({}, controlInfo, values);

        await this.sendRequest('aircon/set_control_info', newControlInfo);

        this.setControlInfoCache(newControlInfo);

        return newControlInfo;
    }

    async doGetSensorInfo() {
        return this.sendRequest('aircon/get_sensor_info');
    }

    async doGetRawZoneSetting() {
        return this.sendRequest('aircon/get_zone_setting');
    }

    async getZoneSetting(rawZoneSetting = null) {
        const { zoneNames, zoneStatuses } =
            rawZoneSetting || (await this.getRawZoneSetting());

        const result = {};
        for (let index = 0; index < zoneNames.length; index++) {
            const zoneName = zoneNames[index];
            const zoneStatus = zoneStatuses[index];

            result[zoneName] = zoneStatus;
        }

        return result;
    }

    async setZoneSetting(values) {
        // must send the complete list of values to the controller
        const { zoneNames, zoneStatuses } = await this.getRawZoneSetting();

        forEach(values, (zoneStatus, zoneName) => {
            const zoneIndex = zoneNames.indexOf(zoneName);

            zoneStatuses[zoneIndex] = zoneStatus;
        });

        const newZoneSetting = { zoneNames, zoneStatuses };

        await this.sendRequest('aircon/set_zone_setting', newZoneSetting);

        this.setRawZoneSettingCache(newZoneSetting);

        return this.getZoneSetting(newZoneSetting);
    }
}

module.exports = DaikinAircon;
