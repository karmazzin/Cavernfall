(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, ANIMAL_SPAWN_ATTEMPTS } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { rand } = Game.math;
  const { getBlock, blockSolid, liquid } = Game.world;

  function spawnAnimals(state) {
    state.animals.length = 0;

    for (let i = 0; i < ANIMAL_SPAWN_ATTEMPTS; i += 1) {
      const tx = Math.floor(rand(4, WORLD_W - 4));
      const ty = state.surfaceAt[tx] - 1;

      if (
        getBlock(state, tx, state.surfaceAt[tx]) === BLOCK.GRASS &&
        getBlock(state, tx, ty) === BLOCK.AIR &&
        !liquid(getBlock(state, tx, state.surfaceAt[tx] - 1))
      ) {
        if (Math.random() < 0.23) {
          state.animals.push({
            x: tx * TILE + 2,
            y: ty * TILE,
            w: 12,
            h: 10,
            hp: Math.floor(rand(2, 5)),
            dir: Math.random() < 0.5 ? -1 : 1,
            walkTimer: rand(0.5, 2),
            hopCd: 0,
          });
        }
      }
    }
  }

  function updateAnimals(state, dt) {
    for (const animal of state.animals) {
      animal.walkTimer -= dt;
      animal.hopCd -= dt;

      if (animal.walkTimer <= 0) {
        animal.walkTimer = rand(1, 3);
        animal.dir = Math.random() < 0.5 ? -1 : 1;
      }

      const speed = 28;
      animal.x += animal.dir * speed * dt;

      const frontX = animal.x + (animal.dir > 0 ? animal.w + 1 : -1);
      const txFront = Math.floor(frontX / TILE);
      const tyFeet = Math.floor((animal.y + animal.h) / TILE);
      const aheadBlock = getBlock(state, txFront, tyFeet - 1);
      const groundAhead = getBlock(state, txFront, tyFeet);
      const groundBelowSelf = getBlock(state, Math.floor((animal.x + animal.w / 2) / TILE), tyFeet);

      const blocked = blockSolid(aheadBlock);
      const noGroundAhead = !blockSolid(groundAhead) || liquid(groundAhead);
      const badGround = liquid(groundBelowSelf);

      if (blocked && animal.hopCd <= 0) {
        animal.y -= TILE * 0.9;
        animal.hopCd = 0.4;
      }

      if (noGroundAhead || badGround) {
        animal.dir *= -1;
        animal.x += animal.dir * 6;
      }
    }
  }

  Game.animalsEntity = { spawnAnimals, updateAnimals };
})();
