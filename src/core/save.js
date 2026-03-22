(() => {
  const Game = window.MC2D;
  const SAVE_KEY = 'mc2d-save-v1';
  const { HOTBAR_SIZE } = Game.constants;
  const { createGameState } = Game.state;
  const { createSlot, normalizeSlot } = Game.inventory;

  function normalizeSlotArray(slots, size) {
    const result = Array.from({ length: size }, (_, index) => {
      const raw = slots && slots[index] ? slots[index] : createSlot();
      return normalizeSlot({
        id: raw.id ?? null,
        count: raw.count ?? 0,
        durability: raw.durability ?? null,
      });
    });
    return result;
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

  function snapshotState(state) {
    return {
      world: state.world,
      biomeAt: state.biomeAt,
      surfaceAt: state.surfaceAt,
      animals: state.animals,
      zombies: state.zombies,
      spiders: state.spiders,
      foods: state.foods,
      furnaces: state.furnaces,
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

  function saveGame(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshotState(state)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const state = createGameState();

      state.world = Array.isArray(data.world) ? data.world : state.world;
      state.biomeAt = Array.isArray(data.biomeAt) ? data.biomeAt : state.biomeAt;
      state.surfaceAt = Array.isArray(data.surfaceAt) ? data.surfaceAt : state.surfaceAt;
      state.animals = Array.isArray(data.animals) ? data.animals : state.animals;
      state.zombies = Array.isArray(data.zombies) ? data.zombies : state.zombies;
      state.spiders = Array.isArray(data.spiders) ? data.spiders : state.spiders;
      state.foods = Array.isArray(data.foods) ? data.foods : state.foods;
      state.furnaces = normalizeFurnaces(data.furnaces);
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
      }

      state.crafting.open = false;
      state.crafting.grid = Array.from({ length: 9 }, () => createSlot());
      state.crafting.cursor = createSlot();
      state.crafting.result = null;
      state.pause.open = false;
      state.pause.confirmRestart = false;
      state.pause.statusText = '';
      state.autosaveTick = 0;
      return state;
    } catch (error) {
      return null;
    }
  }

  function clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  Game.saveSystem = { saveGame, loadGame, clearSave };
})();
