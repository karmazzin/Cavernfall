(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, GRAVITY, PLAYER_SPEED, JUMP_SPEED, SWIM_SPEED } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { clamp } = Game.math;
  const { getBlock } = Game.world;
  const { moveEntity } = Game.physics;
  const audio = Game.audio;

  function updatePlayer(state, input, dt) {
    const { player } = state;
    const left = input.keys.has('KeyA');
    const right = input.keys.has('KeyD');
    const jump = input.keys.has('KeyW') || input.keys.has('Space');
    const wasOnGround = player.onGround;
    const preMoveVy = player.vy;

    const centerTx = Math.floor((player.x + player.w / 2) / TILE);
    const centerTy = Math.floor((player.y + player.h / 2) / TILE);
    const headTy = Math.floor((player.y + 2) / TILE);
    const feetTy = Math.floor((player.y + player.h - 2) / TILE);
    const blockCenter = getBlock(state, centerTx, centerTy);
    const blockHead = getBlock(state, centerTx, headTy);
    const blockFeet = getBlock(state, centerTx, feetTy);

    player.inWater = blockCenter === BLOCK.WATER || blockHead === BLOCK.WATER || blockFeet === BLOCK.WATER;
    player.underwater = blockHead === BLOCK.WATER && blockCenter === BLOCK.WATER;

    player.vx = 0;
    if (left) player.vx -= PLAYER_SPEED;
    if (right) player.vx += PLAYER_SPEED;

    if (player.inWater) {
      const diving = input.keys.has('KeyS');
      if (jump) player.vy = -SWIM_SPEED;
      else if (diving) player.vy = SWIM_SPEED;
      else player.vy *= 0.85;
    } else {
      if (jump && player.onGround) {
        player.vy = -JUMP_SPEED;
        audio.playJump();
      }
      player.vy += GRAVITY * dt;
    }

    moveEntity(state, player, dt);
    player.x = clamp(player.x, 0, WORLD_W * TILE - player.w);

    if (!wasOnGround && player.onGround && !player.inWater && preMoveVy > 700) {
      const damage = Math.ceil((preMoveVy - 700) / 180);
      if (damage > 0) {
        player.health = Math.max(0, player.health - damage);
        state.attackFlash = 0.18;
        if (player.health <= 0) state.gameOver = true;
      }
    }

    const footTx = Math.floor((player.x + player.w / 2) / TILE);
    const footTy = Math.floor((player.y + player.h) / TILE);
    const under = getBlock(state, footTx, footTy);
    const inBody = getBlock(state, footTx, Math.floor((player.y + player.h / 2) / TILE));

    if (under === BLOCK.LAVA || inBody === BLOCK.LAVA) {
      player.health = Math.max(0, player.health - dt * 2);
      state.attackFlash = 0.2;
      player.lavaSoundTimer -= dt;
      if (player.lavaSoundTimer <= 0) {
        audio.playBurn();
        player.lavaSoundTimer = 0.45;
      }
    } else {
      player.lavaSoundTimer = 0;
    }

    if (player.inWater) player.vx *= 0.7;

    const movingHorizontally = left || right;
    player.stepSoundTimer -= dt;
    player.swimSoundTimer -= dt;

    if (player.inWater && (movingHorizontally || Math.abs(player.vy) > 15)) {
      if (player.swimSoundTimer <= 0) {
        audio.playSwim();
        player.swimSoundTimer = 0.42;
      }
    } else if (!player.inWater && player.onGround && movingHorizontally && wasOnGround) {
      if (player.stepSoundTimer <= 0) {
        audio.playStep();
        player.stepSoundTimer = 0.32;
      }
    }
  }

  Game.playerEntity = { updatePlayer };
})();
