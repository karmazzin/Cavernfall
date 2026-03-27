(() => {
  const Game = window.MC2D;
  const { TILE, GRAVITY } = Game.constants;
  const { rand, aabb } = Game.math;
  const { moveEntity } = Game.physics;
  const { getBlock, blockSolid, setBlock } = Game.world;
  const { BLOCK } = Game.blocks;
  const { ensureMobState, updateMobMediumState } = Game.mobUtils;
  const { applyPlayerDamage } = Game.combat;

  function breakableForGuard(id) {
    return id === BLOCK.BLACKSTONE || id === BLOCK.BASALT || id === BLOCK.RED_EARTH;
  }

  function updateFireGuards(state, dt) {
    if (state.activeDimension !== 'fire') return;
    for (let i = state.fireGuards.length - 1; i >= 0; i -= 1) {
      const guard = state.fireGuards[i];
      ensureMobState(guard);
      updateMobMediumState(state, guard);
      guard.attackCd = Math.max(0, (guard.attackCd || 0) - dt);
      guard.jumpCd = Math.max(0, (guard.jumpCd || 0) - dt);
      guard.obstacleTimer = guard.obstacleTimer || 0;
      guard.patrolTimer = (guard.patrolTimer || 0) - dt;

      const playerDist = Math.hypot((state.player.x + state.player.w / 2) - (guard.x + guard.w / 2), (state.player.y + state.player.h / 2) - (guard.y + guard.h / 2));
      let targetDir = 0;
      const destroyer = guard.role === 'destroyer';
      if (!destroyer && playerDist < 180) targetDir = state.player.x < guard.x ? -1 : 1;
      else {
        if (guard.patrolTimer <= 0) {
          guard.dir *= Math.random() < 0.55 ? 1 : -1;
          guard.patrolTimer = destroyer ? rand(2.4, 4.8) : rand(1.4, 3.2);
        }
        targetDir = guard.dir;
      }

      const speed = destroyer ? 24 : playerDist < 180 ? 58 : 34;
      guard.vx = targetDir * speed;
      if (guard.vx !== 0) guard.dir = guard.vx < 0 ? -1 : 1;

      const frontX = guard.vx >= 0 ? guard.x + guard.w + 1 : guard.x - 1;
      const txFront = Math.floor(frontX / TILE);
      const tyFeet = Math.floor((guard.y + guard.h) / TILE);
      const aheadBlock = getBlock(state, txFront, tyFeet - 1);
      const groundAhead = getBlock(state, txFront, tyFeet);
      const needJump = blockSolid(aheadBlock) && !blockSolid(groundAhead);
      if (destroyer && breakableForGuard(aheadBlock)) {
        guard.vx = 0;
        guard.breakTimer = (guard.breakTimer || 0) + dt;
        guard.miningSwing = (guard.miningSwing || 0) + dt * 12;
        if (guard.breakTimer >= 0.65) {
          setBlock(state, txFront, tyFeet - 1, BLOCK.AIR);
          guard.breakTimer = 0;
        }
      } else {
        guard.breakTimer = 0;
        guard.miningSwing = 0;
      }
      if (needJump && guard.onGround && guard.jumpCd <= 0) {
        guard.vy = -360;
        guard.jumpCd = 0.7;
      }

      const wasOnGround = guard.onGround;
      guard.vy += GRAVITY * dt;
      guard.stepUpHeight = TILE;
      moveEntity(state, guard, dt);
      guard.stepUpHeight = 0;
      if (!wasOnGround && guard.onGround && guard.vy > 0) guard.obstacleTimer = 0;

      const centerTx = Math.floor((guard.x + guard.w / 2) / TILE);
      const feetTy = Math.floor((guard.y + guard.h - 2) / TILE);
      const feetBlock = getBlock(state, centerTx, feetTy);
      const bodyBlock = getBlock(state, centerTx, Math.floor((guard.y + guard.h / 2) / TILE));
      if (feetBlock === BLOCK.LAVA || bodyBlock === BLOCK.LAVA) {
        guard.vy = Math.min(guard.vy, 120);
      }

      if (aabb(guard.x, guard.y, guard.w, guard.h, state.player.x, state.player.y, state.player.w, state.player.h) && guard.attackCd <= 0) {
        guard.attackCd = 0.9;
        applyPlayerDamage(state, 3, { flash: 0.25 });
      }

      if (guard.hp <= 0) state.fireGuards.splice(i, 1);
    }
  }

  Game.fireGuardsEntity = { updateFireGuards };
})();
