/**
 * ObjectPool - Generic object pooling utility for performance optimization
 *
 * Object pooling reduces garbage collection overhead by reusing objects
 * instead of constantly creating and destroying them.
 *
 * @template T - The type of objects to pool
 */

export class ObjectPool<T> {
    private pool: T[] = [];
    private activeObjects: T[] = [];
    private createFn: () => T;
    private resetFn?: (obj: T) => void;
    private maxPoolSize: number;

    /**
     * Create a new ObjectPool
     *
     * @param createFn - Function that creates a new object
     * @param initialSize - Initial number of objects to pre-allocate (default: 10)
     * @param resetFn - Optional function to reset object state when released
     * @param maxPoolSize - Maximum number of objects in pool (default: 1000)
     */
    constructor(
        createFn: () => T,
        initialSize: number = 10,
        resetFn?: (obj: T) => void,
        maxPoolSize: number = 1000
    ) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxPoolSize = maxPoolSize;

        // Pre-allocate initial pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(createFn());
        }
    }

    /**
     * Get an object from the pool
     * If pool is empty, creates a new object
     *
     * @returns An object ready to use
     */
    public get(): T {
        const obj = this.pool.pop() || this.createFn();
        this.activeObjects.push(obj);
        return obj;
    }

    /**
     * Release an object back to the pool
     * Resets object state if resetFn was provided
     *
     * @param obj - The object to release
     */
    public release(obj: T): void {
        const index = this.activeObjects.indexOf(obj);
        if (index > -1) {
            this.activeObjects.splice(index, 1);

            // Reset object state if reset function provided
            if (this.resetFn) {
                this.resetFn(obj);
            }

            // Only add back to pool if under max size
            if (this.pool.length < this.maxPoolSize) {
                this.pool.push(obj);
            }
        }
    }

    /**
     * Release multiple objects back to the pool at once
     * More efficient than releasing one at a time
     *
     * @param objects - Array of objects to release
     */
    public releaseMany(objects: T[]): void {
        for (const obj of objects) {
            this.release(obj);
        }
    }

    /**
     * Get all currently active objects
     *
     * @returns Array of active objects
     */
    public getActiveObjects(): readonly T[] {
        return this.activeObjects;
    }

    /**
     * Get the count of active objects
     *
     * @returns Number of active objects
     */
    public getActiveCount(): number {
        return this.activeObjects.length;
    }

    /**
     * Get the count of available objects in pool
     *
     * @returns Number of available objects
     */
    public getPoolCount(): number {
        return this.pool.length;
    }

    /**
     * Clear all active objects and return them to pool
     */
    public clear(): void {
        // Release all active objects
        while (this.activeObjects.length > 0) {
            const obj = this.activeObjects.pop()!;
            if (this.resetFn) {
                this.resetFn(obj);
            }
            if (this.pool.length < this.maxPoolSize) {
                this.pool.push(obj);
            }
        }
    }

    /**
     * Pre-allocate more objects to the pool
     * Useful for known performance-critical moments
     *
     * @param count - Number of additional objects to allocate
     */
    public preAllocate(count: number): void {
        const toAllocate = Math.min(count, this.maxPoolSize - this.pool.length);
        for (let i = 0; i < toAllocate; i++) {
            this.pool.push(this.createFn());
        }
    }

    /**
     * Get total pool statistics
     *
     * @returns Object with pool statistics
     */
    public getStats() {
        return {
            active: this.activeObjects.length,
            available: this.pool.length,
            total: this.activeObjects.length + this.pool.length,
            maxSize: this.maxPoolSize
        };
    }
}
