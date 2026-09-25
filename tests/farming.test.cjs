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
function fixture(G) {
  const s = G.state.createGameState({id:'farm-test'});
  for(let x=0;x<G.constants.WORLD_W;x++) { s.surfaceAt[x]=50; s.world[50][x]=G.blocks.BLOCK.GRASS; }
  s.player.x=20*G.constants.TILE; s.player.y=48*G.constants.TILE;
  return s;
}
function select(G,s,id,count=4) { s.player.hotbar[0]=G.inventory.createItemStack(id,count); s.player.selectedSlot=0; }
test('one carrot or wheat crafts four matching seeds',()=>{
  const G=loadGame(), I=G.items.ITEM;
  for(const name of ['WHEAT','CARROT']) {
    assert.ok(I[name+'_SEEDS']);
    assert.ok(G.craftingRecipes.RECIPES.some(r=>r.pattern.length===1 && r.pattern[0].length===1 && r.pattern[0][0]===I[name] && r.result.id===I[name+'_SEEDS'] && r.result.count===4));
  }
});
test('crops mature only after all four stages; nearby water doubles progress',()=>{
  const G=loadGame(), s=fixture(G), B=G.blocks.BLOCK, I=G.items.ITEM;
  assert.ok(G.farming);
  select(G,s,I.WHEAT_SEEDS); assert.equal(G.farming.tryPlant(s,20,50),true);
  assert.equal(s.player.hotbar[0].count,3); assert.equal(s.world[50][20],B.WHEAT_FARMLAND);
  G.farming.update(s,90); assert.equal(G.farming.stageAt(s,20,50),3);
  assert.equal(G.farming.getDrop(s,20,50).id,B.DIRT);
  G.farming.update(s,30); assert.equal(G.farming.getDrop(s,20,50).id,I.WHEAT);
  select(G,s,I.CARROT_SEEDS); G.farming.tryPlant(s,30,50); G.world.setBlock(s,34,50,B.WATER);
  G.farming.update(s,59); assert.equal(G.farming.getDrop(s,30,50).id,B.DIRT);
  G.farming.update(s,1); assert.equal(G.farming.getDrop(s,30,50).id,I.CARROT);
});
test('soil becomes grass under air; any covering block including saplings kills grass after five seconds',()=>{
  const G=loadGame(),s=fixture(G),B=G.blocks.BLOCK; assert.ok(G.farming);
  G.world.setBlock(s,20,49,B.OAK_SAPLING);
  G.farming.update(s,4.9); assert.equal(s.world[50][20],B.GRASS);
  G.farming.update(s,0.1); assert.equal(s.world[50][20],B.DIRT);
  G.world.setBlock(s,20,49,B.AIR); assert.equal(s.world[50][20],B.GRASS);
  G.world.setBlock(s,25,80,B.DIRT); assert.equal(s.world[80][25],B.GRASS);
  assert.equal(G.farming.getDrop(s,25,80).id,B.DIRT);
});
test('all ordinary saplings keep one occupied cell until becoming matching trees',()=>{
  const G=loadGame(),B=G.blocks.BLOCK; assert.ok(G.farming);
  for(const name of ['OAK','SPRUCE','SEQUOIA','MAPLE','ROWAN','ASPEN','BIRCH','CHERRY']) {
    const s=fixture(G); select(G,s,B[name+'_SAPLING']);
    assert.equal(G.farming.tryPlant(s,20,49),true,name);
    G.farming.update(s,90);
    assert.equal(G.farming.stageAt(s,20,49),3); assert.equal(s.world[48][20],B.AIR);
    assert.equal(G.farming.getDrop(s,20,49).id,B[name+'_SAPLING']);
    G.farming.update(s,30);
    assert.equal(s.world[49][20],name==='OAK'?B.WOOD:B[name+'_WOOD']);
  }
});
test('blocked tree waits without destroying buildings and progress survives save/load',()=>{
  const G=loadGame(),s=fixture(G),B=G.blocks.BLOCK; assert.ok(G.farming);
  select(G,s,B.CHERRY_SAPLING); G.farming.tryPlant(s,20,49);
  G.world.setBlock(s,20,47,B.PLANK); G.farming.update(s,120);
  assert.equal(s.world[49][20],B.CHERRY_SAPLING); assert.equal(s.world[47][20],B.PLANK);
  assert.equal(G.saveSystem.saveWorld(s),true);
  const loaded=G.saveSystem.loadWorld('farm-test'); assert.ok(loaded);
  assert.equal(G.farming.stageAt(loaded,20,49),3);
  G.world.setBlock(loaded,20,47,B.AIR); G.farming.update(loaded,1);
  assert.equal(loaded.world[49][20],B.CHERRY_WOOD);
});
test('feeding two sheep consumes wheat, produces one child and enforces cooldown',()=>{
  const G=loadGame(),s=fixture(G); assert.equal(typeof G.animalsEntity.feedSheep,'function');
  const a=G.animalsEntity.createSheep(20,49),b=G.animalsEntity.createSheep(20,49); s.animals=[a,b];
  select(G,s,G.items.ITEM.WHEAT);
  assert.equal(G.animalsEntity.feedSheep(s,a),true); assert.equal(G.animalsEntity.feedSheep(s,b),true);
  assert.equal(s.player.hotbar[0].count,2);
  G.animalsEntity.updateAnimals(s,0.01); assert.equal(s.animals.length,3);
  assert.equal(G.animalsEntity.feedSheep(s,a),false);
  G.animalsEntity.updateAnimals(s,0.01); assert.equal(s.animals.length,3);
});
test('shepherd sells exactly four live sheep for ten coins, only when placement succeeds',()=>{
  const G=loadGame(),s=fixture(G),I=G.items.ITEM;
  const trader={kind:'human',human:{profession:'shepherd'}};
  const offer=G.tradeSystem.getTraderOffers(trader).find(o=>o.id==='h_sheep'); assert.ok(offer);
  select(G,s,I.COIN,10); assert.equal(G.tradeSystem.performTrade(s,trader,'h_sheep'),true);
  assert.equal(s.animals.length,4); assert.equal(G.inventory.countItem(s,I.COIN),0);
});
test('generated fields have crops and water within irrigation radius',()=>{
  const G=loadGame(),s=fixture(G); assert.ok(G.farming);
  assert.equal(G.farming.createField(s,40,50,18),true);
  let crops=0;
  for(let x=40;x<58;x++) { assert.equal(s.biomeAt[x],'field'); if(G.farming.isCrop(s.world[50][x])) { crops++; assert.equal(G.farming.hasWater(s,x,50),true); } }
  assert.ok(crops>10);
});
test('sapling artwork has four sizes, with a two-tile final preview and no opaque background',()=>{
  const G=loadGame(),B=G.blocks.BLOCK,T=G.constants.TILE;
  const heights=[];
  for(const elapsed of [0,30,60,90]) {
    const rects=[];
    const ctx=new Proxy({}, {get:(o,k)=>k==='fillRect'?(...args)=>rects.push(args):()=>{}});
    G.worldRenderer.drawBlock(ctx,B.CHERRY_SAPLING,0,0,0,elapsed);
    heights.push(T-Math.min(...rects.map(r=>r[1])));
    assert.ok(!rects.some(([x,y,w,h])=>x===0 && y===0 && w===T && h===T));
  }
  assert.ok(heights[0]<heights[1] && heights[1]<heights[2]); assert.equal(heights[3],2*T);
});
test('leaf drops preserve species and use a twenty percent threshold',()=>{
  const G=loadGame(),s=fixture(G),B=G.blocks.BLOCK;
  for(const spec of G.farming.SPECIES) {
    G.world.setBlock(s,20,40,spec.leaf);
    assert.equal(G.farming.getDrop(s,20,40,0.199).id,spec.id);
    assert.equal(G.farming.getDrop(s,20,40,0.2),null);
  }
  G.world.setBlock(s,20,42,B.CHERRY_WOOD); G.world.setBlock(s,20,40,B.AUTUMN_LEAF);
  assert.equal(G.farming.getDrop(s,20,40,0.1).id,B.CHERRY_SAPLING);
});
test('wheat attracts sheep, removing wheat releases them, and unsafe purchases do not charge',()=>{
  const G=loadGame(),s=fixture(G),I=G.items.ITEM,T=G.constants.TILE;
  const a=G.animalsEntity.createSheep(16,49);s.animals=[a];
  select(G,s,I.WHEAT);G.animalsEntity.updateAnimals(s,0.01);assert.ok(a.targetVx>0);
  select(G,s,I.CARROT);a.state='idle';a.stateTimer=3;G.animalsEntity.updateAnimals(s,0.01);assert.equal(a.targetVx,0);
  const blocked=G.state.createGameState();blocked.player.y=40*T;
  select(G,blocked,I.COIN,10);
  assert.equal(G.tradeSystem.performTrade(blocked,{kind:'human',human:{profession:'shepherd'}},'h_sheep'),false);
  assert.equal(G.inventory.countItem(blocked,I.COIN),10);assert.equal(blocked.animals.length,0);
});
test('village fields actually generate on natural uneven terrain',()=>{
  const G=loadGame();let villages=0,fields=0;
  for(let i=0;i<6;i++) {
    const s=G.state.createGameState({seed:'farm'+i});G.random.withSeed('farm'+i,()=>G.generation.generateWorld(s));
    villages+=s.humanSettlements.villages.length;fields+=s.humanSettlements.villages.filter(v=>v.field).length;
  }
  assert.ok(fields>0,`${fields} fields in ${villages} villages`);assert.equal(fields,villages);
});
test('season changes retain the field biome and autumn leaves remember their species after trunk removal',()=>{
  const G=loadGame(),s=fixture(G),B=G.blocks.BLOCK;
  s.worldMeta.worldType='seasons';G.farming.createField(s,40,50,18);G.seasons.initialize(s);
  s.cycleTime=5*G.constants.CYCLE;G.seasons.update(s);assert.equal(s.biomeAt[45],'field');
  const other=fixture(G);G.seasons.plantTree(other,20,50,'birch',true);
  const coords=[];for(let y=0;y<50;y++)for(let x=15;x<=25;x++) {if(other.world[y][x]===B.AUTUMN_LEAF)coords.push([x,y]);if(other.world[y][x]===B.BIRCH_WOOD)G.world.setBlock(other,x,y,B.AIR);}
  assert.ok(coords.length);for(const [x,y] of coords)assert.equal(G.farming.getDrop(other,x,y,0.1)?.id,B.BIRCH_SAPLING);
});
test('soil tracking survives winter and spring ground-cover changes',()=>{
  const G=loadGame(),s=fixture(G),B=G.blocks.BLOCK;s.worldMeta.worldType='seasons';G.seasons.initialize(s);
  G.farming.update(s,0);
  s.cycleTime=10*G.constants.CYCLE;G.seasons.update(s);G.farming.update(s,5);
  s.cycleTime=15*G.constants.CYCLE;G.seasons.update(s);G.farming.update(s,5);
  const covered=Object.entries(s.seasons.cells).find(([,v])=>v.cover && v.values[3]===B.PINK_FLOWERS);
  assert.ok(covered);const [x,y]=covered[0].split(',').map(Number);assert.equal(s.world[y+1][x],B.GRASS);
  G.world.setBlock(s,x,y,B.PLANK);G.farming.update(s,5);assert.equal(s.world[y+1][x],B.DIRT);
});
test('clicking each visible shepherd offer buys that offer, including live sheep',()=>{
  const G=loadGame(),canvas={width:1280,height:800};
  for(let index=0;index<4;index++) {
    const s=fixture(G),I=G.items.ITEM;
    s.humanSettlements.villages=[{id:'village-test',alertLevel:0}];
    s.humans=[{id:'shepherd-test',villageId:'village-test',profession:'shepherd',role:'villager',hp:4,x:s.player.x,y:s.player.y,w:12,h:22}];
    select(G,s,I.COIN,20);G.crafting.openHumanTrade(s,'shepherd-test');
    const layout=G.crafting.getCraftingLayout(canvas,s);
    G.crafting.handleCraftingPointer(s,{mouse:{x:layout.trade.panel.x+30,y:layout.trade.panel.y+46+index*40+17,button:0,justPressed:true}},canvas);
    if(index===0) assert.equal(s.animals.length,4);
    else assert.equal(G.inventory.countItem(s,G.tradeSystem.HUMAN_OFFERS.shepherd[index].rewardId),G.tradeSystem.HUMAN_OFFERS.shepherd[index].rewardCount);
  }
});
test('planting and harvesting work through real mouse actions',()=>{
  const G=loadGame(),s=fixture(G),B=G.blocks.BLOCK,I=G.items.ITEM,T=G.constants.TILE,Z=G.constants.VIEW_ZOOM;
  const camera={x:0,y:0};
  function click(x,y,dt=0.1) { G.interaction.handleMouse(s,{mouse:{x:(x*T+T/2)*Z,y:(y*T+T/2)*Z,down:true,justPressed:true,button:0}},camera,dt); }
  select(G,s,I.CARROT_SEEDS,2);click(20,50);assert.equal(s.world[50][20],B.CARROT_FARMLAND);
  G.farming.update(s,120);select(G,s,null,0);click(20,50,2);
  assert.equal(s.world[50][20],B.AIR);assert.equal(G.inventory.countItem(s,I.CARROT),1);
});
test('dimension bundles keep growth independent and old worlds initialize without farming data',()=>{
  const G=loadGame(),s=fixture(G),I=G.items.ITEM;
  select(G,s,I.WHEAT_SEEDS);G.farming.tryPlant(s,20,50);G.farming.update(s,45);
  const original=G.state.captureDimensionState(s), other=G.state.captureDimensionState(fixture(G));
  delete other.farming;G.state.applyDimensionState(s,other);G.farming.update(s,30);
  assert.equal(G.farming.stageAt(s,20,50),0);
  G.state.applyDimensionState(s,original);assert.equal(G.farming.stageAt(s,20,50),1);
});

test('cherry flowers and leaves preserve grass and reset the covering timer',()=>{
  const G=loadGame(),B=G.blocks.BLOCK;
  for(const cover of [B.PINK_FLOWERS,B.CHERRY_LEAF]) {
    const s=fixture(G);
    G.world.setBlock(s,20,49,B.PLANK);G.farming.update(s,4);
    G.world.setBlock(s,20,49,cover);G.farming.update(s,10);
    assert.equal(s.world[50][20],B.GRASS);
    assert.equal(s.farming.covered['20,50'],undefined);
    G.world.setBlock(s,20,49,B.PLANK);G.farming.update(s,4.9);
    assert.equal(s.world[50][20],B.GRASS);
    G.farming.update(s,0.1);assert.equal(s.world[50][20],B.DIRT);
  }
});

test('snow within four blocks gives 1.5x growth; water takes priority without stacking',()=>{
  const G=loadGame(), B=G.blocks.BLOCK;
  for(const [dx,dy,water,want] of [[4,0,false,15],[0,-4,false,15],[4,1,false,10],[5,0,false,10],[4,0,true,20]]) {
    const s=fixture(G);
    G.world.setBlock(s,20,50,B.WHEAT_FARMLAND);
    G.world.setBlock(s,20+dx,50+dy,B.SNOW);
    if(water) G.world.setBlock(s,19,50,B.WATER);
    G.farming.update(s,10);
    assert.equal(s.farming.plants['20,50'].elapsed,want);
  }
});

test('every village receives a field with climate-appropriate channels',()=>{
  const G=loadGame(),B=G.blocks.BLOCK;
  const s=fixture(G);
  s.humanSettlements={villages:['plains_village','mountain_village','winter_village','desert_village'].map((type,i)=>({type,bounds:{x0:60+i*100,x1:90+i*100}}))};
  G.random.withSeed('all-fields',()=>G.farming.generateFields(s));
  for(const [i,v] of s.humanSettlements.villages.entries()) {
    assert.ok(v.field,`${v.type} needs a field`);
    const {x,y,width}=v.field;
    assert.equal(s.world[y][x+3],[B.WATER,B.WATER,B.SNOW,B.AIR][i]);
    for(let xx=x;xx<x+width;xx++) assert.equal(s.biomeAt[xx],'field');
  }
});

test('single field biome grows crops across the world and generates plains villages and scarecrows',()=>{
  const G=loadGame(),B=G.blocks.BLOCK;
  assert.ok(G.world.getSelectableSingleBiomes().includes('field'));
  const s=G.state.createGameState({id:'field-save',worldType:'single_biome',singleBiome:'field'});
  G.random.withSeed('field-world',()=>G.generation.generateWorld(s));
  assert.ok(s.biomeAt.every(b=>b==='field'));
  assert.ok(s.humanSettlements.villages.length>0);
  assert.ok(s.humanSettlements.villages.every(v=>v.type==='plains_village' && v.field));
  assert.ok(s.world.flat().filter(id=>G.farming.isCrop(id)).length>G.constants.WORLD_W/2);
  const heads=[];
  s.world.forEach((row,y)=>row.forEach((id,x)=>{if(id===B.SCARECROW_HEAD) heads.push({x,y});}));
  assert.ok(heads.length>0);
  for(const {x,y} of heads) {
    assert.equal(s.world[y+1][x],B.WOOD);
    assert.equal(s.world[y+1][x-1],B.PLANK);
    assert.equal(s.world[y+1][x+1],B.PLANK);
    assert.equal(s.world[y+2][x],B.PILLAR);
  }
  assert.equal(G.saveSystem.saveWorld(s),true);
  const loaded=G.saveSystem.loadWorld('field-save');
  assert.equal(JSON.stringify(loaded.world),JSON.stringify(s.world));
});


test('each village keeps a field on mixed terrain, including moss and dark stone',()=>{
  const G=loadGame();
  for(const seed of [7,21,27,63,66,68,71,78,86,95,107,199]) {
    const s=G.state.createGameState({worldType:'normal'});
    G.random.withSeed('field-check-'+seed,()=>G.generation.generateWorld(s));
    assert.ok(s.humanSettlements.villages.length>0);
    for(const village of s.humanSettlements.villages) {
      assert.ok(village.field,`${seed}: ${village.type}`);
      const {x,y,width}=village.field, B=G.blocks.BLOCK;
      const channel=village.type==='winter_village' ? B.SNOW : village.type==='desert_village' ? B.AIR : B.WATER;
      for(let xx=x;xx<x+width;xx++) {
        assert.equal(s.biomeAt[xx],'field');
        if((xx-x)%7===3) assert.equal(s.world[y][xx],channel);
      }
    }
  }
});

test('all field grass becomes random farmland, including placed and regrown grass',()=>{
  const G=loadGame(),s=fixture(G),B=G.blocks.BLOCK;
  for(let x=20;x<40;x++) s.biomeAt[x]='field';
  G.random.withSeed('field-conversion',()=>G.farming.update(s,0));
  const crops=new Set();
  for(let x=20;x<40;x++) {assert.ok(G.farming.isCrop(s.world[50][x]));crops.add(s.world[50][x]);}
  assert.equal(crops.size,2);
  assert.equal(s.world[50][40],B.GRASS,'other biomes keep their grass');
  G.world.setBlock(s,20,50,B.DIRT);
  assert.ok(G.farming.isCrop(s.world[50][20]),'regrown grass becomes farmland');
  G.world.setBlock(s,21,50,B.GRASS);
  assert.ok(G.farming.isCrop(s.world[50][21]),'placed grass becomes farmland immediately');
  assert.equal(s.farming.plants['21,50'].elapsed,0);
  G.world.setBlock(s,22,50,B.AUTUMN_GRASS);
  assert.ok(G.farming.isCrop(s.world[50][22]));
});

test('generated field worlds have no grass left in the field biome',()=>{
  const G=loadGame(),s=G.state.createGameState({worldType:'single_biome',singleBiome:'field'}),B=G.blocks.BLOCK;
  G.random.withSeed('field-no-grass',()=>G.generation.generateWorld(s));
  assert.ok(!s.world.flat().some(id=>id===B.GRASS || id===B.AUTUMN_GRASS));
});

test('field village bounds turn existing and new crops into paths without affecting the outside field',()=>{
  const G=loadGame(),s=fixture(G),B=G.blocks.BLOCK;
  s.biomeAt.fill('field');
  s.humanSettlements={villages:[{bounds:{x0:20,x1:30,y0:40,y1:53}}]};
  // Existing crops from a saved world, including one below the village footprint.
  s.world[50][20]=B.WHEAT_FARMLAND;
  s.world[50][30]=B.CARROT_FARMLAND;
  s.world[54][25]=B.CARROT_FARMLAND;
  G.farming.update(s,0);
  assert.equal(s.world[50][20],B.PATH);
  assert.equal(s.world[50][30],B.PATH);
  assert.ok(G.farming.isCrop(s.world[50][19]));
  assert.ok(G.farming.isCrop(s.world[50][31]));
  assert.equal(s.world[54][25],B.CARROT_FARMLAND);
  G.world.setBlock(s,25,50,B.WHEAT_FARMLAND);
  assert.equal(s.world[50][25],B.PATH);
  assert.equal(s.farming.plants['25,50'],undefined);
  G.world.setBlock(s,26,50,B.GRASS);
  assert.equal(s.world[50][26],B.PATH);
  s.biomeAt[27]='plains';
  G.world.setBlock(s,27,50,B.CARROT_FARMLAND);
  assert.equal(s.world[50][27],B.CARROT_FARMLAND);
});

test('single field world villages have paths instead of crops within their structure bounds',()=>{
  const G=loadGame(),s=G.state.createGameState({worldType:'single_biome',singleBiome:'field'});
  G.random.withSeed('field-village-paths',()=>G.generation.generateWorld(s));
  for(const v of s.humanSettlements.villages) {
    for(let y=v.bounds.y0;y<=v.bounds.y1;y++) for(let x=v.bounds.x0;x<=v.bounds.x1;x++) {
      assert.equal(G.farming.isCrop(s.world[y][x]),false,`${x},${y}`);
    }
    assert.ok(G.farming.isCrop(s.world[v.field.y][v.field.x]));
  }
});
