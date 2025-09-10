# RepoScribe for VS Code

RepoScribe is a Visual Studio Code extension that automatically generates and maintains a single Markdown document containing a complete, real-time snapshot of your project's source code. This file includes a detailed directory tree and the full contents of every relevant file, serving as a perfect, self-updating context for documentation, code reviews, or analysis with Large Language Models (LLMs).

## Features

- **Generate for Selection**: Instantly create a snapshot of specific files or folders by right-clicking them in the Explorer.
- **User-Controlled Generation**: For new projects, RepoScribe starts paused, giving you full control over when to generate the initial snapshot.
- **Persistent State**: Remembers its "paused" or "running" state for each project across VS Code sessions.
- **Real-Time Updates**: Once active, it watches your workspace for file changes and automatically updates the snapshot.
- **Intelligent & Performant**: Uses a smart watcher that pre-filters events and an in-memory configuration cache to prevent unnecessary work and save system resources.
- **Smart Debouncing**: Bundles rapid file changes into a single update to minimize performance impact.
- **`.gitignore` Aware**: Natively respects your project's `.gitignore` rules.
- **Highly Configurable**: Use an optional, self-documenting `.reposcribe.jsonc` file (with comments!) to precisely control which files are included or excluded.
- **File Size Limiting**: Set a `maxFileSizeKb` threshold to automatically omit overly large files.
- **Reliable**: Uses atomic writes to prevent file corruption and safely skips inaccessible directories.
- **Seamless Git Integration**: Automatically adds the output file to your `.gitignore`.
- **Status Bar Feedback**: A convenient status bar icon keeps you informed of RepoScribe's status.

## Getting Started

1. **Install the Extension**: Find "RepoScribe" in the VS Code Marketplace and click Install.
2. **Open a Project**: Open a folder or workspace in VS Code.
3. **Activate RepoScribe**: For a new project, the extension will start in a **paused** state. An information message will appear. To begin, simply click the status bar icon and select **"Resume Watcher"** from the hover menu. This will generate the initial `PROJECT_STRUCTURE.md` file, and RepoScribe will then remain active to keep it updated.

## Configuration

For more granular control, create a `.reposcribe.jsonc` file in your project's root directory. You can generate this file quickly by running the **`RepoScribe: Create Configuration File`** command from the command palette. The generated file includes comments explaining each option.

### Available Options

- `outputFile` (string): Customize the output file's name and path.
  - **Default**: `"PROJECT_STRUCTURE.md"`
- `include` (string[]): An array of glob patterns that act as a powerful "allow-list" to override default exclusions.
  - **Default**: `[]`
- `exclude` (string[]): An array of glob patterns to exclude files. These rules are applied last as a final veto.
  - **Default**: A built-in list of common binary files and dependency folders. Your custom patterns are added to this list.
- `regenerationDelay` (number): The delay in milliseconds to wait after a file change before regenerating the output.
  - **Default**: `1500`
- `maxFileSizeKb` (number): The maximum size of a file in kilobytes to be included. Files larger than this will be omitted. Set to `0` for no limit.
  - **Default**: `2048`

### Example `.reposcribe.jsonc`

This configuration tells RepoScribe to:

1. Override the default exclusion for `pnpm-lock.yaml`, ensuring it's always included in the snapshot.
2. Explicitly remove any test files and anything in the `src/legacy` directory as a final cleanup step.

```jsonc
// RepoScribe Configuration File (.jsonc format supports comments)
{
  // (Optional) The path to the output Markdown file.
  "outputFile": "PROJECT_STRUCTURE.md",

  // "include" acts as an "allow-list" to override default exclusions.
  // Here, we're forcing "pnpm-lock.yaml" (which is normally excluded) to be included.
  "include": ["pnpm-lock.yaml"],

  // "exclude" is the final authority. It removes any matching files.
  // We're removing all test files and a legacy folder.
  "exclude": ["**/*.test.ts", "src/legacy/**"]
}
```

### Understanding the File Filtering Logic

RepoScribe uses a precise, multi-stage process to decide which files to include in the snapshot. This allows for powerful and predictable control. The rules are applied in this exact order:

1. **Start with All Files**: RepoScribe begins by finding every file in your workspace.
2. **Apply `.gitignore` Rules**: Any file or folder matching a pattern in your `.gitignore` file is removed. This is the baseline for what's "in" your project.
3. **Apply Default Exclusions**: A built-in list of common patterns (like `node_modules`, `dist`, `.git`, binary files, etc.) is applied. Any matching files are removed. You can see this full list as comments in the file generated by the `Create Configuration File` command.
4. **Apply Your `include` Rules (The "Allow-List")**: The `include` array is your tool to override the default exclusions. RepoScribe looks at the files that were just removed in Step 3 and **adds back** any that match a pattern in your `include` list.
   - _Example_: The file `pnpm-lock.yaml` is excluded by default. To include it, you would add `"pnpm-lock.yaml"` to your `include` array.
5. **Apply Your `exclude` Rules (The Final Veto)**: Finally, after the list has been potentially re-populated by your `include` rules, your `exclude` patterns are applied. Any file matching a pattern here is **removed**. This rule is the final authority and cannot be overridden.
   - _Example_: Even if you `include` `"dist/bundle.js"`, adding `"dist/**"` to `exclude` will ensure `dist/bundle.js` is removed.

This flow ensures that `include` is a targeted tool for rescuing specific files from default ignores, while your `exclude` provides the ultimate control to remove anything you don't want.

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **`RepoScribe: Force Rebuild`**: Immediately regenerates the project snapshot.
- **`RepoScribe: Pause/Resume Automatic Generation`**: Toggles the file watcher on or off. The state is saved per-project.
- **`RepoScribe: Create Configuration File`**: Creates a `.reposcribe.jsonc` file in your project root with default settings and explanatory comments.
- **`RepoScribe: Open Output File`**: Opens the generated Markdown file.
- **`RepoScribe: Copy Output File Content`**: Copies the entire content of the output file to your clipboard.
- **`RepoScribe: Generate Snapshot for Selection`**: Generates a snapshot for the selected file(s) and/or folder(s) in the Explorer and copies it to the clipboard.

## Status Bar Indicator

The RepoScribe status bar item provides at-a-glance feedback on the extension's current state. The default **click action** is to copy the output file's content to the clipboard.

The icon changes to reflect the current status:

- `$(note) | $(eye-watch)`: Idle and watching for file changes.
- `$(note) | $(sync~spin)`: Actively regenerating the file.
- `$(note) | $(check-all)`: The snapshot has been successfully updated.
- `$(note) | $(debug-pause)`: Auto-generation is currently paused.
- `$(note) | $(error)` (with a red background): An error occurred. Check the "RepoScribe" output channel for details.

**Hovering** over the icon reveals a rich interactive menu with all available actions, including Pause/Resume, Open Output File, and Copy Content.

## Contributing

This project is under active development. Bug reports, feature requests, and contributions are welcome!

## License

MIT
