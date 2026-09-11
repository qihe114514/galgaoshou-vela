# GalMaster Asunabi Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom GalMaster reader with an Asunabi-miband-derived player, adapted to the Xiaomi Band 10 212 by 520 dp viewport and limited to the extracted prologue.

**Architecture:** Keep Asunabi's two-page model: title/system/load in `pages/index` and a scene-array reader in `pages/detail`. Convert the existing stable-node prologue into the framework's scene-array protocol, extending the renderer only for up to five choices and GalMaster's own full-character PNG layers. Reuse ATRI's `mb9` overlay, storage, and narrow-screen interaction pattern as layout reference, not its story or assets.

**Tech Stack:** Vela JS Quick App, AIoT Toolkit 2.0.5, `@system.file`, `@system.storage`, Node.js tests.

## Global Constraints

- Use `212dp × 520dp`; no `px` units in project-owned UI styles.
- Use Asunabi-miband's scene protocol: scene `{ background, dialogues }` or `{ choices }`; choice transition is relative `nextScene`.
- Preserve every reachable prologue branch and stop at `收下钥匙扣后，我们相互道别。`.
- No audio, video, animation, post-prologue loading, or original-work modifications.
- Store settings and an arbitrary-length `recoveryData` slot list with scene, dialogue, choices, and settings.
- Reuse only Asunabi framework code and ATRI narrow-screen patterns; do not package their story or visual resources.
- Do not use CSS descendant or pseudo selectors unsupported by Toolkit 2.0.
- Increment `versionCode` before the final RPK build.

---

### Task 1: Establish the framework-owned page contract

**Files:**
- Modify: `src/manifest.json`
- Modify: `src/pages/index/index.ux`
- Create: `src/pages/detail/detail.ux`
- Remove from routing: `src/pages/game/game.ux`

**Interfaces:**
- `pages/index` routes to `pages/detail` with optional `params.load` slot index.
- `pages/detail` exposes `loadData()`, `nextDialogue()`, `selectChoice(index)`, `saveRecoveryData(index)`, and `loadRecoveryData(index)`.

- [ ] Copy the Asunabi two-page navigation and ATRI narrow-screen overlay behavior into project-owned 212 by 520 dp pages.
- [ ] Set the manifest pages to `pages/index` and `pages/detail`, retain the GalMaster package identity and EXE icon, and keep Toolkit 2.0.5.
- [ ] Verify `npm run build` contains only the index and detail pages.

### Task 2: Convert the stable-node prologue to scene-array data

**Files:**
- Create: `tools/convert-prologue-to-asunabi.js`
- Create: `src/common/story/prologue-scenes.txt`
- Test: `tests/convert-prologue-to-asunabi.test.js`

**Interfaces:**
- Input: `src/common/story/prologue.txt` with `{ entryId, endId, nodes }`.
- Output: ordered scene array consumed by `loadData()`, each dialogue scene containing `{ background, characters, dialogues }`, and each choice scene containing `{ choices }` with relative `nextScene` offsets.

- [ ] Write a failing test for the five-option branch and ending text.
- [ ] Convert each reachable stable node to one scene so every `next` target has an exact relative offset.
- [ ] Materialize the terminal node as `{ END: '序章结束' }`, preventing any next-chapter path.
- [ ] Run `npm test` and inspect that all converted choice offsets target existing scenes.

### Task 3: Adapt the Asunabi detail reader to GalMaster data

**Files:**
- Modify: `src/pages/detail/detail.ux`
- Test: `tests/asunabi-scene-validation.test.js`

**Interfaces:**
- `loadData()` reads only `/common/story/prologue-scenes.txt`.
- `gameData.scenes[currentScene].characters` is an optional array of no more than three `{ slot, image }` layers.
- A choice list renders all choices and calls `selectChoice($idx)`.

- [ ] Write checks for at most three character layers, valid relative choice transitions, and an end scene reachable from entry.
- [ ] Render backgrounds in the upper 337 dp stage, characters in left/center/right slots, then the 183 dp name/text area.
- [ ] Retain Asunabi typewriter, scroll reset, swipe-to-menu, save/load/delete, and setting flows.
- [ ] Make `skipScene` refuse scenes with choices or terminal dialogue; make `skipChapter` show a toast because the package has only one prologue.
- [ ] Run `npm run check`.

### Task 4: Package and validate the framework migration

**Files:**
- Modify: `src/manifest.json`
- Build: `dist/cn.singularpoint.galmasterprologue.debug.0.1.0.rpk`

- [ ] Increment `versionCode` once for the final RPK.
- [ ] Run `npm run check` and `npm run build`.
- [ ] Verify the RPK contains `common/story/prologue-scenes.txt`, the EXE icon, and all 53 referenced images.
- [ ] Attempt `npm run start`; report any simulator-environment failure separately from package validation.
