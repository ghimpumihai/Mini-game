import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
    MAX_ROOM_PLAYERS,
    createDefaultCustomization,
    decodeWireMessage,
    encodeWireMessage,
    isClientToServerMessage,
    type ClientToServerMessage,
    type PlayerCustomization,
    type RoomSummary,
    type ServerToClientMessage,
} from '../src/multiplayer/protocol.js';

interface ClientConnection {
    playerId: string;
    socket: WebSocket;
    roomCode: string | null;
    displayName: string;
    ready: boolean;
    customization: PlayerCustomization;
}

interface RoomState {
    code: string;
    hostPlayerId: string;
    playerIds: string[];
    started: boolean;
    createdAtMs: number;
    updatedAtMs: number;
}

const clientsById = new Map<string, ClientConnection>();
const clientIdsBySocket = new Map<WebSocket, string>();
const roomsByCode = new Map<string, RoomState>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, '../..');

const mimeTypeByExtension: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.map': 'application/json; charset=utf-8',
};

function getMimeType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    return mimeTypeByExtension[extension] ?? 'application/octet-stream';
}

function normalizeDisplayName(rawName: string): string {
    const trimmed = rawName.trim();
    if (trimmed.length === 0) {
        return `Player-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }

    return trimmed.slice(0, 20);
}

function sanitizeRoomCode(roomCode: string): string {
    return roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function sanitizeCustomization(customization: Partial<PlayerCustomization> | undefined): PlayerCustomization {
    const defaults = createDefaultCustomization();
    if (!customization) {
        return defaults;
    }

    const model = customization.model;
    const hat = customization.hat;

    const safeModel = model === 'core' || model === 'cross' || model === 'stripes' || model === 'target'
        ? model
        : defaults.model;

    const safeHat = hat === 'none' || hat === 'cap' || hat === 'crown' || hat === 'beanie'
        ? hat
        : defaults.hat;

    const safeColor = typeof customization.color === 'string' && customization.color.trim().length > 0
        ? customization.color
        : defaults.color;

    return {
        color: safeColor,
        model: safeModel,
        hat: safeHat,
    };
}

function createUniqueRoomCode(): string {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    for (let attempts = 0; attempts < 2000; attempts++) {
        let roomCode = '';
        for (let index = 0; index < 6; index++) {
            roomCode += alphabet[Math.floor(Math.random() * alphabet.length)];
        }

        if (!roomsByCode.has(roomCode)) {
            return roomCode;
        }
    }

    throw new Error('Unable to allocate a unique room code');
}

function getClientById(playerId: string): ClientConnection | undefined {
    return clientsById.get(playerId);
}

function sendToClient(playerId: string, message: ServerToClientMessage): void {
    const client = getClientById(playerId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
        return;
    }

    client.socket.send(encodeWireMessage(message));
}

function broadcastToRoom(roomCode: string, message: ServerToClientMessage, excludePlayerId?: string): void {
    const room = roomsByCode.get(roomCode);
    if (!room) {
        return;
    }

    room.playerIds.forEach(playerId => {
        if (excludePlayerId && playerId === excludePlayerId) {
            return;
        }
        sendToClient(playerId, message);
    });
}

function roomToSummary(room: RoomState): RoomSummary {
    const players = room.playerIds
        .map(playerId => clientsById.get(playerId))
        .filter((client): client is ClientConnection => Boolean(client))
        .map(client => ({
            playerId: client.playerId,
            displayName: client.displayName,
            ready: client.ready,
            customization: client.customization,
        }));

    return {
        code: room.code,
        hostPlayerId: room.hostPlayerId,
        started: room.started,
        maxPlayers: MAX_ROOM_PLAYERS,
        players,
    };
}

function sendRoomUpdate(roomCode: string): void {
    const room = roomsByCode.get(roomCode);
    if (!room) {
        return;
    }

    broadcastToRoom(roomCode, {
        type: 'room_updated',
        room: roomToSummary(room),
    });
}

function sendError(playerId: string, code: string, message: string): void {
    sendToClient(playerId, {
        type: 'error',
        code,
        message,
    });
}

function leaveCurrentRoom(playerId: string): void {
    const client = clientsById.get(playerId);
    if (!client || !client.roomCode) {
        return;
    }

    const roomCode = client.roomCode;
    const room = roomsByCode.get(roomCode);

    client.roomCode = null;
    client.ready = false;

    if (!room) {
        return;
    }

    room.playerIds = room.playerIds.filter(existingPlayerId => existingPlayerId !== playerId);
    room.updatedAtMs = Date.now();

    broadcastToRoom(roomCode, {
        type: 'player_left',
        playerId,
    });

    if (room.playerIds.length === 0) {
        roomsByCode.delete(roomCode);
        return;
    }

    if (room.hostPlayerId === playerId) {
        room.hostPlayerId = room.playerIds[0];
        broadcastToRoom(roomCode, {
            type: 'host_changed',
            hostPlayerId: room.hostPlayerId,
        });
    }

    sendRoomUpdate(roomCode);
}

function joinRoom(playerId: string, roomCode: string, displayName: string, customization: Partial<PlayerCustomization> | undefined): void {
    const client = clientsById.get(playerId);
    if (!client) {
        return;
    }

    const normalizedRoomCode = sanitizeRoomCode(roomCode);
    const room = roomsByCode.get(normalizedRoomCode);

    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Room code does not exist');
        return;
    }

    if (room.started) {
        sendError(playerId, 'ROOM_ALREADY_STARTED', 'Match already started for this room');
        return;
    }

    if (room.playerIds.length >= MAX_ROOM_PLAYERS) {
        sendError(playerId, 'ROOM_FULL', 'Room is already full');
        return;
    }

    leaveCurrentRoom(playerId);

    client.displayName = normalizeDisplayName(displayName);
    client.customization = sanitizeCustomization(customization);
    client.ready = false;
    client.roomCode = normalizedRoomCode;

    room.playerIds.push(playerId);
    room.updatedAtMs = Date.now();

    sendToClient(playerId, {
        type: 'room_joined',
        playerId,
        room: roomToSummary(room),
    });

    sendRoomUpdate(normalizedRoomCode);
}

function createRoom(playerId: string, displayName: string, customization: Partial<PlayerCustomization> | undefined): void {
    const client = clientsById.get(playerId);
    if (!client) {
        return;
    }

    leaveCurrentRoom(playerId);

    const roomCode = createUniqueRoomCode();
    const nowMs = Date.now();

    const room: RoomState = {
        code: roomCode,
        hostPlayerId: playerId,
        playerIds: [playerId],
        started: false,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
    };

    client.displayName = normalizeDisplayName(displayName);
    client.customization = sanitizeCustomization(customization);
    client.ready = false;
    client.roomCode = roomCode;

    roomsByCode.set(roomCode, room);

    sendToClient(playerId, {
        type: 'room_joined',
        playerId,
        room: roomToSummary(room),
    });
}

function setReady(playerId: string, ready: boolean): void {
    const client = clientsById.get(playerId);
    if (!client || !client.roomCode) {
        sendError(playerId, 'NOT_IN_ROOM', 'You must join a room first');
        return;
    }

    const room = roomsByCode.get(client.roomCode);
    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Current room no longer exists');
        return;
    }

    client.ready = ready;
    room.updatedAtMs = Date.now();
    sendRoomUpdate(room.code);
}

function startMatch(playerId: string): void {
    const client = clientsById.get(playerId);
    if (!client || !client.roomCode) {
        sendError(playerId, 'NOT_IN_ROOM', 'You must join a room first');
        return;
    }

    const room = roomsByCode.get(client.roomCode);
    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Current room no longer exists');
        return;
    }

    if (room.hostPlayerId !== playerId) {
        sendError(playerId, 'HOST_ONLY', 'Only the room host can start the match');
        return;
    }

    if (room.playerIds.length < 2) {
        sendError(playerId, 'NOT_ENOUGH_PLAYERS', 'Need at least 2 players to start');
        return;
    }

    const everyoneReady = room.playerIds.every(roomPlayerId => clientsById.get(roomPlayerId)?.ready === true);
    if (!everyoneReady) {
        sendError(playerId, 'NOT_ALL_READY', 'All players must be ready before starting');
        return;
    }

    room.started = true;
    room.updatedAtMs = Date.now();

    // Ensure clients receive the final room roster (including all active players)
    // before handling match start.
    sendRoomUpdate(room.code);

    broadcastToRoom(room.code, {
        type: 'match_started',
        roomCode: room.code,
        hostPlayerId: room.hostPlayerId,
        startedAtMs: Date.now(),
        room: roomToSummary(room),
    });
}

function forwardInputFrame(playerId: string, payload: Extract<ClientToServerMessage, { type: 'input_frame' }>): void {
    const client = clientsById.get(playerId);
    if (!client?.roomCode) {
        sendError(playerId, 'NOT_IN_ROOM', 'Join a room before sending inputs');
        return;
    }

    broadcastToRoom(
        client.roomCode,
        {
            type: 'input_frame',
            fromPlayerId: playerId,
            sequence: payload.sequence,
            input: payload.input,
        },
        playerId
    );
}

function forwardHostSnapshot(playerId: string, payload: Extract<ClientToServerMessage, { type: 'state_snapshot' }>): void {
    const client = clientsById.get(playerId);
    if (!client?.roomCode) {
        sendError(playerId, 'NOT_IN_ROOM', 'Join a room before sending snapshots');
        return;
    }

    const room = roomsByCode.get(client.roomCode);
    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Current room no longer exists');
        return;
    }

    if (room.hostPlayerId !== playerId) {
        sendError(playerId, 'HOST_ONLY', 'Only the host can publish snapshots');
        return;
    }

    broadcastToRoom(
        room.code,
        {
            type: 'state_snapshot',
            fromPlayerId: playerId,
            tick: payload.tick,
            snapshot: payload.snapshot,
        },
        playerId
    );
}

function forwardHostGameEvent(playerId: string, payload: Extract<ClientToServerMessage, { type: 'game_event' }>): void {
    const client = clientsById.get(playerId);
    if (!client?.roomCode) {
        sendError(playerId, 'NOT_IN_ROOM', 'Join a room before sending game events');
        return;
    }

    const room = roomsByCode.get(client.roomCode);
    if (!room) {
        sendError(playerId, 'ROOM_NOT_FOUND', 'Current room no longer exists');
        return;
    }

    if (room.hostPlayerId !== playerId) {
        sendError(playerId, 'HOST_ONLY', 'Only the host can publish game events');
        return;
    }

    broadcastToRoom(
        room.code,
        {
            type: 'game_event',
            fromPlayerId: playerId,
            event: payload.event,
        },
        playerId
    );
}

function handleClientMessage(playerId: string, message: ClientToServerMessage): void {
    switch (message.type) {
        case 'create_room':
            createRoom(playerId, message.displayName, message.customization);
            return;
        case 'join_room':
            joinRoom(playerId, message.roomCode, message.displayName, message.customization);
            return;
        case 'leave_room':
            leaveCurrentRoom(playerId);
            return;
        case 'set_ready':
            setReady(playerId, message.ready);
            return;
        case 'start_match':
            startMatch(playerId);
            return;
        case 'input_frame':
            forwardInputFrame(playerId, message);
            return;
        case 'state_snapshot':
            forwardHostSnapshot(playerId, message);
            return;
        case 'game_event':
            forwardHostGameEvent(playerId, message);
            return;
        case 'ping':
            sendToClient(playerId, {
                type: 'pong',
                clientTimeMs: message.clientTimeMs,
                serverTimeMs: Date.now(),
            });
            return;
    }
}

async function serveStaticRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname;

    if (requestPath === '/health') {
        const payload = {
            ok: true,
            rooms: roomsByCode.size,
            clients: clientsById.size,
        };

        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(payload));
        return;
    }

    const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
    const candidatePath = path.resolve(clientDistDir, `.${normalizedPath}`);

    if (!candidatePath.startsWith(clientDistDir)) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
    }

    try {
        const fileContent = await readFile(candidatePath);
        response.writeHead(200, {
            'Content-Type': getMimeType(candidatePath),
            'Cache-Control': 'public, max-age=3600',
        });
        response.end(fileContent);
        return;
    } catch {
        // Fall through to SPA fallback.
    }

    const indexPath = path.join(clientDistDir, 'index.html');

    try {
        const indexContent = await readFile(indexPath);
        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
        });
        response.end(indexContent);
    } catch {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Build output not found. Run "npm run build" before starting the server.');
    }
}

const httpServer = createServer((request, response) => {
    serveStaticRequest(request, response).catch(error => {
        console.error('Failed to serve request', error);
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Internal Server Error');
    });
});

const wsServer = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname !== '/ws') {
        socket.destroy();
        return;
    }

    wsServer.handleUpgrade(request, socket, head, upgradedSocket => {
        wsServer.emit('connection', upgradedSocket, request);
    });
});

wsServer.on('connection', socket => {
    const playerId = randomUUID();

    const client: ClientConnection = {
        playerId,
        socket,
        roomCode: null,
        displayName: `Player-${playerId.slice(0, 4).toUpperCase()}`,
        ready: false,
        customization: createDefaultCustomization(),
    };

    clientsById.set(playerId, client);
    clientIdsBySocket.set(socket, playerId);

    sendToClient(playerId, {
        type: 'connected',
        playerId,
    });

    socket.on('message', (data, isBinary) => {
        if (isBinary) {
            sendError(playerId, 'INVALID_PAYLOAD', 'Binary frames are not supported');
            return;
        }

        const payload = decodeWireMessage(data.toString());
        if (!payload || !isClientToServerMessage(payload)) {
            sendError(playerId, 'INVALID_MESSAGE', 'Message shape is not valid');
            return;
        }

        handleClientMessage(playerId, payload);
    });

    socket.on('close', () => {
        leaveCurrentRoom(playerId);
        clientIdsBySocket.delete(socket);
        clientsById.delete(playerId);
    });
});

const port = Number(process.env.PORT ?? '3000');

httpServer.listen(port, () => {
    console.log(`Neon Rain server listening on port ${port}`);
    console.log(`Serving client from: ${clientDistDir}`);
});
