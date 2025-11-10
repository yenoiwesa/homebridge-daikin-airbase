import { API } from 'homebridge';
import {
    PLUGIN_NAME,
    PLATFORM_NAME,
    DaikinAirbasePlatform,
} from './daikin-airbase-platform';

export default (api: API): void => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DaikinAirbasePlatform);
};
