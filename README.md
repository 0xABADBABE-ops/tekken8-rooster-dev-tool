Tekken 8 rooster dev tool
=================================
(_yes 'rooster', it's not a typo._)

Responsive, modern album-style grid that loads `rooster.json` (characters with image variants) and provides a details view, favorites, search, and offline support.

Features
- Grid of cards with lazy-loaded images
- Detail panel with larger art and all variants
- Search and image-type toggle (Icon/Stock)
- Favorites with filter (localStorage)
- Offline caching via Service Worker (static app + visible images)
- Lightweight PWA (installable)

Project Structure
- `index.html` — App shell and UI
- `styles.css` — Responsive styles and subtle violet–green–purple accents
- `script.js` — Data loading, UI logic, favorites, offline tools
- `sw.js` — Service worker (cache strategies)
- `manifest.webmanifest` — PWA metadata
- `rooster.json` — Data source (array of characters)

Local Development
1. Serve locally (service workers need HTTP):
   - Python: `python -m http.server 8000`
   - Node (if installed): `npx http-server -p 8000`
2. Open http://localhost:8000 and hard-refresh when changing the service worker (Ctrl/Cmd+Shift+R).

Updating rooster.json from Start.gg
- Use the GraphQL query shown in the app’s detail view (copy button provided).

Deploy to GitHub Pages
1. Create a new GitHub repo and push:
   ```bash
   git init
   git add .
   git commit -m "feat: Tekken 8 rooster dev tool"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git push -u origin main
   ```
2. Enable Pages: Repository Settings → Pages → Branch: `main` / `/root` → Save.
3. Visit the Pages URL. If updates don’t show, hard-refresh to update the service worker.

Notes
- The app uses hash URLs (e.g., `#id-2410`) so Pages routing works without extra config.
- Images are fetched from `images.start.gg`; caching may skip some due to CORS—this is expected.

