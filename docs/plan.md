# Implementation Plan: RepoScribe VS Code Extension

## **Phase 1: Foundation & Core Domain Logic**

This phase focuses on establishing the pure, testable, and dependency-free core business logic of RepoScribe. We will define all data structures and implement the core algorithms for configuration management, tree generation, and Markdown rendering within the `src/domain` directory, without touching any VS Code APIs.

- [ ] **1. Set Up Core Infrastructure (Logging)**

  - [ ] Create the directory `src/infrastructure`.
  - [ ] Create the file `src/infrastructure/Logger.ts`.
  - [ ] Implement a `Logger` class that wraps a VS Code `OutputChannel`.
  - [ ] Define methods `info(message: string)`, `warn(message: string)`, `error(message: string | Error)`, and a private `log(level: string, message: string)` method.
  - [ ] Add a `dispose()` method to clean up the output channel.

- [ ] **2. Define Core Domain Types**

  - [ ] Create the file `src/domain/config/types.ts`.
  - [ ] Define and export the `RepoScribeConfig` interface with properties: `outputFile`, `include`, `exclude`, and `languageMap`.
  - [ ] Create the file `src/domain/workspace/types.ts`.
  - [ ] Define and export the `FileNode` interface with properties: `name: string`, `path: string`, `type: 'file' | 'directory'`, and `children: FileNode[]`.
  - [ ] Create the file `src/domain/markdown/types.ts`.
  - [ ] Define and export a `LanguageMap` type alias: `export type LanguageMap = Record<string, string>;`.

- [ ] **3. Implement Configuration Domain Logic**

  - [ ] In `src/domain/config/types.ts`, define and export a `BASE_CONFIG` constant of type `RepoScribeConfig` containing all default values (e.g., `outputFile: 'PROJECT_STRUCTURE.md'`, default binary exclusions).
  - [ ] Create the file `src/domain/config/resolver.ts`.
  - [ ] Implement a pure function `resolveConfig(baseConfig: RepoScribeConfig, userConfig?: Partial<RepoScribeConfig>): RepoScribeConfig`.
  - [ ] Ensure the function correctly merges the user's config over the base config, with user values taking precedence.

- [ ] **4. Implement Workspace Domain Logic (File Tree)**

  - [ ] Create the file `src/domain/workspace/FileTree.ts`.
  - [ ] Implement a class or function `buildFileTree(filePaths: string[]): FileNode`.
  - [ ] The function should take a flat, sorted array of file paths.
  - [ ] It must correctly construct a hierarchical `FileNode` tree structure from the paths.
  - [ ] Implement the sorting logic within the tree construction: directories first (alphabetically), then files (alphabetically) at each level.

- [ ] **5. Implement Markdown Domain Logic (Builder)**
  - [ ] Create the file `src/domain/markdown/MarkdownBuilder.ts`.
  - [ ] Implement a `MarkdownBuilder` class.
  - [ ] Create a private method `renderTree(root: FileNode): string` that recursively generates the ASCII tree representation.
  - [ ] Create a private method `renderFileContent(filePath: string, content: string, languageMap: LanguageMap): string` that formats the content into a Markdown section with a fenced code block.
  - [ ] Create a public method `build(tree: FileNode, fileContents: Map<string, string>, languageMap: LanguageMap): string`.
  - [ ] This `build` method will orchestrate calling the tree and content renderers to assemble the final, complete Markdown string according to the required structure.

---

## **Phase 2: Infrastructure & Application Layer Implementation**

This phase focuses on building the "impure" layers of the application that interact with the external world (VS Code APIs, file system). We will implement the concrete services for scanning files, reading/writing to disk, and managing the UI, then orchestrate them with an application-level coordinator.

- [ ] **6. Implement File System Infrastructure**

  - [ ] Create the file `src/infrastructure/FileSystem.ts`.
  - [ ] Implement a `FileSystem` class.
  - [ ] Add a method `readFile(filePath: string): Promise<string>` that wraps `vscode.workspace.fs.readFile`.
  - [ ] Add a method `atomicWrite(filePath: string, content: string): Promise<void>` that uses `fs-extra` to write to a `.tmp` file and then atomically move it.
  - [ ] Add a method `updateGitignore(workspaceRoot: string, outputFile: string): Promise<void>` to read, update, and write the `.gitignore` file.
  - [ ] Add a method `findFile(globPattern: string): Promise<vscode.Uri | undefined>` to find a single file like `.reposcribe.json`.

- [ ] **7. Implement File Scanner Infrastructure**

  - [ ] Create the file `src/infrastructure/FileScanner.ts`.
  - [ ] Implement a `FileScanner` class.
  - [ ] Create a method `scan(workspaceRoot: string, config: RepoScribeConfig, gitignoreContent: string): Promise<string[]>`.
  - [ ] Implement the full filtering and precedence logic inside this method:
    - [ ] Use `fast-glob` to get all files.
    - [ ] Use the `ignore` package to apply `.gitignore` rules.
    - [ ] Apply the default binary exclusions from the resolved config.
    - [ ] Apply the `include` patterns from the resolved config.
    - [ ] Apply the `exclude` patterns from the resolved config.
    - [ ] Return the final, sorted list of absolute file paths.

- [ ] **8. Implement VS Code UI Infrastructure**

  - [ ] Create the file `src/infrastructure/VSCodeUI.ts`.
  - [ ] Implement a `VSCodeUI` class to manage the Status Bar item.
  - [ ] Define an enum for UI states: `State { IDLE, GENERATING, UPDATED, ERROR }`.
  - [ ] Create a method `updateStatus(state: State, details?: string)` that updates the status bar's text, icon, and tooltip based on the provided state.
  - [ ] Implement a `dispose()` method to hide and dispose of the status bar item.
  - [ ] Configure the status bar item to open the output file on click.

- [ ] **9. Implement the Application Layer Coordinator**
  - [ ] Create the directory `src/application`.
  - [ ] Create the file `src/application/GenerationCoordinator.ts`.
  - [ ] Implement the `GenerationCoordinator` class.
  - [ ] The constructor should accept dependencies: `Logger`, `FileSystem`, `FileScanner`, `VSCodeUI`, and the workspace root path.
  - [ ] Create a main public method `generate(): Promise<void>`.
  - [ ] Implement the end-to-end generation logic inside `generate()`:
    - [ ] Update UI to `GENERATING` state.
    - [ ] Read `.reposcribe.json` and `.gitignore`.
    - [ ] Resolve the final configuration using the domain `resolveConfig` function.
    - [ ] Call `FileScanner.scan()` to get the file list.
    - [ ] Call the domain `buildFileTree()` function.
    - [ ] Concurrently read all file contents using `FileSystem.readFile` and `Promise.all`.
    - [ ] Call the domain `MarkdownBuilder.build()` to get the final string.
    - [ ] Call `FileSystem.atomicWrite()` to save the output file.
    - [ ] Call `FileSystem.updateGitignore()`.
    - [ ] Update UI to `UPDATED` state.
    - [ ] Add `try/catch` blocks to handle errors and update UI to `ERROR` state.

---

## **Phase 3: Composition & End-to-End Integration**

This phase brings the entire application to life. We will focus on the `src/extension.ts` file, acting as the "Composition Root" to instantiate and connect all the domain, application, and infrastructure components. We'll implement the extension's activation, initial run, and file watching capabilities.

- [ ] **10. Instantiate and Wire Dependencies in `extension.ts`**

  - [ ] Clear the boilerplate code from `src/extension.ts`.
  - [ ] In the `activate` function, get the workspace root folder. Handle the case where no folder is open.
  - [ ] Instantiate the `Logger`.
  - [ ] Instantiate the `VSCodeUI` and pass it the `ExtensionContext`.
  - [ ] Instantiate the `FileSystem`.
  - [ ] Instantiate the `FileScanner`.
  - [ ] Instantiate the `GenerationCoordinator`, injecting all the previously created services.
  - [ ] Store the `GenerationCoordinator` instance for access by watchers.

- [ ] **11. Trigger Initial Generation on Activation**

  - [ ] In `activate`, after instantiation, call `coordinator.generate()` to run the first scan when the extension loads.
  - [ ] Ensure the context's `subscriptions` array is populated with disposable items like the `Logger` and `VSCodeUI` to ensure clean shutdown.

- [ ] **12. Implement File Watchers for Automatic Updates**

  - [ ] Create a `setupWatchers(coordinator: GenerationCoordinator)` function in `extension.ts`.
  - [ ] Use `vscode.workspace.createFileSystemWatcher` to create a general watcher for `**/*`.
  - [ ] The watcher should ignore the path of the configured output file to prevent infinite loops. This requires reading the config first.
  - [ ] Hook up the `onDidCreate`, `onDidDelete`, and `onDidChange` events of the watcher.
  - [ ] Create watchers specifically for `.gitignore` and `.reposcribe.json` that trigger immediate regeneration.

- [ ] **13. Implement Debouncing for File Change Events**
  - [ ] Install `debounce-fn`.
  - [ ] In `extension.ts`, create a debounced version of the `coordinator.generate()` method call using `debounceFn`.
  - [ ] The debounce delay should be ~1.5 seconds as specified in requirements.
  - [ ] Call this debounced function from the general file watcher's events (`onDidCreate`, etc.).
  - [ ] The config file watchers (`.gitignore`, `.reposcribe.json`) should call `coordinator.generate()` directly, without debouncing.

---

## **Phase 4: Finalization, UX Refinements & Packaging**

With the core functionality in place, this final phase focuses on polishing the user experience, hardening the extension against edge cases, and preparing it for packaging and distribution.

- [ ] **14. Finalize Status Bar Behavior**

  - [ ] Thoroughly test the status bar state transitions: `Idle` -> `Generating` -> `Updated` / `Error`.
  - [ ] Ensure the `$(sync~spin)` icon is used for the `Generating` state.
  - [ ] Verify that clicking the status bar item opens the generated Markdown file correctly.
  - [ ] Add a `command` to `package.json` and register it in `extension.ts` to handle the status bar click action.

- [ ] **15. Enhance Error Handling and Logging**

  - [ ] Review the `GenerationCoordinator` and add detailed logging at each major step (e.g., "Config resolved", "Found X files", "Writing output to Y").
  - [ ] Ensure that file read errors for individual files are logged but do not stop the entire generation process (e.g., render a placeholder like `[Error reading file]`).
  - [ ] Ensure critical errors (e.g., config parsing failure, atomic write failure) are logged and displayed in the UI.

- [ ] **16. Add Final TSDoc Comments & Clean Up**

  - [ ] Add TSDoc comments to all public classes and methods in the `domain`, `application`, and `infrastructure` layers.
  - [ ] Remove any `console.log` statements, ensuring all output goes through the centralized `Logger`.
  - [ ] Review `package.json` to remove the boilerplate "Hello World" command.
  - [ ] Update the `activationEvents` in `package.json` to `onStartupFinished` or a more appropriate event if needed.

- [ ] **17. Prepare for Publishing**
  - [ ] Update the `README.md` file with instructions on how to use the extension, including configuration options.
  - [ ] Update the `CHANGELOG.md` with initial release notes.
  - [ ] Verify the `esbuild` script in `package.json` produces a clean, minified build for publishing.
  - [ ] Use `vsce package` to create a VSIX file and test installation locally.
