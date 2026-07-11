import { PlayMeshClient } from "@playmesh/client";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";

const W = 960;
const H = 600;
const ROOMS = [
  { id: "meadow", label: "🌼 Meadow", fallback: 0xa8d948 },
  { id: "beach", label: "🏖️ Beach", fallback: 0xffe3a3 },
  { id: "forest", label: "🌙 Forest", fallback: 0x2b4162 },
];
const COLORS = [
  "#ffb703",
  "#e63946",
  "#2a9d8f",
  "#8e7dbe",
  "#ff70a6",
  "#4cc9f0",
];

const $ = (id: string) => document.getElementById(id)!;

let client: PlayMeshClient;
let myColor = COLORS[0];
let currentRoom = "playground/meadow";

// ---------- join screen ----------

function selectColor(color: string) {
  myColor = color;
  document
    .querySelectorAll<HTMLButtonElement>(".swatch")
    .forEach((s) => s.classList.toggle("active", s.dataset.color === color));
  client?.emit("setColor", { color });
}

for (const el of [$("joinColors"), $("gameColors")]) {
  COLORS.forEach((color) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.dataset.color = color;
    b.style.background = color;
    b.onclick = () => selectColor(color);
    el.appendChild(b);
  });
}
selectColor(myColor);

$("play").onclick = join;
($("name") as HTMLInputElement).addEventListener("keydown", (e) => {
  if (e.key === "Enter") join();
});

async function join() {
  const username = ($("name") as HTMLInputElement).value.trim();
  if (!username) return ($("err").textContent = "Please type a name!");
  client = new PlayMeshClient({
    url: "http://localhost:4000",
    auth: { username, color: myColor },
    signing: true,
  });
  wireClient();
  try {
    const session = await client.connect();
    currentRoom = session.instances[0] ?? currentRoom;
    $("overlay").style.display = "none";
    await startGame();
  } catch (e: any) {
    $("err").textContent = e?.message ?? "Could not connect";
  }
}

// ---------- pixi ----------

const app = new Application();
let avatarTexture: Texture | null = null;
const bgTextures = new Map<string, Texture>();
let bg: Sprite | Graphics;
const players = new Map<
  string,
  {
    root: Container;
    label: Text;
    bubble: Text;
    body: Sprite | Graphics;
    tx: number;
    ty: number;
  }
>();

async function startGame() {
  await app.init({ width: W, height: H, antialias: true });
  $("game").appendChild(app.canvas);

  // assets are optional - everything has a drawn fallback so the example runs before art exists
  avatarTexture = await Assets.load("/assets/avatar.png").catch(() => null);
  for (const room of ROOMS) {
    const tex = await Assets.load(`/assets/bg_${room.id}.png`).catch(
      () => null,
    );
    if (tex) bgTextures.set(room.id, tex);
  }

  setBackground();
  buildRoomButtons();
  rebuildPlayers();

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointertap", (e) => {
    client.emit("move", { x: e.global.x / W, y: e.global.y / H });
  });

  app.ticker.add(() => {
    for (const p of players.values()) {
      p.root.x += (p.tx * W - p.root.x) * 0.08;
      p.root.y += (p.ty * H - p.root.y) * 0.08;
    }
  });
}

function setBackground() {
  if (bg) app.stage.removeChild(bg);
  const roomId = currentRoom.split("/")[1];
  const tex = bgTextures.get(roomId);
  if (tex) {
    bg = new Sprite(tex);
    bg.width = W;
    bg.height = H;
  } else {
    const room = ROOMS.find((r) => r.id === roomId)!;
    bg = new Graphics().rect(0, 0, W, H).fill(room.fallback);
  }
  app.stage.addChildAt(bg, 0);
}

function makeAvatar(color: string) {
  let body: Sprite | Graphics;
  if (avatarTexture) {
    body = new Sprite(avatarTexture);
    body.width = 90;
    body.height = 90;
    body.anchor.set(0.5);
  } else {
    body = new Graphics()
      .circle(0, 0, 34)
      .fill(0xffffff)
      .circle(-11, -6, 5)
      .fill(0x222222)
      .circle(11, -6, 5)
      .fill(0x222222)
      .arc(0, 6, 12, 0.2, Math.PI - 0.2)
      .stroke({ width: 4, color: 0x222222, cap: "round" });
  }
  body.tint = parseInt(color.slice(1), 16);
  return body;
}

function addPlayer(sessionId: string, data: any) {
  removePlayer(sessionId);
  const root = new Container();
  const body = makeAvatar(String(data.color ?? "#ffb703"));
  const label = new Text({
    text: String(data.userId ?? "?"),
    style: {
      fontSize: 16,
      fill: 0xffffff,
      stroke: { color: 0x2a6f97, width: 4 },
      fontWeight: "bold",
    },
  });
  label.anchor.set(0.5);
  label.y = 46;
  const bubble = new Text({
    text: "",
    style: {
      fontSize: 15,
      fill: 0x333333,
      stroke: { color: 0xffffff, width: 5 },
      wordWrap: true,
      wordWrapWidth: 220,
    },
  });
  bubble.anchor.set(0.5, 1);
  bubble.y = -44;
  root.addChild(body, label, bubble);
  root.x = Number(data.x ?? 0.5) * W;
  root.y = Number(data.y ?? 0.5) * H;
  app.stage.addChild(root);
  players.set(sessionId, {
    root,
    label,
    bubble,
    body,
    tx: Number(data.x ?? 0.5),
    ty: Number(data.y ?? 0.5),
  });
}

function removePlayer(sessionId: string) {
  const p = players.get(sessionId);
  if (!p) return;
  app.stage.removeChild(p.root);
  p.root.destroy({ children: true });
  players.delete(sessionId);
}

function rebuildPlayers() {
  for (const id of [...players.keys()]) removePlayer(id);
  const state = client.stateOf(currentRoom) ?? {};
  for (const [sessionId, data] of Object.entries(state))
    addPlayer(sessionId, data);
}

// ---------- rooms ----------

function buildRoomButtons() {
  const bar = $("rooms");
  bar.replaceChildren();
  for (const room of ROOMS) {
    const path = `playground/${room.id}`;
    const b = document.createElement("button");
    b.className = "room" + (path === currentRoom ? " active" : "");
    b.textContent = room.label;
    b.onclick = async () => {
      if (path === currentRoom) return;
      await client.leave(currentRoom);
      await client.join(path);
      enterRoom(path);
    };
    bar.appendChild(b);
  }
}

function enterRoom(path: string) {
  currentRoom = path;
  setBackground();
  buildRoomButtons();
  rebuildPlayers();
  $("chatlog").replaceChildren();
}

// ---------- chat & events ----------

function wireClient() {
  client.onStateChange((change) => {
    if (change.instance !== currentRoom || change.scope === "user") return;
    if (change.cleared) return rebuildPlayers();
    if (!change.key) return;
    if (change.value === undefined) removePlayer(change.key);
    else if (players.has(change.key)) {
      const p = players.get(change.key)!;
      const data = change.value as any;
      p.tx = Number(data.x ?? p.tx);
      p.ty = Number(data.y ?? p.ty);
      p.body.tint = parseInt(String(data.color ?? "#ffb703").slice(1), 16);
    } else addPlayer(change.key, change.value);
  });

  client.onChat((message) => {
    if (message.instance !== currentRoom) return;
    const p = players.get(message.sessionId);
    if (p) {
      p.bubble.text = message.text;
      setTimeout(() => {
        if (p.bubble.text === message.text) p.bubble.text = "";
      }, 4000);
    }
    const line = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = message.userId + ": ";
    line.appendChild(name);
    line.appendChild(document.createTextNode(message.text));
    $("chatlog").prepend(line);
  });

  client.on("announce", (payload: any) => {
    $("announceMsg").textContent = String(payload.message ?? "");
    $("announce").style.display = "flex";
  });

  client.on("teleported", (payload: any) => enterRoom(String(payload.to)));

  client.onKick((reason) => {
    $("kickReason").textContent =
      reason || "You were removed by an administrator.";
    ($("kicked") as HTMLElement).style.display = "flex";
  });

  client.onReconnect(() => {
    // a reconnect is a fresh session (re-admitted to meadow): resync the whole scene
    // ponytail: 300ms grace for the join snapshot to land; onStateChange fills any gap
    setTimeout(
      () => enterRoom(client.instances[0] ?? "playground/meadow"),
      300,
    );
  });
}

$("announceClose").onclick = () => ($("announce").style.display = "none");

$("send").onclick = sendChat;
($("msg") as HTMLInputElement).addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

function sendChat() {
  const input = $("msg") as HTMLInputElement;
  const text = input.value.trim();
  if (!text || !client?.connected) return;
  client.chat(text);
  input.value = "";
}
