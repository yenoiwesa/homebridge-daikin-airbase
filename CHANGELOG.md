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

