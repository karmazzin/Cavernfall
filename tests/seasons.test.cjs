const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function loadGame() {
  const storage = new Map();
  const context = vm.createContext({ window: {}, document: { getElementById: () => null }, console,
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) } });
  for (const [, file] of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/src="\.\/(src\/[^" ]+\.js)"/g)) {
    if (file === 'src/app/menuUi.js') break;
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context.window.MC2D;
}
test('new woods are placeable, harvestable and craft ordinary planks', () => {
  const G = loadGame(), B = G.blocks.BLOCK;
  for (const name of ['MAPLE_WOOD','ROWAN_WOOD','ASPEN_WOOD','BIRCH_WOOD','CHERRY_WOOD']) {
    assert.equal(typeof B[name], 'number', name);
    assert.ok(G.blocks.PLACEABLE.has(B[name]));
    assert.ok(Number.isFinite(G.tools.getBreakTime(B[name], null)));
    assert.equal(G.world.blockSolid(B[name]), false);
    assert.ok(G.craftingRecipes.RECIPES.some(r => r.pattern.length === 1 && r.pattern[0][0] === B[name] && r.result.id === B.PLANK));
  }
});
test('mushrooms and litter have no opaque tile background and do not block walking', () => {
  const G = loadGame(), B = G.blocks.BLOCK, tile = G.constants.TILE;
  for (const id of [B.SMALL_WHITE_MUSHROOM,B.SMALL_FLY_AGARIC,B.SMALL_GLOW_MUSHROOM,B.CHANTERELLE,B.LEAF_LITTER,B.PINK_FLOWERS]) {
    assert.equal(typeof id, 'number');
    const rects = [];
    const ctx = new Proxy({}, { get: (o,k) => k === 'fillRect' ? (...a) => rects.push(a) : () => {} });
    G.worldRenderer.drawBlock(ctx,id,0,0);
    assert.ok(!rects.some(([x,y,w,h]) => x === 0 && y === 0 && w === tile && h === tile));
    assert.equal(G.world.blockSolid(id),false);
  }
});
function seasonFixture(G) {
  const s = G.state.createGameState({ id:'season-test', worldType:'seasons' }), B = G.blocks.BLOCK;
  for(let x=0;x<G.constants.WORLD_W;x++) { s.surfaceAt[x]=30; s.world[30][x]=B.GRASS; }
  G.seasons.plantTree(s,20,30,'maple',false);
  G.seasons.initialize(s);
  return s;
}
test('five-day seasons preserve terrain and tree trunks across repeated years', () => {
  const G = loadGame(); assert.ok(G.seasons, 'season system exists');
  const s = seasonFixture(G), B = G.blocks.BLOCK;
  const trunks = s.world.map(row => row.map((id,x) => id===B.MAPLE_WOOD ? x : -1).filter(x=>x>=0));
  const original = JSON.stringify(s.world);
  s.cycleTime = G.constants.CYCLE*5-0.01; G.seasons.update(s); assert.equal(s.seasons.index,0);
  for(let step=1;step<=8;step++) {
    s.cycleTime = G.constants.CYCLE*5*step; G.seasons.update(s);
    assert.equal(s.seasons.index,step%4);
    assert.equal(s.world[30][0], [B.GRASS,B.AUTUMN_GRASS,B.SNOW,B.GRASS][step%4]);
    trunks.forEach((xs,y)=>xs.forEach(x=>assert.equal(s.world[y][x],B.MAPLE_WOOD)));
    if(step%4===2) assert.ok(!s.world.flat().includes(B.MAPLE_LEAF));
    if(step%4===0) assert.equal(JSON.stringify(s.world),original);
  }
});
test('winter building, digging and felling permanently override seasonal cells', () => {
  const G = loadGame(); assert.ok(G.seasons);
  const s = seasonFixture(G), B = G.blocks.BLOCK;
  const leaf = Object.entries(s.seasons.cells).find(([,c])=>c.tree);
  assert.ok(leaf);
  s.cycleTime=10*G.constants.CYCLE; G.seasons.update(s);
  const [x,y]=leaf[0].split(',').map(Number);
  G.world.setBlock(s,x,y,B.PLANK);
  G.world.setBlock(s,20,29,B.AIR);
  G.world.setBlock(s,0,30,B.AIR);
  for(const day of [15,20,25,30,35]) { s.cycleTime=day*G.constants.CYCLE; G.seasons.update(s); }
  assert.equal(s.world[y][x],B.PLANK);
  assert.equal(s.world[29][20],B.AIR);
  assert.equal(s.world[30][0],B.AIR);
  assert.ok(!s.world.flat().includes(B.MAPLE_LEAF));
  assert.equal(G.saveSystem.saveWorld(s),true);
  const loaded=G.saveSystem.loadWorld('season-test'); assert.ok(loaded);
  assert.equal(JSON.stringify(loaded.seasons),JSON.stringify(s.seasons));
});
test('weather pools enforce rain-free spring and wetter autumn', () => {
  const G=loadGame(); assert.equal(typeof G.weatherSystem.weatherPool,'function');
  const s=G.state.createGameState();
  const pool=b=>G.weatherSystem.weatherPool(s,{biome:b,climate:'temperate',inCave:false});
  assert.ok(!pool('cherry_forest').some(e=>e.type==='rain'));
  assert.ok(pool('autumn_forest').find(e=>e.type==='rain').weight > pool('forest').find(e=>e.type==='rain').weight);
});

for (const biome of ['autumn_forest','cherry_forest']) {
  test(`${biome} generates selectable woodland with the intended flora`, () => {
    const G=loadGame(), B=G.blocks.BLOCK;
    assert.ok(G.world.getSelectableSingleBiomes().includes(biome));
    const s=G.state.createGameState({worldType:'single_biome',singleBiome:biome});
    G.random.withSeed('woodland-check',()=>G.generation.generateWorld(s));
    const all=s.world.flat();
    if(biome==='autumn_forest') {
      for(const id of [B.MAPLE_WOOD,B.ROWAN_WOOD,B.ASPEN_WOOD,B.BIRCH_WOOD,B.AUTUMN_GRASS,B.LEAF_LITTER,B.CHANTERELLE]) assert.ok(all.includes(id),`block ${id}`);
      assert.ok(all.filter(id=>id===B.BIRCH_WOOD).length<all.filter(id=>id===B.MAPLE_WOOD).length);
    } else {
      for(const id of [B.CHERRY_WOOD,B.CHERRY_LEAF,B.PINK_FLOWERS]) assert.ok(all.includes(id));
      assert.ok(!all.includes(B.AUTUMN_GRASS));
    }
  });
}
test('season world generation is reproducible and saves fixed mushroom/cover positions', () => {
  const G=loadGame();
  function generate() {
    const s=G.state.createGameState({id:'generated-seasons',worldType:'seasons'});
    G.random.withSeed('season-check',()=>G.generation.generateWorld(s));
    return s;
  }
  const s=generate(), other=generate();
  assert.ok(s.seasons);
  assert.equal(JSON.stringify(s.world),JSON.stringify(other.world));
  assert.equal(JSON.stringify(s.seasons),JSON.stringify(other.seasons));
  const cover=Object.entries(s.seasons.cells).find(([,c])=>c.cover && [G.blocks.BLOCK.SMALL_WHITE_MUSHROOM,G.blocks.BLOCK.SMALL_FLY_AGARIC,G.blocks.BLOCK.CHANTERELLE].includes(c.values[1]));
  assert.ok(cover);
  const [x,y]=cover[0].split(',').map(Number);
  s.cycleTime=5*G.constants.CYCLE; G.seasons.update(s);
  G.world.setBlock(s,x,y,G.blocks.BLOCK.AIR);
  assert.equal(s.world[y][x],G.blocks.BLOCK.AIR);
  assert.equal(G.saveSystem.saveWorld(s),true);
  const loaded=G.saveSystem.loadWorld(s.worldMeta.id);
  assert.ok(loaded.seasons);
  loaded.cycleTime=15*G.constants.CYCLE; G.seasons.update(loaded);
  assert.equal(loaded.world[y][x],G.blocks.BLOCK.AIR);
  assert.equal(JSON.stringify(s.seasons.cells),JSON.stringify(loaded.seasons.cells));
});
test('season changes leave other dimensions untouched and catch up on return', () => {
  const G=loadGame(),s=seasonFixture(G), B=G.blocks.BLOCK;
  G.state.ensureDimensions(s);
  const other=G.state.createGameState();
  s.dimensions.fire=G.state.captureDimensionState(other);
  assert.equal(G.state.switchDimension(s,'fire'),true);
  const before=JSON.stringify(s.world);
  s.cycleTime=10*G.constants.CYCLE; G.seasons.update(s);
  assert.equal(JSON.stringify(s.world),before);
  assert.equal(G.saveSystem.saveWorld(s),true);
  const loaded=G.saveSystem.loadWorld(s.worldMeta.id);
  assert.equal(G.state.switchDimension(loaded,'overworld'),true);
  G.seasons.update(loaded);
  assert.equal(loaded.seasons.index,2);
  assert.equal(loaded.world[30][0],B.SNOW);
});

test('new forest ground covers allow ordinary animal spawning', () => {
  const G=loadGame();
  for(const biome of ['autumn_forest','cherry_forest']) {
    const s=G.state.createGameState({worldType:'single_biome',singleBiome:biome});
    G.random.withSeed('woodland-check',()=>{ G.generation.generateWorld(s); G.animalsEntity.spawnAnimals(s); });
    assert.ok(s.animals.length>0,`${biome} must have animals`);
    for(const animal of s.animals) {
      const x=Math.floor(animal.x/G.constants.TILE), y=Math.floor(animal.y/G.constants.TILE);
      assert.equal(G.world.blockSolid(s.world[y][x]),false);
    }
  }
});


test('seasonal mushrooms appear only in autumn at predetermined locations', () => {
  const G=loadGame(), s=seasonFixture(G), B=G.blocks.BLOCK;
  const mushrooms=new Set([B.SMALL_WHITE_MUSHROOM,B.SMALL_FLY_AGARIC,B.CHANTERELLE]);
  const positions=()=>s.world.flatMap((row,y)=>row.flatMap((id,x)=>mushrooms.has(id)?[`${x},${y}`]:[]));
  assert.equal(positions().length,0,'no summer mushrooms');
  s.cycleTime=5*G.constants.CYCLE; G.seasons.update(s);
  const original=positions(); assert.ok(original.length>0);
  const [x,y]=original[0].split(',').map(Number);
  G.world.setBlock(s,x,y,B.AIR);
  for(const day of [10,15,20]) {
    s.cycleTime=day*G.constants.CYCLE; G.seasons.update(s);
    assert.equal(positions().length,0,`no mushrooms on day ${day}`);
  }
  s.cycleTime=25*G.constants.CYCLE; G.seasons.update(s);
  assert.deepEqual(positions(),original.slice(1),'same autumn sites except the harvested mushroom');
});

test('loading a seasonal world never retrofits terrain over existing edits', () => {
  const G=loadGame(),s=G.state.createGameState({id:'season-reload',worldType:'seasons'});
  G.random.withSeed('season-reload',()=>G.generation.generateWorld(s));
  const before=JSON.stringify(s.world);
  G.random.withSeed('load-retrofit',()=>G.generation.retrofitWorldFeatures(s));
  assert.ok(JSON.stringify(s.world)===before,'load-time compatibility code must not regenerate seasonal terrain');
});
