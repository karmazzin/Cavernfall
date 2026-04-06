(() => {
  const Game = window.MC2D;
  const { aabb } = Game.math;
  const { addToInventory } = Game.inventory;

  function updateFood(state, dt) {
    for (let i = state.foods.length - 1; i >= 0; i -= 1) {
      const food = state.foods[i];
      food.t += dt;

      if (Game.firePyramidSystem && Game.firePyramidSystem.tryActivateFirePyramid(state, food)) {
        state.foods.splice(i, 1);
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
