# PlayMesh Official Example - "Meadow Pals"

Cute kids' game: walk a blob avatar around themed rooms, chat with friends. No Redis (single-node mode), PixiJS client, React admin dashboard.

## Structure (npm workspaces, 3 packages)

```
server/   Node + @playmesh/server        (port 4000)
game/     Vite + PixiJS + @playmesh/client
admin/    Vite + React + @playmesh/client
prompts.md  asset-generation prompts
```

## Server (`server/src/index.ts` - one file)

- `new PlayMesh({ port: 4000, signing: true })` - no `redis` key = in-memory single node; `signing: true` = ECDSA P-256 event signing ("key encryption" feature).
- **Auth (no signup, no password for players):** `onAuthenticate` - any non-empty username → `{ userId, roles: ['player'] }`. Special case `username === 'admin' && password === 'playmesh'` → `roles: ['admin']`.
- **Topology:** domain `playground` with instances `meadow`, `beach`, `forest`. Domain `admin` with instance `console`, restricted `{ roles: ['admin'] }`.
- **Admission:** players → `playground/meadow`; admin → `admin/console`.
- **Chat:** built-in chat (`client.chat` / `onChat`). `mesh.onChatMessage`: word in `BLACKLIST` → `session.kick('bad language: …')`, return `false`. Otherwise store in per-room history (in-memory `Map<room, msg[]>`, last 100) and pass through.
- **Player state:** `move` event → update `{x, y, color}` in instance state; instance broadcasts positions. Presence for join/leave.
- **Admin events** (handled on `admin/console`, all check `session.hasRole('admin')`):
  - `admin:topology` → domains + their rooms + player counts
  - `admin:room` `{domain, room}` → chat history + player list (`userId`, sessionId, color)
  - `admin:kick` `{sessionId, reason}` → `session.kick(reason)`
  - `admin:teleport` `{sessionId, from, to}` → `session.leave(from); session.join(to)` (same domain only)
  - `admin:broadcast` `{scope: 'world'|'domain'|'instance', target?, message}` → `mesh.broadcast` / `domain.broadcast` / `instance.broadcast` of an `announce` event, sender "Administrator"

## Game client (`game/`)

- Join screen: name input + avatar color picker (6 colors). No password.
- PixiJS: room background image, one white base avatar sprite **tinted** per player's chosen color (one asset, N colors), click-to-move with simple lerp, name label + chat bubble above avatar.
- Chat bar (plain HTML under canvas) → `client.chat()`; `onChat` → bubble + log.
- Room doors/buttons to switch rooms (`join`/`leave` via server event).
- `client.onKick(reason)` → friendly "You were removed: …" screen.
- `announce` event → banner from Administrator.

## Admin dashboard (`admin/`)

- Plain React + `@playmesh/client` (custom hooks per docs - no extra state lib).
- Login form (admin / playmesh) → connect with those creds.
- Left: domain list → expandable room sub-list (from `admin:topology`, refresh on presence events).
- Room view: chat messages + player list.
- Per-player actions: **Kick** (modal: reason textarea), **Teleport** (modal: room select, same domain).
- **Broadcast** button (modal: scope radio world/domain/instance + message).

## Skipped (ponytail)

- Persistence/DB - in-memory only; it's an example.
- Avatar sprite per color - one grayscale sprite + Pixi `tint`.
- Auth tokens/JWT - username-only is the demo's point.

## Build order

1. Assets from `prompts.md`
2. Server (runnable with two terminal clients)
3. Game client
4. Admin dashboard
5. README + smoke check
