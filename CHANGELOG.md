# Changelog

All notable changes to this project will be documented in this file.

## [4.0.0] - TBD

### ⚠️ BREAKING CHANGES

- **Full rewrite**: Complete rewrite of the plugin in TypeScript
- **Action Required**: After upgrading, you must clear the accessory cache for this plugin and re-add the bridge/accessory in HomeKit
- **Config Change**: Polling interval unit changed from minutes to seconds (default is now 300 seconds / 5 minutes)
- Removed option to ungroup zone switches - zones are now always separate accessories
- Removed settings overrides - all features are now automatically detected based on what your airbase device supports

### Added

- **Airside Fan Support**: Automatic switch creation when airside fan is supported by your Daikin unit
- **Auto Fan Mode**: Integrated auto fan mode support directly into the fan accessory using FanV2 service (Manual/Auto toggle)
- Support for Homebridge v2 beta

### Changed

- Fan accessory now uses FanV2 service with native auto mode support
- Polling interval now specified in seconds instead of minutes for more granular control
- Zone switches are always created as separate accessories (no grouping option)
- All accessory features are now automatically detected from the airbase device capabilities

### Fixed

- Fixed bug that prevented adding the platform as a child bridge

### Technical

- Full rewrite in TypeScript
- Complete refactor of platform, accessory, and service layers
- Added `FanAirside` and `FanAuto` enums for better code maintainability
- Improved type safety throughout the codebase

### Behavior Details

- When airside fan is ON, the regular fan accessory shows as OFF/INACTIVE
- When turning on or adjusting the regular fan, airside fan is automatically disabled
- When turning on airside fan switch, auto fan mode is automatically disabled
- Fan speed adjustments work alongside auto mode (allows auto low/medium/high)

## [3.2.5] - 2022-10-15

### Fixed

- Fixed an exception when the plugin fails to reach the AirBase module at the last retry attempt [#50](https://github.com/yenoiwesa/homebridge-daikin-airbase/pull/50)

### Contributors

- [@longzheng](https://github.com/longzheng)

## [3.2.4] - 2022-08-30

### Fixed

- Fixed a Homebridge warning when Homekit is fetching the Heater Cooler Target status while the aircon is in fan or dry mode [#47](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/47)

## [3.2.3] - 2022-03-31

### Changed

- Decreased logging level from info to debug for common logging events [#41](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/41)

### Contributors

- [@cemilbrowne](https://github.com/cemilbrowne)

## [3.2.2] - 2022-01-26

### Security

- Patched `node-fetch` to version `2.6.7` for [vulnerability](https://github.com/node-fetch/node-fetch/releases/tag/v2.6.7)

## [3.2.1] - 2022-01-22

### Fixed

- Fixed command sent to the Daikin Airbase when receiving chain of requests from Home app automations, resulting in wrong target temperature being set [#37](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/37)

## [3.2.0] - 2022-01-16

### Added

- Added the ability to map zone control toggles to individual accessories (vs. being mapped as multiple services of a single accessory) so that each zone control switch can be placed in the room it controls in the Home app [#22](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/22)
- New optional configuration `useIndividualZoneControls` (Boolean, default: false) to enable individual zone accessories

## [3.1.0] - 2021-07-26

### Added

- Added the ability to override a limited number of Daikin Airbase properties, such as forcing the dry mode and fan mode support. This allows hiding the dry mode and/or fan mode switches by forcing their support property to `false` [#30](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/30)

## [3.0.2] - 2021-06-08

### Fixed

- Fixed a bug where setting the Heater/Cooler threshold temperature via automations would fail to apply the temperature set [#27](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/27)

## [3.0.1] - 2021-05-05

### Fixed

- Fixed a bug with recent versions of HomeKit where the fan speed would be shown as zero when the fan is set to LOW mode on the A/C unit [#23](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/23)

## [3.0.0] - 2020-09-02

### ⚠️ BREAKING CHANGES

- Warning: Due to changes to the platform initialisation routine, your previous accessories will lose their homekit specific details once upgrading (room allocation, custom name, scenes and automations). You will have to redo these settings.

### Changed

- Upgraded npm dependencies to the latest versions. The platform now requires homebridge version 1.0.0 or above to run
- [#18](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/18) The platform will now properly use cached homebridge accessories and restore them, instead of always re-creating them from scratch when homebridge starts
- [#18](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/18) The platform will no longer unregister accessories if it cannot reach the airbase module when homebridge starts. Instead the cached accessories will still be available, and shown as "Not responding" in the Home app

### Added

- If the platform fails to contact all the previously registered airbase modules when homebridge starts, it will re-attempt to reach them multiple times, with the last attempt made around 85 minutes after homebridge has started

## [2.0.6] - 2020-06-28

### Fixed

- Fixed an issue where the platform would crash if encountering multiple zones with the same name. The platform will now only map one of the zones with the duplicated names, the other ones will be ignored [#14](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/14)

## [2.0.5] - 2020-05-17

### Added

- Added an advanced settings section to the Homebridge UI configuration schema [#5](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/5)

## [2.0.3] - 2020-05-09

### Added

- This release includes a configuration JSON schema to allow the Homebridge UI project to show a configuration page for this plugin

## [2.0.1] - 2020-05-09

### Fixed

- Fixed bug that forced the heater/cooler to cool mode when switched on [#13](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/13)

## [2.0.0] - 2020-04-02

### Added

- Added support for the Daikin Zone Controller Zones [#7](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/7). The plugin will now check whether zone support is enabled, and query the defined zones from the Airbase module at start up. The zones will then be mapped to a new accessory group with an individual switch mapping each zone

## [1.3.0] - 2020-03-08

### Added

- Added support for background polling of the Daikin Airbase's state [#3](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/3)
- The default polling interval is set to 5 minutes and can be changed in minutes with the `pollingInterval` configuration, or disabled by setting it to `0`
- The polling allows to refresh the state of the accessories in the background so that automations can react on them

## [1.2.4] - 2020-03-02

### Fixed

- Mapped the Airbase power off state to 0 fan speed to fix the Home app display inconsistency with the fan rotation speed when turning on the aircon

## [1.2.3] - 2020-03-01

### Fixed

- Fixed the issue with setting Fan or Dry mode that would result in the aircon being entirely turned off. This is fixed by caching the previously set control info value, so that it does not rely on the response from the Daikin airbase module for its updated state (the airbase module has a stale value for up to a few seconds after setting a new state)

### Changed

- Decreased back set control info debounce delay to 0.5s

## [1.2.2] - 2020-03-01

### Changed

- Decreased set control info debounce delay from 1s to 0.8s
- Added priority to Fan & Dry mode switches requests over Heater/Cooler ones

## [1.2.1] - 2020-03-01

### Changed

- Shortened name of the Heater/Cooler service from Heating & Cooling to Heat & Cool
- Increased debounce delay for the set control info request from 0.5s to 1s

## [1.2.0] - 2020-02-27

### Added

- Added support for fan and dry modes [#2](https://github.com/yenoiwesa/homebridge-daikin-airbase/issues/2)
- The plugin will register an accessory with 4 services for each airbase, showing as grouped accessories in the Home app:
  - A heater/cooler service allowing to set the aircon to cool/heat or auto mode, as well as the threshold temperatures
  - A switch allowing to turn on/off fan mode
  - A fan service allowing to change the aircon's fan speed (low/medium/high) if the device supports changing fan speed
  - A second switch allowing to turn on/off dry mode if the device supports that mode

## [1.1.0] - 2020-02-20

### Added

- Added support for Daikin devices auto-discovery via UDP broadcasting on the local network
- Added support for mapping multiple Daikin Airbase enabled devices

### Changed

- Modified the behaviour of the `hostname` configuration entry to become optional, and accept arrays of hostnames

## [1.0.1] - 2020-02-19

### Added

- Added retry mechanism for HTTP requests sent to the Daikin API that fail with any operational `FetchError` (to cover `ECONNRESET` cases). The plugin will attempt the request 3 times before giving up

### Changed

- Changed the update of the current heating/cooling state to be done without a delayed action. It will now be processed as soon as the `setControlInfo` call has resolved instead of waiting for a given timeout

## [1.0.0] - 2020-02-18

### Added

- Initial release
- Maps the Daikin Airbase enabled aircon to a Homekit Heater Cooler accessory

