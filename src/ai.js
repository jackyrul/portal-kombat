// CPU opponent: periodic decision-making written into a virtual pad.

const DIFFICULTY = {
  easy:   { think: [0.4, 0.75], blockChance: 0.15, jumpProj: 0.2, aggression: 0.4,  specialChance: 0.12, comboChance: 0.1 },
  medium: { think: [0.28, 0.5], blockChance: 0.45, jumpProj: 0.45, aggression: 0.6, specialChance: 0.22, comboChance: 0.3 },
  hard:   { think: [0.16, 0.3], blockChance: 0.72, jumpProj: 0.65, aggression: 0.8, specialChance: 0.3,  comboChance: 0.55 },
};

export class AI {
  constructor(fighter, opponent, game, difficulty = 'medium') {
    this.f = fighter;
    this.o = opponent;
    this.game = game;
    this.cfg = DIFFICULTY[difficulty] ?? DIFFICULTY.medium;
    this.timer = 0.5;
  }

  update(dt) {
    const pad = this.f.pad;
    this.timer -= dt;

    // mid-air: kick when close enough
    if (this.f.state === 'jump' && !this.f.airAttacked) {
      if (Math.abs(this.o.x - this.f.x) < 2.0 && Math.random() < 0.3) pad.press('lk');
    }

    if (this.timer > 0) return;
    const [tMin, tMax] = this.cfg.think;
    this.timer = tMin + Math.random() * (tMax - tMin);

    pad.neutral();
    const f = this.f, o = this.o, cfg = this.cfg;
    if (f.busy || !f.controlEnabled || f.state === 'jump') return;

    const dx = o.x - f.x;
    const dist = Math.abs(dx);
    const toward = dx > 0 ? 'right' : 'left';
    const away = dx > 0 ? 'left' : 'right';

    // defend against incoming projectiles
    if (this.game.hasHostileProjectile(f)) {
      const r = Math.random();
      if (r < cfg.jumpProj) { pad.press('up'); pad.held[toward] = true; }
      else if (r < cfg.jumpProj + 0.3) { pad.held[away] = true; }
      return;
    }

    // block a close-range attack
    if (o.state === 'attack' && dist < 2.4 && Math.random() < cfg.blockChance) {
      pad.held[away] = true;
      if (o.attack?.def?.low) pad.held.down = true;
      return;
    }

    // punish a frozen or knocked-down opponent by walking in
    if (o.state === 'frozen' && dist > 1.4) { pad.held[toward] = true; return; }

    if (dist > 4.6) {
      const r = Math.random();
      if (r < cfg.specialChance * 1.8) pad.press('sp1');
      else if (r < cfg.specialChance * 1.8 + 0.15) { pad.press('up'); pad.held[toward] = true; }
      else pad.held[toward] = true;
      return;
    }

    if (dist > 2.1) {
      const r = Math.random();
      if (r < cfg.specialChance) pad.press('sp2');
      else if (r < cfg.specialChance + 0.12) { pad.press('up'); pad.held[toward] = true; }
      else if (r < cfg.aggression + 0.25) pad.held[toward] = true;
      else pad.held[away] = true;
      return;
    }

    // close range
    const r = Math.random();
    if (r < cfg.aggression) {
      const roll = Math.random();
      if (roll < 0.16) { pad.held.down = true; pad.press('hp'); }        // uppercut
      else if (roll < 0.3) { pad.held.down = true; pad.press('hk'); }    // sweep
      else if (roll < 0.5) pad.press('hp');
      else if (roll < 0.68) pad.press('lp');
      else if (roll < 0.85) pad.press('lk');
      else pad.press('hk');
    } else if (r < cfg.aggression + 0.22) {
      pad.held[away] = true;               // back off / block
    } else if (r < cfg.aggression + 0.3) {
      pad.press('sp2');
    }
  }
}
