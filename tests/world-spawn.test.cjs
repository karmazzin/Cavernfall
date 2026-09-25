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
  return {G:context.window.MC2D,context};
}


function generate(G,meta,seed='center-spawn') {
  const s=G.state.createGameState(meta);
  G.random.withSeed(seed,()=>G.generation.generateWorld(s));
  return s;
}
const {G:catalog}=loadGame();
const modes=[{worldType:'normal'},{worldType:'flat'},{worldType:'seasons'},{worldType:'infinite_village',singleBiome:'snow_plains'},
  {worldType:'floating_islands'},{worldType:'cavern'},
  ...catalog.world.getSelectableSingleBiomes().map(singleBiome=>({worldType:'single_biome',singleBiome}))];
for(const meta of modes) test(`new player appears at exact horizontal centre with clear body: ${JSON.stringify(meta)}`,()=>{
  const {G}=loadGame(),s=generate(G,meta),C=G.constants,p=s.player;
  assert.equal(p.x+p.w/2,C.WORLD_W*C.TILE/2);
  assert.ok(p.y>=0 && p.y+p.h<C.WORLD_H*C.TILE);
  for(let y=Math.floor(p.y/C.TILE);y<=Math.floor((p.y+p.h-0.01)/C.TILE);y++) {
    for(let x=Math.floor(p.x/C.TILE);x<=Math.floor((p.x+p.w-0.01)/C.TILE);x++) {
      const block=G.world.getBlock(s,x,y);
      assert.equal(G.world.isSolidAtPixel(s,x*C.TILE+1,y*C.TILE+1,p),false,`body collision ${x},${y}`);
      assert.notEqual(block,G.blocks.BLOCK.LAVA);
    }
  }
});

test('normal world wells take priority over villages and their reserved fields',()=>{
  const {G}=loadGame();let wells=0;
  for(let i=0;i<30;i++) {
    const s=generate(G,{worldType:'normal'},'well-priority-'+i);
    if(!s.waterWell) continue;
    wells++;
    const w=s.waterWell.bounds;
    for(const v of s.humanSettlements.villages) {
      assert.ok(v.bounds.x1<w.x0-1 || v.bounds.x0>w.x1+1,`overlap seed ${i}`);
      if(v.field) assert.ok(v.field.x+v.field.width<w.x0-1 || v.field.x>w.x1+1,`field overlap ${i}`);
    }
  }
  assert.ok(wells>0);
});

test('infinite village never contains the water well, including on reload',()=>{
  const {G}=loadGame(),s=generate(G,{id:'no-well',worldType:'infinite_village',singleBiome:'snow_plains'});
  assert.equal(s.waterWell,null);
  assert.ok(!s.world.flat().includes(G.blocks.BLOCK.WATER_WELL_FRAME));
  G.saveSystem.saveWorld(s);
  const loaded=G.saveSystem.loadWorld('no-well');G.generation.retrofitWorldFeatures(loaded);
  assert.equal(loaded.waterWell,null);
});

test('centred surface-world spawning does not drop the player into a cave below the terrain',()=>{
  const {G}=loadGame(),C=G.constants;
  for(const seed of [1,7,19,32]) {
    const s=generate(G,{worldType:'normal'},'spawn-audit-'+seed);
    const surface=Math.min(s.surfaceAt[C.WORLD_W/2-1],s.surfaceAt[C.WORLD_W/2]);
    assert.ok((s.player.y+s.player.h)/C.TILE<=surface+1,`underground start seed ${seed}`);
  }
});

test('centred spawn uses uneven natural ground and passable tree layers without stamping a stone platform',()=>{
 const {G}=loadGame(),B=G.blocks.BLOCK,C=G.constants;
 const initialize=G.layers.initialize;let before;
 G.layers.initialize=s=>{
  initialize(s);
  for(let x=C.WORLD_W/2-2;x<=C.WORLD_W/2+1;x++){
   const ground=x<C.WORLD_W/2?30:31;s.surfaceAt[x]=ground;
   for(let y=3;y<C.WORLD_H-1;y++){
    s.world[y][x]=y<ground?B.AIR:y===ground?B.GRASS:B.DIRT;
    delete s.blockLayers[`${x},${y}`];
   }
  }
  s.world[29][C.WORLD_W/2-1]=B.WOOD;s.blockLayers[`${C.WORLD_W/2-1},29`]=3;
  before=s.world.map(row=>row.slice(C.WORLD_W/2-2,C.WORLD_W/2+2));
 };
 const s=generate(G,{worldType:'normal'},'no-stone-platform');
 assert.equal((s.player.y+s.player.h)/C.TILE,30);
 assert.equal(JSON.stringify(s.world.map(row=>row.slice(C.WORLD_W/2-2,C.WORLD_W/2+2))),JSON.stringify(before));
});
