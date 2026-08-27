/**
 * EVERNIGHT OATH: DAWN CHRONICLES (永夜之誓：破曉紀錄)
 * Master Game Controller, Game Loop, State Machine, and UI Manager
 */

import { LightingEngine } from './lighting.js';
import { ParticleEngine } from './particles.js';
import { Player, FORMS } from './player.js';
import { Companion, COMPANION_CLASSES } from './companions.js';
import { Enemy, ENEMY_TYPES } from './enemies.js';
import { BossGaruka } from './boss.js';
import { DungeonMap, LootDrop } from './dungeon.js';
import { CitadelSystem } from './citadel.js';
import { AncestralForge } from './gacha.js';
import { ArsenalSanctum } from './arsenal.js';
import { TALENT_TREE_DATA } from './weapons.js';
import { SaveSystem } from './storage.js';
import { audio } from './audio.js';

export const GAME_STATES = {
  HUB: 'hub',
  EXPEDITION: 'expedition',
  VICTORY: 'victory',
  DEFEAT: 'defeat'
};

class EvernightGame {
  constructor() {
    this.state = GAME_STATES.HUB;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Systems
    this.lighting = new LightingEngine();
    this.particles = new ParticleEngine();
    this.player = new Player(400, 300);
    this.companion = new Companion(COMPANION_CLASSES[0]);
    this.boss = new BossGaruka(1600, 1100);
    this.dungeon = new DungeonMap();
    this.citadel = new CitadelSystem();
    this.forge = new AncestralForge();
    this.arsenal = new ArsenalSanctum();

    // World Entities
    this.enemies = [];
    this.enemyProjectiles = [];

    // Camera
    this.cameraX = 0;
    this.cameraY = 0;

    // Input
    this.inputState = {
      keys: {},
      mouse: { x: 0, y: 0, isDown: false, rightDown: false, worldX: 0, worldY: 0 }
    };

    // Expedition Run Stats
    this.runKills = 0;
    this.runLoot = { blackIron: 0, rations: 0, lumenOil: 0, starlightShards: 0 };

    this.lastTime = performance.now();
  }

  init() {
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Load Saved Game
    SaveSystem.load(this.player, this.companion, this.citadel, this.arsenal);

    this.setupEventListeners();
    this.setupUIHandlers();
    this.updateHUD();
    this.updateCitadelModal();

    // Start in Citadel Hub screen
    this.openModal('modal-citadel');

    // Game Animation Loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.lighting.resize(window.innerWidth, window.innerHeight);
  }

  startExpedition() {
    this.state = GAME_STATES.EXPEDITION;
    this.closeAllModals();
    this.runKills = 0;
    this.runLoot = { blackIron: 0, rations: 0, lumenOil: 0, starlightShards: 0 };

    // Reset Player, Companion, Dungeon, Boss
    this.player.reset(400, 300);
    this.companion.x = 350;
    this.companion.y = 300;
    this.dungeon.initBarrenWastes();
    this.boss.reset(1600, 1100);
    this.boss.isActive = false;

    // Spawn Initial Expedition Monsters
    this.enemies = [];
    this.enemyProjectiles = [];

    // 1. Crawler packs
    this.enemies.push(new Enemy(650, 400, ENEMY_TYPES.CRAWLER));
    this.enemies.push(new Enemy(720, 380, ENEMY_TYPES.CRAWLER));
    this.enemies.push(new Enemy(550, 800, ENEMY_TYPES.CRAWLER));
    this.enemies.push(new Enemy(620, 840, ENEMY_TYPES.CRAWLER));

    // 2. Stalkers in dark corridors
    this.enemies.push(new Enemy(900, 500, ENEMY_TYPES.STALKER));
    this.enemies.push(new Enemy(800, 950, ENEMY_TYPES.STALKER));
    this.enemies.push(new Enemy(1100, 600, ENEMY_TYPES.STALKER));

    // 3. Hollow Knights & Casters guarding the Boss Sanctum
    this.enemies.push(new Enemy(1200, 750, ENEMY_TYPES.KNIGHT));
    this.enemies.push(new Enemy(1250, 950, ENEMY_TYPES.KNIGHT));
    this.enemies.push(new Enemy(1050, 850, ENEMY_TYPES.CASTER));
    this.enemies.push(new Enemy(1300, 550, ENEMY_TYPES.CASTER));

    audio.setMusicTrack('expedition');
    this.showToast('進入禁區：荒蕪禁區 (Barren Wastes)', 'toast-cyan');
  }

  triggerFormShift() {
    const shiftRes = this.player.toggleForm(this.particles);
    if (shiftRes && shiftRes.isCataclysm) {
      for (const en of this.enemies) {
        if (en.isDead) continue;
        if (Math.hypot(en.x - shiftRes.x, en.y - shiftRes.y) < shiftRes.radius) {
          en.takeDamage(shiftRes.damage, true, 1.5, this.particles);
          en.stun(2.0, this.particles);
        }
      }
      if (this.boss.isActive && !this.boss.isDead && Math.hypot(this.boss.x - shiftRes.x, this.boss.y - shiftRes.y) < shiftRes.radius) {
        this.boss.takeDamage(shiftRes.damage, true, 1.5, this.particles);
      }
    }
  }

  setupEventListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.inputState.keys[e.code] = true;
      audio.init();

      if (this.state === GAME_STATES.EXPEDITION) {
        // Space or Tab: Form Switch
        if (e.code === 'Space' || e.code === 'Tab') {
          e.preventDefault();
          this.triggerFormShift();
        }

        // Q: Skill 1
        if (e.code === 'KeyQ') {
          const res = this.player.triggerSkillQ(this.inputState.mouse.worldX, this.inputState.mouse.worldY, this.particles);
          if (res) {
            if (res.skill === 'solar_flare') {
              this.hitLineEnemies(res.x, res.y, res.angle, res.length, res.width, res.damage, res.critRate, res.critMult);
            } else if (res.skill === 'shadow_blink') {
              this.hitLineEnemies(res.startX, res.startY, Math.atan2(res.endY - res.startY, res.endX - res.startX), 180, 50, res.damage, res.critRate, res.critMult);
            }
          }
        }

        // E: Skill 2
        if (e.code === 'KeyE') {
          const res = this.player.triggerSkillE(this.inputState.mouse.worldX, this.inputState.mouse.worldY, this.particles);
          if (res && res.skill === 'umbral_vortex') {
            let totalDmg = 0;
            for (const en of this.enemies) {
              if (en.isDead) continue;
              if (Math.hypot(en.x - res.x, en.y - res.y) < res.radius) {
                en.takeDamage(res.damage, Math.random() < res.critRate, res.critMult, this.particles);
                totalDmg += res.damage;
              }
            }
            if (this.boss.isActive && !this.boss.isDead && Math.hypot(this.boss.x - res.x, this.boss.y - res.y) < res.radius) {
              this.boss.takeDamage(res.damage, Math.random() < res.critRate, res.critMult, this.particles);
              totalDmg += res.damage;
            }
            if (totalDmg > 0) {
              const heal = Math.round(totalDmg * res.lifestealRate);
              this.player.heal(heal, this.particles);
            }
          }
        }

        // R: Ultimate
        if (e.code === 'KeyR') {
          const res = this.player.triggerSkillR(this.inputState.mouse.worldX, this.inputState.mouse.worldY, this.particles);
          if (res) {
            if (res.skill === 'dawnbreaker_judgment') {
              this.hitLineEnemies(res.x, res.y, res.angle, res.length, res.width, res.damage, res.critRate, res.critMult);
            } else if (res.skill === 'eclipse_execution') {
              // Hits all nearby
              for (const en of this.enemies) {
                if (en.isDead) continue;
                if (Math.hypot(en.x - res.x, en.y - res.y) < res.radius) {
                  en.takeDamage(res.damage * 4, true, res.critMult, this.particles);
                }
              }
              if (this.boss.isActive && !this.boss.isDead && Math.hypot(this.boss.x - res.x, this.boss.y - res.y) < res.radius) {
                this.boss.takeDamage(res.damage * 4, true, res.critMult, this.particles);
              }
            }
          }
        }

        // F: Interact / Companion Skill
        if (e.code === 'KeyF') {
          const interactRes = this.dungeon.interactClosest(this.player, this.particles);
          if (!interactRes) {
            // Trigger Companion Active Skill
            this.companion.triggerActiveSkill(this.player, this.dungeon, this.particles);
          }
        }

        // 1: Quick Item (Lumen Oil Flask)
        if (e.code === 'Digit1') {
          if (this.citadel.lumenOil >= 10) {
            this.citadel.lumenOil -= 10;
            this.player.lanternFuel = Math.min(this.player.maxLanternFuel, this.player.lanternFuel + 30);
            this.particles.addFloatingText(this.player.x, this.player.y, '+30 提燈燃油', 'heal');
            audio.playLootPickup();
          }
        }

        // 2: Quick Item (Ration Meal)
        if (e.code === 'Digit2') {
          if (this.citadel.rations >= 10) {
            this.citadel.rations -= 10;
            this.player.heal(300, this.particles);
            audio.playLootPickup();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.inputState.keys[e.code] = false;
    });

    // Mouse
    window.addEventListener('mousemove', (e) => {
      this.inputState.mouse.x = e.clientX;
      this.inputState.mouse.y = e.clientY;
      this.inputState.mouse.worldX = e.clientX + this.cameraX;
      this.inputState.mouse.worldY = e.clientY + this.cameraY;
    });

    window.addEventListener('mousedown', (e) => {
      audio.init();
      if (e.button === 0) {
        this.inputState.mouse.isDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.inputState.mouse.rightDown = true;
        // Right click: Dodge roll
        if (this.state === GAME_STATES.EXPEDITION) {
          const angle = Math.atan2(
            this.inputState.mouse.worldY - this.player.y,
            this.inputState.mouse.worldX - this.player.x
          );
          this.player.dodge(angle, this.particles);
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.inputState.mouse.isDown = false;
      } else if (e.button === 2) {
        this.inputState.mouse.rightDown = false;
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setupUIHandlers() {
    // Form Switch on Click
    document.getElementById('hud-form-ring')?.addEventListener('click', () => {
      if (this.state === GAME_STATES.EXPEDITION) {
        this.triggerFormShift();
      }
    });

    document.querySelector('.form-switch-btn')?.addEventListener('click', () => {
      if (this.state === GAME_STATES.EXPEDITION) {
        this.triggerFormShift();
      }
    });

    // Skill Slots on Click
    document.getElementById('slot-q')?.addEventListener('click', () => {
      if (this.state === GAME_STATES.EXPEDITION) {
        const res = this.player.triggerSkillQ(this.inputState.mouse.worldX, this.inputState.mouse.worldY, this.particles);
        if (res) {
          if (res.skill === 'solar_flare') {
            this.hitLineEnemies(res.x, res.y, res.angle, res.length, res.width, res.damage, res.critRate, res.critMult);
          } else if (res.skill === 'shadow_blink') {
            this.hitLineEnemies(res.startX, res.startY, Math.atan2(res.endY - res.startY, res.endX - res.startX), 180, 50, res.damage, res.critRate, res.critMult);
          }
        }
      }
    });

    document.getElementById('slot-e')?.addEventListener('click', () => {
      if (this.state === GAME_STATES.EXPEDITION) {
        const res = this.player.triggerSkillE(this.inputState.mouse.worldX, this.inputState.mouse.worldY, this.particles);
        if (res && res.skill === 'umbral_vortex') {
          let totalDmg = 0;
          for (const en of this.enemies) {
            if (en.isDead) continue;
            if (Math.hypot(en.x - res.x, en.y - res.y) < res.radius) {
              en.takeDamage(res.damage, Math.random() < res.critRate, res.critMult, this.particles);
              totalDmg += res.damage;
            }
          }
          if (this.boss.isActive && !this.boss.isDead && Math.hypot(this.boss.x - res.x, this.boss.y - res.y) < res.radius) {
            this.boss.takeDamage(res.damage, Math.random() < res.critRate, res.critMult, this.particles);
            totalDmg += res.damage;
          }
          if (totalDmg > 0) {
            const heal = Math.round(totalDmg * res.lifestealRate);
            this.player.heal(heal, this.particles);
          }
        }
      }
    });

    document.getElementById('slot-r')?.addEventListener('click', () => {
      if (this.state === GAME_STATES.EXPEDITION) {
        const res = this.player.triggerSkillR(this.inputState.mouse.worldX, this.inputState.mouse.worldY, this.particles);
        if (res) {
          if (res.skill === 'dawnbreaker_judgment') {
            this.hitLineEnemies(res.x, res.y, res.angle, res.length, res.width, res.damage, res.critRate, res.critMult);
          } else if (res.skill === 'eclipse_execution') {
            for (const en of this.enemies) {
              if (en.isDead) continue;
              if (Math.hypot(en.x - res.x, en.y - res.y) < res.radius) {
                en.takeDamage(res.damage * 4, true, res.critMult, this.particles);
              }
            }
            if (this.boss.isActive && !this.boss.isDead && Math.hypot(this.boss.x - res.x, this.boss.y - res.y) < res.radius) {
              this.boss.takeDamage(res.damage * 4, true, res.critMult, this.particles);
            }
          }
        }
      }
    });

    // Quick Item Clicks
    document.getElementById('item-lumen-flask')?.addEventListener('click', () => {
      if (this.citadel.lumenOil >= 10) {
        this.citadel.lumenOil -= 10;
        this.player.lanternFuel = Math.min(this.player.maxLanternFuel, this.player.lanternFuel + 30);
        this.particles.addFloatingText(this.player.x, this.player.y, '+30 提燈燃油', 'heal');
        audio.playLootPickup();
      } else {
        this.showToast('堡壘流明聖油不足！', 'toast-crimson');
      }
    });

    document.getElementById('item-ration-meal')?.addEventListener('click', () => {
      if (this.citadel.rations >= 10) {
        this.citadel.rations -= 10;
        this.player.heal(300, this.particles);
        audio.playLootPickup();
      } else {
        this.showToast('堡壘口糧不足！', 'toast-crimson');
      }
    });

    // Utility Bar
    document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
      const isMuted = audio.toggleMute();
      const icon = document.getElementById('btn-sound-toggle');
      if (icon) icon.innerText = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('btn-citadel-modal')?.addEventListener('click', () => {
      this.openModal('modal-citadel');
      this.updateCitadelModal();
    });

    document.getElementById('btn-forge-modal')?.addEventListener('click', () => {
      this.openModal('modal-forge');
      this.updateForgeModal();
    });

    document.getElementById('btn-arsenal-modal')?.addEventListener('click', () => {
      this.openModal('modal-arsenal');
      this.updateArsenalModal();
    });

    document.getElementById('btn-companion-modal')?.addEventListener('click', () => {
      this.openModal('modal-companion');
      this.updateCompanionModal();
    });

    // Close buttons for modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
        SaveSystem.save(this.player, this.companion, this.citadel, this.arsenal);
      });
    });

    // Start Expedition Button in Citadel
    document.getElementById('btn-start-expedition')?.addEventListener('click', () => {
      this.startExpedition();
    });

    // Forge Pull 1x & 10x
    document.getElementById('btn-forge-pull-1')?.addEventListener('click', () => {
      const res = this.forge.pullOnce(this.citadel, this.player);
      if (!res.success) {
        this.showToast(res.reason, 'toast-crimson');
      } else {
        this.showGachaResults([res.item]);
        this.updateForgeModal();
      }
    });

    document.getElementById('btn-forge-pull-10')?.addEventListener('click', () => {
      const res = this.forge.pullTen(this.citadel, this.player);
      if (!res.success) {
        this.showToast(res.reason, 'toast-crimson');
      } else {
        this.showGachaResults(res.results);
        this.updateForgeModal();
      }
    });

    document.getElementById('btn-close-gacha-stage')?.addEventListener('click', () => {
      document.getElementById('gacha-result-stage').classList.remove('active');
    });

    // Arsenal Upgrade & Refine Buttons
    document.getElementById('btn-upgrade-weapon')?.addEventListener('click', () => {
      const res = this.arsenal.upgradeWeapon(this.player, this.citadel);
      if (!res.success) {
        this.showToast(res.reason, 'toast-crimson');
      } else {
        this.showToast(`武器升級至 Lv.${res.newLevel}！攻擊力提升至 ${res.newDamage}`, 'toast-cyan');
        this.updateArsenalModal();
      }
    });

    document.getElementById('btn-refine-weapon')?.addEventListener('click', () => {
      const res = this.arsenal.refineWeapon(this.player, this.citadel);
      if (!res.success) {
        this.showToast(res.reason, 'toast-crimson');
      } else {
        this.showToast(`武器精煉至 階級 ${res.newRefinement}！攻擊力與被動大幅提升！`, 'toast-gold');
        this.updateArsenalModal();
      }
    });

    // Victory / Defeat Return Buttons
    document.getElementById('btn-return-citadel')?.addEventListener('click', () => {
      document.getElementById('expedition-outcome-modal').classList.remove('active');
      this.state = GAME_STATES.HUB;
      audio.setMusicTrack('citadel');
      this.openModal('modal-citadel');
      this.updateCitadelModal();
      SaveSystem.save(this.player, this.companion, this.citadel, this.arsenal);
    });
  }

  openModal(modalId) {
    this.closeAllModals();
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
  }

  showToast(message, typeClass = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${typeClass}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  // --- Modal Update Handlers ---

  updateCitadelModal() {
    document.getElementById('res-rations').innerText = this.citadel.rations;
    document.getElementById('res-iron').innerText = this.citadel.blackIron;
    document.getElementById('res-oil').innerText = this.citadel.lumenOil;
    document.getElementById('res-morale').innerText = `${this.citadel.morale}%`;
    document.getElementById('res-survivors').innerText = this.citadel.survivors;
    document.getElementById('res-shards').innerText = this.citadel.starlightShards;
    document.getElementById('res-tickets').innerText = this.citadel.forgeTickets;

    // Render Moral Dilemma
    const dilemma = this.citadel.getCurrentDilemma();
    const dilemmaContainer = document.getElementById('dilemma-display-container');

    if (!dilemma) {
      dilemmaContainer.innerHTML = `
        <div class="dilemma-card" style="border-color: var(--gold-dim);">
          <div class="dilemma-title" style="color: var(--gold-radiant);">✨ 堡壘當前政務安寧</div>
          <div class="dilemma-desc">目前防線內無突發緊急事件，請勇者繼續帶隊深入禁區探索物資與淨化魔物！</div>
        </div>
      `;
    } else {
      dilemmaContainer.innerHTML = `
        <div class="dilemma-card">
          <div class="dilemma-badge">${dilemma.badge}</div>
          <div class="dilemma-title">${dilemma.title}</div>
          <div class="dilemma-desc">${dilemma.desc}</div>
          <div class="dilemma-options">
            ${dilemma.options.map((opt, idx) => `
              <div class="dilemma-option-btn" data-opt-index="${idx}">
                <div>
                  <div style="font-weight: 600;">${opt.text}</div>
                  <div class="dilemma-outcome-hint">${opt.hint}</div>
                </div>
                <div style="font-size: 1.2rem;">⚖️</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      dilemmaContainer.querySelectorAll('.dilemma-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(btn.getAttribute('data-opt-index'), 10);
          const outcome = this.citadel.chooseDilemmaOption(idx);
          if (outcome) {
            this.showToast(outcome.resultText, 'toast-purple');
            this.updateCitadelModal();
          }
        });
      });
    }
  }

  updateForgeModal() {
    document.getElementById('forge-pity-display').innerText = `距離 SSR 保底還有 ${this.forge.hardPity - this.forge.pityCount} 抽`;
    document.getElementById('forge-ticket-display').innerText = `剩餘鍛造券: ${this.citadel.forgeTickets} | 星光碎屑: ${this.citadel.starlightShards}`;
  }

  showGachaResults(items) {
    const stage = document.getElementById('gacha-result-stage');
    const grid = document.getElementById('gacha-cards-container');
    grid.innerHTML = '';

    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `gacha-card ${item.rarity.toLowerCase()}`;
      card.style.animationDelay = `${idx * 0.08}s`;

      card.innerHTML = `
        <div class="gacha-card-rarity">${item.rarity}</div>
        <div class="gacha-card-icon">${item.icon}</div>
        <div class="gacha-card-name">${item.name}</div>
      `;

      grid.appendChild(card);
    });

    stage.classList.add('active');
  }

  updateArsenalModal() {
    const sidebar = document.getElementById('arsenal-weapon-list');
    sidebar.innerHTML = '';

    this.arsenal.weapons.forEach(w => {
      const isEquipped = this.player.equippedWeapon.id === w.id;
      const isSelected = this.arsenal.selectedWeapon.id === w.id;

      const card = document.createElement('div');
      card.className = `weapon-select-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div class="weapon-icon-box">${w.icon}</div>
        <div class="weapon-details">
          <div class="weapon-name-title">${w.name} ${isEquipped ? '【已裝備】' : ''}</div>
          <div class="weapon-type-text">${w.rarity} · 基礎攻擊 ${w.baseDamage}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.arsenal.selectedWeapon = w;
        this.player.equippedWeapon = w;
        this.updateArsenalModal();
      });

      sidebar.appendChild(card);
    });

    // Detail Panel
    const curW = this.arsenal.selectedWeapon;
    document.getElementById('arsenal-weapon-title').innerText = `${curW.name} (Lv.${this.player.weaponLevel} · 精煉 ${this.player.refinementLevel}階)`;
    document.getElementById('arsenal-weapon-desc').innerText = curW.description;
    document.getElementById('arsenal-weapon-passive').innerText = curW.passive || '無特殊被動';
    document.getElementById('arsenal-weapon-atk').innerText = `攻擊力: ${this.player.getAttackDamage()}`;

    // Talent Resonance Tree
    const treeContainer = document.getElementById('talent-tree-container');
    treeContainer.innerHTML = '';

    TALENT_TREE_DATA.forEach(t => {
      const isUnlocked = this.player.unlockedTalents.has(t.id);
      const node = document.createElement('div');
      node.className = `talent-node ${isUnlocked ? 'unlocked' : ''}`;

      node.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="talent-node-title">${t.icon} ${t.name}</div>
          <div style="font-size:0.75rem; color:var(--gold-radiant);">${isUnlocked ? '✅ 已解鎖' : `✨ ${t.cost} 碎屑`}</div>
        </div>
        <div class="talent-node-desc">${t.desc}</div>
      `;

      if (!isUnlocked) {
        node.addEventListener('click', () => {
          const res = this.arsenal.unlockTalent(t.id, this.player, this.citadel);
          if (!res.success) {
            this.showToast(res.reason, 'toast-crimson');
          } else {
            this.showToast(`成功解鎖天賦：${t.name}！`, 'toast-gold');
            this.updateArsenalModal();
          }
        });
      }

      treeContainer.appendChild(node);
    });
  }

  updateCompanionModal() {
    const list = document.getElementById('companion-select-list');
    list.innerHTML = '';

    COMPANION_CLASSES.forEach(c => {
      const isSelected = this.companion.data.id === c.id;
      const card = document.createElement('div');
      card.className = `weapon-select-card ${isSelected ? 'active' : ''}`;

      card.innerHTML = `
        <div class="weapon-icon-box">${c.icon}</div>
        <div class="weapon-details">
          <div class="weapon-name-title" style="color: ${c.color};">${c.name} ${isSelected ? '【出戰中】' : ''}</div>
          <div class="weapon-type-text">${c.role} · 生命 ${c.baseHp}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.companion.setCompanionClass(c);
        this.updateCompanionModal();
        this.updateHUD();
      });

      list.appendChild(card);
    });

    const activeC = this.companion.data;
    document.getElementById('companion-detail-title').innerText = activeC.name;
    document.getElementById('companion-detail-desc').innerText = activeC.description;
    document.getElementById('companion-active-skill').innerText = `主動技能 [F]: ${activeC.activeSkillName}`;
    document.getElementById('companion-dialogue').innerText = activeC.dialogues[Math.floor(Math.random() * activeC.dialogues.length)];
  }

  // --- Hitbox Check for Linear AoE (Beams / Slashes) ---
  hitLineEnemies(startX, startY, angle, length, width, damage, critRate, critMult) {
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;

    for (const en of this.enemies) {
      if (en.isDead) continue;
      const dist = this.distToSegment(en.x, en.y, startX, startY, endX, endY);
      if (dist <= width / 2 + en.radius) {
        en.takeDamage(damage, Math.random() < critRate, critMult, this.particles);
      }
    }

    if (this.boss.isActive && !this.boss.isDead) {
      const dist = this.distToSegment(this.boss.x, this.boss.y, startX, startY, endX, endY);
      if (dist <= width / 2 + this.boss.radius) {
        this.boss.takeDamage(damage, Math.random() < critRate, critMult, this.particles);
      }
    }
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  // --- Update Loop ---
  update(dt) {
    if (this.state !== GAME_STATES.EXPEDITION) return;

    // 1. Update Lighting Light Sources
    this.lighting.clearLights();

    // Player Lantern Light
    this.lighting.addLight(
      this.player.x,
      this.player.y,
      this.player.getLightRadius(),
      this.player.form === FORMS.RADIANT ? '#ffd700' : '#c084fc',
      1.0,
      true
    );

    // Braziers Light
    for (const b of this.dungeon.braziers) {
      if (b.isLit) {
        this.lighting.addLight(b.x, b.y, b.lightRadius, '#ff9900', 0.9, true);
      }
    }

    this.lighting.update(dt);

    // 2. Player Update & Attacks
    this.player.facingAngle = Math.atan2(
      this.inputState.mouse.worldY - this.player.y,
      this.inputState.mouse.worldX - this.player.x
    );

    // Continuous attack on mouse hold
    if (this.inputState.mouse.isDown) {
      const atkRes = this.player.triggerBasicAttack(
        this.inputState.mouse.worldX,
        this.inputState.mouse.worldY,
        this.particles
      );

      if (atkRes && atkRes.type === 'melee') {
        this.performMeleeAttack(atkRes);
      }
    }

    this.player.update(dt, this.inputState, this.lighting, this.particles);

    // Check Player Death -> Defeat
    if (this.player.isDead) {
      this.triggerExpeditionOutcome(false);
      return;
    }

    // 3. Companion Update
    this.companion.update(dt, this.player, this.enemies, this.boss, this.dungeon, this.particles);

    // 4. Boss Trigger & Update
    if (!this.boss.isActive && this.player.x > 1300 && this.player.y > 800) {
      this.boss.isActive = true;
      audio.setMusicTrack('boss');
      audio.playBossRoar();
      this.showToast('首領降臨：噬骨魔靈·迦魯卡！', 'toast-crimson');
    }

    if (this.boss.isActive) {
      // Phase 2: Extinguish braziers
      if (this.boss.phase === 2 && this.boss.isShielded) {
        if (this.dungeon.areAllBossBraziersLit()) {
          // Break Shield & Stun Boss!
          this.boss.breakShieldAndStun(6.0, this.particles);
        }
      }

      this.boss.update(dt, this.player, this.dungeon, this.particles, this.enemyProjectiles);

      // Check Boss Death -> Victory
      if (this.boss.isDead) {
        this.triggerExpeditionOutcome(true);
        return;
      }
    }

    // 5. Enemies Update
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      en.update(dt, this.player, this.lighting, this.particles, this.enemyProjectiles);

      if (en.isDead) {
        this.runKills++;
        // Spawn loot drops
        this.dungeon.lootDrops.push(new LootDrop(en.x, en.y, 'iron', Math.floor(Math.random() * 8 + 4)));
        if (Math.random() < 0.6) {
          this.dungeon.lootDrops.push(new LootDrop(en.x, en.y, 'oil', 1));
        }
        if (Math.random() < 0.4) {
          this.dungeon.lootDrops.push(new LootDrop(en.x, en.y, 'shards', Math.floor(Math.random() * 6 + 3)));
        }
        this.enemies.splice(i, 1);
      }
    }

    // 6. Enemy Projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.traveled += Math.hypot(p.vx * dt, p.vy * dt);

      if (Math.hypot(this.player.x - p.x, this.player.y - p.y) < this.player.radius + p.radius) {
        this.player.takeDamage(p.damage, this.particles);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (p.traveled >= p.range) {
        this.enemyProjectiles.splice(i, 1);
      }
    }

    // 7. Player Projectiles Collision
    for (let i = this.player.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.player.activeProjectiles[i];
      let hit = false;

      for (const en of this.enemies) {
        if (en.isDead) continue;
        if (Math.hypot(en.x - p.x, en.y - p.y) < en.radius + 10) {
          en.takeDamage(p.damage, Math.random() < p.critRate, p.critMult, this.particles);
          hit = true;
          break;
        }
      }

      if (!hit && this.boss.isActive && !this.boss.isDead) {
        if (Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < this.boss.radius + 10) {
          this.boss.takeDamage(p.damage, Math.random() < p.critRate, p.critMult, this.particles);
          hit = true;
        }
      }

      if (hit) {
        this.player.activeProjectiles.splice(i, 1);
      }
    }

    // 8. Loot Collection
    const collected = this.dungeon.updateLootCollection(this.player, this.companion, this.particles);
    if (collected.iron > 0) this.runLoot.blackIron += collected.iron;
    if (collected.rations > 0) this.runLoot.rations += collected.rations;
    if (collected.shards > 0) this.runLoot.starlightShards += collected.shards;

    // 9. Particles & Screen Shake
    this.particles.update(dt);

    // 10. Smooth Camera Follow
    const targetCamX = this.player.x - this.canvas.width / 2;
    const targetCamY = this.player.y - this.canvas.height / 2;
    this.cameraX += (targetCamX - this.cameraX) * 0.1;
    this.cameraY += (targetCamY - this.cameraY) * 0.1;

    // Update HUD
    this.updateHUD();
  }

  performMeleeAttack(atkData) {
    const isBackstabBonus = this.player.equippedWeapon.id === 'ssr_eclipse_fangs' && this.player.form === FORMS.SHADOW;

    for (const en of this.enemies) {
      if (en.isDead) continue;
      const dx = en.x - atkData.x;
      const dy = en.y - atkData.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= atkData.range + en.radius) {
        const angleToTarget = Math.atan2(dy, dx);
        let angleDiff = Math.abs(angleToTarget - atkData.angle);
        while (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

        if (angleDiff <= atkData.arc / 2) {
          const isCrit = Math.random() < atkData.critRate;
          en.takeDamage(atkData.damage, isCrit, atkData.critMult, this.particles);

          if (isBackstabBonus) {
            this.player.shadowEnergy = Math.min(this.player.maxEnergy, this.player.shadowEnergy + 10);
          }
        }
      }
    }

    if (this.boss.isActive && !this.boss.isDead) {
      const dx = this.boss.x - atkData.x;
      const dy = this.boss.y - atkData.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= atkData.range + this.boss.radius) {
        const angleToTarget = Math.atan2(dy, dx);
        let angleDiff = Math.abs(angleToTarget - atkData.angle);
        while (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

        if (angleDiff <= atkData.arc / 2) {
          const isCrit = Math.random() < atkData.critRate;
          this.boss.takeDamage(atkData.damage, isCrit, atkData.critMult, this.particles);
        }
      }
    }
  }

  triggerExpeditionOutcome(isVictory) {
    this.state = isVictory ? GAME_STATES.VICTORY : GAME_STATES.DEFEAT;
    const modal = document.getElementById('expedition-outcome-modal');
    const title = document.getElementById('outcome-title');
    const box = modal.querySelector('.outcome-box');

    if (isVictory) {
      title.innerText = '⚔️ 遠征大捷：深淵肅清！';
      box.classList.remove('defeat');
      this.runLoot.blackIron += 150;
      this.runLoot.starlightShards += 80;
      this.citadel.forgeTickets += 2;
    } else {
      title.innerText = '💀 提燈熄滅：遠征潰敗...';
      box.classList.add('defeat');
    }

    // Apply Loot to Citadel
    this.citadel.applyExpeditionLoot(this.runLoot);

    document.getElementById('outcome-loot-display').innerHTML = `
      <div class="loot-reward-item">⛓️ 黑鐵 +${this.runLoot.blackIron}</div>
      <div class="loot-reward-item">🍞 糧草 +${this.runLoot.rations}</div>
      <div class="loot-reward-item">✨ 星光碎屑 +${this.runLoot.starlightShards}</div>
      <div class="loot-reward-item">💀 討伐魔物: ${this.runKills} 隻</div>
    `;

    modal.classList.add('active');
  }

  updateHUD() {
    // 1. Health Bar
    const hpFill = document.getElementById('hud-hp-fill');
    const hpVal = document.getElementById('hud-hp-val');
    const maxHp = this.player.getMaxHp();
    if (hpFill) hpFill.style.width = `${Math.max(0, (this.player.hp / maxHp) * 100)}%`;
    if (hpVal) hpVal.innerText = `${Math.max(0, Math.round(this.player.hp))} / ${maxHp}`;

    // 2. Dual Form Energy
    const energyFill = document.getElementById('hud-energy-fill');
    const energyVal = document.getElementById('hud-energy-val');
    const curEnergy = this.player.form === FORMS.RADIANT ? this.player.radiantEnergy : this.player.shadowEnergy;
    if (energyFill) {
      energyFill.style.width = `${curEnergy}%`;
      if (this.player.form === FORMS.SHADOW) {
        energyFill.classList.add('shadow-mode');
      } else {
        energyFill.classList.remove('shadow-mode');
      }
    }
    if (energyVal) energyVal.innerText = `${Math.round(curEnergy)} / 100`;

    // 3. Lantern Fuel
    const lanternFill = document.getElementById('hud-lantern-fill');
    const lanternVal = document.getElementById('hud-lantern-val');
    if (lanternFill) lanternFill.style.width = `${this.player.lanternFuel}%`;
    if (lanternVal) lanternVal.innerText = `${Math.round(this.player.lanternFuel)}%`;

    // 4. Form Portrait & Peak Shift
    const formRing = document.getElementById('hud-form-ring');
    const formIcon = document.getElementById('hud-form-icon');
    const isPeak = curEnergy >= 100;

    if (formRing) {
      if (this.player.form === FORMS.SHADOW) {
        formRing.classList.add('shadow-active');
      } else {
        formRing.classList.remove('shadow-active');
      }
      if (isPeak) {
        formRing.classList.add('peak-shift-ready');
      } else {
        formRing.classList.remove('peak-shift-ready');
      }
    }
    if (formIcon) {
      formIcon.innerText = this.player.form === FORMS.RADIANT ? '☀️' : '🌑';
    }

    // 5. Zone Badge
    const zoneDot = document.getElementById('hud-zone-dot');
    const zoneText = document.getElementById('hud-zone-text');
    const zoneBuff = document.getElementById('hud-zone-buff');

    if (this.player.isInLightZone) {
      if (zoneDot) zoneDot.classList.remove('in-darkness');
      if (zoneText) zoneText.innerText = '光明領域 (Safe Light Zone)';
      if (zoneBuff) {
        zoneBuff.classList.remove('dark-buff');
        zoneBuff.innerText = '🛡️ 提燈燃油消耗減緩';
      }
    } else {
      if (zoneDot) zoneDot.classList.add('in-darkness');
      if (zoneText) zoneText.innerText = '暗影深淵 (Hazardous Dark Zone)';
      if (zoneBuff) {
        zoneBuff.classList.add('dark-buff');
        zoneBuff.innerText = '⚡ 黯影暴擊率 +40% | 怪物狂暴';
      }
    }

    // 6. Boss Bar
    const bossContainer = document.getElementById('boss-health-container');
    if (this.boss.isActive && !this.boss.isDead) {
      bossContainer.style.display = 'flex';
      const bossFill = document.getElementById('boss-hp-fill');
      const bossShield = document.getElementById('boss-shield-fill');
      const bossHint = document.getElementById('boss-mechanic-text');

      if (bossFill) bossFill.style.width = `${(this.boss.hp / this.boss.maxHp) * 100}%`;
      if (bossShield) bossShield.style.display = this.boss.isShielded ? 'block' : 'none';

      if (this.boss.isShielded) {
        bossHint.innerText = '⚠️ 首領處於暗影狂暴護盾！請點燃 3 座神聖火盆破盾！';
      } else if (this.boss.stunTimer > 0) {
        bossHint.innerText = '💥 神聖領域生效！首領防禦崩解，全力爆發輸出！';
      } else {
        bossHint.innerText = `階段 ${this.boss.phase}：小心地面爆發的骨刺與深淵風暴！`;
      }
    } else {
      bossContainer.style.display = 'none';
    }

    // 7. Skill Cooldown Slots
    const qSlot = document.getElementById('slot-q');
    const eSlot = document.getElementById('slot-e');
    const rSlot = document.getElementById('slot-r');

    this.updateSlotCd(qSlot, this.player.skillQCooldown);
    this.updateSlotCd(eSlot, this.player.skillECooldown);
    this.updateSlotCd(rSlot, this.player.skillRCooldown);

    // Companion HUD
    document.getElementById('hud-comp-name').innerText = this.companion.data.name.split('·')[0];
    document.getElementById('hud-comp-skill').innerText = `[F] ${this.companion.data.activeSkillName}`;
  }

  updateSlotCd(slotElem, cd) {
    if (!slotElem) return;
    const overlay = slotElem.querySelector('.skill-cooldown-overlay');
    if (cd > 0) {
      slotElem.classList.add('on-cooldown');
      if (overlay) overlay.innerText = cd.toFixed(1);
    } else {
      slotElem.classList.remove('on-cooldown');
    }
  }

  // --- Render Loop ---
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const renderCamX = this.cameraX + this.particles.shakeOffsetX;
    const renderCamY = this.cameraY + this.particles.shakeOffsetY;

    // 1. Draw World & Dungeon
    this.dungeon.render(this.ctx, renderCamX, renderCamY, this.canvas.width, this.canvas.height);

    // 2. Draw Enemies
    for (const en of this.enemies) {
      en.render(this.ctx, renderCamX, renderCamY);
    }

    // 3. Draw Enemy Projectiles
    for (const p of this.enemyProjectiles) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(p.x - renderCamX, p.y - renderCamY, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      this.ctx.restore();
    }

    // 4. Draw Boss
    this.boss.render(this.ctx, renderCamX, renderCamY);

    // 5. Draw Companion
    this.companion.render(this.ctx, renderCamX, renderCamY);

    // 6. Draw Player
    this.player.render(this.ctx, renderCamX, renderCamY);

    // 7. Render Particles & Floating Combat Text (Pre-Lighting)
    this.particles.render(this.ctx, renderCamX, renderCamY);

    // 8. Overlay Dynamic Chiaroscuro Darkness & Lighting
    this.lighting.render(this.ctx, renderCamX, renderCamY, this.canvas.width, this.canvas.height);
  }

  gameLoop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Start Game on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  const game = new EvernightGame();
  game.init();
});
