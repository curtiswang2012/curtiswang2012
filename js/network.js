/**
 * EVERNIGHT OATH: DAWN CHRONICLES (永夜之誓：破曉紀錄)
 * Multiplayer Network Engine: BroadcastChannel & WebRTC Hybrid Network Layer
 * Real-time Hero Synchronization, Lobby Matchmaking, Remote Player Rendering & World Sync
 */

import { accountSystem } from './account.js';
import { FORMS } from './player.js';

export const NETWORK_PACKET_TYPES = {
  // Lobby & Rooms
  ROOM_ANNOUNCE: 'room_announce',
  ROOM_LIST_REQ: 'room_list_req',
  ROOM_JOIN_REQ: 'room_join_req',
  ROOM_JOIN_ACK: 'room_join_ack',
  ROOM_STATE: 'room_state',
  ROOM_LEAVE: 'room_leave',
  ROOM_READY: 'room_ready',
  ROOM_START: 'room_start',

  // Gameplay In-Sync
  PLAYER_STATE: 'player_state',
  PLAYER_SKILL: 'player_skill',
  PLAYER_ATTACK: 'player_attack',
  BOSS_STATE_SYNC: 'boss_state_sync',
  BRAZIER_SYNC: 'brazier_sync',
  CHEST_SYNC: 'chest_sync',
  TACTICAL_PING: 'tactical_ping',
  CHAT_MSG: 'chat_msg'
};

export class MultiplayerNetworkEngine {
  constructor() {
    this.peerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    this.channel = null;
    this.currentRoom = null;
    this.publicRooms = new Map(); // roomId -> roomSummary
    this.remotePlayers = new Map(); // peerId -> remotePlayerState

    this.isHost = false;
    this.isConnected = false;
    this.lastBroadcastTime = 0;
    this.broadcastInterval = 1 / 30; // 30Hz network tick

    this.onRoomStateChanged = null;
    this.onExpeditionStarted = null;
    this.onChatMessage = null;
    this.onTacticalPing = null;
    this.onRemoteSkillCast = null;

    this.initChannel();
  }

  initChannel() {
    try {
      this.channel = new BroadcastChannel('evernight_oath_multiplayer_bus_v1');
      this.channel.onmessage = (e) => this.handleMessage(e.data);
      this.isConnected = true;

      // Periodically request active rooms list
      this.requestRoomList();
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  sendPacket(type, payload = {}) {
    if (!this.channel) return;
    const packet = {
      type,
      senderId: this.peerId,
      senderUser: accountSystem.getCurrentUser(),
      roomId: this.currentRoom ? this.currentRoom.id : null,
      timestamp: Date.now(),
      payload
    };
    try {
      this.channel.postMessage(packet);
    } catch (e) {
      console.error('Failed to send packet:', e);
    }
  }

  handleMessage(packet) {
    if (!packet || packet.senderId === this.peerId) return;

    switch (packet.type) {
      // 1. Lobby Discovery
      case NETWORK_PACKET_TYPES.ROOM_ANNOUNCE:
        this.handleRoomAnnounce(packet);
        break;

      case NETWORK_PACKET_TYPES.ROOM_LIST_REQ:
        if (this.currentRoom && this.isHost) {
          this.broadcastRoomAnnounce();
        }
        break;

      case NETWORK_PACKET_TYPES.ROOM_JOIN_REQ:
        this.handleJoinRequest(packet);
        break;

      case NETWORK_PACKET_TYPES.ROOM_JOIN_ACK:
        this.handleJoinAck(packet);
        break;

      case NETWORK_PACKET_TYPES.ROOM_STATE:
        this.handleRoomStateUpdate(packet);
        break;

      case NETWORK_PACKET_TYPES.ROOM_LEAVE:
        this.handlePlayerLeave(packet);
        break;

      case NETWORK_PACKET_TYPES.ROOM_START:
        this.handleRoomStart(packet);
        break;

      // 2. Real-time In-Game Sync
      case NETWORK_PACKET_TYPES.PLAYER_STATE:
        this.handleRemotePlayerState(packet);
        break;

      case NETWORK_PACKET_TYPES.PLAYER_SKILL:
        if (this.onRemoteSkillCast) {
          this.onRemoteSkillCast(packet.senderId, packet.payload);
        }
        break;

      case NETWORK_PACKET_TYPES.TACTICAL_PING:
        if (this.onTacticalPing) {
          this.onTacticalPing(packet.senderId, packet.senderUser, packet.payload);
        }
        break;

      case NETWORK_PACKET_TYPES.CHAT_MSG:
        if (this.onChatMessage) {
          this.onChatMessage(packet.senderUser, packet.payload.text);
        }
        break;
    }
  }

  // --- Lobby & Room Actions ---

  requestRoomList() {
    this.sendPacket(NETWORK_PACKET_TYPES.ROOM_LIST_REQ);
  }

  createRoom(roomName = '破曉討伐小隊', maxPlayers = 4, password = '') {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const user = accountSystem.getCurrentUser() || { username: '聖誓勇者', avatar: { icon: '☀️', color: '#ffd700' } };

    this.isHost = true;
    this.currentRoom = {
      id: 'room_' + code,
      name: roomName,
      code,
      password,
      hostId: this.peerId,
      maxPlayers,
      status: 'lobby',
      createdAt: Date.now(),
      players: [
        {
          peerId: this.peerId,
          user,
          isHost: true,
          isReady: true,
          ping: 15
        }
      ]
    };

    this.remotePlayers.clear();
    this.broadcastRoomAnnounce();
    if (this.onRoomStateChanged) this.onRoomStateChanged(this.currentRoom);
    return this.currentRoom;
  }

  joinRoomByCode(code) {
    this.sendPacket(NETWORK_PACKET_TYPES.ROOM_JOIN_REQ, {
      code: code.trim()
    });
  }

  handleJoinRequest(packet) {
    if (!this.isHost || !this.currentRoom) return;
    if (packet.payload.code !== this.currentRoom.code) return;

    if (this.currentRoom.players.length >= this.currentRoom.maxPlayers) {
      return; // Room full
    }

    const existingIdx = this.currentRoom.players.findIndex(p => p.peerId === packet.senderId);
    if (existingIdx === -1) {
      this.currentRoom.players.push({
        peerId: packet.senderId,
        user: packet.senderUser,
        isHost: false,
        isReady: false,
        ping: 20
      });
    }

    // Send ACK directly to joined client
    this.sendPacket(NETWORK_PACKET_TYPES.ROOM_JOIN_ACK, {
      targetPeerId: packet.senderId,
      room: this.currentRoom
    });

    // Broadcast updated room state
    this.broadcastRoomState();
  }

  handleJoinAck(packet) {
    if (packet.payload.targetPeerId !== this.peerId) return;
    this.isHost = false;
    this.currentRoom = packet.payload.room;
    this.remotePlayers.clear();
    if (this.onRoomStateChanged) this.onRoomStateChanged(this.currentRoom);
  }

  toggleReady() {
    if (!this.currentRoom) return;
    const player = this.currentRoom.players.find(p => p.peerId === this.peerId);
    if (player && !player.isHost) {
      player.isReady = !player.isReady;
      this.sendPacket(NETWORK_PACKET_TYPES.ROOM_READY, {
        isReady: player.isReady
      });
      this.broadcastRoomState();
    }
  }

  broadcastRoomAnnounce() {
    if (!this.currentRoom || !this.isHost) return;
    this.sendPacket(NETWORK_PACKET_TYPES.ROOM_ANNOUNCE, {
      id: this.currentRoom.id,
      name: this.currentRoom.name,
      code: this.currentRoom.code,
      hostName: this.currentRoom.players[0]?.user?.username || '房主',
      playerCount: this.currentRoom.players.length,
      maxPlayers: this.currentRoom.maxPlayers,
      hasPassword: !!this.currentRoom.password,
      status: this.currentRoom.status
    });
  }

  handleRoomAnnounce(packet) {
    const summary = packet.payload;
    if (summary && summary.id) {
      this.publicRooms.set(summary.id, summary);
    }
  }

  broadcastRoomState() {
    if (!this.currentRoom) return;
    this.sendPacket(NETWORK_PACKET_TYPES.ROOM_STATE, {
      room: this.currentRoom
    });
    if (this.onRoomStateChanged) this.onRoomStateChanged(this.currentRoom);
  }

  handleRoomStateUpdate(packet) {
    if (this.currentRoom && packet.payload.room && packet.payload.room.id === this.currentRoom.id) {
      this.currentRoom = packet.payload.room;
      if (this.onRoomStateChanged) this.onRoomStateChanged(this.currentRoom);
    }
  }

  leaveRoom() {
    if (!this.currentRoom) return;
    this.sendPacket(NETWORK_PACKET_TYPES.ROOM_LEAVE);
    this.currentRoom = null;
    this.isHost = false;
    this.remotePlayers.clear();
    if (this.onRoomStateChanged) this.onRoomStateChanged(null);
  }

  handlePlayerLeave(packet) {
    if (!this.currentRoom) return;
    const idx = this.currentRoom.players.findIndex(p => p.peerId === packet.senderId);
    if (idx !== -1) {
      this.currentRoom.players.splice(idx, 1);
      this.remotePlayers.delete(packet.senderId);

      // If host left, auto migrate host
      if (this.currentRoom.players.length > 0 && packet.senderId === this.currentRoom.hostId) {
        this.currentRoom.hostId = this.currentRoom.players[0].peerId;
        this.currentRoom.players[0].isHost = true;
        if (this.currentRoom.hostId === this.peerId) {
          this.isHost = true;
        }
      }

      this.broadcastRoomState();
    }
  }

  startExpedition() {
    if (!this.isHost || !this.currentRoom) return;
    this.currentRoom.status = 'in_game';
    this.sendPacket(NETWORK_PACKET_TYPES.ROOM_START, {
      roomId: this.currentRoom.id,
      seed: Math.floor(Math.random() * 100000)
    });
    if (this.onExpeditionStarted) this.onExpeditionStarted(this.currentRoom);
  }

  handleRoomStart(packet) {
    if (this.currentRoom && packet.payload.roomId === this.currentRoom.id) {
      this.currentRoom.status = 'in_game';
      if (this.onExpeditionStarted) this.onExpeditionStarted(this.currentRoom);
    }
  }

  // --- Real-time Synchronizations ---

  broadcastPlayerState(player) {
    if (!this.currentRoom || !player) return;
    const now = performance.now() / 1000;
    if (now - this.lastBroadcastTime < this.broadcastInterval) return;
    this.lastBroadcastTime = now;

    this.sendPacket(NETWORK_PACKET_TYPES.PLAYER_STATE, {
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.vx),
      vy: Math.round(player.vy),
      facingAngle: Number(player.facingAngle.toFixed(3)),
      form: player.form,
      hp: Math.round(player.hp),
      maxHp: player.getMaxHp(),
      isDodging: player.isDodging,
      isAttacking: player.isAttacking,
      weaponId: player.equippedWeapon.id
    });
  }

  handleRemotePlayerState(packet) {
    if (!this.currentRoom || packet.roomId !== this.currentRoom.id) return;
    const data = packet.payload;
    let remote = this.remotePlayers.get(packet.senderId);

    if (!remote) {
      remote = {
        peerId: packet.senderId,
        user: packet.senderUser || { username: '盟友', avatar: { icon: '☀️', color: '#ffd700' } },
        x: data.x,
        y: data.y,
        targetX: data.x,
        targetY: data.y,
        vx: data.vx,
        vy: data.vy,
        facingAngle: data.facingAngle,
        form: data.form,
        hp: data.hp,
        maxHp: data.maxHp,
        isDodging: data.isDodging,
        isAttacking: data.isAttacking,
        weaponId: data.weaponId,
        lastUpdate: Date.now()
      };
      this.remotePlayers.set(packet.senderId, remote);
    } else {
      remote.targetX = data.x;
      remote.targetY = data.y;
      remote.vx = data.vx;
      remote.vy = data.vy;
      remote.facingAngle = data.facingAngle;
      remote.form = data.form;
      remote.hp = data.hp;
      remote.maxHp = data.maxHp;
      remote.isDodging = data.isDodging;
      remote.isAttacking = data.isAttacking;
      remote.weaponId = data.weaponId;
      remote.lastUpdate = Date.now();
    }
  }

  broadcastSkill(skillData) {
    if (!this.currentRoom) return;
    this.sendPacket(NETWORK_PACKET_TYPES.PLAYER_SKILL, skillData);
  }

  broadcastChat(text) {
    if (!this.currentRoom || !text) return;
    this.sendPacket(NETWORK_PACKET_TYPES.CHAT_MSG, { text });
  }

  broadcastPing(x, y, pingType = 'beacon', message = '') {
    if (!this.currentRoom) return;
    this.sendPacket(NETWORK_PACKET_TYPES.TACTICAL_PING, { x, y, pingType, message });
  }

  update(dt) {
    // Interpolate remote players position
    const now = Date.now();
    for (const [peerId, rp] of this.remotePlayers.entries()) {
      // Remove stale players (no update for > 6s)
      if (now - rp.lastUpdate > 6000) {
        this.remotePlayers.delete(peerId);
        continue;
      }
      rp.x += (rp.targetX - rp.x) * 12 * dt;
      rp.y += (rp.targetY - rp.y) * 12 * dt;
    }
  }

  renderRemotePlayers(ctx, cameraX, cameraY) {
    if (!this.currentRoom || this.remotePlayers.size === 0) return;

    for (const rp of this.remotePlayers.values()) {
      const sx = rp.x - cameraX;
      const sy = rp.y - cameraY;

      ctx.save();
      ctx.translate(sx, sy);

      const isRadiant = rp.form === FORMS.RADIANT;
      const formColor = isRadiant ? '#ffd700' : '#c084fc';
      const formGlow = isRadiant ? 'rgba(255, 215, 0, 0.4)' : 'rgba(168, 85, 247, 0.4)';

      // 1. Ally Aura Ring
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fillStyle = formGlow;
      ctx.fill();
      ctx.strokeStyle = formColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Character Body
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#1e2029';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 3. Form Core Icon
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isRadiant ? '☀️' : '🌑', 0, 0);

      // 4. Facing Direction Arrow
      ctx.rotate(rp.facingAngle);
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(10, -5);
      ctx.lineTo(12, 0);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fillStyle = formColor;
      ctx.fill();

      ctx.restore();

      // 5. Overhead Ally Name & HP Bar
      ctx.save();
      ctx.translate(sx, sy);

      // Name & Title
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = rp.user?.avatar?.color || '#38bdf8';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(`${rp.user?.username || '隊友'}`, 0, -32);

      // Mini HP Bar
      const hpW = 40;
      const hpH = 4;
      const hpPct = Math.max(0, Math.min(1, rp.hp / (rp.maxHp || 1000)));

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(-hpW / 2, -26, hpW, hpH);
      ctx.fillStyle = hpPct > 0.3 ? '#22c55e' : '#ef4444';
      ctx.fillRect(-hpW / 2, -26, hpW * hpPct, hpH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-hpW / 2, -26, hpW, hpH);

      ctx.restore();
    }
  }
}

export const networkEngine = new MultiplayerNetworkEngine();
