/**
 * EVERNIGHT OATH: DAWN CHRONICLES (永夜之誓：破曉紀錄)
 * LocalStorage Save / Load Management
 */

const STORAGE_KEY = 'evernight_oath_save_v1';

export class SaveSystem {
  static save(player, companion, citadel, arsenal) {
    try {
      const data = {
        player: {
          weaponId: player.equippedWeapon.id,
          weaponLevel: player.weaponLevel,
          refinementLevel: player.refinementLevel,
          unlockedTalents: Array.from(player.unlockedTalents)
        },
        companion: {
          classId: companion.data.id,
          level: companion.level,
          bondLevel: companion.bondLevel
        },
        citadel: {
          rations: citadel.rations,
          blackIron: citadel.blackIron,
          lumenOil: citadel.lumenOil,
          morale: citadel.morale,
          survivors: citadel.survivors,
          starlightShards: citadel.starlightShards,
          forgeTickets: citadel.forgeTickets,
          currentDilemmaIndex: citadel.currentDilemmaIndex
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  static load(player, companion, citadel, arsenal) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);

      if (data.player) {
        player.weaponLevel = data.player.weaponLevel || 1;
        player.refinementLevel = data.player.refinementLevel || 0;
        if (data.player.unlockedTalents) {
          player.unlockedTalents = new Set(data.player.unlockedTalents);
        }
        if (data.player.weaponId && arsenal) {
          const w = arsenal.weapons.find(x => x.id === data.player.weaponId);
          if (w) {
            player.equippedWeapon = w;
            arsenal.selectedWeapon = w;
          }
        }
      }

      if (data.citadel) {
        citadel.rations = data.citadel.rations ?? 150;
        citadel.blackIron = data.citadel.blackIron ?? 120;
        citadel.lumenOil = data.citadel.lumenOil ?? 100;
        citadel.morale = data.citadel.morale ?? 85;
        citadel.survivors = data.citadel.survivors ?? 180;
        citadel.starlightShards = data.citadel.starlightShards ?? 120;
        citadel.forgeTickets = data.citadel.forgeTickets ?? 15;
        citadel.currentDilemmaIndex = data.citadel.currentDilemmaIndex ?? 0;
      }

      return true;
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
      return false;
    }
  }
}
