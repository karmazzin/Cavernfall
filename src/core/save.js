(() => {
  const Game = window.MC2D;
  const INDEX_KEY = 'cavernfall-world-index-v2';
  const WORLD_PREFIX = 'cavernfall-world-';
  const LEGACY_SAVE_KEY = 'mc2d-save-v1';
  const MOD_INDEX_KEY = 'cavernfall-mod-index-v1';
  const MOD_PREFIX = 'cavernfall-mod-';
  const { HOTBAR_SIZE } = Game.constants;
  const { createGameState, ensureDimensions, syncActiveDimension } = Game.state;
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
    const snapshot = {
      worldMeta: state.worldMeta,
      world: state.world,
      seasons: state.seasons,
      farming: state.farming,
      biomeAt: state.biomeAt,
      climateAt: state.climateAt,
      surfaceAt: state.surfaceAt,
      animals: state.animals,
      zombies: state.zombies,
      spiders: state.spiders,
      fireGuards: state.fireGuards,
      waterfolk: state.waterfolk,
      windfolk: state.windfolk,
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
      fireKing: state.fireKing,
      fireDungeon: state.fireDungeon,
      friendlyFireKing: state.friendlyFireKing,
      waterCaves: state.waterCaves,
      airCaves: state.airCaves,
      waterWell: state.waterWell,
      goldenFlowerGuardian: state.goldenFlowerGuardian,
      airGuardian: state.airGuardian,
      airThief: state.airThief,
      evilTrunk: state.evilTrunk,
      kraken: state.kraken,
      quake: state.quake,
      fireWorldMeta: state.fireWorldMeta,
      waterWorldMeta: state.waterWorldMeta,
      airWorldMeta: state.airWorldMeta,
      undergroundWorldMeta: state.undergroundWorldMeta,
      endWorldMeta: state.endWorldMeta,
      dimensions: state.dimensions,
      activeDimension: state.activeDimension,
      portalLinks: state.portalLinks,
      player: state.player,
      gameOver: state.gameOver,
      hardcoreDeath: state.hardcoreDeath,
      endingScene: state.endingScene,
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
      weather: state.weather,
      friendshipAmuletTick: state.friendshipAmuletTick,
      steamEffects: state.steamEffects,
      echoPulse: state.echoPulse,
      invisibilityBlocks: state.invisibilityBlocks,
      invisibilityGroupSeed: state.invisibilityGroupSeed,
      temporaryEarthBlocks: state.temporaryEarthBlocks,
      factionMemory: state.factionMemory,
      settings: state.settings,
      achievements: state.achievements,
    };
    Object.assign(snapshot, Game.state.captureDimensionState(state));
    // Active dimension already lives at the root; do not write its entire grid twice.
    snapshot.dimensions = { ...state.dimensions, [state.activeDimension]: null };
    return snapshot;
  }

  function encodeSnapshot(snapshot) {
    return JSON.stringify(snapshot, (key, value) => {
      if (key === 'background') return undefined;
      if (key === 'world' && Array.isArray(value)) {
        return { gridRle: value.map(row => {
          const runs = [];
          for (let i = 0; i < row.length;) {
            const id = row[i]; let end = i + 1;
            while (end < row.length && row[end] === id) end++;
            runs.push(id, end - i); i = end;
          }
          return runs;
        }) };
      }
      return value;
    });
  }

  function decodeSnapshot(raw) {
    return JSON.parse(raw, (key, value) => {
      if (key === 'background') return undefined;
      if (value && Array.isArray(value.gridRle)) return value.gridRle.map(runs => {
        const row = [];
        for (let i = 0; i < runs.length; i += 2) {
          if (!Number.isInteger(runs[i + 1]) || runs[i + 1] < 1 || row.length + runs[i + 1] > Game.constants.WORLD_W) throw new Error('Invalid saved grid');
          for (let n = 0; n < runs[i + 1]; n++) row.push(runs[i]);
        }
        return row;
      });
      return value;
    });
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
      worldType: data.worldType || 'normal',
      singleBiome: data.singleBiome || 'forest',
      cavernBiome: data.cavernBiome || 'mix',
      landscape3d: !!data.landscape3d,
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
      worldType: meta.worldType || 'normal',
      singleBiome: meta.singleBiome || 'forest',
      cavernBiome: meta.cavernBiome || 'mix',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      preview: meta.preview || null,
    });
    writeIndex(index);
  }

  function listWorlds() {
    const worlds = new Map(readIndex().map(meta => [meta.id, meta]));
    for (const meta of Game.worldStorage.list()) worlds.set(meta.id, meta);
    return [...worlds.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function savingFailed(state, error) {
    state.saveError = error?.name === 'QuotaExceededError'
      ? 'Недостаточно места для сохранения в браузере.'
      : `Ошибка сохранения: ${error?.message || error?.name || 'хранилище недоступно'}`;
    return false;
  }

  function saveWorld(state, preview = null) {
    if (!state.worldMeta || !state.worldMeta.id) return false;
    const storage = Game.worldStorage;
    if (!storage.initialized) return storage.ready.then(() => saveWorld(state, preview));
    try {
      ensureDimensions(state);
      syncActiveDimension(state);
      const nextMeta = {
        ...state.worldMeta,
        updatedAt: Date.now(),
        preview: preview ?? state.worldMeta.preview ?? null,
      };
      state.worldMeta = nextMeta;
      const raw = encodeSnapshot(snapshotState(state));
      const writeDatabase = () => storage.write({ id: nextMeta.id, meta: nextMeta, raw })
        .then(() => { state.saveError = null; return true; })
        .catch(error => savingFailed(state, error));
      // Once a world moves to IndexedDB, keep writing to that authoritative copy.
      if (storage.get(nextMeta.id)) return writeDatabase();
      try {
        localStorage.setItem(worldStorageKey(nextMeta.id), raw);
        upsertIndexMeta(nextMeta);
        state.saveError = null;
        return true;
      } catch (error) {
        if (storage.available) return writeDatabase();
        return savingFailed(state, error);
      }
    } catch (error) { return savingFailed(state, error); }
  }

  function loadWorld(worldId) {
    const storage = Game.worldStorage;
    if (!storage.initialized) return storage.ready.then(() => loadWorld(worldId));
    try {
      const raw = storage.get(worldId)?.raw || localStorage.getItem(worldStorageKey(worldId));
      if (!raw) return null;
      const data = decodeSnapshot(raw);
      const state = createGameState(data.worldMeta || { id: worldId });

      state.worldMeta = {
        ...state.worldMeta,
        ...(data.worldMeta || {}),
        id: worldId,
      };
      delete state.worldMeta.modId;
      delete state.worldMeta.modName;
      delete state.worldMeta.modSummary;
      state.blockLayers = data.blockLayers || {};
      state.backdrop = data.backdrop || null;
      state.layersVersion = data.layersVersion || 0;
      state.greatTrees = data.greatTrees || [];
      state.farming = data.farming && typeof data.farming === 'object' ? data.farming : null;
      state.seasons = data.seasons && typeof data.seasons === 'object' ? data.seasons : null;
      state.world = Array.isArray(data.world) ? data.world : state.world;
      state.biomeAt = Array.isArray(data.biomeAt) ? data.biomeAt : state.biomeAt;
      state.climateAt = Array.isArray(data.climateAt) ? data.climateAt : state.climateAt;
      state.surfaceAt = Array.isArray(data.surfaceAt) ? data.surfaceAt : state.surfaceAt;
      state.animals = Array.isArray(data.animals) ? data.animals : state.animals;
      state.zombies = Array.isArray(data.zombies) ? data.zombies : state.zombies;
      state.spiders = Array.isArray(data.spiders) ? data.spiders : state.spiders;
      state.fireGuards = Array.isArray(data.fireGuards) ? data.fireGuards : state.fireGuards;
      state.waterfolk = Array.isArray(data.waterfolk) ? data.waterfolk : state.waterfolk;
      state.windfolk = Array.isArray(data.windfolk) ? data.windfolk : state.windfolk;
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
      state.fireKing = data.fireKing && typeof data.fireKing === 'object'
        ? data.fireKing
        : state.fireKing;
      state.fireDungeon = data.fireDungeon && typeof data.fireDungeon === 'object'
        ? data.fireDungeon
        : state.fireDungeon;
      state.friendlyFireKing = data.friendlyFireKing && typeof data.friendlyFireKing === 'object'
        ? data.friendlyFireKing
        : state.friendlyFireKing;
      state.waterCaves = data.waterCaves && typeof data.waterCaves === 'object'
        ? data.waterCaves
        : state.waterCaves;
      state.airCaves = data.airCaves && typeof data.airCaves === 'object'
        ? data.airCaves
        : state.airCaves;
      state.waterWell = data.waterWell && typeof data.waterWell === 'object'
        ? data.waterWell
        : state.waterWell;
      state.goldenFlowerGuardian = data.goldenFlowerGuardian && typeof data.goldenFlowerGuardian === 'object'
        ? data.goldenFlowerGuardian
        : state.goldenFlowerGuardian;
      state.airGuardian = data.airGuardian && typeof data.airGuardian === 'object'
        ? data.airGuardian
        : state.airGuardian;
      state.airThief = data.airThief && typeof data.airThief === 'object'
        ? data.airThief
        : state.airThief;
      state.evilTrunk = data.evilTrunk && typeof data.evilTrunk === 'object'
        ? data.evilTrunk
        : state.evilTrunk;
      state.kraken = data.kraken && typeof data.kraken === 'object'
        ? data.kraken
        : state.kraken;
      state.quake = data.quake && typeof data.quake === 'object'
        ? data.quake
        : state.quake;
      state.fireWorldMeta = data.fireWorldMeta && typeof data.fireWorldMeta === 'object'
        ? data.fireWorldMeta
        : state.fireWorldMeta;
      state.waterWorldMeta = data.waterWorldMeta && typeof data.waterWorldMeta === 'object'
        ? data.waterWorldMeta
        : state.waterWorldMeta;
      state.airWorldMeta = data.airWorldMeta && typeof data.airWorldMeta === 'object'
        ? data.airWorldMeta
        : state.airWorldMeta;
      state.undergroundWorldMeta = data.undergroundWorldMeta && typeof data.undergroundWorldMeta === 'object'
        ? data.undergroundWorldMeta
        : state.undergroundWorldMeta;
      state.endWorldMeta = data.endWorldMeta && typeof data.endWorldMeta === 'object'
        ? data.endWorldMeta
        : state.endWorldMeta;
      state.dimensions = data.dimensions && typeof data.dimensions === 'object'
        ? {
            overworld: data.dimensions.overworld || null,
            fire: data.dimensions.fire || null,
            water: data.dimensions.water || null,
            air: data.dimensions.air || null,
            underground: data.dimensions.underground || null,
            end: data.dimensions.end || null,
          }
        : state.dimensions;
      state.activeDimension = typeof data.activeDimension === 'string' ? data.activeDimension : 'overworld';
      state.portalLinks = data.portalLinks && typeof data.portalLinks === 'object'
        ? {
            fireGate: data.portalLinks.fireGate || null,
            waterGate: data.portalLinks.waterGate || null,
            airGate: data.portalLinks.airGate || null,
            undergroundGate: data.portalLinks.undergroundGate || null,
            undergroundGates: data.portalLinks.undergroundGates && typeof data.portalLinks.undergroundGates === 'object' ? data.portalLinks.undergroundGates : {},
            endGate: data.portalLinks.endGate || null,
          }
        : { fireGate: null, waterGate: null, airGate: null, undergroundGate: null, undergroundGates: {}, endGate: null };
      state.gameOver = !!data.gameOver;
      state.hardcoreDeath = data.hardcoreDeath && typeof data.hardcoreDeath === 'object' ? data.hardcoreDeath : null;
      state.endingScene = data.endingScene && typeof data.endingScene === 'object' ? data.endingScene : null;
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
      state.weather = data.weather && typeof data.weather === 'object'
        ? {
            type: data.weather.type || 'clear',
            targetType: data.weather.targetType || data.weather.type || 'clear',
            intensity: Number.isFinite(data.weather.intensity) ? data.weather.intensity : 0,
            targetIntensity: Number.isFinite(data.weather.targetIntensity) ? data.weather.targetIntensity : 0,
            timer: Number.isFinite(data.weather.timer) ? data.weather.timer : 24,
            contextKey: typeof data.weather.contextKey === 'string' ? data.weather.contextKey : '',
          }
        : state.weather;
      state.friendshipAmuletTick = Number.isFinite(data.friendshipAmuletTick) ? data.friendshipAmuletTick : 0;
      state.steamEffects = Array.isArray(data.steamEffects) ? data.steamEffects : [];
      state.echoPulse = data.echoPulse && typeof data.echoPulse === 'object'
        ? {
            timer: Number.isFinite(data.echoPulse.timer) ? data.echoPulse.timer : 0,
            cooldown: Number.isFinite(data.echoPulse.cooldown) ? data.echoPulse.cooldown : 0,
            ores: Array.isArray(data.echoPulse.ores) ? data.echoPulse.ores : [],
            passages: Array.isArray(data.echoPulse.passages) ? data.echoPulse.passages : [],
            structures: Array.isArray(data.echoPulse.structures) ? data.echoPulse.structures : [],
          }
        : state.echoPulse;
      state.invisibilityBlocks = Array.isArray(data.invisibilityBlocks) ? data.invisibilityBlocks : state.invisibilityBlocks;
      state.invisibilityGroupSeed = Number.isFinite(data.invisibilityGroupSeed) ? data.invisibilityGroupSeed : state.invisibilityGroupSeed;
      state.temporaryEarthBlocks = Array.isArray(data.temporaryEarthBlocks) ? data.temporaryEarthBlocks : state.temporaryEarthBlocks;
      state.factionMemory = data.factionMemory && typeof data.factionMemory === 'object' ? data.factionMemory : state.factionMemory;
      state.settings = data.settings && typeof data.settings === 'object'
        ? {
            ...state.settings,
            ...data.settings,
            ambientNpcSpeech: data.settings.ambientNpcSpeech !== false,
          }
        : state.settings;
      state.achievements = data.achievements && typeof data.achievements === 'object'
        ? {
            unlocked: data.achievements.unlocked && typeof data.achievements.unlocked === 'object' ? data.achievements.unlocked : {},
            order: Array.isArray(data.achievements.order) ? data.achievements.order : [],
            scanTick: Number.isFinite(data.achievements.scanTick) ? data.achievements.scanTick : 0,
          }
        : state.achievements;

      if (data.player) {
        Object.assign(state.player, data.player);
        state.player.hotbar = normalizeSlotArray(data.player.hotbar, HOTBAR_SIZE);
        state.player.inventory = normalizeSlotArray(data.player.inventory, 27);
        state.player.armor = normalizeArmorSlots(data.player.armor);
        if (!state.player.spawnPoint || typeof state.player.spawnPoint !== 'object') {
          state.player.spawnPoint = { dimension: 'overworld', x: state.player.x, y: state.player.y };
        }
        if (!Array.isArray(state.player.sleepRespawnHistory)) state.player.sleepRespawnHistory = [];
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
      state.pause.showModePicker = false;
      state.pause.showAssistant = false;
      state.pause.statusText = '';
      state.autosaveTick = 0;
      ensureDimensions(state);
      if (!data.dimensions || !state.dimensions[state.activeDimension]) syncActiveDimension(state);
      else if (state.dimensions[state.activeDimension]) Game.state.applyDimensionState(state, state.dimensions[state.activeDimension]);
      Game.generation.retrofitVillageBackWalls(state);
      Game.generation.retrofitVillageWorkyards(state);
      Game.layers.initialize(state);
      syncActiveDimension(state);
      return state;
    } catch (error) {
      return null;
    }
  }

  function deleteWorld(worldId) {
    const storage = Game.worldStorage;
    if (!storage.initialized) return storage.ready.then(() => deleteWorld(worldId));
    try {
      localStorage.removeItem(worldStorageKey(worldId));
      const nextIndex = readIndex().filter((entry) => entry && entry.id !== worldId);
      writeIndex(nextIndex);
    } catch (error) {
      // A full local index does not prevent deleting a database-only world.
      if (!storage.get(worldId)) return false;
    }
    if (storage.get(worldId)) return storage.remove(worldId).catch(() => false);
    return true;
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

  function purgeMods() {
    try {
      const index = readIndex();
      for (const entry of index) {
        if (!entry || !entry.id) continue;
        delete entry.modId;
        delete entry.modName;
        delete entry.modSummary;
        const raw = localStorage.getItem(worldStorageKey(entry.id));
        if (!raw) continue;
        try {
          const snapshot = JSON.parse(raw);
          if (snapshot && snapshot.worldMeta && typeof snapshot.worldMeta === 'object') {
            delete snapshot.worldMeta.modId;
            delete snapshot.worldMeta.modName;
            delete snapshot.worldMeta.modSummary;
          }
          localStorage.setItem(worldStorageKey(entry.id), JSON.stringify(snapshot));
        } catch (error) {
          // ignore single world cleanup failures
        }
      }
      writeIndex(index);
      const modIndexRaw = localStorage.getItem(MOD_INDEX_KEY);
      if (modIndexRaw) {
        const modIndex = JSON.parse(modIndexRaw);
        if (Array.isArray(modIndex)) {
          for (const entry of modIndex) {
            if (entry && entry.id) localStorage.removeItem(`${MOD_PREFIX}${entry.id}`);
          }
        }
      }
      localStorage.removeItem(MOD_INDEX_KEY);
    } catch (error) {
      // ignore purge failures
    }
  }

  Game.saveSystem = { saveWorld, loadWorld, listWorlds, deleteWorld, createWorldMeta, migrateLegacySave, purgeMods };
})();
