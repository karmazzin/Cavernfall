(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { addToInventory } = Game.inventory;

  function moveToward(current, target, speed, dt) {
    const delta = target - current;
    if (Math.abs(delta) <= 1.5) return target;
    return current + Math.sign(delta) * Math.min(Math.abs(delta), speed * dt);
  }

  function updateFriendlyFireKing(state, dt) {
    if (state.activeDimension !== 'fire' || !state.friendlyFireKing) return;
    const king = state.friendlyFireKing;
    const dungeon = state.fireDungeon;
    const fireMeta = state.fireWorldMeta;
    if (!dungeon) return;

    if (king.state === 'awakening') {
      king.stateTimer = Math.max(0, (king.stateTimer || 0) - dt);
      if (king.stateTimer <= 0) {
        king.state = 'freed_walk';
        king.targetX = dungeon.centerX * TILE + 18;
        king.targetY = (dungeon.y1 - 4) * TILE;
      }
      return;
    }

    if (king.state === 'freed_walk') {
      const targetX = king.targetX || king.x;
      const targetY = king.targetY || king.y;
      king.x = moveToward(king.x, targetX, 26, dt);
      king.y = moveToward(king.y, targetY, 26, dt);
      if (Math.abs(targetX - king.x) <= 2 && Math.abs(targetY - king.y) <= 2) {
        king.x = targetX;
        king.y = targetY;
        king.state = 'freed';
        if (!dungeon.giftGiven) {
          addToInventory(state, BLOCK.FRIENDSHIP_AMULET, 1);
          dungeon.giftGiven = true;
          state.ui.noticeText = 'Добрый огненный король передал амулет дружбы.';
          state.ui.noticeTimer = 5;
        }
        if (fireMeta && fireMeta.road && fireMeta.castle) {
          king.state = 'return_to_surface';
          king.targetX = (dungeon.access ? dungeon.access.shaftX : dungeon.centerX) * TILE;
          king.targetY = (fireMeta.road.y - 3) * TILE;
        }
      }
      return;
    }

    if (king.state === 'return_to_surface') {
      king.x = moveToward(king.x, king.targetX || king.x, 24, dt);
      king.y = moveToward(king.y, king.targetY || king.y, 28, dt);
      if (Math.abs((king.targetX || king.x) - king.x) <= 2 && Math.abs((king.targetY || king.y) - king.y) <= 2) {
        king.state = 'return_to_castle';
        king.targetX = (fireMeta.castle.x0 + 4) * TILE;
        king.targetY = (fireMeta.castle.baseY - 3) * TILE;
      }
      return;
    }

    if (king.state === 'return_to_castle') {
      king.x = moveToward(king.x, king.targetX || king.x, 36, dt);
      king.y = moveToward(king.y, king.targetY || king.y, 18, dt);
      if (Math.abs((king.targetX || king.x) - king.x) <= 2 && Math.abs((king.targetY || king.y) - king.y) <= 2) {
        king.state = 'returned';
        state.ui.noticeText = 'Добрый огненный король вернулся в свой замок.';
        state.ui.noticeTimer = 4;
      }
    }
  }

  Game.friendlyFireKingEntity = { updateFriendlyFireKing };
})();
