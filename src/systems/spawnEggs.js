(() => {
  const Game = window.MC2D;
  const { TILE, GRAVITY } = Game.constants;
  const { ITEM } = Game.items;
  const { rand } = Game.math;
  const { getBlock, blockSolid } = Game.world;
  const { createItemStack, removeFromSlot } = Game.inventory;

  function isCreativeLike(state) {
    return !!(state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'infinite_inventory'));
  }

  function findSpawnSpot(state, tx, ty, wTiles = 1, hTiles = 2) {
    for (let dy = 0; dy >= -4; dy -= 1) {
      const baseTy = ty + dy;
      let clear = true;
      for (let oy = 0; oy < hTiles; oy += 1) {
        for (let ox = 0; ox < wTiles; ox += 1) {
          const block = getBlock(state, tx + ox, baseTy - oy);
          if (block !== Game.blocks.BLOCK.AIR && block !== Game.blocks.BLOCK.WATER) clear = false;
        }
      }
      if (!clear) continue;
      let solidFloor = false;
      for (let ox = 0; ox < wTiles; ox += 1) {
        if (blockSolid(getBlock(state, tx + ox, baseTy + 1))) solidFloor = true;
      }
      if (solidFloor) return { x: tx * TILE + 2, y: (baseTy - (hTiles - 1)) * TILE };
    }
    return null;
  }

  function createAnimal(tx, ty) {
    return {
      x: tx * TILE + 2, y: ty * TILE, w: 12, h: 10, vx: 0, vy: 0, onGround: false, hp: 4,
      dir: Math.random() < 0.5 ? -1 : 1, state: 'idle', stateTimer: rand(1.4, 3.2), grazing: false,
      walkMin: 6, walkMax: 10, moveSpeed: 22, panicSpeed: 60, targetVx: 0, hopCd: 0, obstacleTimer: 0,
      clickCd: 0, edgeCooldown: 0, commitTimer: 0, stuckTimer: 0, turnLockTimer: 0,
    };
  }

  function createZombie(tx, ty) {
    return { x: tx * TILE, y: ty * TILE, w: 12, h: 24, vx: 0, vy: 0, onGround: false, attackCd: 0, hp: 3, burnTimer: 0, jumpCd: 0, obstacleTimer: 0 };
  }

  function createSpider(tx, ty) {
    return { x: tx * TILE + 1, y: ty * TILE + 4, w: 14, h: 10, vx: 0, vy: 0, onGround: false, hp: 2, attackCd: 0, clickCd: 0, moveTimer: rand(0.4, 1.5), dir: Math.random() < 0.5 ? -1 : 1, jumpCd: 0, obstacleTimer: 0 };
  }

  function createHuman(tx, ty, profession = 'farmer', role = 'villager') {
    return {
      id: `egg-human-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`,
      villageId: null, homeId: null, x: tx * TILE + 2, y: ty * TILE, w: 12, h: 22, vx: 0, vy: 0, hp: 4,
      onGround: false, dir: Math.random() < 0.5 ? -1 : 1, role, profession,
      palette: { body: '#75624f', accent: role === 'guard' ? '#5477a7' : '#84a96e', hat: '#8f6a3f' },
      state: role === 'guard' ? 'guard' : 'idle', stateTimer: rand(1.2, 2.8), route: [], routeIndex: 0,
      routeTargetId: null, attackCd: 0, clickCd: 0, homeNodeId: null, workNodeId: null, towerNodeId: null,
      sleepBlockX: null, sleepBlockY: null, sleeping: false,
    };
  }

  function createDwarf(tx, ty, role = 'miner') {
    return {
      id: `egg-dwarf-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`,
      settlementId: null, homeId: null, x: tx * TILE + 2, y: ty * TILE, w: 12, h: 20, vx: 0, vy: 0,
      onGround: false, hp: 5, dir: Math.random() < 0.5 ? -1 : 1, state: 'idle', stateTimer: rand(1.2, 2.8),
      attackCd: 0, mineTimer: 0, jumpCd: 0, obstacleTimer: 0, targetX: tx, targetY: ty, route: [], routeIndex: 0,
      routeTargetId: null, role, worksiteIndex: -1,
    };
  }

  function createFireGuard(tx, ty, role = 'guard') {
    return { x: tx * TILE + 1, y: ty * TILE, w: 14, h: 24, vx: 0, vy: 0, onGround: false, hp: 50, maxHp: 50, dir: 1, attackCd: 0, jumpCd: 0, obstacleTimer: 0, patrolTimer: 2, role, breakTimer: 0, miningSwing: 0 };
  }

  function createFireBoss(tx, ty) {
    return { x: tx * TILE - 15, y: ty * TILE - 18, w: 30, h: 42, vx: 0, vy: 0, onGround: false, hp: 70, maxHp: 70, attackCd: 0, dir: 1, phase: 'idle', arenaX: tx, isBoss: true, name: 'Огненный страж' };
  }

  function createFireKing(tx, ty) {
    return { x: tx * TILE - 40, y: ty * TILE - 140, w: 80, h: 160, vx: 0, vy: 0, onGround: false, hp: 100, maxHp: 100, attackCd: 0, phase: 'idle', phaseTimer: 0, dir: 1, summonStage: 0, awakened: true, erupted: false, castleCenterX: tx, castleBaseY: ty + 10, isBoss: true, name: 'Огненный король' };
  }

  function createFriendlyFireKing(tx, ty) {
    return { x: tx * TILE, y: ty * TILE - 24, w: 20, h: 30, state: 'freed', stateTimer: 0, targetX: null, targetY: null, freed: true };
  }

  function createKraken(tx, ty) {
    return {
      x: tx * TILE - 24, y: ty * TILE - 16, w: 64, h: 48, hp: 200, maxHp: 200, phase: 'idle', phaseTimer: 0, attackCd: 0.6,
      dir: 1, vx: 0, vy: 0, isBoss: true, name: 'Кракен', arena: { x0: Math.max(0, (tx - 12) * TILE), x1: (tx + 12) * TILE, y0: Math.max(0, (ty - 8) * TILE), y1: (ty + 8) * TILE },
    };
  }

  const EGG_DEFS = [
    { id: ITEM.SPAWN_EGG_SHEEP, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.animals.push(createAnimal(tx, ty)); } },
    { id: ITEM.SPAWN_EGG_ZOMBIE, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.zombies.push(createZombie(tx, ty)); } },
    { id: ITEM.SPAWN_EGG_SPIDER, wTiles: 2, hTiles: 1, spawn(state, tx, ty) { state.spiders.push(createSpider(tx, ty)); } },
    { id: ITEM.SPAWN_EGG_DWARF_GUARD, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.dwarves.push(createDwarf(tx, ty, 'guard')); } },
    { id: ITEM.SPAWN_EGG_DWARF_MINER, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.dwarves.push(createDwarf(tx, ty, 'miner')); } },
    { id: ITEM.SPAWN_EGG_HUMAN_FARMER, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.humans.push(createHuman(tx, ty, 'farmer')); } },
    { id: ITEM.SPAWN_EGG_HUMAN_SHEPHERD, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.humans.push(createHuman(tx, ty, 'shepherd')); } },
    { id: ITEM.SPAWN_EGG_HUMAN_MASON, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.humans.push(createHuman(tx, ty, 'mason')); } },
    { id: ITEM.SPAWN_EGG_HUMAN_LUMBER, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.humans.push(createHuman(tx, ty, 'lumber')); } },
    { id: ITEM.SPAWN_EGG_HUMAN_MINER, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.humans.push(createHuman(tx, ty, 'miner')); } },
    { id: ITEM.SPAWN_EGG_HUMAN_MERCHANT, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.humans.push(createHuman(tx, ty, 'merchant')); } },
    { id: ITEM.SPAWN_EGG_HUMAN_GUARD, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.humans.push(createHuman(tx, ty, 'guard', 'guard')); } },
    { id: ITEM.SPAWN_EGG_FIRE_GUARD, wTiles: 1, hTiles: 2, spawn(state, tx, ty) { state.fireGuards.push(createFireGuard(tx, ty)); } },
    { id: ITEM.SPAWN_EGG_FIRE_GUARDIAN, wTiles: 2, hTiles: 3, spawn(state, tx, ty) { state.fireBoss = createFireBoss(tx, ty); } },
    { id: ITEM.SPAWN_EGG_FIRE_KING, wTiles: 5, hTiles: 10, spawn(state, tx, ty) { state.fireKing = createFireKing(tx, ty); } },
    { id: ITEM.SPAWN_EGG_FRIENDLY_FIRE_KING, wTiles: 2, hTiles: 3, spawn(state, tx, ty) { state.friendlyFireKing = createFriendlyFireKing(tx, ty); } },
    { id: ITEM.SPAWN_EGG_KRAKEN, wTiles: 4, hTiles: 4, spawn(state, tx, ty) { state.kraken = createKraken(tx, ty); } },
  ];

  const EGG_MAP = Object.fromEntries(EGG_DEFS.map((entry) => [entry.id, entry]));

  function isSpawnEgg(itemId) {
    return !!EGG_MAP[itemId];
  }

  function getSpawnEggEntries() {
    return EGG_DEFS.map((entry) => createItemStack(entry.id, 64));
  }

  function tryUseSelectedSpawnEgg(state, tx, ty) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    if (!slot || !slot.id || !isSpawnEgg(slot.id)) return false;
    const egg = EGG_MAP[slot.id];
    const spot = findSpawnSpot(state, tx, ty, egg.wTiles || 1, egg.hTiles || 2);
    if (!spot) {
      state.ui.noticeText = 'Нет места для призыва.';
      state.ui.noticeTimer = 2.5;
      return true;
    }
    egg.spawn(state, tx, Math.floor(spot.y / TILE));
    if (!isCreativeLike(state)) removeFromSlot(slot, 1);
    state.ui.noticeText = 'Моб призван.';
    state.ui.noticeTimer = 2;
    return true;
  }

  Game.spawnEggSystem = { isSpawnEgg, getSpawnEggEntries, tryUseSelectedSpawnEgg };
})();
