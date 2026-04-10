import { describe, it, expect } from 'vitest';
import { CircularBuffer } from '../utils/CircularBuffer';

describe('CircularBuffer', () => {
    it('should keep oldest-to-newest order after wraparound', () => {
        const buffer = new CircularBuffer<number>(3);

        buffer.push(1);
        buffer.push(2);
        buffer.push(3);
        buffer.push(4);
        buffer.push(5);

        expect(buffer.toArray()).toEqual([3, 4, 5]);
    });

    it('should keep newest-to-oldest order after wraparound', () => {
        const buffer = new CircularBuffer<number>(3);

        buffer.push(1);
        buffer.push(2);
        buffer.push(3);
        buffer.push(4);
        buffer.push(5);

        expect(buffer.toReversedArray()).toEqual([5, 4, 3]);
    });

    it('should return only defined entries after wraparound', () => {
        const buffer = new CircularBuffer<{ id: number }>(2);

        buffer.push({ id: 1 });
        buffer.push({ id: 2 });
        buffer.push({ id: 3 });

        const entries = buffer.toReversedArray();
        expect(entries).toHaveLength(2);
        expect(entries.every(e => e && typeof e.id === 'number')).toBe(true);
    });
});