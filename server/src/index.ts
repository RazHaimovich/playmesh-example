import {
  PlayMesh,
  rateLimit,
  type Session,
  type ChatMessage,
} from "@playmesh/server";

const PORT = Number(process.env.PORT ?? 4000);
// ponytail: documented demo credential; override via env for any real deployment
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "playmesh";
const ROOMS = ["meadow", "beach", "forest"];
const BLACKLIST = ["stupid", "dummy", "hate", "ugly", "shut up", "poop"];
const HISTORY_LIMIT = 100;

// ponytail: in-memory history, single node. Move to a store if this ever clusters.
const history = new Map<string, ChatMessage[]>();

const mesh = new PlayMesh({
  port: PORT,
  signing: true, // ECDSA P-256 signing of all app events, both directions
  uniqueUser: "replace", // a reconnect replaces the old session instead of duplicating the player
  socket: { cors: { origin: true } },
});

mesh.use(rateLimit({ move: 30, chat: 2, "*": 50 }));

mesh.onAuthenticate(async (request) => {
  const username = String(request.auth.username ?? "").trim();
  if (!username) throw new Error("Please pick a name");
  if (username.toLowerCase() === "admin") {
    if (request.auth.password !== ADMIN_PASSWORD)
      throw new Error("Wrong admin password");
    return { userId: "admin", roles: ["admin"] };
  }
  return {
    userId: username,
    roles: ["player"],
    data: { color: String(request.auth.color ?? "#ffb703") },
  };
});

mesh.onAdmission(async ({ userId }) => ({
  instances: userId === "admin" ? ["admin/console"] : ["playground/meadow"],
}));

mesh.bootstrap(async ({ mesh }) => {
  const playground = mesh.createDomain("playground");
  const adminZone = mesh.createDomain("admin", { roles: ["admin"] });
  const console_ = adminZone.createInstance("console");

  for (const id of ROOMS) {
    const room = playground.createInstance(id);
    room.onJoinRequest(() => true); // players may switch rooms freely

    room.onJoin(async (session) => {
      if (session.hasRole("admin")) return;
      await room.publicState.set(session.id, {
        userId: session.userId,
        color: session.data.color,
        x: 0.2 + Math.random() * 0.6,
        y: 0.5 + Math.random() * 0.3,
      });
      console_.broadcast("admin:presence", { path: room.path });
    });

    room.onLeave(async (session) => {
      await room.publicState.delete(session.id);
      console_.broadcast("admin:presence", { path: room.path });
    });

    room.on("move", async (session, payload: any) => {
      const prev = (await room.publicState.get(session.id)) as
        | Record<string, unknown>
        | undefined;
      if (!prev) return;
      const x = Math.min(1, Math.max(0, Number(payload?.x)));
      const y = Math.min(1, Math.max(0, Number(payload?.y)));
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      await room.publicState.set(session.id, { ...prev, x, y });
    });

    room.on("setColor", async (session, payload: any) => {
      const color = String(payload?.color ?? "");
      if (!/^#[0-9a-f]{6}$/i.test(color)) return;
      session.data.color = color;
      const prev = (await room.publicState.get(session.id)) as
        | Record<string, unknown>
        | undefined;
      if (prev) await room.publicState.set(session.id, { ...prev, color });
    });
  }

  // ---- admin zone (domain is role-locked, so every sender here is an admin) ----

  adminZone.on("admin:topology", async (session) => {
    const domains = [];
    for (const domain of mesh.domains) {
      if (domain === adminZone) continue; // the admin zone is not moderatable

      const rooms = [];
      for (const instance of domain.instances) {
        rooms.push({
          id: instance.id,
          path: instance.path,
          count: await instance.memberCount(),
        });
      }
      domains.push({ id: domain.id, rooms });
    }
    session.send("admin:topology", { domains });
  });

  adminZone.on("admin:room", async (session, payload: any) => {
    const instance = mesh.getInstance(String(payload?.path ?? ""));
    if (!instance || instance.domain === adminZone) return;
    session.send("admin:room", {
      path: instance.path,
      messages: history.get(instance.path) ?? [],
      players: instance.sessions
        .filter((s) => !s.hasRole("admin"))
        .map((s) => ({
        sessionId: s.id,
        userId: s.userId,
        color: s.data.color,
      })),
    });
  });

  adminZone.on("admin:kick", (session, payload: any) => {
    const target = mesh.getSession(String(payload?.sessionId ?? ""));
    if (!target || target.hasRole("admin")) return; // admins cannot be kicked
    target.kick(String(payload?.reason ?? "Removed by administrator"));
  });

  adminZone.on("admin:teleport", async (session, payload: any) => {
    const target = mesh.getSession(String(payload?.sessionId ?? ""));
    const from = mesh.getInstance(String(payload?.from ?? ""));
    const to = mesh.getInstance(String(payload?.to ?? ""));
    if (!target || !from || !to || from.domain.id !== to.domain.id) return;
    if (target.hasRole("admin") || to.domain === adminZone) return; // admins cannot be teleported
    target.send("announce", {
      from: "Administrator",
      message: "You are being teleported...",
      at: Date.now(),
    });
    await target.leave(from);
    await target.join(to);
    target.send("teleported", { to: to.path });
  });

  adminZone.on("admin:broadcast", (session, payload: any) => {
    const message = String(payload?.message ?? "").trim();
    if (!message) return;
    const announce = { from: "Administrator", message, at: Date.now() };
    const scope = payload?.scope;
    if (scope === "world") mesh.broadcast("announce", announce);
    else if (scope === "domain")
      mesh.getDomain(String(payload?.target))?.broadcast("announce", announce);
    else if (scope === "instance")
      mesh
        .getInstance(String(payload?.target))
        ?.broadcast("announce", announce);
  });
});

mesh.onChatMessage(({ session, text }) => {
  const lower = text.toLowerCase();
  if (BLACKLIST.some((word) => lower.includes(word))) {
    session.kick(`You used a forbidden word - be kind! 💛`);
    return false;
  }
  const at = Date.now();
  const consoleInstance = mesh.getInstance("admin/console");
  for (const instance of session.instances) {
    if (instance.domain.id !== "playground") continue;
    const messages = history.get(instance.path) ?? [];
    messages.push({
      instance: instance.path,
      sessionId: session.id,
      userId: session.userId,
      text,
      at,
    });
    if (messages.length > HISTORY_LIMIT) messages.shift();
    history.set(instance.path, messages);
    consoleInstance?.broadcast("admin:chat", { path: instance.path });
  }
  return true;
});

mesh.onDisconnect((session) => {
  mesh.getInstance("admin/console")?.broadcast("admin:presence", {});
});

const { port } = await mesh.start();
console.log(
  `Meadow Pals server on http://localhost:${port} (single-node, signing on)`,
);
