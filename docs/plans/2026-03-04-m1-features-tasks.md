# AlgerClipboard M1+ Feature Implementation Plan

> Date: 2026-03-04
> Status: In Progress

## Current State

Basic MVP implemented: clipboard monitoring (text/image), history search/filter, global hotkey (Ctrl+Shift+V), smart paste, system tray, basic settings (theme/history limit/paste-and-close).

## Missing Features (organized by parallel tracks)

### Track A: i18n Infrastructure (independent)
- [ ] A1: Install react-i18next + i18next
- [ ] A2: Create zh-CN and en translation JSON files with all UI strings
- [ ] A3: Set up i18n initialization (src/i18n/index.ts)
- [ ] A4: Wrap all existing UI components with useTranslation hooks
- [ ] A5: Add language selector to Settings page
- [ ] A6: Store language preference in settings (Rust backend)

### Track B: Template System (independent new module)
- [ ] B1: Rust - Create templates table in database.rs
- [ ] B2: Rust - CRUD operations for templates (create, list, update, delete, apply)
- [ ] B3: Rust - Template variable replacement engine ({date}, {time}, {datetime}, {clipboard})
- [ ] B4: Rust - Add template IPC commands (commands/template_cmd.rs)
- [ ] B5: Frontend - Template types + service (templateService.ts)
- [ ] B6: Frontend - Template store (templateStore.ts)
- [ ] B7: Frontend - TemplateManager page (create/edit/delete/apply templates)
- [ ] B8: Frontend - Add Templates tab to main panel navigation

### Track C: Translation Module (independent new module)
- [ ] C1: Rust - Add reqwest, serde_json deps for HTTP requests
- [ ] C2: Rust - TranslateEngine trait + Baidu adapter
- [ ] C3: Rust - Youdao translate adapter
- [ ] C4: Rust - Google translate adapter
- [ ] C5: Rust - Translation engine dispatcher with fallback
- [ ] C6: Rust - Add translate IPC commands (commands/translate_cmd.rs)
- [ ] C7: Frontend - Translation types + service
- [ ] C8: Frontend - Translation store
- [ ] C9: Frontend - TranslatePanel UI (select engine, languages, translate button)
- [ ] C10: Frontend - Translation settings in Settings page (API key configuration)

### Track D: Missing P0 Features + UI Polish
- [ ] D1: Auto-start on boot (tauri-plugin-autostart)
- [ ] D2: Data export/import (backup/restore as JSON)
- [ ] D3: Click outside window to hide (Tauri blur event)
- [ ] D4: Window follow mouse position on hotkey invoke
- [ ] D5: Window transparency setting
- [ ] D6: Customizable shortcut keys (store in DB, re-register on change)
- [ ] D7: Quick paste shortcuts (Ctrl+1~9 for recent entries)
- [ ] D8: Time range filter in history
- [ ] D9: Improved EntryCard with more info (source app, timestamp format)
- [ ] D10: Toast notifications (sonner) for user feedback
- [ ] D11: Empty state / loading skeleton improvements
- [ ] D12: Smooth animations and transitions
- [ ] D13: UI color scheme polish + consistent spacing

## Parallel Execution Strategy

Tracks A, B, C are fully independent modules that can be worked on in parallel using git worktrees.
Track D contains smaller improvements that should be done after A/B/C merge.
