(() => {
  const Game = window.MC2D;
  const { BLOCK: B, SEASON_LEAVES } = Game.blocks;
  const { WORLD_W, CYCLE } = Game.constants;
  const { getBlock, setBlock } = Game.world;
  const SPECIES = {
    maple: [B.MAPLE_WOOD, B.MAPLE_LEAF],
    rowan: [B.ROWAN_WOOD, B.ROWAN_LEAF],
    aspen: [B.ASPEN_WOOD, B.ASPEN_LEAF],
    birch: [B.BIRCH_WOOD, B.BIRCH_LEAF],
    cherry: [B.CHERRY_WOOD, B.CHERRY_LEAF],
  };
  const BIOMES = ['plains', 'autumn_forest', 'snow_plains', 'cherry_forest'];
  const key = (x, y) => `${x},${y}`;
  const isSeasonWorld = state => state.worldMeta && state.worldMeta.worldType === 'seasons';
  const inOverworld = state => !state.activeDimension || state.activeDimension === 'overworld';

  function chooseSpecies() {
    const roll = Math.random();
    return roll < 0.46 ? 'maple' : roll < 0.7 ? 'rowan' : roll < 0.92 ? 'aspen' : 'birch';
  }

  function plantTree(state, x, groundY, species, autumn) {
    const [wood, greenLeaf] = SPECIES[species];
    const leaf = autumn ? B.AUTUMN_LEAF : greenLeaf;
    const height = species === 'birch' || species === 'aspen' ? 6 : 4 + Math.floor(Math.random() * 2);
    const radius = species === 'cherry' ? 3 : 2;
    if (groundY - height - 2 < 0) return false;
    // Require room for the whole crown, never bury a building or another tree.
    for (let yy = groundY - height - 2; yy < groundY; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (getBlock(state, xx, yy) !== B.AIR) return false;
      }
    }
    const tree = { id: key(x, groundY - 1), trunks: [], leaves: [], wood, greenLeaf };
    for (let y = groundY - height; y < groundY; y++) {
      setBlock(state, x, y, wood);
      tree.trunks.push(key(x, y));
    }
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > radius + 1) continue;
        const y = groundY - height + dy;
        if (getBlock(state, x + dx, y) !== B.AIR) continue;
        setBlock(state, x + dx, y, leaf);
        tree.leaves.push(key(x + dx, y));
      }
    }
    if (Game.farming) Game.farming.registerLeaves(state, tree.leaves, greenLeaf);
    if (isSeasonWorld(state)) {
      if (!state.seasonTrees) state.seasonTrees = [];
      state.seasonTrees.push(tree);
    }
    return true;
  }

  function decorate(state) {
    const seasonal = isSeasonWorld(state);
    for (let x = 4; x < WORLD_W - 4; x++) {
      const biome = state.biomeAt[x];
      if (!seasonal && biome !== 'autumn_forest' && biome !== 'cherry_forest') continue;
      const y = state.surfaceAt[x];
      if (getBlock(state, x, y) !== B.GRASS) continue;
      const chance = seasonal ? 0.07 : biome === 'autumn_forest' ? 0.27 : 0.1;
      if (Math.random() < chance) plantTree(state, x, y, biome === 'cherry_forest' ? 'cherry' : chooseSpecies(), !seasonal && biome === 'autumn_forest');
    }
    for (let x = 1; x < WORLD_W - 1; x++) {
      const biome = state.biomeAt[x], y = state.surfaceAt[x];
      if (seasonal || (biome !== 'autumn_forest' && biome !== 'cherry_forest')) continue;
      if (getBlock(state, x, y) !== B.GRASS) continue;
      if (biome === 'autumn_forest') setBlock(state, x, y, B.AUTUMN_GRASS);
      if (getBlock(state, x, y - 1) !== B.AIR) continue;
      // Every eligible floor cell gets cover or a mushroom, with gaps inside the sprite.
      const mushroomChance = biome === 'autumn_forest' ? 0.32 : 0.015;
      const roll = Math.random();
      const mushroom = roll < 0.48 ? B.SMALL_WHITE_MUSHROOM : roll < 0.86 ? B.CHANTERELLE : B.SMALL_FLY_AGARIC;
      setBlock(state, x, y - 1, Math.random() < mushroomChance ? (biome === 'cherry_forest' ? B.SMALL_WHITE_MUSHROOM : mushroom) : biome === 'autumn_forest' ? B.LEAF_LITTER : B.PINK_FLOWERS);
    }
  }

  function initialize(state) {
    const cells = {}, trunks = {};
    function add(k, values, tree = null, cover = false) {
      cells[k] = { values, tree, cover };
      const [x,y] = k.split(',').map(Number);
      state.world[y][x] = values[0];
    }
    for (let x = 0; x < WORLD_W; x++) {
      const y = state.surfaceAt[x];
      if (getBlock(state, x, y) !== B.GRASS) continue;
      add(key(x,y), [B.GRASS, B.AUTUMN_GRASS, B.SNOW, B.GRASS]);
      if (getBlock(state, x, y-1) !== B.AIR) continue;
      if (Math.random() < 0.18) {
        const roll = Math.random();
        const mushroom = roll < 0.48 ? B.SMALL_WHITE_MUSHROOM : roll < 0.87 ? B.CHANTERELLE : B.SMALL_FLY_AGARIC;
        add(key(x,y-1), [B.AIR, mushroom, B.AIR, B.PINK_FLOWERS], null, true);
      } else {
        add(key(x,y-1), [B.AIR, B.LEAF_LITTER, B.AIR, B.PINK_FLOWERS], null, true);
      }
    }
    for (const tree of state.seasonTrees || []) {
      for (const k of tree.trunks) trunks[k] = tree.id;
      for (const k of tree.leaves) {
        const [x,y] = k.split(',').map(Number);
        if (SEASON_LEAVES.has(getBlock(state,x,y))) add(k, [tree.greenLeaf, B.AUTUMN_LEAF, B.AIR, tree.greenLeaf], tree.id);
      }
    }
    delete state.seasonTrees;
    state.seasons = { index: 0, cells, trunks, baseBiomes: state.biomeAt.slice() };
  }

  function markChanged(state, x, y, id) {
    const data = state.seasons;
    if (!data || !inOverworld(state) || getBlock(state,x,y) === id) return;
    const k = key(x,y);
    delete data.cells[k];
    // A removed/replaced floor permanently removes its natural ground cover.
    const aboveKey = key(x,y-1), above = data.cells[aboveKey];
    if (above && above.cover) {
      if (getBlock(state,x,y-1) === above.values[data.index]) state.world[y-1][x] = B.AIR;
      delete data.cells[aboveKey];
    }
    const tree = data.trunks[k];
    if (tree) {
      for (const [leafKey, cell] of Object.entries(data.cells)) {
        if (cell.tree !== tree) continue;
        const [lx,ly] = leafKey.split(',').map(Number);
        if (getBlock(state,lx,ly) === cell.values[data.index]) state.world[ly][lx] = B.AIR;
        delete data.cells[leafKey];
      }
      delete data.trunks[k];
    }
  }

  function update(state) {
    const data = state.seasons;
    if (!isSeasonWorld(state) || !data || !inOverworld(state)) return;
    const next = Math.floor(Math.max(0, state.cycleTime) / (5 * CYCLE)) % 4;
    if (next === data.index) return;
    for (const [k, cell] of Object.entries(data.cells)) {
      const [x,y] = k.split(',').map(Number);
      // Also respect edits from systems that write directly to the terrain grid.
      if (getBlock(state,x,y) !== cell.values[data.index]) {
        delete data.cells[k];
        continue;
      }
      state.world[y][x] = cell.values[next];
    }
    for (let x = 0; x < WORLD_W; x++) {
      // Lake columns keep their water identity and never become dry terrain.
      if (data.baseBiomes[x] === 'lake' || data.baseBiomes[x] === 'field') continue;
      state.biomeAt[x] = BIOMES[next];
      state.climateAt[x] = next === 2 ? 'cold' : 'temperate';
    }
    data.index = next;
    if (Game.farming) Game.farming.invalidateSoil(state);
    if (state.weather) state.weather.contextKey = '';
  }

  Game.seasons = { plantTree, decorate, initialize, markChanged, update };
})();
