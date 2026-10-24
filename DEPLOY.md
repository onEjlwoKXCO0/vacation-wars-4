# Put Vacation Wars 4 online (free) — step by step

Goal: one link (like `https://vacation-wars-4.onrender.com`) that all friends open on phone or computer, and one live game everyone shares.

You need 3 free accounts: **GitHub** (stores the code), **Render** (runs the server), **Upstash** (keeps saved games). About 15 minutes, no command line.

---

> **Live:** https://vacation-wars-4.onrender.com (repo `onEjlwoKXCO0/vacation-wars-4`, branch `main` — every push redeploys).

## 1. Put the code on GitHub

1. Create an account on <https://github.com> (or log in).
2. Top right **+** → **New repository** → name it `vacation-wars-4` → **Private** is fine → **Create repository**.
3. On the empty repository page click **uploading an existing file**.
4. Unzip `vacation-wars-4-deploy.zip` on your computer, open the `vw4` folder, select **everything inside it** (the folders `assets`, `client`, `server`, `shared`… and the files `package.json`, `render.yaml`…) and drag it into the GitHub page. Wait until every file is listed.
5. Click **Commit changes**.

> Check: in the repository you should see `package.json` and `render.yaml` at the top level (not inside a `vw4` folder).

## 2. Create the saved-games database (Upstash)

Render's free plan erases its disk whenever the server sleeps or restarts. Upstash keeps your games safe for free.

1. Create an account on <https://upstash.com> → **Redis** → **Create database**.
2. Name `vw4`, pick a region close to you (e.g. *eu-central-1 / Frankfurt*), free plan → **Create**.
3. On the database page, find the **REST API** section and copy two values:
   - `UPSTASH_REDIS_REST_URL` (looks like `https://xxxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (a long secret)

## 3. Deploy on Render

1. Create an account on <https://render.com> and connect your GitHub account when asked.
2. **New +** → **Blueprint** → pick the `vacation-wars-4` repository. (Or **New +** → **Web Service**: build `npm install && npm run build`, start `npm run serve`, instance **Free**, env `NODE_VERSION=22` + the two Upstash values without quotes, health check `/healthz`.) Render may ask for a card to verify you, even on the free plan; nothing is charged on Free.
3. Render reads `render.yaml` and asks for the two values: paste `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` → **Apply**.
4. Wait for the build (2–4 min). Your link appears at the top of the service page: `https://vacation-wars-4.onrender.com` (or similar).
5. Check: open `…onrender.com/healthz` — it should say `ok 0 rooms · saves: Upstash Redis`.

Every time you change the code on GitHub, Render redeploys automatically — **running games are saved and come back** after the redeploy.

## 4. Game night

1. **5 minutes before**: open the link once. The free server sleeps after 15 minutes without visitors and needs ~1 minute to wake up.
2. One person (the host) clicks **Create a crew**, then copies the invite link from the `CREW XXXXX ⧉` chip and posts it in the WhatsApp group.
3. Everyone opens the invite, makes their passport, lands on the Moon. Phones and computers mix freely.
4. Tap the screen once so the browser allows the music. Turn phones sideways for the cinematics.
5. Keep a WhatsApp / Discord call running for the talking (and the Pharaoh's tests).

**If something drops:** just reload the page — you get your seat back (same coins, same role). If the host disappears for more than a minute, another connected player automatically becomes host. If the server restarts mid-game, the game resumes where it stopped with the same time left on the clock.

---

## Other ways to run it

**From your own computer (one evening, no accounts):**
```bash
npm install
npm start                                            # http://localhost:3000
npx cloudflared tunnel --url http://localhost:3000   # prints a public https link to share
```
Saved games go to the `data/` folder. Your computer must stay on during the game.

**Fly.io** (always-on option, usage-based billing): `fly launch --copy-config --no-deploy`, `fly volumes create vw4_data --size 1 --region cdg`, `fly deploy`. Saves go to the volume (`DATA_DIR=/data`, already set in `fly.toml`).

**Any Docker host:** `docker build -t vw4 . && docker run -p 3000:3000 -v vw4data:/data vw4`.

## Settings (environment variables)

| Variable | Meaning |
|---|---|
| `PORT` | Port to listen on (hosts set it automatically). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Save games in Upstash Redis (recommended on free hosts). |
| `DATA_DIR` | Folder for saved games when Upstash is not set (default `./data`). |

Saved crews are kept for 7 days after their last change; an old invite link wakes its crew up again.
