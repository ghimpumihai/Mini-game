import { Entity } from './Entity';
import { Player } from './Player';
import { CircularBuffer } from '../utils/CircularBuffer';

export class Projectile extends Entity {
    private target: Player;
    private shooter: Player;
    private speed: number = 500;
    private damage: number = 15;
    private lifetime: number = 3; // seconds
    private age: number = 0;
    private isExpired: boolean = false;
    private trailBuffer: CircularBuffer<{ x: number; y: number }>;

    /**
     * Create a projectile (factory method for pooling)
     */
    public static create(shooter: Player, target: Player): Projectile {
        const proj = new Projectile(
            shooter.position.x + shooter.width / 2,
            shooter.position.y + shooter.height / 2,
            shooter,
            target
        );
        return proj;
    }

    /**
     * Initialize projectile with new values (for pooling)
     */
    public initialize(x: number, y: number, shooter: Player, target: Player): void {
        this.position.x = x;
        this.position.y = y;
        this.color = shooter.getColor();
        this.shooter = shooter;
        this.target = target;
        this.age = 0;
        this.isExpired = false;
        this.trailBuffer.clear();
        this.updateDirection();
    }

    /**
     * Reset projectile to initial state (for pooling)
     */
    public reset(): void {
        this.isExpired = true;
        this.age = 0;
        this.trailBuffer.clear();
    }

    constructor(x: number, y: number, shooter: Player, target: Player) {
        super(x, y, 8, 8, shooter.getColor());
        this.shooter = shooter;
        this.target = target;
        this.trailBuffer = new CircularBuffer<{ x: number; y: number }>(10);
        this.updateDirection();
    }

    private updateDirection(): void {
        const targetCenter = this.target.getCenter();
        const myCenter = { x: this.position.x + this.width / 2, y: this.position.y + this.height / 2 };

        const dx = targetCenter.x - myCenter.x;
        const dy = targetCenter.y - myCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            this.velocity.x = (dx / distance) * this.speed;
            this.velocity.y = (dy / distance) * this.speed;
        }
    }

    public update(deltaTime: number): void {
        this.age += deltaTime;
        if (this.age >= this.lifetime) {
            this.isExpired = true;
            return;
        }

        // Homing behavior: Update direction towards target if alive
        if (this.target.getIsAlive()) {
            this.updateDirection();
        }

        this.trailBuffer.push({ x: this.position.x, y: this.position.y });

        super.update(deltaTime);
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        if (this.isExpired) return;

        ctx.save();

        // Trail
        const trail = this.trailBuffer.toReversedArray();
        for (let i = 0; i < trail.length; i++) {
            const pos = trail[i];
            if (!pos) {
                continue;
            }
            const alpha = (i / trail.length) * 0.5;
            const size = (i / trail.length) * this.width;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(pos.x + this.width / 2, pos.y + this.height / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Projectile core
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.position.x + this.width / 2, this.position.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Glow ring
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.position.x + this.width / 2, this.position.y + this.height / 2, this.width / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    public getIsExpired(): boolean { return this.isExpired; }
    public getDamage(): number { return this.damage; }
    public getShooter(): Player { return this.shooter; }
    public getTarget(): Player { return this.target; }
    public expire(): void { this.isExpired = true; }

    public getRemainingLifetimeSeconds(): number {
        return Math.max(0, this.lifetime - this.age);
    }

    public applySnapshotState(
        position: { x: number; y: number },
        velocity: { x: number; y: number },
        expiresInSeconds: number
    ): void {
        this.position.x = position.x;
        this.position.y = position.y;
        this.velocity.x = velocity.x;
        this.velocity.y = velocity.y;
        this.age = Math.max(0, this.lifetime - Math.max(0, expiresInSeconds));
        this.isExpired = expiresInSeconds <= 0;
    }
}
