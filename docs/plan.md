### **RepoScribe Feature Development Plan**

#### **1. Handle Unhandled Binary & Large File Content**

- **Task 1.1: Expand Default Exclusions**

  - **Goal:** Proactively prevent common non-text files from being processed.
  - **Action:** Research and augment the `exclude` array in `domain/config/types.ts` (`BASE_CONFIG`).
  - **File Types to Add:**
    - **Compiled Artifacts:** `.class`, `.jar`, `.war`, `.ear`, `.dll`, `.exe`, `.o`, `.so`, `.a`
    - **Media/Images:** `.mov`, `.mp4`, `.avi`, `.webm`, `.mp3`, `.wav`, `.flac`, `.psd`, `.ai`, `.eps`
    - **Fonts:** `.woff`, `.woff2`, `.eot`, `.ttf`, `.otf`
    - **Compressed Archives:** `.zip`, `.tar`, `.gz`, `.rar`, `.7z`, `.bz2`
    - **Documents:** `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`
    - **Disk Images/VMs:** `.iso`, `.vmdk`, `.vdi`

- **Task 1.2: Ensure Crash Prevention (Verification)**

  - **Goal:** Confirm that the application never crashes when attempting to read a problematic file.
  - **Action:** Review the `try/catch` block within the file-reading loop in `GenerationCoordinator.ts`. Ensure that it correctly catches errors, logs a warning, and inserts a placeholder message (e.g., `[Error reading file]`) without stopping the entire generation process. This mechanism is already in place and just needs verification.

- **Task 1.3: Implement Max File Size Limit**
  - **Goal:** Allow users to define a file size threshold to avoid including excessively large files.
  - **Action:** 1. Add a new property `maxFileSizeKb: number` to the `RepoScribeConfig` interface in `domain/config/types.ts`. 2. Set a sensible default value in `BASE_CONFIG` (e.g., `maxFileSizeKb: 2048` for 2MB). 3. In `GenerationCoordinator.ts`, before the `Promise.all` that reads file contents, modify the logic. For each file path, first use `vscode.workspace.fs.stat(uri)` to get its size. 4. If `file.size > config.maxFileSizeKb * 1024`, do not read the file. Instead, directly set its content in the `fileContents` map to a placeholder message like `[File content omitted: Exceeds ${config.maxFileSizeKb} KB size limit]`. 5. If the file is within the size limit, proceed with reading its content as normal.

---

#### **2. Overhaul Configuration System for Usability and Power**

- **Task 2.1: Transition to JSONC for Comments**

  - **Goal:** Enable comments in the configuration file to make it more user-friendly and educational.
  - **Action:** 1. Add the `jsonc-parser` library as a dependency. 2. Update the configuration reading logic to use `jsonc.parse()` instead of the standard `JSON.parse()` to handle files with comments. 3. Update services to look for `.reposcribe.jsonc` as the primary configuration file.

- **Task 2.2: Redesign Generated Config File**

  - **Goal:** Create a self-documenting and less error-prone configuration file for users.
  - **Action:** 1. Modify the `RepoScribe: Create Configuration File` command. 2. The command will now create a file named `.reposcribe.jsonc`. 3. The file's content will be a template that includes comments explaining the purpose of each field and listing examples of default exclusions. 4. The generated `exclude` array will be empty by default, encouraging users to _add_ their own rules rather than editing a large pre-filled list.

- **Task 2.3: Implement New Filtering Precedence**

  - **Goal:** Allow a user's `include` patterns to act as an override for default `exclude` patterns.
  - **Action:** Modify the `scan` method in `infrastructure/FileScanner.ts` to follow this exact sequence: 1. Apply `.gitignore` rules to the initial list of all files. 2. Apply the default `BASE_CONFIG.exclude` rules to the result. 3. From the files that were just excluded, **add back** any that match a pattern in the user's `include` array. 4. Finally, **remove** any files from the resulting list that match a pattern in the user's `exclude` array. This ensures the user's `exclude` is the final authority.

- **Task 2.4: Deprecate old `.reposcribe.json`**
  - **Goal:** Guide users to migrate to the new format and simplify the codebase by removing support for the old format.
  - **Action:** 1. In the extension's startup logic, add a check for the existence of a `.reposcribe.json` file. 2. If the old file is found, the extension will **not** use it for configuration. 3. Instead, it will trigger a one-time `vscode.window.showWarningMessage` with a clear message: "The `.reposcribe.json` file is deprecated and is being ignored. Please use the `RepoScribe: Create Configuration File` command to generate a new `.reposcribe.jsonc` file and migrate your settings."

---

#### **3. Implement Configuration Caching**

- **Task 3.1: Design `ConfigurationService`**

  - **Goal:** Centralize configuration management to prevent redundant file reads and ensure consistency.
  - **Action:** Plan a new service class, `ConfigurationService`, within the `application` layer.

- **Task 3.2: Define Service Responsibilities**

  - **Action:** The service will have:
    - A private property to hold the cached `RepoScribeConfig`.
    - A public method, `getResolvedConfig(): Promise<RepoScribeConfig>`, which reads from the file system only if the cache is empty, then stores and returns the result.
    - A public method, `clearCache()`, to invalidate the cache.

- **Task 3.3: Refactor for Dependency Injection**
  - **Action:** 1. Instantiate `ConfigurationService` in `extension.ts`. 2. Pass this instance to `GenerationCoordinator` and `WorkspaceWatcher`. 3. Modify the `WorkspaceWatcher` so that when it detects a change to `.reposcribe.jsonc`, it calls `configService.clearCache()` before triggering regeneration. 4. Update all components to get configuration via the service instead of reading the file directly.

---

#### **4. Simplify and Harden the File Scanner**

- **Task 4.1: Refactor `FileScanner` Logic**

  - **Goal:** Improve the clarity and robustness of the file filtering logic.
  - **Action:** Modify the `scan` method in `infrastructure/FileScanner.ts` to align with the new precedence rules defined in Task 2.3.

- **Task 4.2: Maintain Precedence Rules (Verification)**
  - **Action:** After refactoring, confirm that the strict filtering order defined in Task 2.3 is correctly implemented and produces the expected results.

---

#### **5. Ensure Backward Compatibility of Configuration (Verification)**

- **Task 5.1: Verify `resolveConfig` Behavior**

  - **Goal:** Confirm that adding new settings does not break existing user configurations (for users with valid `.reposcribe.jsonc` files).
  - **Action:** Review the `resolveConfig` function in `domain/config/resolver.ts`. The current spread syntax remains correct for merging new properties like `maxFileSizeKb`.

- **Task 5.2: Establish "New Config" Policy**
  - **Goal:** Formalize the process for adding new configuration options.
  - **Action:** Document as a team convention that any new property added to the `RepoScribeConfig` interface **must** also be given a default value in the `BASE_CONFIG` object.

---

#### **6. Add "Generate for Folder" Context Menu**

- **Task 6.1: Create UI Contribution**

  - **Goal:** Add a right-click context menu item for folders in the Explorer view.
  - **Action:** 1. Modify `package.json`. 2. Define a new command: `reposcribe.generateForFolder`. 3. Add a menu contribution to `contributes.menus` targeting `explorer/context`. 4. Set the `when` clause to `explorerResourceIsFolder` to ensure it only appears on directories.

- **Task 6.2: Register the Command**

  - **Goal:** Connect the UI item to the application logic.
  - **Action:** 1. Modify `src/application/CommandRegistry.ts`. 2. Register the `reposcribe.generateForFolder` command. 3. The command handler will accept the folder `vscode.Uri` as an argument. 4. The handler will call a new method on the `GenerationCoordinator` (e.g., `generateMarkdownForPath`). 5. Upon receiving the markdown string from the coordinator, the handler will copy it to the clipboard using `vscode.env.clipboard.writeText()` and show a confirmation message.

- **Task 6.3: Implement Application Service Method**
  - **Goal:** Create a new method in the coordinator that can generate markdown for a specific path without writing to a file.
  - **Action:** 1. Modify `src/application/GenerationCoordinator.ts`. 2. Create a new public method: `generateMarkdownForPath(folderPath: string): Promise<string>`. 3. This method's implementation will reuse existing logic:
    a. Resolve the full workspace configuration and read `.gitignore`.
    b. Call `scanner.scan()` to get the complete, filtered list of files for the **entire workspace**.
    c. In-memory, filter this list to include only files that are descendants of the given `folderPath`.
    d. Prepare the filtered paths for the domain logic (e.g., make them relative to `folderPath`).
    e. Call the existing `buildFileTree` and `markdownBuilder.build` domain functions with the filtered data.
    f. **Return** the generated markdown string instead of writing it to a file.
