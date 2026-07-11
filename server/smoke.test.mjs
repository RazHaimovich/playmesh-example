import { PlayMeshClient } from '@playmesh/client';
import assert from 'node:assert';
import { spawn } from 'node:child_process';

const PORT = 4100;
const url = `http://localhost:${PORT}`;
const wait = ms => new Promise(r => setTimeout(r, ms));

const server = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', d => d.toString().includes('server on') && resolve());
  server.on('exit', () => reject(new Error('server died')));
  setTimeout(() => reject(new Error('server start timeout')), 15000);
});
process.on('exit', () => server.kill());

// player luna
const luna = new PlayMeshClient({ url, auth: { username: 'luna', color: '#e63946' }, signing: true });
let lunaKicked = '';
let lunaAnnounce = null;
let lunaTeleported = null;
const lunaChats = [];
luna.onChat(m => lunaChats.push(m));
luna.onKick(r => (lunaKicked = r));
luna.on('announce', p => (lunaAnnounce = p));
luna.on('teleported', p => (lunaTeleported = p));
const lunaSession = await luna.connect();
assert.deepEqual(lunaSession.instances, ['playground/meadow'], 'luna admitted to meadow');

// wrong admin password rejected
const badAdmin = new PlayMeshClient({ url, auth: { username: 'admin', password: 'nope' }, signing: true });
await assert.rejects(badAdmin.connect(), /Wrong admin password/i, 'bad admin password rejected');

// admin
const admin = new PlayMeshClient({ url, auth: { username: 'admin', password: 'playmesh' }, signing: true });
const got = {};
admin.on('admin:topology', p => (got.topology = p));
admin.on('admin:room', p => (got.room = p));
admin.on('admin:chat', p => (got.chat = p));
admin.on('admin:presence', p => (got.presence = p));
const adminSession = await admin.connect();
assert.deepEqual(adminSession.instances, ['admin/console'], 'admin admitted to console');

// player cannot join admin zone
await assert.rejects(luna.join('admin/console'), /.*/, 'player blocked from admin zone');

// chat + history + admin notification
luna.chat('hello friends');
await wait(400);
assert.equal(lunaChats[0]?.text, 'hello friends', 'luna receives own chat');
assert.equal(got.chat?.path, 'playground/meadow', 'admin notified of chat');

// topology
admin.emit('admin:topology');
await wait(400);
const domains = got.topology.domains.map(d => d.id).sort();
assert.deepEqual(domains, ['playground'], 'admin zone hidden from topology');

// admins cannot be kicked or teleported
admin.emit('admin:kick', { sessionId: adminSession.id, reason: 'no' });
admin.emit('admin:teleport', { sessionId: adminSession.id, from: 'admin/console', to: 'admin/console' });
await wait(400);
assert.equal(admin.connected, true, 'admin cannot be kicked');
const meadow = got.topology.domains.find(d => d.id === 'playground').rooms.find(r => r.id === 'meadow');
assert.equal(meadow.count, 1, 'meadow has 1 player');

// room inspection
admin.emit('admin:room', { path: 'playground/meadow' });
await wait(400);
assert.equal(got.room.messages[0].text, 'hello friends', 'history visible to admin');
assert.equal(got.room.players[0].userId, 'luna', 'player list visible');
assert.equal(got.room.players[0].color, '#e63946', 'player color visible');
const lunaSessionId = got.room.players[0].sessionId;

// move + public state sync
luna.emit('move', { x: 0.9, y: 0.1 });
await wait(400);
const st = luna.stateOf('playground/meadow');
assert.equal(st[lunaSessionId].x, 0.9, 'move synced via public state');

// broadcasts: world / domain / instance
admin.emit('admin:broadcast', { scope: 'world', message: 'hello world' });
await wait(400);
assert.equal(lunaAnnounce?.message, 'hello world', 'world broadcast received');
assert.equal(lunaAnnounce?.from, 'Administrator', 'announced as Administrator');
admin.emit('admin:broadcast', { scope: 'domain', target: 'playground', message: 'hello domain' });
await wait(400);
assert.equal(lunaAnnounce?.message, 'hello domain', 'domain broadcast received');
admin.emit('admin:broadcast', { scope: 'instance', target: 'playground/meadow', message: 'hello room' });
await wait(400);
assert.equal(lunaAnnounce?.message, 'hello room', 'instance broadcast received');

// teleport meadow -> beach
admin.emit('admin:teleport', { sessionId: lunaSessionId, from: 'playground/meadow', to: 'playground/beach' });
await wait(500);
assert.equal(lunaTeleported?.to, 'playground/beach', 'teleport event received');
assert.deepEqual(luna.instances, ['playground/beach'], 'luna now in beach');

// client-side room switch
await luna.leave('playground/beach');
await luna.join('playground/forest');
assert.deepEqual(luna.instances, ['playground/forest'], 'self room switch works');

// blacklist word -> kick
luna.chat('you are stupid');
await wait(500);
assert.match(lunaKicked, /forbidden word/i, 'blacklisted word kicks with reason');
assert.equal(luna.connected, false, 'kicked player disconnected');

// admin kick with reason
const max = new PlayMeshClient({ url, auth: { username: 'max', color: '#4cc9f0' }, signing: true });
let maxKicked = '';
max.onKick(r => (maxKicked = r));
await max.connect();
admin.emit('admin:room', { path: 'playground/meadow' });
await wait(400);
const maxId = got.room.players.find(p => p.userId === 'max').sessionId;
admin.emit('admin:kick', { sessionId: maxId, reason: 'Being naughty' });
await wait(500);
assert.equal(maxKicked, 'Being naughty', 'admin kick reason delivered');

admin.disconnect();
console.log('ALL SMOKE TESTS PASSED ✅');
process.exit(0);
