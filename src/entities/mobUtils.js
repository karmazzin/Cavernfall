(() => {
  const Game = window.MC2D;
  const { TILE } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { getBlock } = Game.world;

  function ensureMobState(mob) {
    if (mob.breath == null) mob.breath = 3.5;
    if (mob.inWater == null) mob.inWater = false;
    if (mob.underwater == null) mob.underwater = false;
    if (mob.lavaDamageTimer == null) mob.lavaDamageTimer = 0;
  }

  function getMobBlocks(state, mob) {
    const centerTx = Math.floor((mob.x + mob.w / 2) / TILE);
    const centerTy = Math.floor((mob.y + mob.h / 2) / TILE);
    const headTy = Math.floor((mob.y + 2) / TILE);
    const feetTy = Math.floor((mob.y + mob.h - 2) / TILE);
    return {
      centerTx,
      centerTy,
      headTy,
      feetTy,
      blockCenter: getBlock(state, centerTx, centerTy),
      blockHead: getBlock(state, centerTx, headTy),
      blockFeet: getBlock(state, centerTx, feetTy),
    };
  }

  function updateMobMediumState(state, mob) {
    ensureMobState(mob);
    const info = getMobBlocks(state, mob);
    mob.inWater = info.blockCenter === BLOCK.WATER || info.blockHead === BLOCK.WATER || info.blockFeet === BLOCK.WATER;
    mob.underwater = info.blockCenter === BLOCK.WATER && info.blockHead === BLOCK.WATER;
    return info;
  }

  function getWaterEscapeDir(state, mob, fallbackDir = 1) {
    const centerTx = Math.floor((mob.x + mob.w / 2) / TILE);
    const headTy = Math.floor((mob.y + 2) / TILE);
    const bodyTy = Math.floor((mob.y + mob.h / 2) / TILE);

    for (let step = 1; step <= 4; step += 1) {
      const rightHead = getBlock(state, centerTx + step, headTy);
      const rightBody = getBlock(state, centerTx + step, bodyTy);
      if (rightHead !== BLOCK.WATER && rightBody !== BLOCK.WATER) return 1;

      const leftHead = getBlock(state, centerTx - step, headTy);
      const leftBody = getBlock(state, centerTx - step, bodyTy);
      if (leftHead !== BLOCK.WATER && leftBody !== BLOCK.WATER) return -1;
    }

    return fallbackDir || 1;
  }

  function applyMobEnvironmentDamage(state, mob, dt, wasOnGround, preMoveVy) {
    const info = updateMobMediumState(state, mob);

    if (!wasOnGround && mob.onGround && !mob.inWater && preMoveVy > 700) {
      const damage = Math.ceil((preMoveVy - 700) / 220);
      if (damage > 0) mob.hp -= damage;
    }

    if (info.blockFeet === BLOCK.LAVA || info.blockCenter === BLOCK.LAVA || info.blockHead === BLOCK.LAVA) {
      mob.hp -= dt * 2;
      mob.lavaDamageTimer = 0.35;
    } else if (mob.lavaDamageTimer > 0) {
      mob.lavaDamageTimer = Math.max(0, mob.lavaDamageTimer - dt);
    }

    if (mob.underwater) {
      mob.breath -= dt;
      if (mob.breath <= 0) mob.hp -= dt * 1.4;
    } else {
      mob.breath = 3.5;
    }
  }

  Game.mobUtils = {
    ensureMobState,
    updateMobMediumState,
    getWaterEscapeDir,
    applyMobEnvironmentDamage,
  };
})();
