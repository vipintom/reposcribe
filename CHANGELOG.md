# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-07-29

### Added

- **Command Palette Integration**:
  - `RepoScribe: Force Rebuild`: Manually trigger a regeneration of the output file.
  - `RepoScribe: Create Configuration File`: Quickly create a `.reposcribe.json` file with default settings.
  - `RepoScribe: Pause/Resume Automatic Generation`: Toggle the file watcher on and off.
- **Status Bar Quick Menu**: Clicking the status bar item now opens a popup menu with quick actions:
  - Pause/Resume Generation
  - Open Output File
  - Copy Output File Content
- **Configurable Regeneration Delay**: Added `regenerationDelay` option to `.reposcribe.json` to control the debounce time for file updates.

### Changed

- The generated `.reposcribe.json` now includes default values for easier customization.
- The status bar item's click action now opens the new quick menu instead of directly opening the file.

## [0.0.1] - 2024-07-29

### Added

- **Initial Release of RepoScribe**
- Automatic generation of `PROJECT_STRUCTURE.md` on activation.
- Real-time updates via file watchers for file creation, deletion, and modification.
- Debounced updates (~1.5s) to bundle rapid file changes into a single operation.
- Immediate regeneration on changes to `.reposcribe.json` or `.gitignore`.
- Support for a `.reposcribe.json` configuration file to customize:
  - `outputFile`: Change the name and location of the output file.
  - `include`: Specify glob patterns for files to include.
  - `exclude`: Specify glob patterns for files to exclude, in addition to defaults.
- Respects `.gitignore` rules by default.
- Built-in exclusion of common binary file types.
- VS Code Status Bar item providing at-a-glance feedback (`Ready`, `Generating`, `Updated`, `Error`).
- Atomic file writes to prevent corruption of the output file.
- Automatic creation or updating of `.gitignore` to include the output file.
