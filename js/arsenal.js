/**
 * EVERNIGHT OATH: DAWN CHRONICLES (永夜之誓：破曉紀錄)
 * Arsenal Sanctum: Weapon Upgrades, Refinements, and Talent Resonance Tree
 */

import { WEAPON_CATALOG, TALENT_TREE_DATA } from './weapons.js';
import { audio } from './audio.js';

export class ArsenalSanctum {
  constructor() {
    this.weapons = [...WEAPON_CATALOG];
    this.selectedWeapon = this.weapons[0];
  }

  upgradeWeapon(player, citadel) {
    const costIron = this.selectedWeapon.rarity === 'SSR' ? 40 : 25;
    if (citadel.blackIron < costIron) {
      return { success: false, reason: `黑鐵不足！需要 ${costIron} 黑鐵。` };
    }

    citadel.blackIron -= costIron;
    player.weaponLevel += 1;
    audio.playBrazierIgnite();

    return {
      success: true,
      newLevel: player.weaponLevel,
      newDamage: player.getAttackDamage()
    };
  }

  refineWeapon(player, citadel) {
    if (player.refinementLevel >= 5) {
      return { success: false, reason: '該武器已達到最高精煉階級 (階級 5)！' };
    }

    const costIron = 80 + player.refinementLevel * 30;
    const costShards = 40 + player.refinementLevel * 20;

    if (citadel.blackIron < costIron || citadel.starlightShards < costShards) {
      return { success: false, reason: `材料不足！需要 ${costIron} 黑鐵與 ${costShards} 星光碎屑。` };
    }

    citadel.blackIron -= costIron;
    citadel.starlightShards -= costShards;
    player.refinementLevel += 1;
    audio.playGachaRevealSSR();

    return {
      success: true,
      newRefinement: player.refinementLevel,
      newDamage: player.getAttackDamage()
    };
  }

  unlockTalent(talentId, player, citadel) {
    const talent = TALENT_TREE_DATA.find(t => t.id === talentId);
    if (!talent) return { success: false, reason: '天賦不存在' };

    if (player.unlockedTalents.has(talentId)) {
      return { success: false, reason: '該天賦已解鎖！' };
    }

    if (citadel.starlightShards < talent.cost) {
      return { success: false, reason: `星光碎屑不足！需要 ${talent.cost} 碎屑。` };
    }

    citadel.starlightShards -= talent.cost;
    player.unlockedTalents.add(talentId);
    audio.playRadiantSkill();

    return {
      success: true,
      talent
    };
  }
}
