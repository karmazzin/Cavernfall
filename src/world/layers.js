(() => {
  const Game = window.MC2D;
  const { WORLD_W, WORLD_H, TILE, DEEP_START } = Game.constants;
  const { BLOCK: B } = Game.blocks;
  const arrays = ['animals', 'zombies', 'spiders', 'fireGuards', 'waterfolk', 'windfolk', 'humans', 'dwarves', 'foods'];
  const singles = ['fireBoss', 'fireKing', 'friendlyFireKing', 'kraken', 'goldenFlowerGuardian', 'airGuardian', 'airThief', 'evilTrunk'];
  const layerOf = entity => entity?.layer || 1;
  const at = (state, x, y) => state.blockLayers?.[`${x},${y}`] || 1;
  const same = (a, b) => layerOf(a) === layerOf(b);
  const valid = (x, y) => x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
  function selected(state, input) {
    if (input?.keys?.has('ShiftRight')) return state.worldMeta.mode === 'creative' ? 3 : 2;
    return input?.keys?.has('ShiftLeft') ? 2 : 1;
  }
  function notify(state, layer, entity = false) {
    if (layer === 1) return;
    state.ui.noticeText = `${entity ? 'Сущность призвана' : 'Блок установлен'} на ${layer === 2 ? 'второй' : 'третий'} слой`;
    state.ui.noticeTimer = 2.5;
  }
  function place(state, x, y, id, layer) {
    if (!valid(x, y) || ![1, 2, 3].includes(layer)) return false;
    if (state.world[y][x] !== B.AIR) return false;
    Game.world.setBlock(state, x, y, id, layer);
    return true;
  }
  function isWood(id) {
    return id === B.WOOD || id === B.SPRUCE_WOOD || id === B.SEQUOIA_WOOD || id === B.GREAT_TREE_WOOD || Game.blocks.SEASON_WOODS.has(id);
  }
  function initialize(state) {
    delete state.background;
    if (state.layersVersion === 5 && state.backdrop) return;
    state.blockLayers ||= {};
    // Only pre-layer saves need the one-time trunk migration.
    if (!state._newLayerWorld && !state.layersVersion) {
      for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
        if (isWood(state.world[y][x]) && !state.blockLayers[`${x},${y}`]) state.blockLayers[`${x},${y}`] = 3;
      }
    }
    const surfaceDimension = !state.activeDimension || state.activeDimension === 'overworld';
    const noCaves = ['flat', 'floating_islands'].includes(state.worldMeta.worldType);
    const terrain = new Set([B.GRASS, B.DIRT, B.STONE, B.SNOW, B.SAND, B.SANDSTONE,
      B.BASALT, B.RED_EARTH, B.AUTUMN_GRASS, B.MOSS, B.MUSHROOM_SOIL, B.ASH,
      B.ASH_STONE, B.CORAL_STONE, B.DEEPSTONE, B.BLACKSTONE, B.CLOUD]);
    const columns = [];
    for (let x = 0; x < WORLD_W; x++) {
      const surface = state.surfaceAt[x];
      const biome = state.biomeAt[x];
      const drawSurface = surfaceDimension && state.worldMeta.landscape3d && biome !== 'void' && biome !== 'field'
        && !(state.worldMeta.worldType === 'single_biome' && state.worldMeta.singleBiome === 'field');
      const wave = (Math.sin(x / 19 + 2) + Math.sin(x / 43)) / 2;
      const rise = wave > 0.85 ? 4 : wave > 0.6 ? 3 : wave > 0 ? 2 : 1;
      const hill = drawSurface ? Math.max(1, surface - rise) : WORLD_H;
      const elemental = ['fire_caves', 'water_caves', 'air_caves'].includes(biome);
      const deep = elemental || biome === 'volcano' ? WORLD_H : biome === 'deep' ? 0 : surfaceDimension
        ? DEEP_START + Math.round(Math.sin(x / 37) * 2 + Math.sin(x / 13) * 1.2) : WORLD_H;
      const fallback = biome === 'desert' ? [B.SAND, B.SAND, B.SANDSTONE]
        : biome === 'volcano' ? [B.BASALT, B.BASALT, B.BASALT]
        : biome === 'snow_plains' ? [B.SNOW, B.DIRT, B.STONE] : [B.GRASS, B.DIRT, B.STONE];
      const materials = drawSurface ? [0, 1, 5].map((depth, i) => {
        const id = state.world[Math.min(WORLD_H - 1, surface + depth)]?.[x];
        const rocky = biome === 'mountains' || biome === 'volcano';
        const rockAtSurface = i < 2 && [B.STONE, B.DEEPSTONE, B.BLACKSTONE, B.BASALT, B.SANDSTONE, B.ASH_STONE, B.CORAL_STONE].includes(id);
        return terrain.has(id) && (rocky || !rockAtSurface) ? id : fallback[i];
      }) : fallback;
      // A visual column profile, not a grid of simulated blocks:
      // hill top, hill bottom, cave top, deep top, grass/soil/rock, cave rock.
      columns.push([hill, surface + 5, noCaves ? WORLD_H : surface + 1, deep,
        ...materials, !elemental && biome === 'volcano' ? B.BASALT : B.STONE]);
    }
    const regions = [state.fireCaves, state.waterCaves, state.airCaves]
      .map(cave => cave?.region).filter(Boolean)
      .map(r => ({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 }));
    state.backdrop = { columns, regions };
    state.layersVersion = 5;
    delete state._newLayerWorld;
  }
  function withLayer(state, layer, action) {
    const previous = state._interactionLayer;
    state._interactionLayer = layer;
    try { return action(state); } finally { state._interactionLayer = previous; }
  }
  // NPC systems receive only peers from their own layer. Their world reads/writes
  // use the same layer, including collision and ground checks.
  function simulate(state, action) {
    for (const layer of [1, 2, 3]) {
      if (layer !== 1 && !arrays.some(key => state[key]?.some(e => layerOf(e) === layer)) && !singles.some(key => state[key] && layerOf(state[key]) === layer)) continue;
      const originals = {};
      for (const key of [...arrays, ...singles]) originals[key] = state[key];
      const player = state.player;
      const meta = state.worldMeta;
      for (const key of arrays) state[key] = (originals[key] || []).filter(e => layerOf(e) === layer);
      for (const key of singles) state[key] = originals[key] && layerOf(originals[key]) === layer ? originals[key] : null;
      if (layer !== layerOf(player)) {
        state.player = { ...player, x: -100000, y: -100000, hotbar: [], inventory: [], armor: {}, layer: layerOf(player) };
        state.worldMeta = { ...meta, mode: 'spectator' };
      }
      const ticks = {};
      for (const key of ['zombieSpawnTick', 'zombieCaveSpawnTick', 'spiderSpawnTick', 'spiderCaveSpawnTick']) {
        ticks[key] = state[key];
        if (layer !== 1) state[key] = -1e9;
      }
      try { withLayer(state, layer, action); }
      finally {
        for (const key of arrays) {
          for (const e of state[key]) e.layer = layer;
          const kept = (originals[key] || []).filter(e => layerOf(e) !== layer);
          state[key] = [...kept, ...state[key]];
        }
        for (const key of singles) {
          if (state[key]) state[key].layer = layer;
          if (originals[key] && layerOf(originals[key]) !== layer) state[key] = originals[key];
        }
        if (layer !== 1) for (const key of Object.keys(ticks)) state[key] = ticks[key];
        state.player = player;
        state.worldMeta = meta;
      }
    }
  }
  function supportAt(state, px, py, ent) {
    // Falling obeys the same layer isolation as sideways and upward movement.
    return Game.world.isSolidAtPixel(state, px, py, ent);
  }
  Game.layers = { at, layerOf, same, selected, place, notify, initialize, isWood, withLayer, simulate, supportAt, arrays, singles };
})();
