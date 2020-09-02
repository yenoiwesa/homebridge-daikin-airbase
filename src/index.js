const {
    PLUGIN_NAME,
    PLATFORM_NAME,
    DaikinAirbasePlatform,
} = require('./daikin-airbase-platform');

module.exports = (api) => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DaikinAirbasePlatform);
};
