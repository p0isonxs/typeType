// ✅ MINIMAL FIX - File: src/multisynq/TypingModel.ts
import { ReactModel } from "@multisynq/react";
import { PlayerModel } from "./PlayerModel";

type Highscores = Record<string, number>;

interface RoomSettings {
  sentenceLength: number;
  timeLimit: number;
  maxPlayers: number;
  theme: string;
  words: string[];
}

interface TypingModelOptions {
  roomSettings?: Partial<RoomSettings>;
}

export class TypingModel extends ReactModel {
  words!: string[];
  players!: Map<string, PlayerModel>;
  started!: boolean;
  timeLeft!: number;
  highscores!: Highscores;
  gameTickScheduled = false;
  sentenceLength!: number;
  theme!: string;
  timeLimit!: number;
  maxPlayers!: number;
  roomSettingsInitialized = false;

  // ✅ ONLY ADD: Simple anti-loop flags
  private lastViewUpdateTime = 0;

  init(options: TypingModelOptions = {}): void {
    super.init(options);

    // Keep all original logic unchanged
    this.subscribe("room", "initialize-settings", this.initializeRoomSettings);
    this.subscribe("game", "start", this.startGame);
    this.subscribe("game", "reset", this.resetGame);

    this.setDefaultSettings();

    if (options.roomSettings && Object.keys(options.roomSettings).length > 0) {
      this.applyRoomSettings(options.roomSettings);
      this.roomSettingsInitialized = true;
    }

    this.players = new Map();
    this.started = false;
    this.timeLeft = this.timeLimit;
    this.highscores = {};
  }

  setDefaultSettings(): void {
    this.theme = "tech";
    this.sentenceLength = 30;
    this.timeLimit = 60;
    this.maxPlayers = 4;
    this.words = this.generateWords(this.sentenceLength, this.theme);
    this.shuffle(this.words);
  }

  initializeRoomSettings(settings: Partial<RoomSettings>): void {
    if (!this.roomSettingsInitialized) {
      this.applyRoomSettings(settings);
      this.roomSettingsInitialized = true;
      this.throttledViewUpdate(); // ✅ ONLY CHANGE: Use throttled update
    }
  }

  applyRoomSettings(settings: Partial<RoomSettings>): void {
    if (settings.theme) this.theme = settings.theme;
    if (settings.sentenceLength) this.sentenceLength = settings.sentenceLength;
    if (settings.timeLimit) this.timeLimit = settings.timeLimit;
    if (settings.maxPlayers) this.maxPlayers = settings.maxPlayers;

    if (settings.words && settings.words.length > 0) {
      this.words = [...settings.words];
    } else {
      this.words = this.generateWords(this.sentenceLength, this.theme);
    }

    this.shuffle(this.words);
    this.timeLeft = this.timeLimit;
  }

  handleViewJoin(viewId: string): void {
    // ✅ ONLY ADD: Check if player already exists
    if (this.players.has(viewId)) {
      console.log(
        `🔄 Player ${viewId} already exists, skipping duplicate join`
      );
      return;
    }

    if (this.players.size >= this.maxPlayers) {
      this.publish(viewId, "room-full");
      return;
    }

    const player = PlayerModel.create({ viewId, parent: this }) as PlayerModel;
    this.players.set(viewId, player);

    if (this.players.size === 1) {
      this.future(500).checkAndInitializeSettings();
    }

    this.throttledViewUpdate(); // ✅ ONLY CHANGE: Use throttled update
  }

  checkAndInitializeSettings(roomSettings?: any): void {
    if (!this.roomSettingsInitialized) {
      if (roomSettings && Object.keys(roomSettings).length > 0) {
        this.publish("room", "initialize-settings", roomSettings);
      }
    }
  }

  handleViewExit(viewId: string): void {
    const player = this.players.get(viewId);
    if (player) {
      player.destroy();
    }
    this.players.delete(viewId);

    this.throttledViewUpdate(); // ✅ ONLY CHANGE: Use throttled update
  }

  // ✅ NEW: Simple throttle function - prevents spam updates
  private throttledViewUpdate(): void {
    const now = this.now();
    if (now - this.lastViewUpdateTime > 100) {
      // 100ms cooldown
      this.lastViewUpdateTime = now;
      this.publish("view", "update");
    }
  }

  // Keep all other methods exactly the same
  generateWords(length: number, theme: string): string[] {
    const wordLibrary = {
      tech: [
        "blockchain",
        "decentralized",
        "smart",
        "contract",
        "crypto",
        "wallet",
        "DAO",
        "NFT",
        "dApp",
        "token",
        "ledger",
        "protocol",
        "consensus",
        "mining",
        "staking",
      ],
      multisynq: [
        "multisynq",
        "sync",
        "real",
        "time",
        "multi",
        "player",
        "react",
        "model",
        "view",
        "event",
        "publish",
        "subscribe",
        "session",
        "client",
        "server",
        "network",
        "peer",
        "node",
        "distributed",
      ],

      monad: [
        "monad",
        "evm",
        "layer1",
        "block",
        "finality",
        "parallel",
        "tps",
        "transaction",
        "validator",
        "state",
        "consensus",
        "execution",
        "decentralized",
        "security",
        "ethereum",
        "storage",
      ],
      web3: [
        "web3",
        "wallet",
        "smart",
        "contract",
        "dapp",
        "eth",
        "crypto",
        "address",
        "gas",
        "token",
        "sign",
        "dao",
        "blockchain",
        "open",
        "ledger",
        "decentralized",
        "identity",
        "metamask",
        "key",
      ],
      general: [
        "quick",
        "brown",
        "fox",
        "jumps",
        "over",
        "lazy",
        "dog",
        "pack",
        "type",
        "fast",
        "speed",
        "word",
        "text",
        "key",
        "board",
        "finger",
      ],
    };

    const words =
      wordLibrary[theme as keyof typeof wordLibrary] || wordLibrary.general;
    return words
      .filter((word) => word.length <= length)
      .slice(0, Math.min(length, 40));
  }

  shuffle(arr: string[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  startGame(): void {
    if (this.started) return;

    this.started = true;
    this.timeLeft = this.timeLimit;

    for (const player of this.players.values()) {
      player.reset();
    }

    this.shuffle(this.words);
    this.scheduleNextTick();
    this.publish("view", "update");
  }

  resetGame(): void {
    this.started = false;
    this.timeLeft = this.timeLimit;
    this.gameTickScheduled = false;

    for (const player of this.players.values()) {
      player.reset();
    }

    this.shuffle(this.words);
    this.publish("view", "update");
  }

  scheduleNextTick(): void {
    if (!this.gameTickScheduled) {
      this.gameTickScheduled = true;
      this.future(1000).tick();
    }
  }

  tick(): void {
    this.gameTickScheduled = false;

    if (!this.started) return;

    this.timeLeft--;
    this.publish("view", "update");

    if (this.timeLeft > 0) {
      this.scheduleNextTick();
    } else {
      this.started = false;

      for (const player of this.players.values()) {
        if (player.initials) {
          this.setHighscore(player.initials, player.score);
        }
      }

      this.publish("view", "update");
    }
  }

  setHighscore(initials: string, score: number): void {
    if (this.highscores[initials] >= score) return;

    this.highscores[initials] = score;
    this.publish("view", "update");
    this.publish("view", "new-highscore", { initials, score });
  }

  getPlayer(viewId: string): PlayerModel | undefined {
    return this.players.get(viewId);
  }

  getGameState() {
    return {
      started: this.started,
      timeLeft: this.timeLeft,
      timeLimit: this.timeLimit,
      theme: this.theme,
      sentenceLength: this.sentenceLength,
      maxPlayers: this.maxPlayers,
      playerCount: this.players.size,
      words: this.words,
      highscores: this.highscores,
      roomSettingsInitialized: this.roomSettingsInitialized,
    };
  }
}

TypingModel.register("TypingModel");
