import { describe, it, expect } from 'vitest';
import { Projectile } from '../entities/Projectile';
import { Player, PLAYER_1_CONFIG, PLAYER_2_CONFIG } from '../entities/Player';
import { InputHandler } from '../systems/InputHandler';

const createMockContext = (): CanvasRenderingContext2D => {
    return {
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        shadowBlur: 0,
        shadowColor: ''
    } as unknown as CanvasRenderingContext2D;
};

describe('Projectile', () => {
    it('should draw without crashing after trail buffer wraps', () => {
        const shooter = new Player(800, 600, new InputHandler(), PLAYER_1_CONFIG);
        const target = new Player(800, 600, new InputHandler(), PLAYER_2_CONFIG);
        const projectile = new Projectile(100, 100, shooter, target);

        // 10 is the trail buffer size; exceed it to force circular wraparound.
        for (let i = 0; i < 20; i++) {
            projectile.update(0.016);
        }

        const ctx = createMockContext();
        expect(() => projectile.draw(ctx)).not.toThrow();
    });
});