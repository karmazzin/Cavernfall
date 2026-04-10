(() => {
  const Game = window.MC2D;
  const { aabb } = Game.math;
  const { addToInventory } = Game.inventory;
  const { BLOCK } = Game.blocks;
  const { ITEM } = Game.items;
  const { getBlock } = Game.world;

  function updateFood(state, dt) {
    for (let i = state.foods.length - 1; i >= 0; i -= 1) {
      const food = state.foods[i];
      food.t += dt;

      if (Game.firePyramidSystem && Game.firePyramidSystem.tryActivateFirePyramid(state, food)) {
        state.foods.splice(i, 1);
        continue;
      }

      if (Game.waterWellSystem && Game.waterWellSystem.tryActivateWaterWell(state, food)) {
        state.foods.splice(i, 1);
        continue;
      }

      const centerX = Math.floor((food.x + food.w * 0.5) / Game.constants.TILE);
      const centerY = Math.floor((food.y + food.h * 0.5) / Game.constants.TILE);
      if (food.itemId === ITEM.FLOUR && getBlock(state, centerX, centerY) === BLOCK.WATER) {
        food.itemId = ITEM.DOUGH;
        food.amount = 1;
        food.t = 0;
        continue;
      }

      if (aabb(food.x, food.y, food.w, food.h, state.player.x, state.player.y, state.player.w, state.player.h)) {
        if (addToInventory(state, food.itemId, food.amount)) {
          if (Game.achievementsSystem) Game.achievementsSystem.updateAchievements(state, 999);
          state.foods.splice(i, 1);
        }
      } else if (food.t > 30) {
        state.foods.splice(i, 1);
      }
    }
  }

  Game.foodEntity = { updateFood };
})();
