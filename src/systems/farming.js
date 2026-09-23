(() => {
  const Game = window.MC2D;
  const { BLOCK: B, SAPLINGS } = Game.blocks;
  const { ITEM: I } = Game.items;
  const { WORLD_W, WORLD_H, TILE } = Game.constants;
  const { getBlock, setBlock } = Game.world;
  const DURATION = 120;
  const SPECIES = [
    ['OAK', B.WOOD, B.LEAF, 5, 2], ['SPRUCE', B.SPRUCE_WOOD, B.SPRUCE_LEAF, 8, 3],
    ['SEQUOIA', B.SEQUOIA_WOOD, B.SEQUOIA_LEAF, 24, 5],
    ['MAPLE', B.MAPLE_WOOD, B.MAPLE_LEAF, 5, 2], ['ROWAN', B.ROWAN_WOOD, B.ROWAN_LEAF, 5, 2],
    ['ASPEN', B.ASPEN_WOOD, B.ASPEN_LEAF, 6, 2], ['BIRCH', B.BIRCH_WOOD, B.BIRCH_LEAF, 6, 2],
    ['CHERRY', B.CHERRY_WOOD, B.CHERRY_LEAF, 5, 3],
  ].map(([name, wood, leaf, height, radius]) => ({ id: B[name + '_SAPLING'], name, wood, leaf, height, radius }));
  const treeBySapling = new Map(SPECIES.map(s => [s.id, s]));
  const key = (x,y) => `${x},${y}`;
  const soilRuntime = new WeakMap();
  const isCrop = id => id === B.WHEAT_FARMLAND || id === B.CARROT_FARMLAND;
  const isPlant = id => isCrop(id) || SAPLINGS.has(id);
  const isGrass = id => id === B.GRASS || id === B.AUTUMN_GRASS;
  const isSoil = id => isGrass(id) || id === B.DIRT;
  const blocksGrassLight = id => id !== B.AIR && id !== B.PINK_FLOWERS && id !== B.CHERRY_LEAF;
  const data = state => state.farming || (state.farming = { plants: {}, covered: {} });
  const freeItems = state => ['creative','infinite_inventory'].includes(state.worldMeta?.mode);

  function hasWater(state, x, y) {
    for (let dy=-4; dy<=4; dy++) for (let dx=-4; dx<=4; dx++) {
      if (dx*dx+dy*dy <= 16 && getBlock(state,x+dx,y+dy) === B.WATER) return true;
    }
    return false;
  }
  function soilChange(state,x,y,id) {
    // A biological soil change must not remove the plant/seasonal cover above it.
    state.world[y][x] = id;
    if (state.seasons?.cells) delete state.seasons.cells[key(x,y)];
  }
  function onBlockChanged(state,x,y,previous,id) {
    if (previous === id) return;
    const d = data(state), k = key(x,y);
    delete d.plants[k]; delete d.covered[k];
    if (d.leaves) delete d.leaves[k];
    if (isPlant(id)) d.plants[k] = { id, elapsed: 0 };
    const runtime = soilRuntime.get(state.world);
    for (const yy of [y,y+1]) {
      if (yy >= WORLD_H) continue;
      const cell = getBlock(state,x,yy), above = getBlock(state,x,yy-1), sk = key(x,yy);
      if (runtime) { if (isSoil(cell)) runtime.cells.add(sk); else runtime.cells.delete(sk); }
      if (cell === B.DIRT && above === B.AIR) soilChange(state,x,yy,B.GRASS);
      if (!blocksGrassLight(above)) delete d.covered[sk];
    }
  }
  function tryPlant(state,x,y) {
    const slot = state.player.hotbar[state.player.selectedSlot];
    if (!slot || slot.count <= 0) return false;
    const id = slot.id, target = getBlock(state,x,y);
    if (id === I.WHEAT_SEEDS || id === I.CARROT_SEEDS) {
      // Accept clicking the grass itself or the air cell immediately above it.
      if (target === B.AIR) y++;
      if (!isGrass(getBlock(state,x,y)) || getBlock(state,x,y-1) !== B.AIR) return false;
      setBlock(state,x,y,id === I.WHEAT_SEEDS ? B.WHEAT_FARMLAND : B.CARROT_FARMLAND);
    } else if (SAPLINGS.has(id)) {
      if (isSoil(target)) y--;
      if (getBlock(state,x,y) !== B.AIR || ![B.DIRT,B.GRASS,B.AUTUMN_GRASS,B.MOSS].includes(getBlock(state,x,y+1))) return false;
      setBlock(state,x,y,id);
    } else return false;
    if (!freeItems(state)) Game.inventory.removeFromSlot(slot,1);
    return true;
  }
  function stageAt(state,x,y) { return Math.min(3, Math.floor((state.farming?.plants?.[key(x,y)]?.elapsed || 0)/30)); }

  function growTree(state,x,y,id) {
    const s = treeBySapling.get(id);
    if (!s || ![B.GRASS,B.DIRT,B.AUTUMN_GRASS,B.MOSS].includes(getBlock(state,x,y+1))) return false;
    const cells = new Map();
    const put = (xx,yy,block) => cells.set(key(xx,yy), {x:xx,y:yy,block});
    const top = y+1-s.height;
    if (s.name === 'SPRUCE') {
      for(let dy=-2;dy<=5;dy++) {
        const r = Math.min(3,Math.floor((dy+3)/2));
        for(let dx=-r;dx<=r;dx++) put(x+dx,top+dy,s.leaf);
      }
    } else if (s.name === 'SEQUOIA') {
      for (const level of [0,6,12,17]) for(let dy=-2;dy<=2;dy++) {
        const r = s.radius-Math.abs(dy);
        for(let dx=-r;dx<=r;dx++) put(x+dx,top+level+dy,s.leaf);
      }
    } else {
      for(let dy=-2;dy<=1;dy++) for(let dx=-s.radius;dx<=s.radius;dx++) {
        if (Math.abs(dx)+Math.abs(dy)<=s.radius+1) put(x+dx,top+dy,s.leaf);
      }
    }
    for(let yy=top;yy<=y;yy++) {
      const r = s.name === 'SEQUOIA' ? 1 : 0;
      for(let dx=-r;dx<=r;dx++) put(x+dx,yy,s.wood);
    }
    for(const c of cells.values()) {
      if(c.x<0 || c.x>=WORLD_W || c.y<0 || c.y>=WORLD_H) return false;
      if(c.x===x && c.y===y) continue;
      if(getBlock(state,c.x,c.y)!==B.AIR) return false;
    }
    for(const c of cells.values()) setBlock(state,c.x,c.y,c.block);
    return true;
  }
  function registerLeaves(state, keys, leaf) {
    const d=data(state); if (!d.leaves) d.leaves={};
    for (const k of keys) d.leaves[k]=leaf;
  }
  function invalidateSoil(state) { soilRuntime.delete(state.world); }
  function leafSpecies(state,x,y,id) {
    if (id === B.AUTUMN_LEAF && state.farming?.leaves?.[key(x,y)]) {
      return SPECIES.find(s=>s.leaf===state.farming.leaves[key(x,y)]) || null;
    }
    const direct = SPECIES.find(s=>s.leaf===id);
    if (direct) return direct;
    if (id !== B.AUTUMN_LEAF) return null;
    const cell = state.seasons?.cells?.[key(x,y)];
    if (cell) return SPECIES.find(s=>s.leaf===cell.values[0]) || null;
    // Autumn forests share a leaf block; identify the closest species trunk.
    let nearest=null, distance=Infinity;
    for(let dy=-7;dy<=7;dy++) for(let dx=-4;dx<=4;dx++) {
      const candidate = SPECIES.find(s=>s.wood===getBlock(state,x+dx,y+dy));
      const d = dx*dx+dy*dy;
      if(candidate && d<distance) { nearest=candidate; distance=d; }
    }
    return nearest;
  }
  function getDrop(state,x,y,roll=Math.random()) {
    const id=getBlock(state,x,y);
    if(isGrass(id)) return {id:B.DIRT,count:1};
    if(isCrop(id)) {
      const ripe=(state.farming?.plants?.[key(x,y)]?.elapsed || 0)>=DURATION;
      return {id:ripe ? (id===B.WHEAT_FARMLAND ? I.WHEAT : I.CARROT) : B.DIRT,count:1};
    }
    if(SAPLINGS.has(id)) return {id,count:1};
    const species=leafSpecies(state,x,y,id);
    if(species && roll<0.2) return {id:species.id,count:1};
    return null;
  }
  function update(state,dt) {
    const d=data(state);
    if (!d.plants) d.plants={}; if (!d.covered) d.covered={};
    let runtime=soilRuntime.get(state.world);
    if(!runtime) {
      runtime={cells:new Set()}; soilRuntime.set(state.world,runtime);
      for(let y=0;y<WORLD_H;y++) for(let x=0;x<WORLD_W;x++) {
        const id=getBlock(state,x,y);
        if(isGrass(id) || (id===B.DIRT && getBlock(state,x,y-1)===B.AIR)) runtime.cells.add(key(x,y));
        if(isPlant(id) && !d.plants[key(x,y)]) d.plants[key(x,y)]={id,elapsed:0};
      }
    }
    for(const k of runtime.cells) {
      const [x,y]=k.split(',').map(Number), id=getBlock(state,x,y);
      if(!isSoil(id)) {runtime.cells.delete(k); delete d.covered[k];continue;}
      const above = getBlock(state,x,y-1);
      if(!blocksGrassLight(above)) {
        delete d.covered[k]; if(id===B.DIRT && above===B.AIR) soilChange(state,x,y,B.GRASS);
      } else if(isGrass(id)) {
        d.covered[k]=(d.covered[k]||0)+dt;
        if(d.covered[k]>=5-1e-9) { soilChange(state,x,y,B.DIRT);delete d.covered[k]; }
      }
    }
    for(const [k,p] of Object.entries(d.plants)) {
      const [x,y]=k.split(',').map(Number);
      if(getBlock(state,x,y)!==p.id) { delete d.plants[k];continue; }
      if(SAPLINGS.has(p.id) && ![B.DIRT,B.GRASS,B.AUTUMN_GRASS,B.MOSS].includes(getBlock(state,x,y+1))) {
        Game.animalsEntity.spawnFood(state,x*TILE,y*TILE,p.id); setBlock(state,x,y,B.AIR);continue;
      }
      p.elapsed=Math.min(DURATION,p.elapsed+dt*(hasWater(state,x,y)?2:1));
      if(p.elapsed>=DURATION && SAPLINGS.has(p.id)) growTree(state,x,y,p.id);
    }
  }
  function createField(state,x0,y,width=18) {
    if(x0<2 || x0+width>=WORLD_W-2 || y<3 || y>=WORLD_H-2) return false;
    const natural = new Set([B.AIR,B.GRASS,B.DIRT,B.AUTUMN_GRASS,B.STONE,B.SNOW,B.SAND,B.SANDSTONE,
      B.WOOD,B.LEAF,B.SPRUCE_WOOD,B.SPRUCE_LEAF,B.SEQUOIA_WOOD,B.SEQUOIA_LEAF,
      ...Game.blocks.SEASON_WOODS,...Game.blocks.SEASON_LEAVES,...Game.blocks.GROUND_COVER,
      B.DRY_BUSH,B.SMALL_WHITE_MUSHROOM,B.SMALL_FLY_AGARIC]);
    // Prepare a modest flat field, including banks, without touching structures or lakes.
    for(let x=x0-1;x<=x0+width;x++) {
      const surface=state.surfaceAt[x];
      if(!Number.isFinite(surface) || Math.abs(surface-y)>6 || state.biomeAt[x]==='lake') return false;
      for(let yy=0;yy<=Math.max(surface,y)+1;yy++) if(!natural.has(getBlock(state,x,yy))) return false;
    }
    for(let x=x0-1;x<=x0+width;x++) {
      const surface=state.surfaceAt[x];
      for(let yy=0;yy<y;yy++) if(getBlock(state,x,yy)!==B.AIR) setBlock(state,x,yy,B.AIR);
      for(let yy=y;yy<=Math.max(surface,y)+1;yy++) setBlock(state,x,yy,B.DIRT);
      state.surfaceAt[x]=y;
    }
    for(let x=x0;x<x0+width;x++) {
      state.biomeAt[x]='field'; state.surfaceAt[x]=y;
      // Channels every seven tiles reach every crop; dirt seals their bottoms.
      const channel=(x-x0)%7===3;
      setBlock(state,x,y+1,B.DIRT);
      setBlock(state,x,y,channel ? B.WATER : Math.random()<0.5 ? B.WHEAT_FARMLAND : B.CARROT_FARMLAND);
      if(!channel) data(state).plants[key(x,y)].elapsed=Math.floor(Math.random()*4)*30;
    }
    return true;
  }
  function generateFields(state) {
    for(const village of state.humanSettlements?.villages || []) {
      if(Math.random()>=0.5) continue;
      const width=18;
      const starts=[village.bounds.x1+2,village.bounds.x0-width-1];
      if(Math.random()<0.5) starts.reverse();
      for(const start of starts) {
        let placed=false;
        for(let offset=0;offset<24;offset++) {
          const x=start+(start>village.bounds.x1?offset:-offset);
          if((state.humanSettlements.villages || []).some(v=>x<=v.bounds.x1 && x+width>v.bounds.x0)) continue;
          if(createField(state,x,state.surfaceAt[x],width)) { village.field={x,y:state.surfaceAt[x],width};placed=true;break; }
        }
        if(placed) break;
      }
    }
  }
  Game.farming={registerLeaves,invalidateSoil,SPECIES,isCrop,hasWater,onBlockChanged,tryPlant,stageAt,getDrop,update,createField,generateFields};
})();
