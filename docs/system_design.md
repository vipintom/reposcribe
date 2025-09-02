# RepoScribe — System Design Document

## 1. Purpose & Scope

RepoScribe is a VS Code extension that automatically produces and maintains a single Markdown snapshot of a repository containing: 1) a directory tree, and 2) the contents of relevant source files. Its behavior is driven by a flexible configuration system that respects `.gitignore` and an optional `.reposcribe.json` file.

The MVP regenerates the full output file on changes, incorporating performance optimizations (debounce, concurrent reads, efficient globbing) and performing atomic writes to avoid corruption.

---

## 2. High-Level Architecture

```
┌────────────────────────────┐
│        VS Code Host        │
│  (Extension Runtime/Node)  │
└─────────────┬──────────────┘
              │  VS Code API (workspace, fs, status bar, watchers)
┌─────────────▼───────────────────┐
│           RepoScribe            │
│          (Extension)            │
├─────────────┬───────────────────┤
│ Activation  │                   │
│ Controller  │                   │
├─────────────┼───────────────────┤
│ FileSystem  │  Event Pipeline   │
│ Watchers    │  (Debounced)      │
├─────────────┼───────────────────┤
│ Discovery & Filtering Engine    │  ← fast-glob + ignore + resolved config
├─────────────┼───────────────────┤
│ Markdown Generation Pipeline    │  ← tree renderer + content renderer
├─────────────┼───────────────────┤
│ Atomic Writer & IO Utilities    │  ← fs-extra
├─────────────┼───────────────────┤
│ UX Layer & Centralized Logger   │  ← status bar + output channel
└─────────────────────────────────┘
```

**Key Data Flows:**

1. **Activation** → resolve config → initial scan → generate output.
2. **Workspace changes** (create/modify/delete/rename) → debounced event → regenerate.
3. **Config/ignore changes** → immediate event → regenerate.

---

## 3. Module Responsibilities

### 3.1 Activation Controller (`src/extension.ts`)

- Entry point of the extension.
- Initializes and owns the singleton `GenerationCoordinator` instance.
- Instantiates the `CentralizedLogger` and passes it to other components.

### 3.2 GenerationCoordinator (`src/core/coordinator.ts`)

- Orchestrates the entire generation process.
- Manages file watchers and the debounced event pipeline.
- Triggers regeneration in response to events.

### 3.3 Discovery & Filtering Engine (`src/core/discovery.ts`)

- Enumerates all files using `fast-glob`, including dotfiles (`dot: true`).
- Applies filtering logic based on the **resolved configuration** in the defined order of precedence.
- Returns a **sorted** file list (directories first, then alphabetical).

### 3.4 Markdown Generation Pipeline (`src/core/markdown.ts`)

- **Tree Renderer**: Builds and renders an ASCII-style directory tree from the sorted file list.
- **Content Renderer**: Reads file contents concurrently and wraps them in fenced code blocks with appropriate language tags from the resolved config.

### 3.5 Atomic Writer & IO Utilities (`src/core/io.ts`)

- Ensures the output directory exists before writing.
- Performs atomic writes by writing to a temporary file first, then moving it into place.
- Safely updates `.gitignore` with the output filename.

### 3.6 Config Management (`src/core/config.ts`)

- Defines a **base configuration** object containing all default values (e.g., default `outputFile`, default `exclude` patterns for binaries and common vendor folders like `node_modules`).
- Loads `.reposcribe.json` from the workspace root if it exists.
- **Merges** the user's configuration over the base configuration. The user's values always take precedence.
- Validates the final resolved configuration and provides it to the coordinator.

### 3.7 Centralized Logger (`src/core/logger.ts`)

- A singleton service that manages all logging for the extension.
- Writes logs to a dedicated "RepoScribe" VS Code Output Channel.
- Provides standardized logging methods (`log.info()`, `log.warn()`, `log.error()`). All other modules will use this service for logging.

### 3.8 UX Layer (`src/ux/status.ts`)

- Manages the VS Code Status Bar item, updating its icon and text to reflect the extension's state (Ready, Generating, Updated, Error).

---

## 4. Data Model & Key Structures

### 4.1 Resolved Configuration

```ts
interface RepoScribeConfig {
  outputFile: string;
  include: string[];
  exclude: string[];
  languageMap: Record<string, string>; // e.g., { ".ts": "typescript" }
  // ... other future config options
}
```

### 4.2 Generation Context

```ts
interface GenerationContext {
  workspaceRoot: string;
  config: RepoScribeConfig; // The final, merged configuration
  gitignore: Ignore; // The initialized 'ignore' instance
}
```

---

## 5. Algorithms

### 5.1 Configuration Resolution

1. Start with the hardcoded **base configuration** object in `config.ts`.
2. Read and parse `.reposcribe.json` from the user's workspace.
3. If user config exists and is valid, deeply merge it over the base configuration.
4. The result is the **resolved config** used for a generation cycle.

### 5.2 File Discovery & Filtering (Precedence)

1. `allFiles = fastGlob('**/*', { dot: true })`
2. Apply `gitignore` rules → `baselineFiles`.
3. If `resolvedConfig.include` is not empty → `includedFiles = filter(baselineFiles)` else `includedFiles = baselineFiles`.
4. Apply `resolvedConfig.exclude` rules → `finalFiles`.
5. Sort `finalFiles` (directories first, then alphabetically).

### 5.3 Content Rendering

- Use `Promise.allSettled` to read file contents concurrently with a **bounded concurrency of 16** to prevent overwhelming the file system.
- Look up the language identifier for each file from `resolvedConfig.languageMap`. Fall back to `text` if not found.

### 5.4 Atomic Write

1. Compose the full Markdown string in memory.
2. Write to `tmpPath = outputPath + '.tmp'` using `fs-extra.outputFile`.
3. On success, `fs-extra.move(tmpPath, outputPath, { overwrite: true })`.
4. On failure, log the error and clean up the temporary file.

---

## 6. Sequence Diagrams (ASCII)

### 6.1 Activation & Initial Generation

```
User opens workspace
    │
VS Code activates extension ───► Activation Controller
    │                            │
    │                            ├─ const logger = new CentralizedLogger()
    │                            ├─ const config = resolveConfig()
    │                            ├─ const coordinator = new Coordinator(logger, config)
    │                            ├─ setupStatusBar(Ready)
    │                            └─ coordinator.generate() ───► Discovery & Filtering
    │                                                         │ (uses resolved config)
    │                                                         └─ filtered list
    │                            ┌─────────────────────────────▼─────────────────┐
    │                            │ Markdown Generation (tree + contents)       │
    │                            └─────────────────────────────▲─────────────────┘
    │                                                         │
    │                                      AtomicWriter.write(markdown)
    │                                                         │
    │                            Status: Updated ◄─────────────┘
```

---

## 7. Error Handling & Resilience

- **Config parse errors**: Log via `logger.error()`; show status `Error`; fall back to base defaults.
- **IO failures**: Log the full error via `logger.error()`, mark status `Error`, and include a `Show Logs` action.
- **Large repo guard**: If discovered files > threshold, log a warning via `logger.warn()`; still proceed.

---

## 8. Performance Strategy

- Use `fast-glob` with `dot: true` and `followSymbolicLinks: false`.
- File read concurrency is bounded to **16** simultaneous reads.
- Debounced regeneration coalesces bursts of file changes into a single operation.
- Log generation timings to the output channel to measure performance.

---

## 9. Security & Privacy Considerations

- The extension makes no network calls.
- It honors `.gitignore` and user-defined excludes to help prevent leaking secrets.
- Symlinks are not followed to avoid escaping the workspace boundary.
- **The `outputFile` path is validated to ensure it resides within the workspace root.**

---

## 10. Observability & Logging

- A **Centralized Logger** manages all logging output.
- It writes to a dedicated VS Code Output Channel named **"RepoScribe"**.
- Log levels (INFO, WARN, ERROR) will be used to structure output clearly.

---

## 11. Testing Strategy

- **Unit Tests (Jest):**
  - **Config resolution:** Test merging user config over base defaults correctly.
  - Glob filtering precedence.
  - Tree rendering correctness.
- **Integration Tests (`@vscode/test-electron`):**
  - Activation triggers generation.
  - Debounced regeneration on file changes.
  - Ignoring its own output file.
  - `.gitignore` or `.reposcribe.json` changes trigger immediate regeneration.

---

## 12. Rollout & Roadmap

- **MVP (v1.0):** Full regeneration, config-driven behavior, status bar, atomic writes, debounce.
- **v1.1:** Command palette actions (Force Regenerate); expose more settings in config.
- **v1.2:** Patch updates (intelligent diffing); file content caching based on mtime.

---
