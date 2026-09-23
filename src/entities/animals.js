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
        [BLOCK.GRASS, BLOCK.AUTUMN_GRASS].includes(getBlock(state, tx, state.surfaceAt[tx])) &&
        (getBlock(state, tx, ty) === BLOCK.AIR || Game.blocks.GROUND_COVER.has(getBlock(state, tx, ty)) || [BLOCK.SMALL_WHITE_MUSHROOM, BLOCK.SMALL_FLY_AGARIC].includes(getBlock(state, tx, ty))) &&
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

  function createSheep(tx, ty) {
    const animal = {
      x: tx*TILE+2, y: ty*TILE, w: 12, h: 10, vx: 0, vy: 0, onGround: false, hp: 4,
      dir: Math.random()<0.5 ? -1 : 1, state: ANIMAL_STATE.IDLE, stateTimer: rand(1.4,3.2), grazing: false,
      walkMin: 6, walkMax: 10, moveSpeed: 22, panicSpeed: 60, targetVx: 0, hopCd: 0, obstacleTimer: 0,
      clickCd: 0, edgeCooldown: 0, commitTimer: 0, stuckTimer: 0, turnLockTimer: 0,
      loveTime: 0, breedCooldown: 0,
    };
    ensureMobState(animal);
    return animal;
  }

  function feedSheep(state, animal) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    if (animal.hp <= 0 || animal.breedCooldown > 0 || animal.loveTime > 0 || !slot || slot.id !== Game.items.ITEM.WHEAT || slot.count <= 0) return false;
    if (!['creative','infinite_inventory'].includes(state.worldMeta?.mode)) Game.inventory.removeFromSlot(slot,1);
    animal.loveTime = 30;
    setIdle(animal);
    return true;
  }

  function findSheepSpots(state, count) {
    const spots=[];
    const px=Math.floor((state.player.x+state.player.w/2)/TILE), py=Math.floor((state.player.y+state.player.h)/TILE)-1;
    for(let radius=0;radius<=8;radius++) for(const dx of radius ? [-radius,radius] : [0]) {
      for(let dy=-3;dy<=3;dy++) {
        const x=px+dx,y=py+dy;
        if(getBlock(state,x,y)!==BLOCK.AIR || !blockSolid(getBlock(state,x,y+1))) continue;
        spots.push({x,y}); break;
      }
      if(spots.length===count) return spots;
    }
    return null;
  }

  function updateAnimals(state, dt) {
    const held = state.player.hotbar[state.player.selectedSlot];
    const lure = held && held.id === Game.items.ITEM.WHEAT && held.count > 0;
    const partners = new Map();
    for (const animal of state.animals) {
      animal.loveTime = Math.max(0,(animal.loveTime||0)-dt);
      animal.breedCooldown = Math.max(0,(animal.breedCooldown||0)-dt);
    }
    for (const animal of state.animals) {
      if (animal.hp<=0 || animal.loveTime<=0 || partners.has(animal)) continue;
      let closest=null, distance=8*TILE;
      for(const other of state.animals) {
        if(other===animal || other.hp<=0 || other.loveTime<=0 || partners.has(other)) continue;
        const d=Math.hypot(other.x-animal.x,other.y-animal.y);
        if(d<distance) { distance=d;closest=other; }
      }
      if(closest) { partners.set(animal,closest);partners.set(closest,animal); }
    }
    const births=[];

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

      const partner=partners.get(animal);
      let target=null;
      if (animal.state !== ANIMAL_STATE.PANIC) {
        if(partner && animal.loveTime>0 && partner.loveTime>0) target=partner;
        else if(lure && Math.hypot(state.player.x-animal.x,state.player.y-animal.y)<8*TILE) target=state.player;
      }
      if(target) {
        const delta=target.x+target.w/2-(animal.x+animal.w/2);
        animal.dir=delta<0 ? -1 : 1;
        animal.targetVx=Math.abs(delta)<(target===partner?4:20) ? 0 : animal.dir*animal.moveSpeed*1.5;
        animal.grazing=false;
        animal.commitTimer=0;
      }
      if(partner && animal.loveTime>0 && partner.loveTime>0 && Math.abs(animal.x-partner.x)<14 && Math.abs(animal.y-partner.y)<10) {
        const child=createSheep(Math.floor((animal.x+partner.x)/2/TILE),Math.floor(animal.y/TILE));
        child.breedCooldown=60;
        births.push(child);
        animal.loveTime=partner.loveTime=0;
        animal.breedCooldown=partner.breedCooldown=60;
      }

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

      if (target && (realEdgeAhead || dangerousAhead) && !blocked) animal.targetVx = 0;
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
    state.animals.push(...births);
  }

  Game.animalsEntity = { createSheep, feedSheep, findSheepSpots, spawnAnimals, updateAnimals, spawnFood, ANIMAL_STATE, setWalk, setIdle };
})();
