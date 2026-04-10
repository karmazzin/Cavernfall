(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, GRAVITY, PLAYER_SPEED, JUMP_SPEED, SWIM_SPEED } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { clamp } = Game.math;
  const { getBlock, getLocationInfo } = Game.world;
  const { moveEntity } = Game.physics;
  const { applyPlayerDamage, hasFullFriendshipArmor, hasFriendshipAmuletAura } = Game.combat;
  const audio = Game.audio;
  const LADDER_SPEED = 165;
  const WALK_FACTOR = 0.9;
  const SPRINT_FACTOR = 1.35;

  function isCreative(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'creative');
  }

  function isSpectator(state) {
    return !!(state.worldMeta && state.worldMeta.mode === 'spectator');
  }

  function updatePlayer(state, input, dt) {
    const { player } = state;
    player.respawnInvuln = Math.max(0, (player.respawnInvuln || 0) - dt);
    if (player.sleeping) {
      player.vx = 0;
      player.vy = 0;
      player.onGround = true;
      if (Number.isFinite(player.sleepBlockX)) player.x = player.sleepBlockX + 2;
      if (Number.isFinite(player.sleepBlockY)) player.y = player.sleepBlockY - player.h + 12;
      player.sleepTimer = Math.max(0, (player.sleepTimer || 0) - dt);
      if (player.sleepTimer <= 0) {
        player.sleeping = false;
        player.sleepBlockX = null;
        player.sleepBlockY = null;
      }
      return;
    }
    if (player.facing !== -1 && player.facing !== 1) player.facing = 1;
    const controlsLocked = (state.crafting && state.crafting.open) || (state.pause && state.pause.open);
    const touchMode = !!(state.ui && state.ui.controlMode === 'touch');
    const left = !controlsLocked && input.keys.has('KeyA');
    const right = !controlsLocked && input.keys.has('KeyD');
    const jump = !controlsLocked && (input.keys.has('KeyW') || input.keys.has('Space'));
    const sprintKey = !controlsLocked && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'));
    const wasOnGround = player.onGround;
    const preMoveVy = player.vy;

    const centerTx = Math.floor((player.x + player.w / 2) / TILE);
    const centerTy = Math.floor((player.y + player.h / 2) / TILE);
    const headTy = Math.floor((player.y + 2) / TILE);
    const feetTy = Math.floor((player.y + player.h - 2) / TILE);
    const blockCenter = getBlock(state, centerTx, centerTy);
    const blockHead = getBlock(state, centerTx, headTy);
    const blockFeet = getBlock(state, centerTx, feetTy);
    const inCobweb = blockCenter === BLOCK.COBWEB || blockHead === BLOCK.COBWEB || blockFeet === BLOCK.COBWEB;
    const onLadder = blockCenter === BLOCK.LADDER || blockHead === BLOCK.LADDER || blockFeet === BLOCK.LADDER;
    const creative = isCreative(state);
    const spectator = isSpectator(state);
    const creativeFlight = creative && (touchMode || player.creativeFlight);
    const sprintMultiplier = sprintKey ? SPRINT_FACTOR : WALK_FACTOR;
    const moveSpeed = PLAYER_SPEED * sprintMultiplier;
    const flightSpeed = SWIM_SPEED * sprintMultiplier;

    player.inWater = blockCenter === BLOCK.WATER || blockHead === BLOCK.WATER || blockFeet === BLOCK.WATER;
    player.underwater = blockHead === BLOCK.WATER && blockCenter === BLOCK.WATER;
    player.onLadder = onLadder;
    player.sprinting = !!(sprintKey && (left || right) && !player.inWater && !onLadder && !creativeFlight && !spectator);

    player.vx = 0;
    if (left) player.vx -= moveSpeed;
    if (right) player.vx += moveSpeed;
    if (player.vx < -1) player.facing = -1;
    else if (player.vx > 1) player.facing = 1;

    if (spectator) {
      const flyingDown = !controlsLocked && input.keys.has('KeyS');
      player.inWater = false;
      player.underwater = false;
      player.onLadder = false;
      player.onGround = false;
      player.vy = 0;
      if (jump) player.vy = -flightSpeed;
      else if (flyingDown) player.vy = flightSpeed;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.x = clamp(player.x, 0, WORLD_W * TILE - player.w);
      player.y = clamp(player.y, 0, state.world.length * TILE - player.h);
      player.stepUpHeight = 0;
      player.lavaSoundTimer = 0;
      return;
    }

    if (creativeFlight) {
      const flyingDown = !controlsLocked && input.keys.has('KeyS');
      player.inWater = false;
      player.underwater = false;
      player.onLadder = false;
      player.vy = 0;
      if (jump) player.vy = -flightSpeed;
      else if (flyingDown) player.vy = flightSpeed;
    } else if (creative) {
      const diving = !controlsLocked && input.keys.has('KeyS');
      if (player.inWater) {
        if (jump) player.vy = -SWIM_SPEED;
        else if (diving) player.vy = SWIM_SPEED;
        else player.vy *= 0.85;
      } else if (onLadder) {
        player.vy = 0;
        if (jump) player.vy = -LADDER_SPEED;
        else if (diving) player.vy = LADDER_SPEED;
        player.vx *= 0.8;
      } else {
        if (jump && player.onGround) {
          player.vy = -JUMP_SPEED;
          audio.playJump();
        }
        player.vy += GRAVITY * dt;
      }
    } else if (player.inWater) {
      const diving = !controlsLocked && input.keys.has('KeyS');
      if (jump) player.vy = -SWIM_SPEED;
      else if (diving) player.vy = SWIM_SPEED;
      else player.vy *= 0.85;
    } else if (onLadder) {
      const climbingDown = !controlsLocked && input.keys.has('KeyS');
      player.vy = 0;
      if (jump) player.vy = -LADDER_SPEED;
      else if (climbingDown) player.vy = LADDER_SPEED;
      player.vx *= 0.8;
    } else {
      if (jump && player.onGround) {
        player.vy = -JUMP_SPEED;
        audio.playJump();
      }
      player.vy += GRAVITY * dt;
    }

    if (inCobweb && !creativeFlight) {
      player.vx *= 0.5;
      player.vy *= 0.5;
    }

    player.stepUpHeight = player.inWater ? TILE : 0;
    moveEntity(state, player, dt);
    player.stepUpHeight = 0;
    player.x = clamp(player.x, 0, WORLD_W * TILE - player.w);

    if (!creative && !wasOnGround && player.onGround && !player.inWater && preMoveVy > 700) {
      const damage = Math.ceil((preMoveVy - 700) / 180);
      if (damage > 0) applyPlayerDamage(state, damage, { flash: 0.18 });
    }

    const footTx = Math.floor((player.x + player.w / 2) / TILE);
    const footTy = Math.floor((player.y + player.h) / TILE);
    const under = getBlock(state, footTx, footTy);
    const inBody = getBlock(state, footTx, Math.floor((player.y + player.h / 2) / TILE));

    const lavaImmune = hasFullFriendshipArmor(state) || hasFriendshipAmuletAura(state, true);
    if (!creative && !spectator && (under === BLOCK.LAVA || inBody === BLOCK.LAVA) && !lavaImmune) {
      applyPlayerDamage(state, dt * 2, { flash: 0.2 });
      player.lavaSoundTimer -= dt;
      if (player.lavaSoundTimer <= 0) {
        audio.playBurn();
        player.lavaSoundTimer = 0.45;
      }
    } else {
      player.lavaSoundTimer = 0;
    }

    if (player.inWater) player.vx *= 0.7;

    const location = getLocationInfo(
      state,
      Math.floor((player.x + player.w / 2) / TILE),
      Math.floor((player.y + player.h / 2) / TILE)
    );
    if (location.biome !== 'water_caves' || hasFullFriendshipArmor(state) || creative || spectator) {
      player.waterCaveSafeX = player.x;
      player.waterCaveSafeY = player.y;
    } else if (location.biome === 'water_caves') {
      if (Number.isFinite(player.waterCaveSafeX) && Number.isFinite(player.waterCaveSafeY)) {
        player.x = player.waterCaveSafeX;
        player.y = player.waterCaveSafeY;
      }
      player.vx = 0;
      player.vy = 0;
      if (state.waterCaves) {
        state.waterCaves.warningTimer = Math.max(0, (state.waterCaves.warningTimer || 0) - dt);
        if ((state.waterCaves.warningTimer || 0) <= 0) {
          state.ui.noticeText = 'Без полного сета брони дружбы Водные пещеры не пропускают.';
          state.ui.noticeTimer = 3.5;
          state.waterCaves.warningTimer = 2.6;
        }
      }
    }

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
