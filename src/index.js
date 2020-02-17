const {
    PLUGIN_NAME,
    PLATFORM_NAME,
    DaikinAirbasePlatformFactory,
} = require('./daikin-airbase-platform');

module.exports = function(homebridge) {
    // For platform plugin to be considered as dynamic platform plugin,
    // dynamic must be true. This is not our case.
    homebridge.registerPlatform(
        PLUGIN_NAME,
        PLATFORM_NAME,
        DaikinAirbasePlatformFactory(homebridge),
        false
    );
};
