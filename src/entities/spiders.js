(() => {
  const Game = window.MC2D;
  const { TILE, GRAVITY } = Game.constants;
  const { aabb, rand } = Game.math;
  const { getBlock, blockSolid } = Game.world;
  const { moveEntity } = Game.physics;

  function updateSpiders(state, dt) {
    for (let i = state.spiders.length - 1; i >= 0; i -= 1) {
      const spider = state.spiders[i];
      const dx = state.player.x - spider.x;
      const dy = state.player.y - spider.y;
      const distance = Math.hypot(dx, dy);

      spider.moveTimer -= dt;
      spider.attackCd -= dt;

      const chasing = distance < 170;
      if (chasing) {
        spider.dir = dx < 0 ? -1 : 1;
        spider.vx = spider.dir * 95;
      } else {
        if (spider.moveTimer <= 0) {
          spider.moveTimer = rand(0.8, 2);
          spider.dir = Math.random() < 0.5 ? -1 : 1;
        }
        spider.vx = spider.dir * 36;
      }

      const frontX = spider.x + (spider.dir > 0 ? spider.w + 1 : -1);
      const txFront = Math.floor(frontX / TILE);
      const tyFeet = Math.floor((spider.y + spider.h) / TILE);
      const aheadBlock = getBlock(state, txFront, tyFeet - 1);
      const groundAhead = getBlock(state, txFront, tyFeet);

      spider.vy += GRAVITY * dt;
      if ((blockSolid(aheadBlock) || !blockSolid(groundAhead)) && spider.onGround) spider.vy = -280;

      moveEntity(state, spider, dt);

      if (aabb(spider.x, spider.y, spider.w, spider.h, state.player.x, state.player.y, state.player.w, state.player.h) && spider.attackCd <= 0) {
        spider.attackCd = 0.9;
        state.player.health = Math.max(0, state.player.health - 1);
        state.attackFlash = 0.18;
        if (state.player.health <= 0) state.gameOver = true;
      }

      if (spider.hp <= 0) state.spiders.splice(i, 1);
    }
  }

  Game.spidersEntity = { updateSpiders };
})();
