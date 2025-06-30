// ✅ FIXED - File: src/multisynq/RoomTypingModel.ts
import { TypingModel } from './TypingModel';

export class RoomTypingModel extends TypingModel {
  private settingsInitialized = false;
  
  // ✅ REMOVE static approach, use proper Multisynq state
  static roomSettings: any = null;
  
  static setRoomSettings(settings: any): void {
    RoomTypingModel.roomSettings = settings;
  }

  init(options: any = {}): void {
    // Subscribe to settings broadcast BEFORE calling super.init
    this.subscribe("room", "sync-settings", this.syncRoomSettings);
    
    super.init(options);

    if (this.settingsInitialized) {
      return;
    }
    
    // ✅ FIXED: Use static settings for initial setup
    let roomSettings = {};
    
    if (RoomTypingModel.roomSettings) {
      roomSettings = RoomTypingModel.roomSettings;
      console.log("✅ Host has room settings, will broadcast:", roomSettings);
      
      // Host: Apply settings immediately and broadcast
      this.applyRoomSettings(roomSettings);
      this.settingsInitialized = true;
      
      // Broadcast to other players after a short delay
      this.future(1000).broadcastRoomSettings(roomSettings);
      
    } else {
      console.log("⏳ Guest waiting for settings from host...");
      
      // Guest: Use defaults temporarily, wait for host broadcast
      roomSettings = {
        sentenceLength: 30,
        timeLimit: 60,
        maxPlayers: 4,
        theme: 'random',
        words: []
      };
      this.applyRoomSettings(roomSettings);
    }
  }

  // ✅ NEW: Host broadcasts settings to all players
  broadcastRoomSettings(settings: any): void {
    console.log("📢 Broadcasting settings to all players:", settings);
    this.publish("room", "sync-settings", settings);
    this.publish("view", "update"); // Trigger UI update
  }

  // ✅ NEW: All players receive and apply settings
  syncRoomSettings(settings: any): void {
    if (!settings) return;
    
    console.log("📥 Received settings from host:", settings);
    
    // Apply the settings from host
    this.applyRoomSettings(settings);
    this.settingsInitialized = true;
    
    // Update static reference for consistency
    RoomTypingModel.roomSettings = settings;
    
    // Trigger UI update so all players see same settings
    this.publish("view", "update");
  }

  // ✅ OVERRIDE: When new player joins, host re-broadcasts settings
  handleViewJoin(viewId: string): void {
    super.handleViewJoin(viewId);
    
    // If we're host (have settings) and someone joins, re-broadcast
    if (RoomTypingModel.roomSettings && this.players.size > 1) {
      console.log("🔄 New player joined, re-broadcasting settings");
      this.future(500).broadcastRoomSettings(RoomTypingModel.roomSettings);
    }
  }
}

RoomTypingModel.register('RoomTypingModel');