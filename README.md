# Q-Music – Enjoy the Music

Q-Music is a music and media player built for the Qortal platform. It brings together community-published songs, playlists, podcasts, and videos inside a modern interface and showcases the future vision of the Q-Music community: decentralized, censorship-resistant, and user-driven media.

## What the project delivers

- The home screen highlights newly added songs, playlists, podcasts, and videos with quick navigation links.
- The media library splits content into dedicated sections (songs, playlists, podcasts, videos) so large collections stay manageable.
- Detail pages let you explore individual songs, playlists, podcasts, and videos with rich metadata and navigation helpers.
- Search and filter tools make it easy to discover fresh material; overviews such as “Newest” provide fast access to recent uploads.
- The Requests area allows listeners to publish song/playlist requests, fill them, report issues, or delete their own entries.
- Statistics panels surface insights about the health of the Q-Music ecosystem.
- Favorite items are stored locally in the browser, keeping frequently played media close at hand.

## Technology stack

- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Material UI, Emotion
- **State management**: Redux Toolkit, Zustand
- **Data sources**: QORTAL Core API and QDN (Qortal Data Network)
- **Productivity tools**: React Hook Form, React Router DOM, moment.js, localforage, Radix UI dialog/slider components
- **Audio processing**: music-metadata-browser, use-sound

## Working with Qortal

The app depends on the Qortal network and Qortal Core:

1. Start Qortal Core or open the Qortal UI that exposes the `qortalRequest` API.
2. When running locally, the polyfill `src/polyfills/qortal.ts` logs a warning whenever the real API is absent.
3. A Qortal account is required to authenticate and use community features (Requests, statistics, etc.).

> Tip: During development, use the browser inside the Qortal UI or bridge a local environment to Qortal Core; otherwise the console shows a warning that the API is unavailable.

## Running the project locally

1. Install Node.js (18.x or newer recommended).
2. Change to the project directory:  
   `cd /home/iffiolen/REACT-PROJECTS/Q-Music/working_folder`
3. Install dependencies:  
   `npm install`
4. Launch the dev server:  
   `npm run dev` and open the printed URL (for example http://localhost:5173).
5. Run lint checks:  
   `npm run lint`
6. Produce a production bundle:  
   `npm run build` (artifacts land in the `dist/` folder).

## Backup best practice

Combine Git commits (push to the GitHub repository `Q-Music-Enjoy-The-Music`) with local archives so you always have both version history and filesystem snapshots.

1. Create the backup directory if needed:  
   `mkdir -p /home/iffiolen/REACT-PROJECTS/Q-Music/BACKUPS`
2. Add the script `working_folder/scripts/backup.sh` with the contents below and make it executable (`chmod +x working_folder/scripts/backup.sh`):

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
   REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"
   BACKUP_DIR="$REPO_ROOT/BACKUPS"

   TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
   ARCHIVE_PATH="$BACKUP_DIR/$TIMESTAMP.tar.gz"

   mkdir -p "$BACKUP_DIR"

   tar --exclude='.git' \
       --exclude='node_modules' \
       --exclude='dist' \
       --exclude='BACKUPS' \
       -czf "$ARCHIVE_PATH" \
       -C "$PROJECT_DIR" .

   echo "Backup created: $ARCHIVE_PATH"

   old_backups=$(ls -1t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +5 || true)
   if [[ -n "$old_backups" ]]; then
     echo "$old_backups" | xargs -r rm --
   fi
   ```

3. Run the script manually whenever you finish a work session or before risky changes.
4. Keep Git in sync:  
   `git add . && git commit -m "Your message" && git push`.

The script always preserves the four most recent archives; adjust `tail -n +5` if you want to keep more.

## Collaboration guidelines

- Fork the repository, create a branch (`git checkout -b feature/your-feature`), implement changes, add tests/checks, then open a pull request.
- Follow the ESLint rules and Tailwind/TypeScript style already used in the project.
- For questions, open an issue or discussion on GitHub.

## License

Published under the MIT License. See the `LICENSE` file for details.

---

Q-Music grows with its community—turn up the music and enjoy!
