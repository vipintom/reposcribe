# ⚙️ RepoScribe – Tech Stack

## 1. Core Platform

- **Visual Studio Code Extension API**
  - Provides access to the workspace, file system, file watchers, status bar, and other core components.
  - The runtime environment is the Node.js version that ships with VS Code.

## 2. Language & Build System

- **TypeScript (v5.x)**
  - Provides strong typing for the extension APIs and our internal logic.
  - Helps catch potential `null` bugs, async issues, and incorrect type usage early.
- **ESBuild (latest)**
  - An extremely fast bundler for the extension, significantly outperforming the legacy `webpack` default.
  - Produces a single, optimized `extension.js` file for distribution.

## 3. File System & Globbing

- **`fast-glob` (v3.x)**
  - A highly efficient library for glob pattern matching, ideal for scanning large repositories.
  - Natively supports ignore patterns, simplifying our filtering logic.
- **`ignore` (v5.x)**
  - The de facto standard for parsing `.gitignore` files. It's battle-tested and used by major tools like ESLint.

## 4. Markdown Generation

- **Tree Rendering:** A custom, lightweight recursive generator will be implemented to avoid heavy dependencies.
- **Code Fence Syntax:** A simple internal lookup table (e.g., `Map<extension, languageId>`) will be used. This avoids bloating the extension with a full syntax highlighting library, as VS Code's renderer handles the highlighting itself.

## 5. Reliability & Atomic Writes

- **`fs-extra` (v11.x)**
  - Provides robust file system helpers like `outputFile` (which ensures the target directory exists) and `move` (atomic rename with overwrite).
  - This simplifies the implementation of atomic writes, preventing corrupted output files.

## 6. Development Tooling

- **Yeoman Generator (`yo code`)**
  - Used to scaffold the initial extension project with the recommended TypeScript and VS Code configurations.
- **ESLint + Prettier**
  - Enforces a consistent and clean codebase.
- **Jest (latest)** _(Optional)_
  - For unit-testing critical, pure-logic functions like file filtering and config parsing.
- **VS Code Extension Test Runner (`@vscode/test-electron`)**
  - For running integration tests within an actual VS Code instance to validate API interactions.

## 7. Performance Optimizations

- **`debounce-fn` (v5.x)**
  - A lightweight, modern debounce utility for batching file watcher events efficiently.
- **`async/await` with `Promise.all`**
  - Ensures that file contents are read concurrently, dramatically speeding up the generation process on projects with many files.

## 8. Distribution

- **`vsce` (Visual Studio Code Extensions)**
  - The official command-line tool for building and publishing the extension to the Visual Studio Code Marketplace.
- **`ovsx` (Open VSX Registry CLI)**
  - _(Optional)_ A tool to publish the extension to the Open VSX registry, making it available to non-Microsoft distributions like VSCodium.

---

## 📦 Final Stack Overview

| Layer                  | Choice                           | Why?                                                |
| :--------------------- | :------------------------------- | :-------------------------------------------------- |
| **Language**           | `TypeScript v5.x`                | Safety, modern features, and great DX.              |
| **Bundler**            | `ESBuild`                        | Fastest build times, simple configuration.          |
| **FS Utilities**       | `fs-extra`                       | Robust atomic writes and `mkdirp` support.          |
| **Globbing**           | `fast-glob` + `ignore`           | High performance + gold-standard gitignore parsing. |
| **Debouncing**         | `debounce-fn`                    | Small, modern, and reliable.                        |
| **Tests**              | `Jest` + `@vscode/test-electron` | Full unit and integration test coverage.            |
| **Formatting/Linting** | `ESLint` + `Prettier`            | Ensures a clean and consistent codebase.            |
| **Packaging**          | `vsce`, `ovsx`                   | Official Marketplace + Open VSX support.            |

---
