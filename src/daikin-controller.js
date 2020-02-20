const fetch = require('node-fetch');
const { setWith, forEach, merge } = require('lodash');
const debounce = require('debounce-promise');
const { cachePromise } = require('./utils');
const { QUERIES_MAPPING, RESPONSES_MAPPING } = require('./constants');

const RETRY_ATTEMPTS = 3;

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

        const {
            exec: getControlInfo,
            reset: resetControlInfoCache,
        } = cachePromise(this.doGetControlInfo.bind(this), 1000);
        this.getControlInfo = getControlInfo;
        this.resetControlInfoCache = resetControlInfoCache;

        this.getSensorInfo = cachePromise(
            this.doGetSensorInfo.bind(this),
            5 * 1000
        ).exec;

        this.setControlInfo = debounce(
            this.doSetAccumulatedControlInfo.bind(this),
            500,
            { accumulate: true }
        );
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
        const url = new URL(`http://${this.hostname}/skyfi/${path}`);

        if (params) {
            const mapping = QUERIES_MAPPING[path];

            forEach(params, (value, key) => {
                if (key in mapping) {
                    url.searchParams.append(mapping[key], value);
                }
            });
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
        this.log.debug('Sent:', url.toString(), 'Response:', result);
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
        const values = merge({}, ...accArgs.map(args => args[0]));

        const controlInfo = await this.doSetControlInfo(values);

        return new Array(accArgs.length).fill(controlInfo);
    }

    async doSetControlInfo(values) {
        // must send the complete list of values to the controller
        const controlInfo = await this.getControlInfo();
        const newControlInfo = { ...controlInfo, ...values };

        // reset the response cache for the next call
        this.resetControlInfoCache();

        return this.sendRequest('aircon/set_control_info', newControlInfo);
    }

    async doGetSensorInfo() {
        return this.sendRequest('aircon/get_sensor_info');
    }
}

module.exports = DaikinAircon;
