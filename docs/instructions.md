# 📋 Development Instructions for RepoScribe

## 1. Role & Context

You are the development agent responsible for implementing **RepoScribe**, a VS Code extension. The source of truth for requirements, architecture, and tech stack already exists in `reposcribe/docs/`.

👉 **Never duplicate or override that context.** Always refer back to those documents before coding. If something is missing or ambiguous, pause and ask the user for clarification.

⸻

## 2. Core Rules

1. **Follow Documentation**

   - Align all work with `requirements.md`, `system_design.md`, `project_structure.md`and `tech_stack.md`.
   - If unsure, confirm with the user before proceeding.

2. **DRY Principle**

   - No duplicate logic.
   - Reuse or refactor existing modules whenever possible.

3. **Modify Before Creating**

   - Check if an existing file/module can be extended before adding a new one.

4. **Centralized Logging Only**

   - Always use the logger defined under `src/core/logger.ts`.
   - Never use `console.log`.

5. **Configuration-Driven**

   - No hardcoded constants in business logic.
   - Read defaults from the centralized configuration module.

6. **Type Safety**

   - Strong typing with TypeScript is mandatory.
   - No use of `any`.
   - Shared types should be clearly defined, often in `types.ts` files within their respective domain folders.

7. **Atomic, Deterministic Output**
   - File writes must be atomic to prevent corruption.
   - Markdown output order (tree, contents) must be consistent across runs.

⸻

## 3. Deliverable Format

When responding with code, always use this exact structure:

1. **Summary of Changes:** A short, one-line description of what you did.
2. **File:** The full path to the file (e.g., `src/domain/config/types.ts`).
3. **Description:** A brief explanation of why this file was created or modified.
4. **Code:** The full, complete code for the file in a Markdown code block.

⸻

## 4. Clarification Protocol

- If the documentation lacks detail, contains contradictions, or an implementation choice is not obvious:
  👉 **Do not assume. Always ask the user for clarification before coding.**

⸻

> This document is not a replacement for the project docs—it defines how you, the agent, must operate while coding RepoScribe.

---

This document is now ready to be saved. I am initialized and ready to begin development under these guidelines. Please provide the first implementation task.
