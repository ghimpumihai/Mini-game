/**
 * CircularBuffer - Fixed-size circular buffer for efficient data storage
 *
 * Eliminates push/shift operations on arrays.
 * Automatically wraps around when buffer is full.
 * Useful for trails, history tracking, etc.
 */

export class CircularBuffer<T> {
    private buffer: T[];
    private capacity: number;
    private size: number = 0;
    private head: number = 0; // Position to write next element

    constructor(capacity: number) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
    }

    /**
     * Add an element to the buffer
     * If buffer is full, oldest element is overwritten
     *
     * @param item - Item to add
     */
    public push(item: T): void {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;

        if (this.size < this.capacity) {
            this.size++;
        }
    }

    /**
     * Get all elements in order from oldest to newest
     *
     * @returns Array of elements in order
     */
    public toArray(): T[] {
        const result: T[] = [];

        for (let i = 0; i < this.size; i++) {
            // Calculate index, accounting for circular wrap
            const index = this.normalizeIndex(this.head - this.size + i);
            result.push(this.buffer[index]);
        }

        return result;
    }

    /**
     * Get all elements from newest to oldest
     *
     * @returns Array of elements in reverse order
     */
    public toReversedArray(): T[] {
        const result: T[] = [];

        for (let i = this.size - 1; i >= 0; i--) {
            const index = this.normalizeIndex(this.head - this.size + i);
            result.push(this.buffer[index]);
        }

        return result;
    }

    /**
     * Normalize an index to a valid array slot.
     */
    private normalizeIndex(index: number): number {
        return ((index % this.capacity) + this.capacity) % this.capacity;
    }

    /**
     * Get element at specific position from head
     * Position 0 = newest, position size-1 = oldest
     *
     * @param offset - Offset from head (0 = newest)
     * @returns Element at offset, or undefined if out of range
     */
    public getFromHead(offset: number): T | undefined {
        if (offset < 0 || offset >= this.size) {
            return undefined;
        }

        const index = (this.head - offset - 1 + this.capacity) % this.capacity;
        return this.buffer[index];
    }

    /**
     * Clear the buffer
     */
    public clear(): void {
        this.size = 0;
        this.head = 0;
        // Note: We don't clear the actual buffer array for performance
        // Existing data will be overwritten as needed
    }

    /**
     * Get current size of buffer
     *
     * @returns Number of elements in buffer
     */
    public getSize(): number {
        return this.size;
    }

    /**
     * Get buffer capacity
     *
     * @returns Maximum number of elements buffer can hold
     */
    public getCapacity(): number {
        return this.capacity;
    }

    /**
     * Check if buffer is empty
     *
     * @returns True if no elements in buffer
     */
    public isEmpty(): boolean {
        return this.size === 0;
    }

    /**
     * Check if buffer is full
     *
     * @returns True if buffer has reached capacity
     */
    public isFull(): boolean {
        return this.size === this.capacity;
    }

    /**
     * Get buffer statistics
     *
     * @returns Object with buffer info
     */
    public getStats() {
        return {
            size: this.size,
            capacity: this.capacity,
            head: this.head,
            usedPercentage: (this.size / this.capacity) * 100
        };
    }
}
