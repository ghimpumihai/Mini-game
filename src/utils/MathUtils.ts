/**
 * MathUtils - Utility class for cached mathematical calculations
 *
 * Provides optimized math operations with caching to reduce
 * repeated calculations in game loop
 */

export class MathUtils {
    // Cache for distance calculations (avoid repeated sqrt calls)
    private static distanceCache: Map<string, number> = new Map();
    private static maxCacheSize: number = 1000;

    /**
     * Calculate Euclidean distance between two points with caching
     *
     * @param x1 - First point x
     * @param y1 - First point y
     * @param x2 - Second point x
     * @param y2 - Second point y
     * @returns Distance between points
     */
    public static distance(x1: number, y1: number, x2: number, y2: number): number {
        // Create cache key
        const key = `${x1.toFixed(2)},${y1.toFixed(2)},${x2.toFixed(2)},${y2.toFixed(2)}`;

        // Check cache
        const cached = this.distanceCache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        // Calculate distance
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Store in cache
        if (this.distanceCache.size >= this.maxCacheSize) {
            this.distanceCache.clear();
        }
        this.distanceCache.set(key, distance);

        return distance;
    }

    /**
     * Calculate squared distance (faster than distance when comparing)
     * Use this when you only need to compare distances, not the actual value
     *
     * @param x1 - First point x
     * @param y1 - First point y
     * @param x2 - Second point x
     * @param y2 - Second point y
     * @returns Squared distance between points
     */
    public static distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    }

    /**
     * Linear interpolation between two values
     *
     * @param start - Start value
     * @param end - End value
     * @param t - Interpolation factor (0-1)
     * @returns Interpolated value
     */
    public static lerp(start: number, end: number, t: number): number {
        return start + (end - start) * Math.max(0, Math.min(1, t));
    }

    /**
     * Clamp a value between min and max
     *
     * @param value - Value to clamp
     * @param min - Minimum value
     * @param max - Maximum value
     * @returns Clamped value
     */
    public static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Map a value from one range to another
     *
     * @param value - Value to map
     * @param inMin - Input range minimum
     * @param inMax - Input range maximum
     * @param outMin - Output range minimum
     * @param outMax - Output range maximum
     * @returns Mapped value
     */
    public static mapRange(
        value: number,
        inMin: number,
        inMax: number,
        outMin: number,
        outMax: number
    ): number {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }

    /**
     * Clear all caches (call this at appropriate times, like level change)
     */
    public static clearCache(): void {
        this.distanceCache.clear();
    }

    /**
     * Get cache statistics
     *
     * @returns Cache size
     */
    public static getCacheSize(): number {
        return this.distanceCache.size;
    }
}
