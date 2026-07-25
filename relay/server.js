/* Virtual-Ethernet relay for Alto Trek in the browser.
 *
 * Every binary WebSocket message is a raw 3-Mbit Alto Ethernet frame.
 * The relay broadcasts each frame to every OTHER client connected to the
 * same room — a shared cable, exactly what the Alto network code expects.
 * No game logic lives here.
 *
 * Rooms: the WebSocket path is the room name ("/ethernet", "/room/foo"...).
 * Run locally:  node server.js          (listens on 8081)
 * Cloud Run:    listens on $PORT.
 */

"use strict";

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8081;
const MAX_FRAME_BYTES = 4096;          // Alto frames are ~600 bytes max
const MAX_CLIENTS_PER_ROOM = 64;

const rooms = new Map();               // path -> Set of sockets

const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok\n");
        return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Alto Trek virtual-Ethernet relay. Connect via WebSocket.\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
    const room = req.url || "/ethernet";

    let members = rooms.get(room);
    if (!members) {
        members = new Set();
        rooms.set(room, members);
    }
    if (members.size >= MAX_CLIENTS_PER_ROOM) {
        ws.close(1013, "room full");
        return;
    }
    members.add(ws);
    log(`join ${room} (${members.size} aboard)`);
    broadcastPresence(members);

    ws.on("message", (data, isBinary) => {
        if (!isBinary || data.length === 0 || data.length > MAX_FRAME_BYTES) {
            return;
        }
        for (const peer of members) {
            if (peer !== ws && peer.readyState === peer.OPEN) {
                peer.send(data, { binary: true });
            }
        }
    });

    const bye = () => {
        members.delete(ws);
        if (members.size === 0) {
            rooms.delete(room);
        }
        log(`leave ${room} (${members.size} aboard)`);
        broadcastPresence(members);
    };
    ws.on("close", bye);
    ws.on("error", bye);
});

// Tell everyone in the room how many players are connected. Sent as a TEXT
// message so clients can tell it apart from binary Ethernet frames.
function broadcastPresence(members) {
    const msg = JSON.stringify({ type: "presence", count: members.size });
    for (const ws of members) {
        if (ws.readyState === ws.OPEN) {
            ws.send(msg);
        }
    }
}

// Keepalive: Cloud Run and some proxies drop idle connections.
setInterval(() => {
    for (const members of rooms.values()) {
        for (const ws of members) {
            if (ws.readyState === ws.OPEN) {
                ws.ping();
            }
        }
    }
}, 30000);

function log(msg) {
    console.log(`${new Date().toISOString()} ${msg}`);
}

server.listen(PORT, () => log(`relay listening on :${PORT}`));
