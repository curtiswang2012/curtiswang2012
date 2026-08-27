/**
 * EVERNIGHT OATH: DAWN CHRONICLES (永夜之誓：破曉紀錄)
 * Dungeon / Expedition Map Generator: The Barren Wastes (荒蕪禁區)
 * Braziers, Light Sanctuaries, Loot Chests, and Obstacles
 */

import { audio } from './audio.js';

export class Brazier {
  constructor(x, y, isLit = false, isBossBrazier = false) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.lightRadius = 240;
    this.isLit = isLit;
    this.isBossBrazier = isBossBrazier;
  }

  ignite(particleEngine) {
    if (this.isLit) return;
    this.isLit = true;
    audio.playBrazierIgnite();
    particleEngine.emitShockwaveRing(this.x, this.y, 140, '#ffd700', 0.4);
    particleEngine.emitSparks(this.x, this.y, '#ffd700', 20, 180);
    particleEngine.addFloatingText(this.x, this.y, '🔥 聖火已點燃！', 'heal');
  }

  extinguish(particleEngine) {
    if (!this.isLit) return;
    this.isLit = false;
    particleEngine.emitShadowWisps(this.x, this.y, 12);
  }

  render(ctx, cameraX, cameraY) {
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    ctx.save();
    ctx.translate(sx, sy);

    // Brazier Pillar Base
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#262933';
    ctx.fill();
    ctx.strokeStyle = this.isLit ? '#ffd700' : '#475569';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Fire or Cold Ash
    ctx.font = '18px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.isLit ? '🔥' : '🪨', 0, 0);

    // Prompt if unlit
    if (!this.isLit) {
      ctx.font = '11px Outfit, sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText('[F] 點燃', 0, -26);
    }

    ctx.restore();
  }
}

export class Chest {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.isOpened = false;
  }

  open(particleEngine) {
    if (this.isOpened) return null;
    this.isOpened = true;
    audio.playLootPickup();
    particleEngine.emitSparks(this.x, this.y, '#ffd700', 16, 160);
    particleEngine.addFloatingText(this.x, this.y, '寶箱開啟！', 'crit');

    return {
      blackIron: Math.floor(Math.random() * 25 + 15),
      rations: Math.floor(Math.random() * 20 + 10),
      starlightShards: Math.floor(Math.random() * 15 + 10)
    };
  }

  render(ctx, cameraX, cameraY) {
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.font = '22px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.isOpened ? '📭' : '📦', 0, 0);
    if (!this.isOpened) {
      ctx.font = '11px Outfit, sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('[F] 開啟', 0, -22);
    }
    ctx.restore();
  }
}

export class LootDrop {
  constructor(x, y, type = 'iron', amount = 1) {
    this.x = x;
    this.y = y;
    this.type = type; // 'iron', 'oil', 'ration', 'shards'
    this.amount = amount;
    this.radius = 10;
    this.life = 60.0;
  }

  render(ctx, cameraX, cameraY) {
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    ctx.save();
    ctx.translate(sx, sy);

    let icon = '⛓️';
    if (this.type === 'oil') icon = '🕯️';
    if (this.type === 'ration') icon = '🍞';
    if (this.type === 'shards') icon = '✨';

    ctx.font = '14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 0);
    ctx.restore();
  }
}

export class DungeonMap {
  constructor() {
    this.width = 2400;
    this.height = 1800;
    this.braziers = [];
    this.chests = [];
    this.lootDrops = [];
    this.obstacles = [];
    this.bossBraziers = [];
  }

  initBarrenWastes() {
    this.braziers = [];
    this.chests = [];
    this.lootDrops = [];
    this.obstacles = [];
    this.bossBraziers = [];

    // 1. Entrance Light Sanctuary Braziers (Starting Safe Zone)
    this.braziers.push(new Brazier(400, 300, true));
    this.braziers.push(new Brazier(700, 450, false));
    this.braziers.push(new Brazier(500, 850, false));
    this.braziers.push(new Brazier(1000, 400, false));
    this.braziers.push(new Brazier(750, 1100, false));

    // 2. Boss Arena 3 Perimeter Braziers (Surrounding 1600, 1100)
    const b1 = new Brazier(1400, 950, true, true);
    const b2 = new Brazier(1800, 950, true, true);
    const b3 = new Brazier(1600, 1300, true, true);

    this.bossBraziers = [b1, b2, b3];
    this.braziers.push(b1, b2, b3);

    // 3. Loot Chests
    this.chests.push(new Chest(850, 350));
    this.chests.push(new Chest(350, 900));
    this.chests.push(new Chest(950, 1250));
    this.chests.push(new Chest(1900, 1100));

    // 4. Obstacles (Gothic stone pillars)
    const pillarPositions = [
      { x: 550, y: 300, r: 25 },
      { x: 800, y: 600, r: 30 },
      { x: 450, y: 700, r: 28 },
      { x: 1100, y: 750, r: 35 },
      { x: 1350, y: 650, r: 30 },
      { x: 1250, y: 1200, r: 30 },
      { x: 1850, y: 750, r: 30 },
      { x: 1750, y: 1350, r: 30 }
    ];

    for (const p of pillarPositions) {
      this.obstacles.push(p);
    }
  }

  extinguishAllBossBraziers(particleEngine) {
    for (const b of this.bossBraziers) {
      b.extinguish(particleEngine);
    }
  }

  areAllBossBraziersLit() {
    return this.bossBraziers.every(b => b.isLit);
  }

  interactClosest(player, particleEngine) {
    // 1. Check Braziers within range
    for (const b of this.braziers) {
      if (!b.isLit && Math.hypot(player.x - b.x, player.y - b.y) < 55) {
        b.ignite(particleEngine);
        return { type: 'brazier' };
      }
    }

    // 2. Check Chests within range
    for (const c of this.chests) {
      if (!c.isOpened && Math.hypot(player.x - c.x, player.y - c.y) < 55) {
        const loot = c.open(particleEngine);
        return { type: 'chest', loot };
      }
    }

    return null;
  }

  updateLootCollection(player, companion, particleEngine) {
    const collected = { iron: 0, oil: 0, ration: 0, shards: 0 };

    for (let i = this.lootDrops.length - 1; i >= 0; i--) {
      const drop = this.lootDrops[i];

      // Night-Eater companion auto-attract loot
      if (companion.data.id === 'companion_night_eater') {
        const dComp = Math.hypot(companion.x - drop.x, companion.y - drop.y);
        if (dComp < 200) {
          drop.x += ((companion.x - drop.x) / dComp) * 300 * 0.016;
          drop.y += ((companion.y - drop.y) / dComp) * 300 * 0.016;
        }
      }

      // Player magnet
      const dPlayer = Math.hypot(player.x - drop.x, player.y - drop.y);
      if (dPlayer < 120) {
        drop.x += ((player.x - drop.x) / dPlayer) * 380 * 0.016;
        drop.y += ((player.y - drop.y) / dPlayer) * 380 * 0.016;
      }

      if (dPlayer < 30 || (companion.data.id === 'companion_night_eater' && Math.hypot(companion.x - drop.x, companion.y - drop.y) < 30)) {
        collected[drop.type] = (collected[drop.type] || 0) + drop.amount;
        if (drop.type === 'oil') {
          player.lanternFuel = Math.min(player.maxLanternFuel, player.lanternFuel + 15);
          particleEngine.addFloatingText(player.x, player.y, '+15 燃油', 'heal');
        }
        audio.playLootPickup();
        particleEngine.emitSparks(drop.x, drop.y, '#ffd700', 6, 80);
        this.lootDrops.splice(i, 1);
      }
    }

    return collected;
  }

  render(ctx, cameraX, cameraY, width, height) {
    // 1. Draw gothic tiled floor & border
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 140, 60, 0.2)';
    ctx.lineWidth = 1;

    const tileSize = 80;
    const startCol = Math.floor(cameraX / tileSize);
    const endCol = startCol + Math.ceil(width / tileSize) + 1;
    const startRow = Math.floor(cameraY / tileSize);
    const endRow = startRow + Math.ceil(height / tileSize) + 1;

    for (let c = startCol; c <= endCol; c++) {
      for (let r = startRow; r <= endRow; r++) {
        const x = c * tileSize - cameraX;
        const y = r * tileSize - cameraY;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // World Boundary
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(-cameraX, -cameraY, this.width, this.height);
    ctx.restore();

    // 2. Render Obstacles
    for (const obs of this.obstacles) {
      const sx = obs.x - cameraX;
      const sy = obs.y - cameraY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, obs.r, 0, Math.PI * 2);
      ctx.fillStyle = '#1e212b';
      ctx.fill();
      ctx.strokeStyle = '#333847';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Pillar Top
      ctx.beginPath();
      ctx.arc(sx, sy, obs.r * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = '#11131a';
      ctx.fill();
      ctx.restore();
    }

    // 3. Render Braziers & Chests
    for (const b of this.braziers) {
      b.render(ctx, cameraX, cameraY);
    }
    for (const c of this.chests) {
      c.render(ctx, cameraX, cameraY);
    }

    // 4. Render Loot Drops
    for (const drop of this.lootDrops) {
      drop.render(ctx, cameraX, cameraY);
    }
  }
}
