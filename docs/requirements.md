📄 **RepoScribe – Requirements Specification**

This document outlines the complete requirements for the RepoScribe VS Code extension. It is the final blueprint for the Minimum Viable Product (MVP) and includes key refinements for robustness, flexibility, and user experience.

### 1. Overview

RepoScribe is a Visual Studio Code extension that automatically generates and maintains a single Markdown document containing a complete snapshot of a project's source code. The generated file includes:

1. A text-based project tree structure.
2. The full contents of all relevant source files, embedded in Markdown code blocks.

This document serves as a self-updating, comprehensive reference for documentation, code reviews, or for providing context to Large Language Models (LLMs).

### 2. Goals & Non-Goals

#### Goals

- Generate a single, configurable Markdown file in the project root.
- Keep the file automatically updated in near real-time as the project changes.
- Respect `.gitignore` as the primary source of truth for file exclusion.
- Allow for fine-grained control via an optional `.reposcribe.json` configuration file.
- Prevent corruption of the output file through atomic write operations.
- Intelligently exclude common binary file types by default.
- Optimize for performance by batching updates (debouncing).
- Provide clear, non-intrusive feedback via an icon-based VS Code Status Bar item.

#### Non-Goals (for v1.0)

- Multi-root workspace support.
- Smart patching (partial file updates).
- Rich formatting beyond the defined Markdown structure.
- External syncing or sharing features.

### 3. File Naming & Location

- **Default Output File:** `PROJECT_STRUCTURE.md`.
- **Customization:** The output filename can be customized in `.reposcribe.json` via the `outputFile` property.
- **Git Integration:** RepoScribe will automatically add the configured output filename to `.gitignore`.
  - If `.gitignore` exists, the filename will be appended if not already present.
  - If `.gitignore` does not exist, it will be created with the entry.
  - Failures to write to `.gitignore` will trigger a single, non-blocking warning notification.

### 4. Configuration

#### 4.1 Config File

- **Filename:** `.reposcribe.json` (located in the project root).

**Example `.reposcribe.json`:**

```json
{
  "outputFile": "docs/CodeSnapshot.md",
  "include": ["src/**/*.ts", "README.md"],
  "exclude": ["**/*.test.ts", "src/legacy/**"]
}
```

#### 4.2 Filtering & Precedence

The final list of files to be included is determined by this exact sequence:

1. **Discover All:** Start with a list of all files in the workspace.
2. **Apply `.gitignore`:** Remove any file matching a rule in `.gitignore`.
3. **Apply Default Binary Exclusions:** Remove any file matching the built-in list of common binary/non-text file extensions (e.g., `**/*.png`, `**/*.jpg`, `**/*.pdf`).
4. **Apply Custom `include`:** If a non-empty `include` array exists in `.reposcribe.json`, filter the current list, keeping _only_ files that match an `include` pattern.
5. **Apply Custom `exclude`:** From the resulting list, remove any file that matches a rule in the `exclude` array of `.reposcribe.json`.

### 5. Markdown File Structure

The generated output will be structured as follows:

````markdown
# RepoScribe – Project Snapshot

## Project Tree

<root>/
├── docs/
├── src/
│ ├── utils/
│ │ └── helper.ts
│ └── index.ts
└── README.md

---

## File Contents

### `README.md`

```markdown
# My Project
```

### `src/index.ts`

```typescript
// Content of index.ts
```

### `src/utils/helper.ts`

```typescript
// Content of helper.ts
```
````

- **File Tree Sorting:** The tree will be sorted with **directories first (alphabetically)**, followed by **files (alphabetically)** at each level.
- **Content Sorting:** The `File Contents` section will list files in the same sorted order as the project tree for consistency.
- **Syntax Highlighting:** Code blocks will use an appropriate language identifier derived from a mapping of file extensions (e.g., `.ts` -> `typescript`). Unrecognized extensions will default to plain text.

### 6. Update Behavior & Reliability

- **On Activation:** The extension will perform an initial full scan and generation.
- **On File Changes:** A `FileSystemWatcher` will monitor the workspace.
  - All change events trigger a **debounced** regeneration (waiting ~1.5 seconds after the last change) to bundle multiple rapid changes into a single update.
  - The watcher will be configured to ignore the extension's own output file to prevent infinite loops.
- **On Config Change:** A change to `.reposcribe.json` or `.gitignore` will trigger an immediate regeneration.
- **Atomic Writes:** To prevent data corruption, the file generation process is:
  1. Write the full content to a temporary file (e.g., `output.md.tmp`).
  2. On successful write, atomically rename the temporary file to the final output filename, overwriting the old version.
  3. The temporary file is cleaned up on success or failure.

### 7. User Experience & Interface

- **Status Bar Item:** An item in the status bar will provide at-a-glance feedback using icons:
  - **Idle:** `$(file-code) RepoScribe: Ready`
  - **Generating:** `$(sync~spin) RepoScribe: Generating...` (animated)
  - **Updated:** `$(check) RepoScribe: Updated`
  - **Error:** `$(error) RepoScribe: Error`
- **Action:** Clicking the status bar item will open the generated Markdown file.

### 8. Performance Considerations

- Utilize efficient file discovery libraries (e.g., `fast-glob`).
- For very large projects (>5,000 files), a one-time warning may suggest creating a `.reposcribe.json` to scope the output and improve performance.

### 9. Future Enhancements (Out of Scope for v1.0)

- **Command Palette Integration:** `RepoScribe: Force Regenerate`, `RepoScribe: Create Config File`.
- **Smart Patching:** Intelligently update only modified sections of the Markdown file.
- **File Size Limits:** Config option to automatically exclude files larger than `n` kilobytes.
- **Multi-root Workspace Support**.

---
