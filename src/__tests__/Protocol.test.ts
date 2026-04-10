import { describe, expect, it } from 'vitest';
import {
    decodeWireMessage,
    encodeWireMessage,
    isClientToServerMessage,
    isServerToClientMessage,
} from '../multiplayer/protocol';

describe('Multiplayer protocol guards', () => {
    it('accepts valid client-to-server input frame messages', () => {
        const message = {
            type: 'input_frame',
            sequence: 14,
            input: {
                left: true,
                right: false,
                up: false,
                down: true,
                dash: false,
                deployBomb: false,
            },
        };

        expect(isClientToServerMessage(message)).toBe(true);
    });

    it('rejects malformed client-to-server messages', () => {
        const malformed = {
            type: 'input_frame',
            sequence: '14',
            input: {
                left: true,
                right: false,
                up: false,
                down: true,
                dash: false,
                deployBomb: false,
            },
        };

        expect(isClientToServerMessage(malformed)).toBe(false);
    });

    it('accepts valid server-to-client snapshot messages', () => {
        const message = {
            type: 'state_snapshot',
            fromPlayerId: 'host-id',
            tick: 5,
            snapshot: {
                timestampMs: Date.now(),
                gameTimeSeconds: 10,
                roundState: 'playing',
                score: 20,
                players: [],
                enemies: [],
                projectiles: [],
                bombs: [],
                powerups: [],
            },
        };

        expect(isServerToClientMessage(message)).toBe(true);
    });

    it('encodes and decodes wire payloads consistently', () => {
        const original = {
            type: 'ping',
            clientTimeMs: Date.now(),
        };

        const encoded = encodeWireMessage(original);
        const decoded = decodeWireMessage(encoded);

        expect(decoded).toEqual(original);
    });
});
