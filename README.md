# RepoScribe for VS Code

RepoScribe is a Visual Studio Code extension that automatically generates and maintains a single Markdown document containing a complete, real-time snapshot of your project's source code. This file includes a detailed directory tree and the full contents of every relevant file, serving as a perfect, self-updating context for documentation, code reviews, or analysis with Large Language Models (LLMs).

## Features

- **Automatic Generation**: Creates a `PROJECT_STRUCTURE.md` file in your project root the moment it's activated.
- **Real-Time Updates**: Watches your workspace for file changes and automatically updates the snapshot.
- **Smart Debouncing**: Bundles rapid file changes into a single update to minimize performance impact.
- **`.gitignore` Aware**: Natively respects your project's `.gitignore` rules.
- **Highly Configurable**: Use an optional `.reposcribe.json` file to precisely control which files are included or excluded.
- **Command Palette Integration**: Access core features directly from the command palette (`Ctrl+Shift+P`):
  - `RepoScribe: Force Rebuild`
  - `RepoScribe: Create Configuration File`
  - `RepoScribe: Pause/Resume Automatic Generation`
- **Status Bar Quick Menu**: A convenient popup menu for common actions, accessible by clicking the status bar item.
- **Reliable**: Uses atomic writes to prevent file corruption, even during rapid changes.
- **Seamless Git Integration**: Automatically adds the output file to your `.gitignore`.
- **Status Bar Feedback**: A convenient status bar icon keeps you informed of RepoScribe's status.

## Getting Started

1. **Install the Extension**: Find "RepoScribe" in the VS Code Marketplace and click Install.
2. **Open a Project**: Open a folder or workspace in VS Code.
3. **Done!**: RepoScribe will automatically generate `PROJECT_STRUCTURE.md` in your root directory and keep it updated as you work.

## Configuration

For more granular control, create a `.reposcribe.json` file in your project's root directory. You can generate this file quickly by running the **`RepoScribe: Create Configuration File`** command from the command palette.

### Available Options

- `outputFile` (string): Customize the output file's name and path.
  - **Default**: `"PROJECT_STRUCTURE.md"`
- `include` (string[]): An array of glob patterns. If specified, **only** files matching these patterns will be included (after respecting `.gitignore`).
  - **Default**: `[]` (include all non-ignored files)
- `exclude` (string[]): An array of glob patterns to exclude files. These are applied _after_ the `include` patterns.
  - **Default**: A built-in list of common binary files and dependency folders. Your custom patterns are added to this list.
- `regenerationDelay` (number): The delay in milliseconds to wait after a file change before regenerating the output.
  - **Default**: `1500`

### Example `.reposcribe.json`

This configuration tells RepoScribe to:

1. Name the output file `docs/CodeSnapshot.md`.
2. Only include TypeScript files from the `src` directory and the root `README.md`.
3. Explicitly exclude any test files within that set.
4. Wait 2 seconds (2000ms) after a file change before updating.

```json
{
  "outputFile": "docs/CodeSnapshot.md",
  "include": ["src/**/*.ts", "README.md"],
  "exclude": ["**/*.test.ts", "src/legacy/**"],
  "regenerationDelay": 2000
}
```

### File Filtering Logic

The final list of files is determined by this exact sequence:

1. **Discover All**: Start with all files in the workspace.
2. **Apply `.gitignore`**: Remove any file matching a rule in `.gitignore`.
3. **Apply Default Exclusions**: Remove files matching the built-in list of binary/non-text file types.
4. **Apply Custom `include`**: If `include` is not empty, keep _only_ the files that match an `include` pattern.
5. **Apply Custom `exclude`**: From the resulting list, remove any file that matches a rule in the `exclude` array.

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **`RepoScribe: Force Rebuild`**: Immediately regenerates the project snapshot.
- **`RepoScribe: Pause/Resume Automatic Generation`**: Toggles the file watcher on or off.
- **`RepoScribe: Create Configuration File`**: Creates a `.reposcribe.json` file in your project root with default settings.
- **`RepoScribe: Open Output File`**: Opens the generated Markdown file.
- **`RepoScribe: Copy Output File Content`**: Copies the entire content of the output file to your clipboard.

## Status Bar

The RepoScribe status bar item gives you quick feedback and access to a menu of actions.

- `$(file-code) RepoScribe: Ready`: Idle and watching for changes.
- `$(sync~spin) RepoScribe: Generating...`: Actively regenerating the file.
- `$(check) RepoScribe: Updated`: The file has been successfully updated.
- `$(error) RepoScribe: Error`: An error occurred. Check the "RepoScribe" output channel for details.
- `$(debug-pause) RepoScribe: Paused`: Automatic generation is currently paused.

Clicking the status bar item will open a quick menu with these actions:

- **Pause/Resume Auto-Generation**
- **Open Output File**
- **Copy Output File Content**

## Contributing

This project is under active development. Bug reports, feature requests, and contributions are welcome!

## License

MIT
