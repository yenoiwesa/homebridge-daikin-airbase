const { invert } = require('lodash');

const MINIMUM_CONTROL_FIELDS = {
    pow: 'power',
    mode: 'mode',
    stemp: 'targetTemperature',
    f_rate: 'fanRate',
    f_airside: 'fanAirside',
    f_auto: 'fanAuto',
    f_dir: 'fanDirection',
};

const REQUESTS_MAPPING = {
    'common/basic_info': {
        name: 'name',
        ver: 'version',
    },
    'aircon/get_model_info': {
        model: 'model',
        type: 'type',
        humd: 'isHumidifierSupported',
        en_zone: 'isZoneSupported',
        en_temp_setting: 'setTemperatureSupported',
        en_frate: 'fanRateSupported',
        en_fdir: 'fanDirectionSupported',
        en_auto: 'autoModeSupported',
        en_dry: 'dryModeSupported',
        cool_l: 'coolMinTemperature',
        cool_h: 'coolMaxTempertature',
        heat_l: 'heatMinTemperature',
        heat_h: 'heatMaxTemperature',
        frate_steps: 'fanRateSteps',
        en_frate_auto: 'autoFanRateSupported',
    },
    'aircon/get_control_info': MINIMUM_CONTROL_FIELDS,
    'aircon/set_control_info': invert(MINIMUM_CONTROL_FIELDS),
    'aircon/get_sensor_info': {
        htemp: 'indoorTemperature',
        otemp: 'outdoorTemperature',
    },
};

module.exports = { REQUESTS_MAPPING };
