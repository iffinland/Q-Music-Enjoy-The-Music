# Q-Music v2 (RTK + QDN)

Q-Music is a React + TypeScript + Vite audio app for Qortal. It uses Redux Toolkit (RTK) for state, RTK Query for all QDN calls, HTMLAudio-backed playback, and a unified publish flow with Dexie drafts. Video support has been removed; focus is music, podcasts, and audiobooks.

## Architecture
- **State**: Redux Toolkit. App store in `src/state/store.ts`; slices in `src/state/slices/*`; feature slices under `src/state/features/*`.
- **QDN access**: RTK Query API in `src/state/api/qdnApi.ts` + endpoints in `src/state/api/endpoints.ts`; `qdnClient` wraps endpoints for non-component usage. All calls route through `window.qortalRequest`.
- **Playback**: Player slice (`src/state/slices/playerSlice.ts`) + HTMLAudio engine (`src/playback/engine.ts`) used by `src/components/Player.tsx`.
- **Publishing**: Unified form at `/publish` using zod + React Hook Form (`src/components/publish/PublishForm.tsx`) with live preview and step stubs.
- **Drafts**: Dexie-backed autosave (`src/db/index.ts`, `src/features/drafts/useDraft.ts`).
- **PWA**: Workbox via `vite-plugin-pwa` with runtime caching for audio and document metadata (`vite.config.ts`).
- **Styling/UI**: Tailwind + shadcn/ui-inspired components under `src/components/ui`.

## Commands
- `npm install`
- `npm run dev` – start Vite dev server
- `npm run build` – type-check + production build
- `npm run test:unit` – Vitest unit/contract tests
- `npm run test:e2e` – Playwright e2e (needs `npx playwright install chromium`)
- `npm run test:ci` – run unit then e2e

## Routes
- `/` home, `/songs`, `/podcasts`, `/audiobooks`, `/playlists/*`, `/library`, `/publish`, `/requests`, `/discussions`, `/search`.
- Video routes are removed.

## Notes
- QDN requests require `window.qortalRequest` injected by Qortal.
- Drafts stored in IndexedDB (`qmusic_v2` DB). Clearing storage removes drafts and favorites cache.
- Service worker precaches minimal shell; runtime caching targets audio and metadata only.
