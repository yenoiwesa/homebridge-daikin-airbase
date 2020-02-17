const fetch = require('node-fetch');
const { isEqual } = require('lodash');
const { cachePromise } = require('./utils');
const { REQUESTS_MAPPING } = require('./constants');

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

    constructor(log, { hostname }) {
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
    }

    normalizeRequestValues(path, values) {
        if (!values) {
            return null;
        }

        const nornalized = {};
        const mapping = REQUESTS_MAPPING[path];

        for (const key in mapping) {
            const value = values[key];

            if (value != null) {
                const normalizedKey = mapping[key];

                nornalized[normalizedKey] = value;
            }
        }

        return nornalized;
    }

    getUrl(path, params) {
        let url = `http://${this.hostname}/skyfi/${path}`;

        if (params) {
            url +=
                '?' +
                Object.keys(params)
                    .map(key => key + '=' + params[key])
                    .join('&');
        }

        return url;
    }

    async sendRequest(path, values) {
        const url = this.getUrl(
            path,
            this.normalizeRequestValues(path, values)
        );

        const response = await fetch(url);
        const body = await response.text();

        const responseValues = body.split(',').reduce((acc, pair) => {
            const [key, value] = pair.split('=');
            acc[key] = parseInt(value);

            if (isNaN(acc[key])) {
                acc[key] = value;
            }

            return acc;
        }, {});

        const result = this.normalizeRequestValues(path, responseValues);
        this.log.debug(url, result);
        return result;
    }

    async init() {
        const basicInfo = await this.sendRequest('common/basic_info');
        const modelInfo = await this.sendRequest('aircon/get_model_info');

        this.info = {
            manufacturer: 'Daikin',
            version: '1',
            ...basicInfo,
            ...modelInfo,
        };
    }

    async doGetControlInfo() {
        return this.sendRequest('aircon/get_control_info');
    }

    async setControlInfo(values) {
        // must send the complete list of values to the controller
        const controlInfo = await this.getControlInfo();
        const newControlInfo = { ...controlInfo, ...values };

        // don't send a request if the values haven't changed
        if (isEqual(controlInfo, newControlInfo)) {
            return;
        }

        // reset the response cache for the next call
        this.resetControlInfoCache();

        return this.sendRequest('aircon/set_control_info', newControlInfo);
    }

    async doGetSensorInfo() {
        return this.sendRequest('aircon/get_sensor_info');
    }
}

module.exports = DaikinAircon;
