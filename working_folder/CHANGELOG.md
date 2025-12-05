# Changelog

## v2 (current)
- Adopted Redux Toolkit + RTK Query for all QDN interactions; no direct `window.qortalRequest` usage in components.
- Added unified publish flow at `/publish` with zod validation, live preview, and Dexie-backed drafts.
- Player migrated to Redux slice + HTMLAudio engine; Zustand removed from playback.
- Enabled PWA runtime caching for audio ranges and document metadata via Workbox.
- Removed video feature and related routes/components.
- Added contract tests for QDN API base query and Playwright e2e for publish → draft → resume → playback.
- Deprecated legacy upload modals; publish/edit flows should use the new `/publish` form.
