(() => {
  const Game = window.MC2D;
  const INDEX_KEY = 'cavernfall-world-index-v2';
  const WORLD_PREFIX = 'cavernfall-world-';
  const LEGACY_SAVE_KEY = 'mc2d-save-v1';
  const { HOTBAR_SIZE } = Game.constants;
  const { createGameState } = Game.state;
  const { createSlot, normalizeSlot } = Game.inventory;
  const { ARMOR_SLOT_ORDER, createArmorSlots } = Game.combat;

  function normalizeSlotArray(slots, size) {
    return Array.from({ length: size }, (_, index) => {
      const raw = slots && slots[index] ? slots[index] : createSlot();
      return normalizeSlot({
        id: raw.id ?? null,
        count: raw.count ?? 0,
        durability: raw.durability ?? null,
      });
    });
  }

  function normalizeFurnaces(furnaces) {
    const result = {};
    if (!furnaces || typeof furnaces !== 'object') return result;
    for (const [key, furnace] of Object.entries(furnaces)) {
      result[key] = {
        input: normalizeSlotArray([furnace.input], 1)[0],
        fuel: normalizeSlotArray([furnace.fuel], 1)[0],
        output: normalizeSlotArray([furnace.output], 1)[0],
        progress: Number.isFinite(furnace.progress) ? furnace.progress : 0,
        burnTime: Number.isFinite(furnace.burnTime) ? furnace.burnTime : 0,
        burnTotal: Number.isFinite(furnace.burnTotal) ? furnace.burnTotal : 0,
      };
    }
    return result;
  }

  function normalizeArmorSlots(armor) {
    const result = createArmorSlots();
    for (const slotId of ARMOR_SLOT_ORDER) {
      const raw = armor && armor[slotId] ? armor[slotId] : createSlot();
      result[slotId] = normalizeSlot({
        id: raw.id ?? null,
        count: raw.count ?? 0,
        durability: raw.durability ?? null,
      });
    }
    return result;
  }

  function normalizeChests(chests) {
    const result = {};
    if (!chests || typeof chests !== 'object') return result;
    for (const [key, chest] of Object.entries(chests)) {
      result[key] = {
        slots: normalizeSlotArray(chest.slots, 12),
        ownerSettlementId: chest.ownerSettlementId || null,
      };
    }
    return result;
  }

  function normalizeDoors(doors) {
    const result = {};
    if (!doors || typeof doors !== 'object') return result;
    for (const [key, door] of Object.entries(doors)) {
      result[key] = {
        open: !!(door && door.open),
        ownerSettlementId: door && door.ownerSettlementId ? door.ownerSettlementId : null,
        tower: !!(door && door.tower),
      };
    }
    return result;
  }

  function snapshotState(state) {
    return {
      worldMeta: state.worldMeta,
      world: state.world,
      biomeAt: state.biomeAt,
      climateAt: state.climateAt,
      surfaceAt: state.surfaceAt,
      animals: state.animals,
      zombies: state.zombies,
      spiders: state.spiders,
      humans: state.humans,
      humanSettlements: state.humanSettlements,
      dwarves: state.dwarves,
      dwarfColony: state.dwarfColony,
      foods: state.foods,
      chests: state.chests,
      furnaces: state.furnaces,
      doors: state.doors,
      fireCaves: state.fireCaves,
      firePyramid: state.firePyramid,
      fireBoss: state.fireBoss,
      player: state.player,
      gameOver: state.gameOver,
      cycleTime: state.cycleTime,
      satietyTick: state.satietyTick,
      starvationTick: state.starvationTick,
      regenTick: state.regenTick,
      zombieSpawnTick: state.zombieSpawnTick,
      zombieCaveSpawnTick: state.zombieCaveSpawnTick,
      spiderSpawnTick: state.spiderSpawnTick,
      spiderCaveSpawnTick: state.spiderCaveSpawnTick,
      attackFlash: state.attackFlash,
      fluidTick: state.fluidTick,
    };
  }

  function worldStorageKey(id) {
    return `${WORLD_PREFIX}${id}`;
  }

  function readIndex() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeIndex(index) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  function generateWorldId() {
    return `world-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e8).toString(36)}`;
  }

  function createWorldMeta(data) {
    const now = Date.now();
    return {
      id: generateWorldId(),
      name: data.name || 'Новый мир',
      seed: data.seed || '',
      mode: data.mode || 'survival',
      createdAt: now,
      updatedAt: now,
      preview: data.preview || null,
    };
  }

  function upsertIndexMeta(meta) {
    const index = readIndex().filter((entry) => entry && entry.id !== meta.id);
    index.unshift({
      id: meta.id,
      name: meta.name,
      seed: meta.seed,
      mode: meta.mode,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      preview: meta.preview || null,
    });
    writeIndex(index);
  }

  function listWorlds() {
    return readIndex().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function saveWorld(state, preview = null) {
    if (!state.worldMeta || !state.worldMeta.id) return false;
    try {
      const nextMeta = {
        ...state.worldMeta,
        updatedAt: Date.now(),
        preview: preview ?? state.worldMeta.preview ?? null,
      };
      state.worldMeta = nextMeta;
      localStorage.setItem(worldStorageKey(nextMeta.id), JSON.stringify(snapshotState(state)));
      upsertIndexMeta(nextMeta);
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadWorld(worldId) {
    try {
      const raw = localStorage.getItem(worldStorageKey(worldId));
      if (!raw) return null;
      const data = JSON.parse(raw);
      const state = createGameState(data.worldMeta || { id: worldId });

      state.worldMeta = {
        ...state.worldMeta,
        ...(data.worldMeta || {}),
        id: worldId,
      };
      state.world = Array.isArray(data.world) ? data.world : state.world;
      state.biomeAt = Array.isArray(data.biomeAt) ? data.biomeAt : state.biomeAt;
      state.climateAt = Array.isArray(data.climateAt) ? data.climateAt : state.climateAt;
      state.surfaceAt = Array.isArray(data.surfaceAt) ? data.surfaceAt : state.surfaceAt;
      state.animals = Array.isArray(data.animals) ? data.animals : state.animals;
      state.zombies = Array.isArray(data.zombies) ? data.zombies : state.zombies;
      state.spiders = Array.isArray(data.spiders) ? data.spiders : state.spiders;
      state.humans = Array.isArray(data.humans) ? data.humans : state.humans;
      state.humanSettlements = data.humanSettlements && typeof data.humanSettlements === 'object'
        ? {
            villages: Array.isArray(data.humanSettlements.villages) ? data.humanSettlements.villages : [],
            nodes: Array.isArray(data.humanSettlements.nodes) ? data.humanSettlements.nodes : [],
            edges: Array.isArray(data.humanSettlements.edges) ? data.humanSettlements.edges : [],
          }
        : state.humanSettlements;
      state.dwarves = Array.isArray(data.dwarves) ? data.dwarves : state.dwarves;
      state.dwarfColony = data.dwarfColony && typeof data.dwarfColony === 'object'
        ? {
            homes: Array.isArray(data.dwarfColony.homes) ? data.dwarfColony.homes : [],
            stockpiles: Array.isArray(data.dwarfColony.stockpiles) ? data.dwarfColony.stockpiles : [],
            halls: Array.isArray(data.dwarfColony.halls) ? data.dwarfColony.halls : [],
            shafts: Array.isArray(data.dwarfColony.shafts) ? data.dwarfColony.shafts : [],
            worksites: Array.isArray(data.dwarfColony.worksites) ? data.dwarfColony.worksites : [],
            nodes: Array.isArray(data.dwarfColony.nodes) ? data.dwarfColony.nodes : [],
            edges: Array.isArray(data.dwarfColony.edges) ? data.dwarfColony.edges : [],
            settlements: Array.isArray(data.dwarfColony.settlements) ? data.dwarfColony.settlements : [],
          }
        : state.dwarfColony;
      state.foods = Array.isArray(data.foods) ? data.foods : state.foods;
      state.chests = normalizeChests(data.chests);
      state.furnaces = normalizeFurnaces(data.furnaces);
      state.doors = normalizeDoors(data.doors);
      state.fireCaves = data.fireCaves && typeof data.fireCaves === 'object'
        ? {
            region: data.fireCaves.region || null,
            shrine: data.fireCaves.shrine || null,
          }
        : state.fireCaves;
      state.firePyramid = data.firePyramid && typeof data.firePyramid === 'object'
        ? data.firePyramid
        : state.firePyramid;
      state.fireBoss = data.fireBoss && typeof data.fireBoss === 'object'
        ? data.fireBoss
        : state.fireBoss;
      state.gameOver = !!data.gameOver;
      state.cycleTime = Number.isFinite(data.cycleTime) ? data.cycleTime : state.cycleTime;
      state.satietyTick = Number.isFinite(data.satietyTick) ? data.satietyTick : state.satietyTick;
      state.starvationTick = Number.isFinite(data.starvationTick) ? data.starvationTick : state.starvationTick;
      state.regenTick = Number.isFinite(data.regenTick) ? data.regenTick : state.regenTick;
      state.zombieSpawnTick = Number.isFinite(data.zombieSpawnTick) ? data.zombieSpawnTick : 0;
      state.zombieCaveSpawnTick = Number.isFinite(data.zombieCaveSpawnTick) ? data.zombieCaveSpawnTick : 0;
      state.spiderSpawnTick = Number.isFinite(data.spiderSpawnTick) ? data.spiderSpawnTick : 0;
      state.spiderCaveSpawnTick = Number.isFinite(data.spiderCaveSpawnTick) ? data.spiderCaveSpawnTick : 0;
      state.attackFlash = Number.isFinite(data.attackFlash) ? data.attackFlash : 0;
      state.fluidTick = Number.isFinite(data.fluidTick) ? data.fluidTick : 0;

      if (data.player) {
        Object.assign(state.player, data.player);
        state.player.hotbar = normalizeSlotArray(data.player.hotbar, HOTBAR_SIZE);
        state.player.inventory = normalizeSlotArray(data.player.inventory, 27);
        state.player.armor = normalizeArmorSlots(data.player.armor);
      }

      state.crafting.open = false;
      state.crafting.tab = 'craft';
      state.crafting.grid = Array.from({ length: 9 }, () => createSlot());
      state.crafting.cursor = createSlot();
      state.crafting.result = null;
      state.crafting.chestOpenKey = null;
      state.crafting.tradeHumanId = null;
      state.pause.open = false;
      state.pause.confirmRestart = false;
      state.pause.statusText = '';
      state.autosaveTick = 0;
      return state;
    } catch (error) {
      return null;
    }
  }

  function deleteWorld(worldId) {
    try {
      localStorage.removeItem(worldStorageKey(worldId));
      const nextIndex = readIndex().filter((entry) => entry && entry.id !== worldId);
      writeIndex(nextIndex);
      return true;
    } catch (error) {
      return false;
    }
  }

  function migrateLegacySave() {
    try {
      if (readIndex().length > 0) return;
      const raw = localStorage.getItem(LEGACY_SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const meta = createWorldMeta({ name: 'Старый мир', seed: '', mode: 'survival', preview: null });
      if (!data.worldMeta) data.worldMeta = meta;
      data.worldMeta = { ...meta, ...(data.worldMeta || {}), id: meta.id };
      localStorage.setItem(worldStorageKey(meta.id), JSON.stringify(data));
      upsertIndexMeta(data.worldMeta);
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch (error) {
      // ignore migration failures
    }
  }

  Game.saveSystem = { saveWorld, loadWorld, listWorlds, deleteWorld, createWorldMeta, migrateLegacySave };
})();
