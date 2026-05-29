(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, WORLD_H } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { getItemDefinition } = Game.items;
  const { getBlock, setBlock, blockSolid } = Game.world;
  const { addToInventory, countItem, selectedItemId, removeItem } = Game.inventory;
  const { removeFromSlot } = Game.inventory;
  const { isPlayerUndetectable } = Game.invisibilitySystem || {};
  const { applyPlayerDamage, getMaxHealth } = Game.combat;
  const ECHO_PULSE_DURATION = 7;
  const ECHO_PULSE_COOLDOWN = 14;
  const ECHO_SCAN_RADIUS = 14;
  const ECHO_STRUCTURE_RADIUS = 40;
  const ECHO_MAX_ORES = 18;
  const ECHO_MAX_PASSAGES = 16;
  const ROOT_HEART_DURATION = 10;
  const ROOT_HEART_COOLDOWN = 18;
  const ROOT_HEART_NATURAL_BLOCKS = new Set([
    BLOCK.GRASS,
    BLOCK.DIRT,
    BLOCK.MOSS,
    BLOCK.MUSHROOM_SOIL,
    BLOCK.GREAT_TREE_WOOD,
  ]);
  const ECHO_ORE_BLOCKS = new Set([
    BLOCK.DIAMOND_ORE,
    BLOCK.DEEP_ORE,
    BLOCK.FRIENDSHIP_ORE,
    BLOCK.STEAM_ORE,
    BLOCK.INVISIBLE_ORE,
  ]);

  function ensureGardenMeta(state, meta) {
    if (meta.garden && Number.isFinite(meta.garden.x0) && Number.isFinite(meta.garden.x1)) return meta.garden;
    let x0 = null;
    let x1 = null;
    let groundY = Infinity;
    for (let tx = 0; tx < WORLD_W; tx += 1) {
      if (state.biomeAt[tx] !== 'great_tree_garden') continue;
      if (x0 == null) x0 = tx;
      x1 = tx;
      groundY = Math.min(groundY, Number.isFinite(state.surfaceAt[tx]) ? state.surfaceAt[tx] : groundY);
    }
    if (x0 == null) return null;
    meta.garden = {
      x0,
      x1,
      centerX: Math.floor((x0 + x1) / 2),
      groundY: Number.isFinite(groundY) ? groundY : 48,
    };
    return meta.garden;
  }

  function ensureEchoPulseState(state) {
    if (!state.echoPulse || typeof state.echoPulse !== 'object') {
      state.echoPulse = {
        timer: 0,
        cooldown: 0,
        ores: [],
        passages: [],
        structures: [],
      };
      return state.echoPulse;
    }
    state.echoPulse.timer = Number.isFinite(state.echoPulse.timer) ? state.echoPulse.timer : 0;
    state.echoPulse.cooldown = Number.isFinite(state.echoPulse.cooldown) ? state.echoPulse.cooldown : 0;
    if (!Array.isArray(state.echoPulse.ores)) state.echoPulse.ores = [];
    if (!Array.isArray(state.echoPulse.passages)) state.echoPulse.passages = [];
    if (!Array.isArray(state.echoPulse.structures)) state.echoPulse.structures = [];
    return state.echoPulse;
  }

  function ensureRootHeartState(state) {
    if (!state.player) return;
    state.player.rootHeartTimer = Number.isFinite(state.player.rootHeartTimer) ? Math.max(0, state.player.rootHeartTimer) : 0;
    state.player.rootHeartCooldown = Number.isFinite(state.player.rootHeartCooldown) ? Math.max(0, state.player.rootHeartCooldown) : 0;
    state.player.rootHeartRegenTick = Number.isFinite(state.player.rootHeartRegenTick) ? Math.max(0, state.player.rootHeartRegenTick) : 0;
  }

  function ensureUndergroundMeta(state) {
    const meta = state.undergroundWorldMeta;
    if (!meta || !meta.castle) return null;
    ensureEchoPulseState(state);
    ensureRootHeartState(state);
    ensureGardenMeta(state, meta);
    if (!meta.king) {
      meta.king = {
        x: meta.castle.throneX * TILE - 8,
        y: (meta.castle.throneY - 2) * TILE,
        w: 16,
        h: 24,
        dir: -1,
      };
    }
    if (!Array.isArray(meta.keepers) || meta.keepers.length === 0) {
      const lakes = meta.undergroundLakes || null;
      const crystal = meta.crystalVaults || null;
      const roots = meta.rootGrove || null;
      const mushroom = meta.mushroomHalls || null;
      const keepers = [];
      if (lakes) {
        keepers.push(
          { x: lakes.centerX * TILE - 8, y: (state.surfaceAt[lakes.centerX] - 2) * TILE, w: 16, h: 24, dir: 1, kind: 'lake', anchorPhase: 0.3 }
        );
      }
      if (crystal) {
        keepers.push(
          { x: crystal.centerX * TILE - 8, y: (state.surfaceAt[crystal.centerX] - 2) * TILE, w: 16, h: 24, dir: 1, kind: 'crystal', anchorPhase: 0.6 },
          { x: (crystal.x0 + 12) * TILE - 8, y: (state.surfaceAt[Math.min(WORLD_W - 1, crystal.x0 + 12)] - 2) * TILE, w: 16, h: 24, dir: -1, kind: 'crystal', anchorPhase: 1.7 }
        );
      }
      if (roots) {
        keepers.push(
          { x: (roots.x0 + 8) * TILE - 8, y: (state.surfaceAt[Math.min(WORLD_W - 1, roots.x0 + 8)] - 2) * TILE, w: 16, h: 24, dir: 1, kind: 'roots', anchorPhase: 2.4 },
          { x: (roots.x1 - 6) * TILE - 8, y: (state.surfaceAt[Math.max(0, roots.x1 - 6)] - 2) * TILE, w: 16, h: 24, dir: -1, kind: 'roots', anchorPhase: 3.1 }
        );
      }
      if (mushroom) {
        keepers.push(
          { x: (mushroom.x0 + 9) * TILE - 8, y: (state.surfaceAt[Math.min(WORLD_W - 1, mushroom.x0 + 9)] - 2) * TILE, w: 16, h: 24, dir: 1, kind: 'mushroom', anchorPhase: 4.2 }
        );
      }
      meta.keepers = keepers.map((keeper) => ({
        ...keeper,
        anchorX: keeper.x,
        anchorY: keeper.y,
        dirTimer: 1.2 + Math.random() * 1.6,
        timer: Math.random() * 2,
      }));
    }
    if (!Array.isArray(state.temporaryEarthBlocks)) state.temporaryEarthBlocks = [];
    if (!Array.isArray(state.greatTrees)) state.greatTrees = [];
    if (meta.echoTemple && !meta.echoTemple.inserted) {
      meta.echoTemple.inserted = {
        [ITEM.DEPTH_CRYSTAL]: false,
        [ITEM.LAKE_CRYSTAL]: false,
        [ITEM.RIFT_CRYSTAL]: false,
      };
      meta.echoTemple.rewardGiven = !!meta.echoTemple.rewardGiven;
    }
    if (!Array.isArray(meta.echoShards)) meta.echoShards = [];
    if (meta.rootShrine && !Array.isArray(meta.rootShrine.activated)) meta.rootShrine.activated = [false, false, false];
    if (meta.greatTree && !state.greatTrees.some((tree) => tree && tree.x === meta.greatTree.x && tree.baseY === meta.greatTree.baseY)) {
      state.greatTrees.push({
        ...meta.greatTree,
        id: meta.greatTree.id || `underground:${meta.greatTree.x}:${meta.greatTree.baseY}`,
        questTree: true,
        rewardTriggered: !!meta.finalAmuletDropped,
      });
    }
    if (typeof meta.saplingGiven !== 'boolean') meta.saplingGiven = false;
    if (typeof meta.greatTreePlanted !== 'boolean') meta.greatTreePlanted = !!meta.greatTree;
    if (typeof meta.finalAmuletDropped !== 'boolean') meta.finalAmuletDropped = false;
    if (meta.finalAmuletFall && typeof meta.finalAmuletFall === 'object') {
      meta.finalAmuletFall.vy = Number.isFinite(meta.finalAmuletFall.vy) ? meta.finalAmuletFall.vy : 0;
    } else {
      meta.finalAmuletFall = null;
    }
    return meta;
  }

  function ensureGreatTrees(state) {
    if (!Array.isArray(state.greatTrees)) state.greatTrees = [];
    return state.greatTrees;
  }

  function playerNearKing(state, king) {
    if (!king) return false;
    const dx = king.x + king.w / 2 - (state.player.x + state.player.w / 2);
    const dy = king.y + king.h / 2 - (state.player.y + state.player.h / 2);
    return Math.hypot(dx, dy) <= 104;
  }

  function placeLeafCluster(state, cx, cy, radius) {
    for (let yy = cy - radius; yy <= cy + radius; yy += 1) {
      for (let xx = cx - radius; xx <= cx + radius; xx += 1) {
        const dist = Math.abs(xx - cx) + Math.abs(yy - cy);
        if (dist > radius + 1) continue;
        if (getBlock(state, xx, yy) === BLOCK.AIR) setBlock(state, xx, yy, BLOCK.LEAF);
      }
    }
  }

  function buildGreatTreeStage(state, tree, stage) {
    const heights = [18, 32, 48, 64, 82];
    const trunkHalfWidths = [1, 1, 2, 2, 2];
    const height = heights[Math.max(0, Math.min(heights.length - 1, stage))];
    const halfWidth = trunkHalfWidths[Math.max(0, Math.min(trunkHalfWidths.length - 1, stage))];
    const topY = tree.baseY - height;
    for (let ty = tree.baseY; ty >= topY; ty -= 1) {
      for (let tx = tree.x - halfWidth; tx <= tree.x + halfWidth; tx += 1) {
        setBlock(state, tx, ty, BLOCK.GREAT_TREE_WOOD);
      }
      if (halfWidth >= 2 && ty > tree.baseY - 16 && ty % 3 === 0) {
        setBlock(state, tree.x - 3, ty, BLOCK.GREAT_TREE_WOOD);
        setBlock(state, tree.x + 3, ty, BLOCK.GREAT_TREE_WOOD);
      }
    }

    const branchLevels = [
      tree.baseY - 10,
      tree.baseY - 22,
      tree.baseY - 36,
      tree.baseY - 52,
    ];
    const activeBranches = Math.min(branchLevels.length, stage + 1);
    for (let i = 0; i < activeBranches; i += 1) {
      const by = branchLevels[i];
      const reach = 4 + i * 2 + Math.min(stage, 3);
      for (let step = 1; step <= reach; step += 1) {
        setBlock(state, tree.x - step, by - Math.floor(step / 3), BLOCK.GREAT_TREE_WOOD);
        setBlock(state, tree.x + step, by - Math.floor(step / 3), BLOCK.GREAT_TREE_WOOD);
      }
      placeLeafCluster(state, tree.x - reach, by - Math.floor(reach / 3), 2 + Math.min(2, i));
      placeLeafCluster(state, tree.x + reach, by - Math.floor(reach / 3), 2 + Math.min(2, i));
    }

    placeLeafCluster(state, tree.x, topY + 2, 4 + Math.min(2, stage));
    placeLeafCluster(state, tree.x, topY - 4, 5 + Math.min(3, stage));
    if (stage >= 3) {
      placeLeafCluster(state, tree.x - 4, topY - 1, 3);
      placeLeafCluster(state, tree.x + 4, topY - 2, 3);
    }
    if (stage >= 4) {
      placeLeafCluster(state, tree.x, topY - 10, 6);
      placeLeafCluster(state, tree.x - 6, topY - 8, 4);
      placeLeafCluster(state, tree.x + 6, topY - 8, 4);
    }
  }

  function buildEndGateStructure(state, meta, tree) {
    const desiredGateY = tree.baseY - 86;
    const gateY = Math.max(4, Math.min(WORLD_H - 10, desiredGateY));
    for (let tx = tree.x - 4; tx <= tree.x + 4; tx += 1) {
      for (let ty = gateY - 2; ty <= gateY + 8; ty += 1) {
        if (tx < 1 || tx >= WORLD_W - 1 || ty < 1 || ty >= WORLD_H - 1) continue;
        setBlock(state, tx, ty, BLOCK.AIR);
      }
    }
    for (let ty = gateY; ty <= gateY + 6; ty += 1) {
      setBlock(state, tree.x - 2, ty, BLOCK.GREAT_TREE_WOOD);
      setBlock(state, tree.x + 2, ty, BLOCK.GREAT_TREE_WOOD);
    }
    for (let tx = tree.x - 2; tx <= tree.x + 2; tx += 1) {
      setBlock(state, tx, gateY, BLOCK.GREAT_TREE_WOOD);
      setBlock(state, tx, gateY + 6, BLOCK.GREAT_TREE_WOOD);
    }
    setBlock(state, tree.x, gateY + 3, BLOCK.END_GATE);
    meta.endEntrance = {
      tx: tree.x,
      ty: gateY + 3,
      gateY,
      baseY: tree.baseY,
    };
  }

  function findNearestFreePosition(state, px, py) {
    const startTx = Math.floor(px / TILE);
    const startTy = Math.floor(py / TILE);
    for (let radius = 0; radius <= 10; radius += 1) {
      for (let ty = startTy - radius; ty <= startTy + radius; ty += 1) {
        for (let tx = startTx - radius; tx <= startTx + radius; tx += 1) {
          if (tx < 1 || tx >= WORLD_W - 1 || ty < 1 || ty >= state.world.length - 2) continue;
          const b0 = getBlock(state, tx, ty);
          const b1 = getBlock(state, tx, ty + 1);
          const below = getBlock(state, tx, ty + 2);
          if (b0 === BLOCK.AIR && b1 === BLOCK.AIR && below !== BLOCK.AIR && below !== BLOCK.WATER && below !== BLOCK.LAVA) {
            return { x: tx * TILE + 2, y: ty * TILE };
          }
        }
      }
    }
    return null;
  }

  function playerEmbeddedInSolid(state) {
    const samples = [
      [state.player.x + 2, state.player.y + 2],
      [state.player.x + state.player.w - 2, state.player.y + 2],
      [state.player.x + 2, state.player.y + state.player.h - 2],
      [state.player.x + state.player.w - 2, state.player.y + state.player.h - 2],
      [state.player.x + state.player.w / 2, state.player.y + state.player.h / 2],
    ];
    for (const [px, py] of samples) {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (blockSolid(getBlock(state, tx, ty))) return true;
    }
    return false;
  }

  function pushPlayerOutOfGrowingTree(state) {
    if (!playerEmbeddedInSolid(state)) return;
    const free = findNearestFreePosition(state, state.player.x + state.player.w / 2, state.player.y + state.player.h / 2);
    if (!free) return;
    state.player.x = free.x;
    state.player.y = free.y;
    state.player.vx = 0;
    state.player.vy = 0;
  }

  function resolveTemporaryEarthBlocks(state, dt) {
    if (!Array.isArray(state.temporaryEarthBlocks) || state.temporaryEarthBlocks.length === 0) return;
    for (let i = state.temporaryEarthBlocks.length - 1; i >= 0; i -= 1) {
      const block = state.temporaryEarthBlocks[i];
      block.timer -= dt;
      if (block.timer > 0) continue;
      if (getBlock(state, block.tx, block.ty) === BLOCK.DIRT) setBlock(state, block.tx, block.ty, BLOCK.AIR);
      state.temporaryEarthBlocks.splice(i, 1);
    }
  }

  function updateKingQuest(state) {
    if (state.activeDimension !== 'underground') return;
    const meta = ensureUndergroundMeta(state);
    if (!meta) return;
    const playerHidden = !!(isPlayerUndetectable && isPlayerUndetectable(state));
    if (!meta.saplingGiven && playerNearKing(state, meta.king) && !playerHidden) {
      if (!addToInventory(state, ITEM.GREAT_TREE_SAPLING, 1)) {
        state.ui.noticeText = 'Освободи слот для Саженца великого древа.';
        state.ui.noticeTimer = 4;
        return;
      }
      meta.saplingGiven = true;
      state.pause.activeCompassTarget = 'great_tree_garden';
      state.ui.noticeText = 'Подземный король: Возьми саженец и иди в Сад великих древ.';
      state.ui.noticeTimer = 6;
    }
  }

  function updateUndergroundKeepers(state, dt) {
    if (state.activeDimension !== 'underground') return;
    const meta = ensureUndergroundMeta(state);
    if (!meta || !Array.isArray(meta.keepers)) return;
    for (const keeper of meta.keepers) {
      keeper.timer = (keeper.timer || 0) + dt;
      keeper.dirTimer = Math.max(0, (keeper.dirTimer || 0) - dt);
      if (keeper.dirTimer <= 0) {
        keeper.dir = Math.random() < 0.5 ? -1 : 1;
        keeper.dirTimer = 1.2 + Math.random() * 2;
      }
      const speed = keeper.kind === 'crystal' ? 12 : keeper.kind === 'lake' ? 8 : keeper.kind === 'mushroom' ? 7 : 9;
      const drift = keeper.kind === 'crystal' ? 5 : keeper.kind === 'lake' ? 4 : keeper.kind === 'mushroom' ? 2 : 3;
      const anchorX = Number.isFinite(keeper.anchorX) ? keeper.anchorX : keeper.x;
      const anchorY = Number.isFinite(keeper.anchorY) ? keeper.anchorY : keeper.y;
      keeper.x += keeper.dir * speed * dt;
      const wave = keeper.kind === 'crystal' ? 1.9 : keeper.kind === 'lake' ? 1.2 : keeper.kind === 'mushroom' ? 0.9 : 1.4;
      keeper.y = anchorY + Math.sin(keeper.timer * wave + (keeper.anchorPhase || 0)) * drift;
      if (keeper.x < anchorX - 28) keeper.dir = 1;
      if (keeper.x > anchorX + 28) keeper.dir = -1;
    }
  }

  function useNearbyEchoTemple(state) {
    if (state.activeDimension !== 'underground') return false;
    const meta = ensureUndergroundMeta(state);
    if (!meta || !meta.echoTemple) return false;
    const temple = meta.echoTemple;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const dist = Math.hypot(temple.coreX * TILE + TILE / 2 - playerCx, temple.coreY * TILE + TILE / 2 - playerCy);
    if (dist > 110) return false;
    const needed = [ITEM.DEPTH_CRYSTAL, ITEM.LAKE_CRYSTAL, ITEM.RIFT_CRYSTAL];
    for (const itemId of needed) {
      if (temple.inserted[itemId]) continue;
      if (countItem(state, itemId) > 0) {
        removeItem(state, itemId, 1);
        temple.inserted[itemId] = true;
        state.ui.noticeText = `Ядро эха приняло ${getItemDefinition(itemId).label}.`;
        state.ui.noticeTimer = 3.5;
        return true;
      }
    }
    const ready = needed.every((itemId) => temple.inserted[itemId]);
    if (ready && !temple.rewardGiven) {
      temple.rewardGiven = true;
      addToInventory(state, ITEM.ECHO_CRYSTAL, 1);
      state.ui.noticeText = 'Ядро эха пробудилось. Ты получил Кристалл эха.';
      state.ui.noticeTimer = 5;
      return true;
    }
    if (!ready) {
      state.ui.noticeText = 'Ядру эха нужны Кристалл глубины, Кристалл озера и Кристалл разлома.';
      state.ui.noticeTimer = 4;
      return true;
    }
    return false;
  }

  function useNearbyEchoShard(state) {
    if (state.activeDimension !== 'underground') return false;
    const meta = ensureUndergroundMeta(state);
    if (!meta || !Array.isArray(meta.echoShards)) return false;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    for (const shard of meta.echoShards) {
      if (shard.taken) continue;
      const dist = Math.hypot(shard.tx * TILE + TILE / 2 - playerCx, shard.ty * TILE + TILE / 2 - playerCy);
      if (dist > 110) continue;
      if (!addToInventory(state, shard.itemId, 1)) {
        state.ui.noticeText = `Освободи слот для ${getItemDefinition(shard.itemId).label}.`;
        state.ui.noticeTimer = 3.5;
        return true;
      }
      shard.taken = true;
      setBlock(state, shard.tx, shard.ty, BLOCK.AIR);
      state.ui.noticeText = `${getItemDefinition(shard.itemId).label} получен.`;
      state.ui.noticeTimer = 3.5;
      return true;
    }
    return false;
  }

  function useNearbyRootShrine(state) {
    if (state.activeDimension !== 'underground') return false;
    const meta = ensureUndergroundMeta(state);
    if (!meta || !meta.rootShrine) return false;
    const shrine = meta.rootShrine;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    for (let i = 0; i < shrine.nodes.length; i += 1) {
      const node = shrine.nodes[i];
      const dist = Math.hypot(node.tx * TILE + TILE / 2 - playerCx, node.ty * TILE + TILE / 2 - playerCy);
      if (dist <= 96 && !shrine.activated[i]) {
        shrine.activated[i] = true;
        state.ui.noticeText = `Корневой узел ${i + 1}/3 пробуждён.`;
        state.ui.noticeTimer = 3.5;
        return true;
      }
    }
    const coreDist = Math.hypot(shrine.coreX * TILE + TILE / 2 - playerCx, shrine.coreY * TILE + TILE / 2 - playerCy);
    if (coreDist > 100) return false;
    if (shrine.activated.every(Boolean) && !shrine.rewardGiven) {
      shrine.rewardGiven = true;
      addToInventory(state, ITEM.ROOT_HEART, 1);
      state.ui.noticeText = 'Сердце святилища открылось. Ты получил Сердце корней.';
      state.ui.noticeTimer = 5;
      return true;
    }
    if (!shrine.activated.every(Boolean)) {
      state.ui.noticeText = 'Святилище ждёт пробуждения трёх корневых узлов.';
      state.ui.noticeTimer = 4;
      return true;
    }
    return false;
  }

  function updateGreatTree(state, dt) {
    const meta = ensureUndergroundMeta(state);
    const trees = ensureGreatTrees(state);
    if (!trees.length) return;
    for (const tree of trees) {
      tree.elapsed = (tree.elapsed || 0) + dt;
      const nextStage = Math.min(4, Math.floor(tree.elapsed / 2));
      while ((tree.stage || 0) < nextStage) {
        tree.stage += 1;
        buildGreatTreeStage(state, tree, tree.stage);
        pushPlayerOutOfGrowingTree(state);
      }
      if (!tree.questTree || tree.rewardTriggered || tree.elapsed < 10 || !meta) continue;
      tree.rewardTriggered = true;
      meta.finalAmuletDropped = true;
      meta.greatTree = tree;
      buildEndGateStructure(state, meta, tree);
      meta.finalAmuletFall = {
        x: state.player.x + state.player.w / 2 - 8,
        y: state.player.y - 96,
        vy: 0,
      };
      state.ui.noticeText = 'С вершины великого древа упал Финальный амулет.';
      state.ui.noticeTimer = 5;
    }
  }

  function updateFinalAmuletFall(state, dt) {
    const meta = ensureUndergroundMeta(state);
    if (!meta || !meta.finalAmuletFall) return;
    const fall = meta.finalAmuletFall;
    fall.vy += 260 * dt;
    fall.y += fall.vy * dt;
    const playerCx = state.player.x + state.player.w / 2;
    const playerCy = state.player.y + state.player.h / 2;
    const amuletCx = fall.x + 8;
    const amuletCy = fall.y + 8;
    if (Math.abs(amuletCx - playerCx) <= state.player.w * 0.8 && amuletCy >= playerCy - 4) {
      applyPlayerDamage(state, 1, { flash: 0.12 });
      addToInventory(state, ITEM.FINAL_AMULET, 1);
      meta.finalAmuletFall = null;
      state.ui.noticeText = 'Финальный амулет упал на тебя и оказался в инвентаре.';
      state.ui.noticeTimer = 4.5;
      return;
    }
    const tx = Math.floor(amuletCx / TILE);
    const ty = Math.floor(amuletCy / TILE);
    const hitSolid = blockSolid(getBlock(state, tx, ty)) || blockSolid(getBlock(state, tx, ty + 1));
    if (hitSolid) {
      state.foods.push({
        x: tx * TILE + 1,
        y: Math.max(0, ty * TILE - 10),
        w: 10,
        h: 10,
        itemId: ITEM.FINAL_AMULET,
        amount: 1,
        t: 0,
      });
      meta.finalAmuletFall = null;
      state.ui.noticeText = 'Финальный амулет коснулся ствола и стал обычным предметом.';
      state.ui.noticeTimer = 4;
    }
  }

  function updateUndergroundQuest(state, dt) {
    resolveTemporaryEarthBlocks(state, dt);
    updateUndergroundKeepers(state, dt);
    updateKingQuest(state);
    updateGreatTree(state, dt);
    updateFinalAmuletFall(state, dt);
    updateEchoPulse(state, dt);
    updateRootHeart(state, dt);
  }

  function tryPlantGreatTreeSapling(state, tx, ty) {
    if (selectedItemId(state) !== ITEM.GREAT_TREE_SAPLING) return false;
    const meta = state.activeDimension === 'underground' ? ensureUndergroundMeta(state) : null;
    if (getBlock(state, tx, ty) !== BLOCK.AIR) return false;
    const below = getBlock(state, tx, ty + 1);
    if (below !== BLOCK.GRASS && below !== BLOCK.DIRT) return false;
    const slot = state.player.hotbar[state.player.selectedSlot];
    if (!slot || slot.id !== ITEM.GREAT_TREE_SAPLING || (slot.count || 0) <= 0) return false;
    const biome = state.biomeAt[Math.max(0, Math.min(state.biomeAt.length - 1, tx))];
    const questTree = !!(meta && meta.garden && !meta.greatTreePlanted && biome === 'great_tree_garden');
    removeFromSlot(slot, 1);
    const tree = {
      id: `${state.activeDimension}:${Date.now()}:${tx}:${ty}`,
      x: tx,
      baseY: ty,
      stage: 0,
      elapsed: 0,
      questTree,
      rewardTriggered: false,
    };
    ensureGreatTrees(state).push(tree);
    if (questTree && meta) {
      meta.greatTree = tree;
      meta.greatTreePlanted = true;
    }
    buildGreatTreeStage(state, tree, 0);
    if (questTree) state.pause.activeCompassTarget = null;
    state.ui.noticeText = questTree
      ? 'Великое древо пустило корни и начало расти.'
      : 'Саженец великого древа начал расти.';
    state.ui.noticeTimer = 5;
    return true;
  }

  function tryUseFinalAmulet(state, tx, ty) {
    if (selectedItemId(state) !== ITEM.FINAL_AMULET) return false;
    if (getBlock(state, tx, ty) !== BLOCK.AIR) return false;
    if (!Array.isArray(state.temporaryEarthBlocks)) state.temporaryEarthBlocks = [];
    const existing = state.temporaryEarthBlocks.find((entry) => entry.tx === tx && entry.ty === ty);
    if (existing) {
      existing.timer = 60;
    } else {
      state.temporaryEarthBlocks.push({ tx, ty, timer: 60 });
    }
    setBlock(state, tx, ty, BLOCK.DIRT);
    state.ui.noticeText = 'Финальный амулет сотворил временный блок земли.';
    state.ui.noticeTimer = 3.5;
    return true;
  }

  function collectEchoStructures(state, radius) {
    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    const structures = [];
    function maybePush(label, tx, ty) {
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      const dx = tx * TILE - px;
      const dy = ty * TILE - py;
      if (Math.hypot(dx, dy) > radius * TILE) return;
      structures.push({ label, tx, ty });
    }
    if (state.activeDimension === 'underground' && state.undergroundWorldMeta) {
      const meta = state.undergroundWorldMeta;
      if (meta.echoTemple) maybePush('Храм кристального эха', meta.echoTemple.coreX, meta.echoTemple.coreY);
      if (meta.rootShrine) maybePush('Святилище корней', meta.rootShrine.coreX, meta.rootShrine.coreY);
      if (meta.garden) maybePush('Сад великих древ', meta.garden.centerX, meta.garden.groundY);
      if (meta.castle) maybePush('Замок подземного короля', meta.castle.centerX, meta.castle.baseY);
    }
    return structures;
  }

  function collectEchoOres(state, radius) {
    const cx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const cy = Math.floor((state.player.y + state.player.h / 2) / TILE);
    const ores = [];
    for (let ty = Math.max(0, cy - radius); ty <= Math.min(WORLD_H - 1, cy + radius); ty += 1) {
      for (let tx = Math.max(0, cx - radius); tx <= Math.min(WORLD_W - 1, cx + radius); tx += 1) {
        const id = getBlock(state, tx, ty);
        if (!ECHO_ORE_BLOCKS.has(id)) continue;
        ores.push({ tx, ty, id });
        if (ores.length >= ECHO_MAX_ORES) return ores;
      }
    }
    return ores;
  }

  function collectEchoPassages(state, radius) {
    const cx = Math.floor((state.player.x + state.player.w / 2) / TILE);
    const cy = Math.floor((state.player.y + state.player.h / 2) / TILE);
    const passages = [];
    for (let ty = Math.max(1, cy - radius); ty <= Math.min(WORLD_H - 2, cy + radius); ty += 1) {
      for (let tx = Math.max(1, cx - radius); tx <= Math.min(WORLD_W - 2, cx + radius); tx += 1) {
        const id = getBlock(state, tx, ty);
        if (!blockSolid(id)) continue;
        const leftAir = getBlock(state, tx - 1, ty) === BLOCK.AIR;
        const rightAir = getBlock(state, tx + 1, ty) === BLOCK.AIR;
        const upAir = getBlock(state, tx, ty - 1) === BLOCK.AIR;
        const downAir = getBlock(state, tx, ty + 1) === BLOCK.AIR;
        if (!((leftAir && rightAir) || (upAir && downAir))) continue;
        passages.push({ tx, ty });
        if (passages.length >= ECHO_MAX_PASSAGES) return passages;
      }
    }
    return passages;
  }

  function hasRootHeart(state) {
    return countItem(state, ITEM.ROOT_HEART) > 0;
  }

  function isNaturalRootHealingBlock(id) {
    return ROOT_HEART_NATURAL_BLOCKS.has(id);
  }

  function playerStandingOnNaturalBlock(state) {
    const leftTx = Math.floor((state.player.x + 1) / TILE);
    const rightTx = Math.floor((state.player.x + state.player.w - 2) / TILE);
    const footTy = Math.floor((state.player.y + state.player.h + 1) / TILE);
    return isNaturalRootHealingBlock(getBlock(state, leftTx, footTy)) || isNaturalRootHealingBlock(getBlock(state, rightTx, footTy));
  }

  function updateRootHeart(state, dt) {
    ensureRootHeartState(state);
    if (state.player.rootHeartCooldown > 0) state.player.rootHeartCooldown = Math.max(0, state.player.rootHeartCooldown - dt);
    if (state.player.rootHeartTimer > 0) state.player.rootHeartTimer = Math.max(0, state.player.rootHeartTimer - dt);
    const nonSurvival = !!(state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'spectator' || state.worldMeta.mode === 'hardcore_spectator'));
    if (nonSurvival || state.gameOver || state.player.health <= 0 || !hasRootHeart(state) || !playerStandingOnNaturalBlock(state)) {
      state.player.rootHeartRegenTick = 0;
      return;
    }
    const maxHealth = getMaxHealth(state);
    if (state.player.health >= maxHealth) {
      state.player.rootHeartRegenTick = 0;
      return;
    }
    const regenInterval = state.activeDimension === 'underground' ? 2 : 2.5;
    state.player.rootHeartRegenTick += dt;
    if (state.player.rootHeartRegenTick < regenInterval) return;
    state.player.rootHeartRegenTick = 0;
    state.player.health = Math.min(maxHealth, state.player.health + 1);
  }

  function useRootHeart(state) {
    ensureRootHeartState(state);
    if (selectedItemId(state) !== ITEM.ROOT_HEART) return false;
    if (!hasRootHeart(state)) return false;
    if (state.player.rootHeartCooldown > 0) {
      state.ui.noticeText = `Сердце корней восстанавливается: ${Math.ceil(state.player.rootHeartCooldown)} с.`;
      state.ui.noticeTimer = 2.2;
      return true;
    }
    state.player.rootHeartTimer = ROOT_HEART_DURATION;
    state.player.rootHeartCooldown = ROOT_HEART_COOLDOWN;
    state.player.rootHeartRegenTick = 0;
    state.ui.noticeText = 'Сердце корней укрепило тебя живой силой земли.';
    state.ui.noticeTimer = 4;
    return true;
  }

  function useEchoCrystal(state) {
    if (selectedItemId(state) !== ITEM.ECHO_CRYSTAL) return false;
    if (countItem(state, ITEM.ECHO_CRYSTAL) <= 0) return false;
    const pulse = ensureEchoPulseState(state);
    if (pulse.cooldown > 0) {
      state.ui.noticeText = `Кристалл эха перезаряжается: ${Math.ceil(pulse.cooldown)} с.`;
      state.ui.noticeTimer = 2.2;
      return true;
    }
    pulse.ores = collectEchoOres(state, ECHO_SCAN_RADIUS);
    pulse.passages = collectEchoPassages(state, ECHO_SCAN_RADIUS);
    pulse.structures = collectEchoStructures(state, ECHO_STRUCTURE_RADIUS);
    pulse.timer = ECHO_PULSE_DURATION;
    pulse.cooldown = ECHO_PULSE_COOLDOWN;
    const parts = [];
    if (pulse.ores.length) parts.push(`руд: ${pulse.ores.length}`);
    if (pulse.passages.length) parts.push(`слабых стен: ${pulse.passages.length}`);
    if (pulse.structures.length) parts.push(`мест силы: ${pulse.structures.length}`);
    state.ui.noticeText = parts.length
      ? `Эхо открыло рядом ${parts.join(', ')}.`
      : 'Эхо разошлось, но рядом ничего не отозвалось.';
    state.ui.noticeTimer = 4.5;
    return true;
  }

  function updateEchoPulse(state, dt) {
    const pulse = ensureEchoPulseState(state);
    if (pulse.cooldown > 0) pulse.cooldown = Math.max(0, pulse.cooldown - dt);
    if (pulse.timer <= 0) return;
    pulse.timer = Math.max(0, pulse.timer - dt);
    if (pulse.timer > 0) return;
    pulse.ores = [];
    pulse.passages = [];
    pulse.structures = [];
  }

  function pushPlayerOutOfReturningEarth(state) {
    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (getBlock(state, tx, ty) !== BLOCK.DIRT && getBlock(state, tx, ty + 1) !== BLOCK.DIRT) return;
    const free = findNearestFreePosition(state, px, py);
    if (!free) return;
    state.player.x = free.x;
    state.player.y = free.y;
    state.player.vx = 0;
    state.player.vy = 0;
  }

  Game.undergroundQuestSystem = {
    updateUndergroundQuest,
    tryPlantGreatTreeSapling,
    tryUseFinalAmulet,
    pushPlayerOutOfReturningEarth,
    ensureUndergroundMeta,
    useNearbyEchoTemple,
    useNearbyEchoShard,
    useNearbyRootShrine,
    useEchoCrystal,
    useRootHeart,
  };
})();
