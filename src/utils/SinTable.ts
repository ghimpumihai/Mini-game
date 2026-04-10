/**
 * SinTable - Pre-calculated sine/cosine lookup tables
 *
 * Provides fast access to trigonometric values without
 * repeatedly calculating Math.sin() and Math.cos() in the game loop
 */

export class SinTable {
    private static instance: SinTable;
    private sinTable: Float32Array;
    private cosTable: Float32Array;
    private readonly tableSize: number;

    /**
     * Get singleton instance
     */
    public static getInstance(): SinTable {
        if (!SinTable.instance) {
            SinTable.instance = new SinTable();
        }
        return SinTable.instance;
    }

    /**
     * Private constructor - use getInstance()
     */
    private constructor(tableSize: number = 360) {
        this.tableSize = tableSize;
        this.sinTable = new Float32Array(tableSize);
        this.cosTable = new Float32Array(tableSize);
        this.populateTables();
    }

    /**
     * Populate sine and cosine tables
     */
    private populateTables(): void {
        for (let i = 0; i < this.tableSize; i++) {
            const radians = (i / this.tableSize) * Math.PI * 2;
            this.sinTable[i] = Math.sin(radians);
            this.cosTable[i] = Math.cos(radians);
        }
    }

    /**
     * Get sine value for angle in degrees
     *
     * @param degrees - Angle in degrees
     * @returns Sine of the angle
     */
    public getSin(degrees: number): number {
        // Normalize angle to 0-360 range
        let normalizedDegrees = degrees % 360;
        if (normalizedDegrees < 0) {
            normalizedDegrees += 360;
        }

        // Convert to table index
        const index = Math.round(normalizedDegrees / 360 * (this.tableSize - 1));
        return this.sinTable[index];
    }

    /**
     * Get cosine value for angle in degrees
     *
     * @param degrees - Angle in degrees
     * @returns Cosine of the angle
     */
    public getCos(degrees: number): number {
        // Normalize angle to 0-360 range
        let normalizedDegrees = degrees % 360;
        if (normalizedDegrees < 0) {
            normalizedDegrees += 360;
        }

        // Convert to table index
        const index = Math.round(normalizedDegrees / 360 * (this.tableSize - 1));
        return this.cosTable[index];
    }

    /**
     * Get both sine and cosine for angle in degrees
     * Faster than calling both methods separately
     *
     * @param degrees - Angle in degrees
     * @returns Object with sin and cos values
     */
    public getSinCos(degrees: number): { sin: number; cos: number } {
        // Normalize angle to 0-360 range
        let normalizedDegrees = degrees % 360;
        if (normalizedDegrees < 0) {
            normalizedDegrees += 360;
        }

        // Convert to table index
        const index = Math.round(normalizedDegrees / 360 * (this.tableSize - 1));
        return {
            sin: this.sinTable[index],
            cos: this.cosTable[index]
        };
    }

    /**
     * Get sine value for angle in radians
     *
     * @param radians - Angle in radians
     * @returns Sine of the angle
     */
    public getSinRad(radians: number): number {
        return this.getSin(radians * 180 / Math.PI);
    }

    /**
     * Get cosine value for angle in radians
     *
     * @param radians - Angle in radians
     * @returns Cosine of the angle
     */
    public getCosRad(radians: number): number {
        return this.getCos(radians * 180 / Math.PI);
    }

    /**
     * Get table size
     */
    public getTableSize(): number {
        return this.tableSize;
    }
}
