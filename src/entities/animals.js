(() => {
  const Game = window.MC2D;
  const { TILE, WORLD_W, ANIMAL_SPAWN_ATTEMPTS, GRAVITY } = Game.constants;
  const { BLOCK } = Game.blocks;
  const { rand } = Game.math;
  const { getBlock, blockSolid, liquid } = Game.world;
  const { moveEntity } = Game.physics;
  const { ensureMobState, applyMobEnvironmentDamage } = Game.mobUtils;

  const ANIMAL_STATE = {
    IDLE: 'idle',
    WALK: 'walk',
    PANIC: 'panic',
  };

  function spawnFood(state, x, y, itemId, amount = 1) {
    state.foods.push({ x, y, w: 10, h: 10, itemId, amount, t: 0 });
  }

  function setIdle(animal) {
    animal.state = ANIMAL_STATE.IDLE;
    animal.stateTimer = rand(1.4, 3.8);
    animal.grazing = Math.random() < 0.55;
    animal.targetVx = 0;
    animal.commitTimer = 0;
  }

  function setWalk(animal, preserveDir = true, durationScale = 1) {
    animal.state = ANIMAL_STATE.WALK;
    animal.stateTimer = rand(animal.walkMin, animal.walkMax) * durationScale;
    animal.grazing = false;
    if (!preserveDir) animal.dir *= -1;
    animal.commitTimer = rand(1.8, 2.8) * Math.min(1.2, durationScale);
  }

  function turnAround(animal) {
    animal.dir *= -1;
    animal.state = ANIMAL_STATE.WALK;
    animal.stateTimer = rand(3.2, 5.8);
    animal.grazing = false;
    animal.commitTimer = rand(2.2, 3.4);
    animal.turnLockTimer = rand(1.4, 2.2);
  }

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
          const animal = {
            x: tx * TILE + 2,
            y: ty * TILE,
            w: 12,
            h: 10,
            vx: 0,
            vy: 0,
            onGround: false,
            hp: Math.floor(rand(2, 5)),
            dir: Math.random() < 0.5 ? -1 : 1,
            state: ANIMAL_STATE.IDLE,
            stateTimer: 0,
            grazing: false,
            walkMin: rand(6, 8),
            walkMax: rand(9, 13),
            moveSpeed: rand(18, 24),
            panicSpeed: rand(52, 68),
            targetVx: 0,
            hopCd: 0,
            obstacleTimer: 0,
            clickCd: 0,
            edgeCooldown: 0,
            commitTimer: 0,
            stuckTimer: 0,
            turnLockTimer: 0,
          };
          ensureMobState(animal);
          if (Math.random() < 0.78) setWalk(animal, true, 1.15);
          else setIdle(animal);
          state.animals.push(animal);
        }
      }
    }
  }

  function updateAnimals(state, dt) {
    if (state.activeDimension === 'fire') return;
    for (const animal of state.animals) {
      animal.stateTimer -= dt;
      animal.hopCd -= dt;
      animal.edgeCooldown -= dt;
      animal.commitTimer -= dt;
      animal.turnLockTimer -= dt;

      if (animal.state === ANIMAL_STATE.PANIC) {
        if (animal.stateTimer <= 0) setWalk(animal, true, 1.1);
      } else if (animal.stateTimer <= 0) {
        if (animal.state === ANIMAL_STATE.IDLE) {
          setWalk(animal, true, 1.25);
        } else {
          const roll = Math.random();
          if (roll < 0.16) setIdle(animal);
          else if (roll < 0.97 || animal.turnLockTimer > 0) setWalk(animal, true, 1.15);
          else setWalk(animal, false, 1);
        }
      }

      if (animal.state === ANIMAL_STATE.IDLE) animal.targetVx = 0;
      else if (animal.state === ANIMAL_STATE.WALK) animal.targetVx = animal.dir * animal.moveSpeed;
      else animal.targetVx = animal.dir * animal.panicSpeed;

      const frontOffset = animal.dir > 0 ? animal.w + 2 : -2;
      const frontX = animal.x + frontOffset;
      const txFront = Math.floor(frontX / TILE);
      const tyFeet = Math.floor((animal.y + animal.h) / TILE);
      const aheadBlock = getBlock(state, txFront, tyFeet - 1);
      const groundAhead = getBlock(state, txFront, tyFeet);
      const groundOneBelowAhead = getBlock(state, txFront, tyFeet + 1);
      const groundBelowSelf = getBlock(state, Math.floor((animal.x + animal.w / 2) / TILE), tyFeet);

      const blocked = blockSolid(aheadBlock);
      const inWater = liquid(groundBelowSelf);
      const badGround = inWater;
      const dangerousAhead = liquid(groundAhead) || liquid(groundOneBelowAhead);
      const canStepDownOneBlock = !blockSolid(groundAhead) && blockSolid(groundOneBelowAhead) && !liquid(groundOneBelowAhead);
      const realEdgeAhead = !blockSolid(groundAhead) && !canStepDownOneBlock && !dangerousAhead;

      if (blocked && animal.onGround && !realEdgeAhead && !dangerousAhead) animal.obstacleTimer += dt;
      else animal.obstacleTimer = 0;

      if (blocked && animal.onGround && animal.hopCd <= 0 && animal.obstacleTimer > (animal.state === ANIMAL_STATE.PANIC ? 0.1 : 0.18)) {
        animal.vy = animal.state === ANIMAL_STATE.PANIC ? -300 : -235;
        animal.hopCd = animal.state === ANIMAL_STATE.PANIC ? 0.55 : 0.8;
        animal.obstacleTimer = 0;
      }

      if ((realEdgeAhead || dangerousAhead || badGround) && animal.edgeCooldown <= 0 && animal.commitTimer <= 0) {
        turnAround(animal);
        animal.edgeCooldown = 1.1;
      }

      if (inWater) {
        animal.dir *= -1;
        animal.targetVx = animal.dir * animal.panicSpeed;
        animal.commitTimer = Math.max(animal.commitTimer, 1.8);
        animal.edgeCooldown = 1.2;
      }

      const accel = animal.state === ANIMAL_STATE.PANIC ? 10 : 5;
      animal.vx += (animal.targetVx - animal.vx) * Math.min(1, accel * dt);
      const prevX = animal.x;
      const wasOnGround = animal.onGround;
      const preMoveVy = animal.vy;
      animal.vy += GRAVITY * dt;
      animal.stepUpHeight = TILE;
      moveEntity(state, animal, dt);
      animal.stepUpHeight = 0;
      applyMobEnvironmentDamage(state, animal, dt, wasOnGround, preMoveVy);

      if (animal.onGround && Math.abs(animal.targetVx) > 1 && Math.abs(animal.x - prevX) < 0.12) {
        animal.stuckTimer += dt;
      } else {
        animal.stuckTimer = 0;
      }

      if (animal.stuckTimer > 0.7 && animal.commitTimer <= 0) {
        turnAround(animal);
        animal.edgeCooldown = 1.1;
        animal.stuckTimer = 0;
      }
    }
  }

  Game.animalsEntity = { spawnAnimals, updateAnimals, spawnFood, ANIMAL_STATE, setWalk, setIdle };
})();
