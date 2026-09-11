# Full And Trial Split Implementation Plan

**Goal:** Split the current watch app into independent full and trial Git repositories with no activation code in either delivered trial flow.

## Tasks

1. Convert the current repository into the full edition: remove activation/trial pages and licensing code, route directly to the full home page, restore unrestricted reader save/load behavior, and update tests.
2. Copy the resulting project to `E:\miband\galgaoshou-trial`, initialize its own Git repository, then reduce it to the trial home, trial reader, settings, about page, and a dedicated AstroBox trial-end page.
3. Trim the trial story to scenes 0–314 and delete images not referenced by those scenes; reject stale auto-saves outside that range.
4. Increment each manifest `versionCode` to 51, run repository tests and release builds, and confirm the produced packages contain only their expected pages and resources.
