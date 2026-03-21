(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, GRAVITY, PLAYER_SPEED, JUMP_SPEED, SWIM_SPEED } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { clamp } = Game.math;
  const { getBlock } = Game.world;
  const { moveEntity } = Game.physics;

  function updatePlayer(state, input, dt) {
    const { player } = state;
    const left = input.keys.has('a');
    const right = input.keys.has('d');
    const jump = input.keys.has('w') || input.keys.has(' ');

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
      if (jump) player.vy = -SWIM_SPEED;
      else if (input.keys.has('s')) player.vy = SWIM_SPEED;
      else player.vy *= 0.85;
    } else {
      if (jump && player.onGround) player.vy = -JUMP_SPEED;
      player.vy += GRAVITY * dt;
    }

    moveEntity(state, player, dt);
    player.x = clamp(player.x, 0, WORLD_W * TILE - player.w);

    const footTx = Math.floor((player.x + player.w / 2) / TILE);
    const footTy = Math.floor((player.y + player.h) / TILE);
    const under = getBlock(state, footTx, footTy);
    const inBody = getBlock(state, footTx, Math.floor((player.y + player.h / 2) / TILE));

    if (under === BLOCK.LAVA || inBody === BLOCK.LAVA) {
      player.health = Math.max(0, player.health - dt * 2);
      state.attackFlash = 0.2;
    }

    if (player.inWater) player.vx *= 0.7;
  }

  Game.playerEntity = { updatePlayer };
})();
