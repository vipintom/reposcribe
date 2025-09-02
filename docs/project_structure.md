### Project File Tree Structure (DDD Approach)

```
.
├── .vscode/
│   ├── launch.json
│   └── tasks.json
├── media/
│   └── icon.png
├── node_modules/
├── src/
│   ├── domain/
│   │   │ // The core, pure logic of RepoScribe. No VS Code APIs allowed here.
│   │   │ // This code is highly testable and independent of the runtime environment.
│   │   │
│   │   ├── config/
│   │   │   ├── types.ts          // Defines RepoScribeConfig interface, base defaults.
│   │   │   └── resolver.ts       // Pure function to merge user config over base config.
│   │   │
│   │   ├── workspace/
│   │   │   ├── FileTree.ts       // Logic to build the tree structure from a path list.
│   │   │   └── types.ts          // Defines the FileNode tree structure.
│   │   │
│   │   └── markdown/
│   │       ├── MarkdownBuilder.ts// Class to assemble the final markdown string from parts.
│   │       └── types.ts          // Defines language map and other rendering types.
│   │
│   ├── application/
│   │   │ // Orchestrates the domain logic to execute specific use cases.
│   │   │ // Connects the pure domain to the infrastructure.
│   │   │
│   │   └── GenerationCoordinator.ts // The main service that runs the end-to-end generation process.
│   │
│   ├── infrastructure/
│   │   │ // Implementations of external concerns (VS Code API, file system, logging).
│   │   │ // This is the "impure" part of the application.
│   │   │
│   │   ├── FileSystem.ts         // Wraps vscode.workspace.fs and fs-extra for atomic writes.
│   │   ├── FileScanner.ts        // Implements file discovery using fast-glob and the 'ignore' pkg.
│   │   ├── Logger.ts             // Centralized logger using VS Code's OutputChannel.
│   │   └── VSCodeUI.ts           // Manages the Status Bar, notifications, and other UI elements.
│   │
│   └── extension.ts              // The Composition Root. Initializes and wires everything together.
│
├── .eslintignore
├── .eslintrc.js
├── .gitignore
├── .prettierrc
├── package.json
├── tsconfig.json
└── ...
```

---

### Breakdown of Responsibilities

#### `src/domain/` - The Core Domain

This is the heart of your extension. The code here represents the "business rules" of RepoScribe.

- **Key Principle:** Contains zero dependencies on `vscode` or any other external infrastructure like `fs`. It should be possible to run this code in Node.js, a browser, or any JavaScript environment. This makes it extremely fast and easy to unit test.
- **`config/`**: Defines what a valid configuration looks like and how to resolve the final settings by merging a user's config with the base defaults.
- **`workspace/`**: Contains the logic for transforming a flat list of file paths into a hierarchical `FileNode` tree structure. This is a pure data transformation.
- **`markdown/`**: Takes the `FileNode` tree and file contents (as simple strings) and builds the final Markdown output string. It knows the rules of formatting—like how to draw the tree lines and format code fences.

#### `src/application/` - The Use Case Layer

This layer acts as the orchestrator. It knows _what_ needs to be done to fulfill a user request (like "generate the document"), but it doesn't know _how_ the low-level details are implemented.

- **`GenerationCoordinator.ts`**: This is the central conductor. When its `generate()` method is called, it will:
  1. Ask the `FileScanner` (from infrastructure) for a list of files.
  2. Pass that list to the `FileTree` builder (from domain).
  3. Ask the `FileSystem` (from infrastructure) to read the contents of those files.
  4. Pass the tree and contents to the `MarkdownBuilder` (from domain).
  5. Take the final Markdown string and give it to the `FileSystem` (from infrastructure) to be written to disk.

#### `src/infrastructure/` - The Infrastructure Layer

This layer contains all the code that interacts with the "outside world." It implements the interfaces required by the application layer.

- **Key Principle:** This is where all the "dirty work" happens. All `vscode` API calls, file system reads/writes, and third-party library interactions (like `fast-glob`) are confined to this layer.
- **`FileScanner.ts`**: Implements the logic of scanning a directory using `fast-glob` and filtering the results using the `ignore` package.
- **`FileSystem.ts`**: Implements the logic for reading files from the disk and, crucially, the **atomic write** operation using `fs-extra`.
- **`Logger.ts` & `VSCodeUI.ts`**: These modules are wrappers around the VS Code API for showing output and updating the status bar. This isolates the VS Code-specific code from the rest of the application.

#### `src/extension.ts` - The Composition Root

This is the entry point of the extension (`activate` function). Its **only job** is to instantiate and connect all the different pieces from the other layers.

- It creates the `Logger` and `VSCodeUI`.
- It creates the `FileSystem` and `FileScanner`.
- It creates the `GenerationCoordinator` and passes it all the infrastructure dependencies it needs (this is called Dependency Injection).
- It sets up the file watchers and tells them to call the `GenerationCoordinator` when a file changes.
