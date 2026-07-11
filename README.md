# Meadow Pals — PlayMesh official example

A cute multiplayer game for kids built on [PlayMesh](https://playmesh.dev), running in **single-node mode (no Redis)** with **event signing enabled** (ECDSA P-256).

Kids pick a name (no signup, no password), choose an avatar color, walk around three themed rooms (meadow / beach / forest), and chat. A React admin dashboard moderates everything.

## Repo layout

```
server/       PlayMesh server (@playmesh/server, one file) + end-to-end smoke test
game/         Kids' game client (Vite + PixiJS + @playmesh/client)
admin/        Admin dashboard (Vite + React + @playmesh/client)
PLAN.md       The build plan for this example
prompts.md    Image-generation prompts for the game art
```

- **[`PLAN.md`](PLAN.md)** — the design document this example was built from: the feature list, how each feature maps to a PlayMesh API, what was deliberately left out (persistence, JWT auth), and the build order. Read it first if you want to understand *why* the code looks the way it does.
- **[`prompts.md`](prompts.md)** — five ready-to-paste prompts for a GPT image generator (gpt-image-1 / DALL·E): one tintable white avatar, three room backgrounds, and a logo, all sharing one style prefix so they match. The game runs without them (every image has a drawn fallback); drop the generated PNGs into `game/public/assets/` and they're picked up automatically.

## Run it

```bash
npm install
npm run server   # PlayMesh server  → http://localhost:4000
npm run game     # PixiJS game      → http://localhost:5173
npm run admin    # Admin dashboard  → http://localhost:5174
```

Admin login: **admin** / **playmesh**.

## Test

```bash
npm test   # boots the server and runs the end-to-end smoke test
```

## What it demonstrates

| PlayMesh feature | Where |
|---|---|
| Single-node mode (no Redis) | `new PlayMesh({ ... })` without `redis` |
| Event signing ("key encryption") | `signing: true` on server and all clients |
| Custom auth + roles | `onAuthenticate` — any username plays; `admin`/`playmesh` gets the `admin` role |
| One session per user | `uniqueUser: 'replace'` — a reconnect replaces the old session, no duplicate players |
| Domains & instances | `playground/{meadow,beach,forest}` + role-locked `admin/console` |
| Built-in chat + moderation | `client.chat()` / `mesh.onChatMessage` — blacklisted words **kick** the sender |
| Synced public state | player positions/colors via `instance.publicState` |
| Client room switching | `onJoinRequest` + `client.join()/leave()` |
| Admin: topology | domain list → room sub-list with live player counts (the admin zone itself is hidden) |
| Admin: room inspection | chat history + player list per room |
| Admin: kick with reason | modal → `session.kick(reason)`; admins can't be kicked |
| Admin: teleport | modal → `session.leave(from)` + `session.join(to)` (same domain); admins can't be teleported |
| Admin: broadcast | modal → world / domain / instance scope; players see it as a modal they must dismiss |
| Rate limiting | `rateLimit({ move: 30, chat: 2 })` |

## Art

The game runs with drawn fallbacks out of the box. To use real art, generate the 5 images in [`prompts.md`](prompts.md) and drop them into `game/public/assets/`. Avatar colors are a single white sprite tinted in PixiJS — no per-color assets.
