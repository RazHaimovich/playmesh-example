import { useEffect, useRef, useState } from 'react';
import { PlayMeshClient } from '@playmesh/client';

type Room = { id: string; path: string; count: number };
type Topology = { domains: { id: string; rooms: Room[] }[] };
type Player = { sessionId: string; userId: string; color?: string };
type Message = { sessionId: string; userId: string; text: string; at: number };
type RoomData = { path: string; messages: Message[]; players: Player[] };

export default function App() {
  const clientRef = useRef<PlayMeshClient>();
  const [connected, setConnected] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [topology, setTopology] = useState<Topology>({ domains: [] });
  const [room, setRoom] = useState<RoomData | null>(null);
  const [modal, setModal] = useState<
    | { kind: 'kick'; player: Player }
    | { kind: 'teleport'; player: Player }
    | { kind: 'broadcast' }
    | null
  >(null);

  const roomPathRef = useRef<string | null>(null);
  roomPathRef.current = room?.path ?? roomPathRef.current;

  async function login(password: string) {
    const client = new PlayMeshClient({
      url: 'http://localhost:4000',
      auth: { username: 'admin', password },
      signing: true,
    });
    client.on('admin:topology', payload => setTopology(payload as Topology));
    client.on('admin:room', payload => setRoom(payload as RoomData));
    const refresh = () => {
      client.emit('admin:topology');
      if (roomPathRef.current) client.emit('admin:room', { path: roomPathRef.current });
    };
    client.on('admin:chat', refresh);
    client.on('admin:presence', refresh);
    client.onDisconnect(() => setConnected(false));
    try {
      await client.connect();
      clientRef.current = client;
      setConnected(true);
      client.emit('admin:topology');
    } catch (e: any) {
      setLoginError(e?.message ?? 'Connection failed');
    }
  }

  if (!connected) return <Login onSubmit={login} error={loginError} />;

  const client = clientRef.current!;
  const openRoom = (path: string) => {
    roomPathRef.current = path;
    client.emit('admin:room', { path });
  };
  const roomDomain = room?.path.split('/')[0];
  const siblingRooms =
    topology.domains.find(d => d.id === roomDomain)?.rooms.filter(r => r.path !== room?.path) ?? [];

  return (
    <div className="layout">
      <aside>
        <h1>🌼 Meadow Pals Admin</h1>
        {topology.domains.map(domain => (
          <div key={domain.id}>
            <h2>📁 {domain.id}</h2>
            <ul>
              {domain.rooms.map(r => (
                <li key={r.path}>
                  <button
                    className={room?.path === r.path ? 'active' : ''}
                    onClick={() => openRoom(r.path)}
                  >
                    # {r.id} <span className="count">{r.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button className="primary" onClick={() => setModal({ kind: 'broadcast' })}>
          📣 Broadcast…
        </button>
      </aside>

      <main>
        {!room ? (
          <p className="empty">Select a room to inspect it.</p>
        ) : (
          <>
            <h2>{room.path}</h2>
            <div className="columns">
              <section>
                <h3>Chat messages</h3>
                <ul className="messages">
                  {room.messages.length === 0 && <li className="empty">No messages yet.</li>}
                  {room.messages.map((m, i) => (
                    <li key={i}>
                      <b>{m.userId}</b> <time>{new Date(m.at).toLocaleTimeString()}</time>
                      <div>{m.text}</div>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Players ({room.players.length})</h3>
                <ul className="players">
                  {room.players.map(p => (
                    <li key={p.sessionId}>
                      <span className="dot" style={{ background: p.color ?? '#999' }} />
                      <b>{p.userId}</b>
                      <span className="actions">
                        <button onClick={() => setModal({ kind: 'kick', player: p })}>Kick</button>
                        <button onClick={() => setModal({ kind: 'teleport', player: p })}>Teleport</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </main>

      {modal?.kind === 'kick' && (
        <KickModal
          player={modal.player}
          onClose={() => setModal(null)}
          onKick={reason => {
            client.emit('admin:kick', { sessionId: modal.player.sessionId, reason });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'teleport' && room && (
        <TeleportModal
          player={modal.player}
          rooms={siblingRooms}
          onClose={() => setModal(null)}
          onTeleport={to => {
            client.emit('admin:teleport', { sessionId: modal.player.sessionId, from: room.path, to });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'broadcast' && (
        <BroadcastModal
          topology={topology}
          onClose={() => setModal(null)}
          onSend={(scope, target, message) => {
            client.emit('admin:broadcast', { scope, target, message });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function Login({ onSubmit, error }: { onSubmit: (password: string) => void; error: string }) {
  const [password, setPassword] = useState('');
  return (
    <div className="login">
      <form
        onSubmit={e => {
          e.preventDefault();
          onSubmit(password);
        }}
      >
        <h1>🌼 Admin login</h1>
        <input value="admin" disabled />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
        />
        <button className="primary" type="submit">Sign in</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function KickModal({ player, onClose, onKick }: { player: Player; onClose: () => void; onKick: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Kick ${player.userId}`} onClose={onClose}>
      <textarea
        placeholder="Reason (shown to the player)"
        value={reason}
        onChange={e => setReason(e.target.value)}
        autoFocus
      />
      <div className="row">
        <button onClick={onClose}>Cancel</button>
        <button className="danger" onClick={() => onKick(reason || 'Removed by administrator')}>
          Kick player
        </button>
      </div>
    </Modal>
  );
}

function TeleportModal({ player, rooms, onClose, onTeleport }: { player: Player; rooms: Room[]; onClose: () => void; onTeleport: (to: string) => void }) {
  const [to, setTo] = useState(rooms[0]?.path ?? '');
  return (
    <Modal title={`Teleport ${player.userId}`} onClose={onClose}>
      <select value={to} onChange={e => setTo(e.target.value)}>
        {rooms.map(r => (
          <option key={r.path} value={r.path}>{r.path}</option>
        ))}
      </select>
      <div className="row">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" disabled={!to} onClick={() => onTeleport(to)}>Teleport</button>
      </div>
    </Modal>
  );
}

function BroadcastModal({ topology, onClose, onSend }: { topology: Topology; onClose: () => void; onSend: (scope: string, target: string, message: string) => void }) {
  const [scope, setScope] = useState<'world' | 'domain' | 'instance'>('world');
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const targets =
    scope === 'domain'
      ? topology.domains.map(d => d.id)
      : scope === 'instance'
        ? topology.domains.flatMap(d => d.rooms.map(r => r.path))
        : [];
  const effectiveTarget = targets.includes(target) ? target : targets[0] ?? '';
  return (
    <Modal title="Broadcast as Administrator" onClose={onClose}>
      <div className="row">
        {(['world', 'domain', 'instance'] as const).map(s => (
          <label key={s}>
            <input type="radio" checked={scope === s} onChange={() => setScope(s)} /> {s}
          </label>
        ))}
      </div>
      {scope !== 'world' && (
        <select value={effectiveTarget} onChange={e => setTarget(e.target.value)}>
          {targets.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}
      <textarea
        placeholder="Message to everyone…"
        value={message}
        onChange={e => setMessage(e.target.value)}
        autoFocus
      />
      <div className="row">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" disabled={!message.trim()} onClick={() => onSend(scope, effectiveTarget, message)}>
          Send 📣
        </button>
      </div>
    </Modal>
  );
}
