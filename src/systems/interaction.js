(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK, BREAK_TIME, PLACEABLE } = Game.blocks;
  const { rand, aabb } = Game.math;
  const { getBlock, setBlock } = Game.world;
  const { selectedBlockId, consumeSelectedBlock, addToInventory } = Game.inventory;

  function screenToTile(mx, my, camera) {
    return {
      tx: Math.floor((mx + camera.x) / TILE),
      ty: Math.floor((my + camera.y) / TILE),
    };
  }

  function canPlaceBlock(state, tx, ty, id) {
    if (!PLACEABLE.has(id)) return false;
    if (getBlock(state, tx, ty) !== BLOCK.AIR) return false;

    const blockPx = tx * TILE;
    const blockPy = ty * TILE;
    if (aabb(blockPx, blockPy, TILE, TILE, state.player.x, state.player.y, state.player.w, state.player.h)) return false;

    return true;
  }

  function handleMouse(state, input, camera, dt) {
    const { tx, ty } = screenToTile(input.mouse.x, input.mouse.y, camera);
    const wx = input.mouse.x + camera.x;
    const wy = input.mouse.y + camera.y;
    const dist = Math.hypot(
      tx * TILE + TILE / 2 - (state.player.x + state.player.w / 2),
      ty * TILE + TILE / 2 - (state.player.y + state.player.h / 2)
    );

    if (!input.mouse.down || state.gameOver) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    for (let i = state.animals.length - 1; i >= 0; i -= 1) {
      const animal = state.animals[i];
      if (wx >= animal.x && wx <= animal.x + animal.w && wy >= animal.y && wy <= animal.y + animal.h) {
        if (!animal.clickCd || animal.clickCd <= 0) {
          animal.hp -= 1;
          animal.clickCd = 0.25;
          if (animal.hp <= 0) {
            state.foods.push({ x: animal.x, y: animal.y, w: 10, h: 10, amount: Math.floor(rand(1, 3)), t: 0 });
            state.animals.splice(i, 1);
          }
        }
        input.mouse.justPressed = false;
        return;
      }
    }

    for (const animal of state.animals) {
      if (animal.clickCd) animal.clickCd = Math.max(0, animal.clickCd - dt);
    }

    if (dist > 110) {
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    const block = getBlock(state, tx, ty);

    if (block === BLOCK.AIR) {
      if (input.mouse.justPressed) {
        const id = selectedBlockId(state);
        if (id && canPlaceBlock(state, tx, ty, id)) {
          const used = consumeSelectedBlock(state);
          if (used) setBlock(state, tx, ty, used);
        }
      }
      state.breaking = null;
      input.mouse.justPressed = false;
      return;
    }

    if (!state.breaking || state.breaking.tx !== tx || state.breaking.ty !== ty) {
      state.breaking = { tx, ty, progress: 0, need: BREAK_TIME[block] ?? Infinity, blockId: block };
    }

    if (!Number.isFinite(state.breaking.need)) {
      input.mouse.justPressed = false;
      return;
    }

    state.breaking.progress += dt;
    if (state.breaking.progress >= state.breaking.need) {
      addToInventory(state, block);
      setBlock(state, tx, ty, BLOCK.AIR);
      state.breaking = null;
    }

    input.mouse.justPressed = false;
  }

  Game.interaction = { screenToTile, canPlaceBlock, handleMouse };
})();
