(() => {
  const Game = window.MC2D;
  const { aabb } = Game.math;
  const { addToInventory } = Game.inventory;

  function updateFood(state, dt) {
    for (let i = state.foods.length - 1; i >= 0; i -= 1) {
      const food = state.foods[i];
      food.t += dt;

      if (aabb(food.x, food.y, food.w, food.h, state.player.x, state.player.y, state.player.w, state.player.h)) {
        if (addToInventory(state, food.itemId, food.amount)) state.foods.splice(i, 1);
      } else if (food.t > 30) {
        state.foods.splice(i, 1);
      }
    }
  }

  Game.foodEntity = { updateFood };
})();
