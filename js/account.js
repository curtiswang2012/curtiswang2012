/**
 * EVERNIGHT OATH: DAWN CHRONICLES (永夜之誓：破曉紀錄)
 * Account Sanctum: Secure Authentication, Session Management, and Multi-Hero Profiles
 */

const ACCOUNTS_DB_KEY = 'evernight_accounts_db_v1';
const ACTIVE_SESSION_KEY = 'evernight_active_session_v1';

export const AVATAR_PRESETS = [
  { id: 'sun_knight', icon: '☀️', name: '太陽聖誓騎士', color: '#ffd700', role: '光輝近衛' },
  { id: 'shadow_assassin', icon: '🌑', name: '暗影逐夜刺客', color: '#c084fc', role: '暗影刺殺' },
  { id: 'aurora_vanguard', icon: '🔱', name: '極光破曉先鋒', color: '#38bdf8', role: '神聖貫通' },
  { id: 'abyss_walker', icon: '🔨', name: '深淵撼地行者', color: '#f87171', role: '撼地破盾' }
];

export const TITLE_PRESETS = [
  '【初光聖誓者】',
  '【破曉使徒】',
  '【暗夜獵手】',
  '【深淵征服者】',
  '【不滅守望者】',
  '【永夜星火】'
];

export class AccountSystem {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    this.loadSession();
    // Create default demo account if none exists
    const accounts = this.getAccounts();
    if (Object.keys(accounts).length === 0) {
      this.createDemoAccount();
    }
  }

  async hashPassword(password, salt) {
    const enc = new TextEncoder();
    const data = enc.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  getAccounts() {
    try {
      const raw = localStorage.getItem(ACCOUNTS_DB_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Failed to read accounts database:', e);
      return {};
    }
  }

  saveAccounts(accounts) {
    try {
      localStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.error('Failed to save accounts database:', e);
    }
  }

  async createDemoAccount() {
    const salt = 'demo_salt_evernight';
    const passwordHash = await this.hashPassword('123456', salt);
    const accounts = {
      'DawnSeeker': {
        username: 'DawnSeeker',
        passwordHash,
        salt,
        avatar: AVATAR_PRESETS[0],
        title: '【初光聖誓者】',
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        stats: {
          totalExpeditions: 12,
          bossKills: 5,
          highestCombo: 48,
          pvpWins: 0
        }
      }
    };
    this.saveAccounts(accounts);
  }

  loadSession() {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        const accounts = this.getAccounts();
        if (session.isGuest) {
          this.currentUser = session;
        } else if (accounts[session.username]) {
          this.currentUser = accounts[session.username];
        }
      }
    } catch (e) {
      console.warn('Session load failed:', e);
      this.currentUser = null;
    }
  }

  saveSession(user) {
    this.currentUser = user;
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Session save failed:', e);
    }
  }

  clearSession() {
    this.currentUser = null;
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (e) {
      console.error('Session clear failed:', e);
    }
  }

  async register(username, password, avatarId = 'sun_knight', title = '【初光聖誓者】') {
    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 2 || cleanUsername.length > 16) {
      return { success: false, reason: '帳號名稱長度需介於 2 ~ 16 字元！' };
    }
    if (!password || password.length < 4) {
      return { success: false, reason: '密碼長度需至少 4 位數！' };
    }

    const accounts = this.getAccounts();
    if (accounts[cleanUsername]) {
      return { success: false, reason: `聖誓者代號【${cleanUsername}】已被使用，請更換代號！` };
    }

    const salt = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const passwordHash = await this.hashPassword(password, salt);
    const avatar = AVATAR_PRESETS.find(a => a.id === avatarId) || AVATAR_PRESETS[0];

    const newUser = {
      username: cleanUsername,
      passwordHash,
      salt,
      avatar,
      title: title || '【初光聖誓者】',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      stats: {
        totalExpeditions: 0,
        bossKills: 0,
        highestCombo: 0,
        pvpWins: 0
      }
    };

    accounts[cleanUsername] = newUser;
    this.saveAccounts(accounts);
    this.saveSession(newUser);

    return { success: true, user: newUser };
  }

  async login(username, password) {
    const cleanUsername = username.trim();
    const accounts = this.getAccounts();
    const user = accounts[cleanUsername];

    if (!user) {
      return { success: false, reason: `查無聖誓者帳號【${cleanUsername}】，請先註冊！` };
    }

    const hash = await this.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return { success: false, reason: '密碼驗證錯誤，請重新輸入！' };
    }

    user.lastLoginAt = Date.now();
    accounts[cleanUsername] = user;
    this.saveAccounts(accounts);
    this.saveSession(user);

    return { success: true, user };
  }

  loginAsGuest() {
    const guestId = Math.floor(1000 + Math.random() * 9000);
    const guestUser = {
      isGuest: true,
      username: `遊俠·${guestId}`,
      avatar: AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)],
      title: '【無名浪人】',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      stats: {
        totalExpeditions: 0,
        bossKills: 0,
        highestCombo: 0,
        pvpWins: 0
      }
    };
    this.saveSession(guestUser);
    return { success: true, user: guestUser };
  }

  logout() {
    this.clearSession();
    return { success: true };
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  calculateCombatPower(player) {
    if (!player) return 1000;
    let power = player.getMaxHp() * 1.5;
    power += player.getAttackDamage() * 8;
    power += player.unlockedTalents.size * 250;
    return Math.round(power);
  }
}

export const accountSystem = new AccountSystem();
