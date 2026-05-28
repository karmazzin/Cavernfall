(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, WORLD_H } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { countItem, addToInventory } = Game.inventory;
  const { getBlock, setBlock, blockSolid } = Game.world;
  const { ensureDimensions, switchDimension } = Game.state;

  const POEM_LINES = [
    'Ты шёл сквозь землю, воду, жар и ветер.',
    'Ты падал, мёрз, горел и вновь вставал.',
    'И каждый мир хранил не только тайны,',
    'Но часть тебя, которой ты не знал.',
    '',
    'Огонь учил не силе, а терпенью.',
    'Вода учила слушать глубину.',
    'Воздушный свод дарил полёт и хрупкость.',
    'А корни звали в древнюю тишину.',
    '',
    'Ты строил путь не только из блоков.',
    'Ты собирал из странствий новый смысл.',
    'И там, где тьма казалась бесконечной,',
    'Внутри тебя уже рождался свет.',
    '',
    'Четыре силы стали не оружьем,',
    'А памятью о каждом дальнем дне.',
    'И мир, что был когда-то неизвестным,',
    'Теперь живёт и в сердце, и в тебе.',
    '',
    'Пусть впереди ещё родятся тропы,',
    'Пусть будут башни, замки и сады.',
    'Но тот, кто видел все края и бездны,',
    'Уже домой вернётся не пустым.',
    '',
    'И если снова позовут дороги,',
    'И если вновь откроется рассвет,',
    'Ты вспомни: мир велик, но путь сквозь чудо',
    'всегда начинается с тебя.',
  ];

  function hasArtifact(state) {
    return countItem(state, ITEM.FOUR_ELEMENTS_ARTIFACT) > 0;
  }

  function findArtifactSlot(state) {
    const slots = [...state.player.hotbar, ...state.player.inventory];
    for (const slot of slots) {
      if (slot && slot.id === ITEM.FOUR_ELEMENTS_ARTIFACT && slot.count > 0) return slot;
    }
    return null;
  }

  function ensureArtifactOwnership(state) {
    const meta = state.endWorldMeta;
    if (!meta || !meta.artifactObtained) return;
    if (hasArtifact(state)) return;
    addToInventory(state, ITEM.FOUR_ELEMENTS_ARTIFACT, 1);
  }

  function findPortalSpot(state, tx, ty) {
    const spots = [
      [tx + 3, ty],
      [tx - 3, ty],
      [tx, ty + 3],
      [tx + 5, ty + 1],
      [tx - 5, ty + 1],
    ];
    for (const [px, py] of spots) {
      if (px < 2 || px >= WORLD_W - 2 || py < 2 || py >= WORLD_H - 2) continue;
      if (getBlock(state, px, py) !== BLOCK.AIR) continue;
      if (getBlock(state, px, py + 1) === BLOCK.AIR) continue;
      return { tx: px, ty: py };
    }
    return null;
  }

  function ensureReturnPortal(state) {
    const meta = state.endWorldMeta;
    if (!meta || !meta.artifactObtained || meta.elementalPortalSpawned) return false;
    const chest = meta.artifactChest;
    if (!chest) return false;
    const spot = findPortalSpot(state, chest.tx, chest.ty) || { tx: chest.tx + 3, ty: chest.ty };
    setBlock(state, spot.tx, spot.ty, BLOCK.ELEMENTAL_RETURN_PORTAL);
    meta.elementalPortalSpawned = true;
    meta.elementalPortal = spot;
    state.ui.noticeText = 'Рядом открылся портал домой.';
    state.ui.noticeTimer = 4;
    return true;
  }

  function getOverworldSpawnBase(state) {
    const point = state.player && state.player.spawnPoint;
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      return {
        tx: Math.floor((point.x + state.player.w * 0.5) / TILE),
        ty: Math.floor((point.y + state.player.h) / TILE),
      };
    }
    const overworld = state.dimensions && state.dimensions.overworld;
    if (overworld && overworld.worldMeta && Number.isFinite(overworld.worldMeta.spawnX) && Number.isFinite(overworld.worldMeta.spawnY)) {
      return { tx: overworld.worldMeta.spawnX, ty: overworld.worldMeta.spawnY };
    }
    return { tx: Math.floor(WORLD_W * 0.5), ty: Math.floor(WORLD_H * 0.5) };
  }

  function canStandAt(state, tx, ty) {
    if (tx < 1 || tx >= WORLD_W - 1 || ty < 2 || ty >= WORLD_H - 2) return false;
    const feet = getBlock(state, tx, ty);
    const body = getBlock(state, tx, ty - 1);
    const head = getBlock(state, tx, ty - 2);
    const floor = getBlock(state, tx, ty + 1);
    return feet === BLOCK.AIR && body === BLOCK.AIR && head === BLOCK.AIR && blockSolid(floor);
  }

  function findSafeOverworldSpawn(state) {
    const base = getOverworldSpawnBase(state);
    for (let radius = 0; radius <= 18; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          const tx = base.tx + dx;
          const ty = base.ty + dy;
          if (canStandAt(state, tx, ty)) {
            return { x: tx * TILE + 2, y: (ty - 2) * TILE };
          }
        }
      }
    }
    return { x: base.tx * TILE + 2, y: Math.max(0, (base.ty - 2) * TILE) };
  }

  function finishEndingScene(state) {
    ensureDimensions(state);
    if (state.activeDimension !== 'overworld') switchDimension(state, 'overworld');
    const point = findSafeOverworldSpawn(state);
    state.player.x = point.x;
    state.player.y = point.y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = false;
    state.player.portalCooldown = 1;
    state.endingScene = null;
    state.ui.noticeText = 'Ты вернулся домой.';
    state.ui.noticeTimer = 4;
  }

  function startEndingScene(state) {
    state.endingScene = {
      active: true,
      timer: 0,
      lineSeconds: 2.15,
      totalSeconds: Math.max(26, POEM_LINES.length * 2.15),
      lines: POEM_LINES,
    };
  }

  function skipEndingScene(state) {
    if (!state.endingScene || !state.endingScene.active) return false;
    finishEndingScene(state);
    return true;
  }

  function updateEndingScene(state, dt) {
    if (!state.endingScene || !state.endingScene.active) return false;
    state.endingScene.timer += dt;
    if (state.endingScene.timer >= state.endingScene.totalSeconds) finishEndingScene(state);
    return true;
  }

  function updateEndQuest(state, dt) {
    if (updateEndingScene(state, dt)) return;
    if (state.activeDimension !== 'end' || !state.endWorldMeta) return;
    const meta = state.endWorldMeta;
    if (!meta.artifactObtained && hasArtifact(state)) {
      meta.artifactObtained = true;
      ensureReturnPortal(state);
    }
    ensureArtifactOwnership(state);
  }

  Game.endQuestSystem = {
    hasFourElementsArtifact: hasArtifact,
    updateEndQuest,
    startEndingScene,
    skipEndingScene,
    ensureArtifactOwnership,
  };
})();
