const { map } = require('lodash');

const toBoolean = (val) => Boolean(parseInt(val));

const toHexEncodedString = (str) =>
    map(str, (char) => '%' + Buffer.from(char).toString('hex')).join('');

const QUERIES_MAPPING = {
    'aircon/set_control_info': {
        power: { key: 'pow', encode: String },
        mode: { key: 'mode', encode: String },
        targetTemperature: { key: 'stemp', encode: String },
        fanRate: { key: 'f_rate', encode: String },
        fanAirside: { key: 'f_airside', encode: String },
        fanAuto: { key: 'f_auto', encode: String },
        fanDirection: { key: 'f_dir', encode: String },
    },
    'aircon/set_zone_setting': {
        zoneNames: {
            key: 'zone_name',
            // somehow, Daikin has decided to have the zone names hex encoded
            encode: (val) => toHexEncodedString(val.join(';')),
        },
        zoneStatuses: {
            key: 'zone_onoff',
            encode: (val) => encodeURIComponent(val.join(';')),
        },
    },
};

const RESPONSES_MAPPING = {
    'common/basic_info': {
        name: { key: 'name', parse: decodeURIComponent },
        ver: {
            key: 'version',
            parse: (version) => (version || '').split('_').join('.'),
        },
        ssid: { key: 'ssid', parse: String },
        en_setzone: { key: 'zonesSupported', parse: toBoolean },
    },
    'aircon/get_model_info': {
        model: {
            key: 'model',
            parse: (model) => (model === 'NOTSUPPORT' ? 'N/A' : model),
        },
        type: { key: 'type', parse: String },
        humd: { key: 'isHumidifierSupported', parse: toBoolean },
        en_zone: { key: 'zoneCount', parse: parseInt },
        en_temp_setting: { key: 'setTemperatureSupported', parse: toBoolean },
        en_frate: { key: 'fanRateSupported', parse: toBoolean },
        en_fdir: { key: 'fanDirectionSupported', parse: toBoolean },
        en_auto: { key: 'autoModeSupported', parse: toBoolean },
        en_dry: { key: 'dryModeSupported', parse: toBoolean },
        cool_l: { key: 'coolMinTemperature', parse: parseInt },
        cool_h: { key: 'coolMaxTempertature', parse: parseInt },
        heat_l: { key: 'heatMinTemperature', parse: parseInt },
        heat_h: { key: 'heatMaxTemperature', parse: parseInt },
        frate_steps: { key: 'fanRateSteps', parse: parseInt },
        en_frate_auto: { key: 'autoFanRateSupported', parse: toBoolean },
    },
    'aircon/get_control_info': {
        pow: { key: 'power', parse: parseInt },
        mode: { key: 'mode', parse: parseInt },
        stemp: { key: 'targetTemperature', parse: parseInt },
        f_rate: { key: 'fanRate', parse: parseInt },
        f_airside: { key: 'fanAirside', parse: parseInt },
        f_auto: { key: 'fanAuto', parse: parseInt },
        f_dir: { key: 'fanDirection', parse: parseInt },
        dt1: { key: ['modeTargetTemperature', 1], parse: parseInt },
        dt2: { key: ['modeTargetTemperature', 2], parse: parseInt },
        dt3: { key: ['modeTargetTemperature', 3], parse: parseInt },
        dt4: { key: ['modeTargetTemperature', 4], parse: parseInt },
        dt5: { key: ['modeTargetTemperature', 5], parse: parseInt },
        dt7: { key: ['modeTargetTemperature', 7], parse: parseInt },
    },
    'aircon/get_sensor_info': {
        htemp: { key: 'indoorTemperature', parse: parseInt },
        otemp: { key: 'outdoorTemperature', parse: parseInt },
    },
    'aircon/get_zone_setting': {
        zone_name: {
            key: 'zoneNames',
            parse: (val) => decodeURIComponent(val).split(';'),
        },
        zone_onoff: {
            key: 'zoneStatuses',
            parse: (val) =>
                decodeURIComponent(val)
                    .split(';')
                    .map((x) => parseInt(x)),
        },
    },
};

module.exports = { QUERIES_MAPPING, RESPONSES_MAPPING };
