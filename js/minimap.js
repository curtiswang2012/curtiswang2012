/**
 * EVERNIGHT OATH: DAWN CHRONICLES (永夜之誓：破曉紀錄)
 * Tactical Radar Mini-Map & Expanded Gothic Cartography System
 */

export class MinimapEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isExpanded = false;
    this.width = 180;
    this.height = 140;
  }

  init(canvasId = 'minimap-canvas') {
    this.canvas = document.getElementById(canvasId);
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.updateSize();
    }
  }

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
    const container = document.getElementById('minimap-container');
    if (container) {
      if (this.isExpanded) {
        container.classList.add('expanded');
      } else {
        container.classList.remove('expanded');
      }
    }
    this.updateSize();
    return this.isExpanded;
  }

  updateSize() {
    if (!this.canvas) return;
    if (this.isExpanded) {
      this.width = 380;
      this.height = 280;
    } else {
      this.width = 180;
      this.height = 135;
    }
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  render(dungeon, player, companion, enemies, boss) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const cw = this.width;
    const ch = this.height;

    ctx.clearRect(0, 0, cw, ch);

    // 1. Background Grid & Gothic Cartography Theme
    ctx.fillStyle = 'rgba(10, 12, 16, 0.95)';
    ctx.fillRect(0, 0, cw, ch);

    // Map Scaling (Dungeon is 2400 x 1800)
    const scaleX = (cw - 16) / dungeon.width;
    const scaleY = (ch - 16) / dungeon.height;
    const offsetX = 8;
    const offsetY = 8;

    const toMapX = (wx) => offsetX + wx * scaleX;
    const toMapY = (wy) => offsetY + wy * scaleY;

    // 2. Dungeon Boundary
    ctx.strokeStyle = 'rgba(180, 140, 60, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(offsetX, offsetY, dungeon.width * scaleX, dungeon.height * scaleY);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= dungeon.width; x += 400) {
      ctx.beginPath();
      ctx.moveTo(toMapX(x), offsetY);
      ctx.lineTo(toMapX(x), offsetY + dungeon.height * scaleY);
      ctx.stroke();
    }
    for (let y = 0; y <= dungeon.height; y += 400) {
      ctx.beginPath();
      ctx.moveTo(offsetX, toMapY(y));
      ctx.lineTo(offsetX + dungeon.width * scaleX, toMapY(y));
      ctx.stroke();
    }

    // 3. Boss Arena Zone Marker
    ctx.save();
    const bossArenaX = toMapX(1600);
    const bossArenaY = toMapY(1100);
    const bossArenaR = 300 * scaleX;
    ctx.beginPath();
    ctx.arc(bossArenaX, bossArenaY, bossArenaR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(139, 0, 0, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.restore();

    // 4. Obstacles (Pillars)
    ctx.fillStyle = '#262933';
    for (const obs of dungeon.obstacles) {
      ctx.beginPath();
      ctx.arc(toMapX(obs.x), toMapY(obs.y), Math.max(2, obs.r * scaleX), 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Braziers (Light Radii & Flame markers)
    for (const b of dungeon.braziers) {
      const mx = toMapX(b.x);
      const my = toMapY(b.y);

      if (b.isLit) {
        // Lit Brazier Light Field
        ctx.beginPath();
        ctx.arc(mx, my, b.lightRadius * scaleX, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 180, 0, 0.18)';
        ctx.fill();

        // Flame Dot
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
      } else {
        // Unlit Brazier Dot
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 6. Chests
    for (const c of dungeon.chests) {
      if (!c.isOpened) {
        const cx = toMapX(c.x);
        const cy = toMapY(c.y);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
      }
    }

    // 7. Regular Enemies
    for (const en of enemies) {
      if (en.isDead) continue;
      const ex = toMapX(en.x);
      const ey = toMapY(en.y);

      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = en.isFrenzied ? '#ef4444' : '#dc2626';
      ctx.fill();
    }

    // 8. Boss Marker
    if (boss && boss.isActive && !boss.isDead) {
      const bx = toMapX(boss.x);
      const by = toMapY(boss.y);

      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.4)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💀', bx, by);
      ctx.restore();
    }

    // 9. Companion Marker
    if (companion) {
      const compX = toMapX(companion.x);
      const compY = toMapY(companion.y);

      ctx.beginPath();
      ctx.arc(compX, compY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = companion.data.color || '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 10. Player Marker (Golden arrow pointing facing direction)
    const px = toMapX(player.x);
    const py = toMapY(player.y);

    // Player Light Radius on minimap
    ctx.beginPath();
    ctx.arc(px, py, player.getLightRadius() * scaleX, 0, Math.PI * 2);
    ctx.fillStyle = player.form === 'radiant' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(148, 0, 211, 0.15)';
    ctx.fill();

    // Player Arrow
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.facingAngle);

    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 11. Coordinates Text in Corner
    ctx.font = '9px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(player.x)}, ${Math.round(player.y)}`, cw - 6, ch - 4);
  }
}

export const minimap = new MinimapEngine();
