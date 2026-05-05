import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { encoding, decoding } from 'lib0';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { docStore } from './storage.js';
import { pool } from './db.js';
import { config } from './config.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface Room {
  id: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Set<WebSocket>;
  saveTimer?: NodeJS.Timeout;
  loaded: boolean;
}

const rooms = new Map<string, Room>();

async function getOrCreateRoom(id: string): Promise<Room> {
  let room = rooms.get(id);
  if (room) return room;

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  room = { id, doc, awareness, conns: new Set(), loaded: false };
  rooms.set(id, room);

  const existing = await docStore.load(id);
  if (existing) Y.applyUpdate(doc, existing);
  room.loaded = true;

  doc.on('update', () => scheduleSave(room!));
  return room;
}

function scheduleSave(room: Room) {
  if (room.saveTimer) return;
  room.saveTimer = setTimeout(async () => {
    room.saveTimer = undefined;
    try {
      const update = Y.encodeStateAsUpdate(room.doc);
      if (update.byteLength > config.maxDocBytes) {
        console.warn(`[yws] doc ${room.id} exceeds max size, skipping save`);
        return;
      }
      await docStore.save(room.id, update);
      await pool.query(
        `UPDATE sheets SET last_edited_at = now(), size_bytes = $2,
           expires_at = now() + (ttl_days || ' days')::interval
         WHERE id = $1`,
        [room.id, update.byteLength]
      );
    } catch (e) {
      console.error('[yws] save error', e);
    }
  }, 3000);
}

function send(ws: WebSocket, data: Uint8Array) {
  if (ws.readyState === ws.OPEN) ws.send(data);
}

function broadcast(room: Room, data: Uint8Array, except?: WebSocket) {
  for (const c of room.conns) if (c !== except) send(c, data);
}

export function startWsServer() {
  const wss = new WebSocketServer({ port: config.wsPort });
  console.log(`[yws] listening on :${config.wsPort}`);

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const id = url.pathname.split('/').filter(Boolean).pop();
    if (!id) { ws.close(1008, 'missing sheet id'); return; }

    const { rows } = await pool.query('SELECT id FROM sheets WHERE id = $1 AND expires_at > now()', [id]);
    if (rows.length === 0) { ws.close(1008, 'sheet not found or expired'); return; }

    const room = await getOrCreateRoom(id);
    room.conns.add(ws);

    // initial sync: send sync step 1
    {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(enc, room.doc);
      send(ws, encoding.toUint8Array(enc));

      // send current awareness states
      const states = room.awareness.getStates();
      if (states.size > 0) {
        const aenc = encoding.createEncoder();
        encoding.writeVarUint(aenc, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          aenc,
          awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys()))
        );
        send(ws, encoding.toUint8Array(aenc));
      }
    }

    const updateHandler = (update: Uint8Array, _origin: any) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
      broadcast(room, encoding.toUint8Array(enc));
    };
    room.doc.on('update', updateHandler);

    const awarenessHandler = ({ added, updated, removed }: any, _origin: any) => {
      const changed = added.concat(updated).concat(removed);
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(room.awareness, changed));
      broadcast(room, encoding.toUint8Array(enc));
    };
    room.awareness.on('update', awarenessHandler);

    ws.on('message', (raw: Buffer) => {
      try {
        const dec = decoding.createDecoder(new Uint8Array(raw));
        const messageType = decoding.readVarUint(dec);
        if (messageType === MESSAGE_SYNC) {
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(dec, enc, room.doc, ws);
          if (encoding.length(enc) > 1) send(ws, encoding.toUint8Array(enc));
        } else if (messageType === MESSAGE_AWARENESS) {
          awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(dec), ws);
        }
      } catch (e) {
        console.error('[yws] message error', e);
      }
    });

    ws.on('close', () => {
      room.conns.delete(ws);
      room.doc.off('update', updateHandler);
      room.awareness.off('update', awarenessHandler);
      awarenessProtocol.removeAwarenessStates(room.awareness, [room.doc.clientID], ws);
      if (room.conns.size === 0) {
        // keep doc in memory for a bit, then evict
        setTimeout(() => {
          if (room.conns.size === 0) {
            scheduleSave(room);
            rooms.delete(room.id);
          }
        }, 60_000);
      }
    });
  });
}
