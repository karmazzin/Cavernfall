(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, WORLD_H } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { getBlock, setBlock, blockSolid } = Game.world;
  const { addToInventory, countItem, selectedItemId } = Game.inventory;
  const { removeFromSlot } = Game.inventory;
  const { isPlayerUndetectable } = Game.invisibilitySystem || {};
  const { applyPlayerDamage } = Game.combat;

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

  function ensureUndergroundMeta(state) {
    const meta = state.undergroundWorldMeta;
    if (!meta || !meta.castle) return null;
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
    if (!Array.isArray(state.temporaryEarthBlocks)) state.temporaryEarthBlocks = [];
    if (!Array.isArray(state.greatTrees)) state.greatTrees = [];
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
    updateKingQuest(state);
    updateGreatTree(state, dt);
    updateFinalAmuletFall(state, dt);
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
  };
})();
