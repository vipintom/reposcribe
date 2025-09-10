# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2025-09-11

### Fixed

- **Context Menu:** Fixed an issue where the "Generate Snapshot for Selection" option would not reliably appear when right-clicking on items in the Explorer.

## [0.4.0] - 2025-09-10

### Added

- **Generate for Selection**: Right-click on any file(s) or folder(s) in the Explorer to generate a snapshot for just that selection and copy it directly to your clipboard.
- **Max File Size Limit**: Added a new `maxFileSizeKb` option in `.reposcribe.jsonc` to automatically exclude files that exceed a certain size, preventing oversized outputs.
- **Configuration Caching**: Implemented an in-memory configuration cache to significantly boost performance on all generation tasks by minimizing redundant file reads.

### Changed

- **Major Configuration Overhaul**:
  - The configuration file is now `.reposcribe.jsonc`, which supports comments. The `Create Configuration File` command now generates a self-documenting template to make customization easier.
  - The filtering logic has been redesigned to be more powerful. User `include` patterns can now override default exclusions, giving you precise control to bring back files that would normally be ignored.
- **Expanded Default Exclusions**: The list of built-in file exclusions has been significantly expanded to include dozens of common binary, media, document, and compiled artifact types for a much cleaner default snapshot.

### Deprecated

- The `.reposcribe.json` file format is now deprecated. The extension will display a warning and ignore this file, guiding users to migrate to the new `.reposcribe.jsonc` format.

## [0.3.8] - 2025-09-09

### Changed

- **Statusbar:** Improved statusbar icons

## [0.3.5] - 2025-09-09

### Fixed

- **Performance:** Heavy dependencies (`fast-glob`, `fs-extra`, `ignore`) are now loaded dynamically on-demand instead of blocking the main thread during startup.

## [0.3.4] - 2025-09-08

### Fixed

- **Performance:** Fixed a critical bug that caused a ~5-second activation delay, even after previous fixes. All I/O-bound startup logic, including watcher initialization and state checking, is now fully decoupled from the activation process, ensuring the extension loads instantly.

## [0.3.3] - 2025-09-07

### Added

- **Persistent State:** The extension now remembers its "paused" or "running" state on a per-project basis. When you close and reopen VS Code, RepoScribe will restore its previous state for that workspace.

### Changed

- **Default Behavior:** For new projects, RepoScribe now starts in a **paused** state by default. This prevents automatic file generation until the user explicitly opts in by resuming the watcher, providing more control over when the extension is active.

## [0.3.2] - 2025-09-06

### Fixed

- **Performance:** Dramatically improved extension startup time by running the initial project scan as a non-blocking background task. This prevents VS Code from lagging or showing an activation error on large projects, ensuring the extension feels instantaneous.

## [0.3.1] - 2025-09-05

### Fixed

- **Performance:** Fixed a major performance issue where the extension would trigger regeneration for changes to ignored files (e.g., in `.gitignore`, `node_modules`, or database files). Watchers now pre-filter events, significantly reducing unnecessary CPU usage.
- **Stability:** Fixed a critical crash caused by permission errors (`EACCES`) when scanning directories like `netdata` or system-owned caches. The file scanner will now safely skip inaccessible directories.

### Changed

- **Configuration:** Expanded the default exclusion list to include common Python artifacts (`__pycache__`, `venv`), log files (`*.log`), and database/cache directories to improve out-of-the-box performance and prevent errors.
- **Internal:** Performed a major internal refactoring to improve code quality and maintainability by separating watcher and command logic into dedicated application services (`WorkspaceWatcher`, `CommandRegistry`).

## [0.3.0] - 2025-09-02

### Changed

- **Major UI/UX Overhaul of the Status Bar Item:**
  - Moved the item to the **right side** of the status bar for better alignment with VS Code conventions.
  - Replaced the custom SVG with the built-in `$(note)` Codicon for improved reliability and a cleaner look.
  - The item is now **icon-only** to take up less space.
  - Replaced the command palette popup with a rich, **interactive hover panel** containing all quick actions (Pause/Resume, Open File, Copy Content).
  - The icon now uses a themed red background to clearly indicate when an error has occurred.
- Changed the default **click action** on the status bar item to **Copy File Content** for quicker workflow integration with LLMs.

## [0.2.0] - 2025-09-02

### Changed

- The `RepoScribe: Create Configuration File` command now generates a `.reposcribe.json` file pre-populated with the default exclusion list for easier customization.

### Fixed

- **Performance:** Significantly improved extension startup time by running the initial project scan as a non-blocking background task. This prevents VS Code from lagging on large projects during activation.

## [0.1.x] - 2025-09-02

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

## [0.0.1] - 2025-09-02

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
