/**
 * EVERNIGHT OATH: DAWN CHRONICLES (永夜之誓：破曉紀錄)
 * Boss Encounter: Garuka, the Bone-Gnaw (噬骨魔靈·迦魯卡)
 * Multi-Phase Mechanics, Brazier Extinguishing, and Sanctified Zone Stun
 */

import { audio } from './audio.js';

export class BossGaruka {
  constructor(x = 1200, y = 800) {
    this.x = x;
    this.y = y;
    this.radius = 42;
    this.maxHp = 6000;
    this.hp = 6000;
    this.speed = 105;

    this.isActive = false;
    this.isDead = false;
    this.phase = 1; // 1 (Normal), 2 (Evernight Berserk), 3 (Enraged Dawn)

    // Berserk Shield & Sanctified Zone Mechanic
    this.isShielded = false; // 80% damage reduction in Phase 2 until 3 braziers are lit
    this.stunTimer = 0;
    this.attackCooldownTimer = 0;
    this.boneSpikeTimer = 3.0;

    // Ground spikes & shockwave rings
    this.activeSpikes = [];
  }

  reset(x = 1200, y = 800) {
    this.x = x;
    this.y = y;
    this.hp = this.maxHp;
    this.isActive = true;
    this.isDead = false;
    this.phase = 1;
    this.isShielded = false;
    this.stunTimer = 0;
    this.activeSpikes = [];
  }

  takeDamage(amount, isCrit, critMult, particleEngine) {
    if (this.isDead || !this.isActive) return 0;

    let finalDmg = amount;
    if (isCrit) {
      finalDmg = Math.round(finalDmg * critMult);
    }

    // Shield Reduction in Phase 2
    if (this.isShielded) {
      finalDmg = Math.round(finalDmg * 0.2); // 80% DR
      particleEngine.addFloatingText(this.x, this.y, '🛡️ 防禦極高！點燃火盆破盾！', 'stun');
    } else if (this.stunTimer > 0) {
      finalDmg = Math.round(finalDmg * 1.8); // 180% vulnerability while stunned
    }

    this.hp = Math.max(0, this.hp - finalDmg);
    particleEngine.emitBlood(this.x, this.y, 14);
    particleEngine.addFloatingText(this.x, this.y, finalDmg, isCrit ? 'crit' : 'normal');
    audio.playHit(isCrit, true);

    // Phase Transitions
    const hpPct = this.hp / this.maxHp;

    if (this.phase === 1 && hpPct <= 0.65) {
      this.triggerPhase2(particleEngine);
    } else if (this.phase === 2 && hpPct <= 0.25) {
      this.triggerPhase3(particleEngine);
    }

    if (this.hp <= 0) {
      this.isDead = true;
      particleEngine.addShake(25);
      particleEngine.emitSparks(this.x, this.y, '#ffd700', 50, 300);
      particleEngine.emitShadowWisps(this.x, this.y, 40);
      audio.playBossRoar();
    }

    return finalDmg;
  }

  triggerPhase2(particleEngine) {
    this.phase = 2;
    this.isShielded = true;
    audio.playBossRoar();
    particleEngine.addShake(20);
    particleEngine.emitShockwaveRing(this.x, this.y, 300, '#8b0000', 0.8);
    particleEngine.addFloatingText(this.x, this.y, '永夜狂暴！熄滅全場火盆！', 'crit');
  }

  triggerPhase3(particleEngine) {
    this.phase = 3;
    this.isShielded = false;
    this.speed = 150;
    audio.playBossRoar();
    particleEngine.addShake(22);
    particleEngine.emitShockwaveRing(this.x, this.y, 350, '#9400d3', 0.9);
    particleEngine.addFloatingText(this.x, this.y, '破曉死決！全屏骨刺風暴！', 'crit');
  }

  breakShieldAndStun(duration = 6.0, particleEngine) {
    this.isShielded = false;
    this.stunTimer = duration;
    particleEngine.addShake(18);
    particleEngine.emitShockwaveRing(this.x, this.y, 250, '#ffd700', 0.6);
    particleEngine.addFloatingText(this.x, this.y, '神聖領域破盾！首領癱瘓！', 'crit');
    audio.playBrazierIgnite();
  }

  update(dt, player, dungeon, particleEngine, allProjectiles) {
    if (this.isDead || !this.isActive) return;

    // 1. Update ground bone spikes
    for (let i = this.activeSpikes.length - 1; i >= 0; i--) {
      const s = this.activeSpikes[i];
      s.timer -= dt;

      // Spike warning -> erupt
      if (s.timer <= 0 && !s.erupted) {
        s.erupted = true;
        s.duration = 0.5;
        particleEngine.addShake(5);
        particleEngine.emitSparks(s.x, s.y, '#e2e8f0', 10, 140);
        audio.playSlash('hammer');

        // Damage player if in radius
        if (Math.hypot(player.x - s.x, player.y - s.y) < s.radius) {
          player.takeDamage(60, particleEngine);
        }
      }

      if (s.erupted) {
        s.duration -= dt;
        if (s.duration <= 0) {
          this.activeSpikes.splice(i, 1);
        }
      }
    }

    // 2. Handle Stun
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }
    if (this.boneSpikeTimer > 0) {
      this.boneSpikeTimer -= dt;
    }

    // 3. Movement AI
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    let curSpeed = this.speed;
    if (this.phase === 2 && this.isShielded) curSpeed *= 1.4; // Berserk speed in darkness
    if (this.phase === 3) curSpeed *= 1.35;

    if (dist > this.radius + player.radius + 10) {
      this.x += (dx / dist) * curSpeed * dt;
      this.y += (dy / dist) * curSpeed * dt;
    }

    // 4. Melee Bone Cleave
    if (dist <= this.radius + player.radius + 25 && this.attackCooldownTimer <= 0) {
      this.attackCooldownTimer = this.phase === 3 ? 1.0 : 1.6;
      player.takeDamage(this.phase === 3 ? 90 : 70, particleEngine);
      audio.playSlash('greatsword');
      particleEngine.emitShockwaveRing(this.x, this.y, 90, '#8b0000', 0.3);
    }

    // 5. Spawn Bone Spikes under player
    if (this.boneSpikeTimer <= 0) {
      this.boneSpikeTimer = this.phase === 3 ? 2.5 : 4.5;

      const spikeCount = this.phase === 3 ? 4 : 2;
      for (let i = 0; i < spikeCount; i++) {
        this.activeSpikes.push({
          x: player.x + (Math.random() * 80 - 40),
          y: player.y + (Math.random() * 80 - 40),
          radius: 35,
          timer: 1.0, // 1 sec warning before eruption
          erupted: false
        });
      }
    }

    // 6. Phase 3 Bone Shard Spiral Projectiles
    if (this.phase === 3 && Math.random() < 0.04) {
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.2;
        allProjectiles.push({
          x: this.x,
          y: this.y,
          vx: Math.cos(angle) * 220,
          vy: Math.sin(angle) * 220,
          radius: 9,
          damage: 45,
          color: '#f43f5e',
          isEnemy: true,
          range: 480,
          traveled: 0
        });
      }
    }
  }

  render(ctx, cameraX, cameraY) {
    if (this.isDead || !this.isActive) return;

    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    // Render Spike Warnings / Eruptions
    for (const s of this.activeSpikes) {
      const spkX = s.x - cameraX;
      const spkY = s.y - cameraY;

      ctx.save();
      if (!s.erupted) {
        // Red warning circle
        ctx.beginPath();
        ctx.arc(spkX, spkY, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220, 38, 38, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
      } else {
        // Erupted Bone Spikes
        ctx.beginPath();
        ctx.arc(spkX, spkY, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(sx, sy);

    // Boss Dark/Berserk Aura
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 16, 0, Math.PI * 2);
    ctx.fillStyle = this.phase === 2 ? 'rgba(139, 0, 0, 0.35)' : 'rgba(59, 7, 100, 0.3)';
    ctx.fill();
    ctx.strokeStyle = this.isShielded ? '#38bdf8' : (this.phase === 3 ? '#e11d48' : '#8b0000');
    ctx.lineWidth = 3;
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f1016';
    ctx.fill();

    // Boss Skull Face
    ctx.font = '36px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💀', 0, 0);

    // Shield Aura Graphic
    if (this.isShielded) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
    }

    // Stun Stars Graphic
    if (this.stunTimer > 0) {
      ctx.font = '20px Outfit, sans-serif';
      ctx.fillText('💫', 0, -this.radius - 16);
    }

    ctx.restore();
  }
}
