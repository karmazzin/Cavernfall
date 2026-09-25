const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function game(limit=Infinity){
 const storage=new Map();
 const c=vm.createContext({window:{},document:{getElementById:()=>null},console,localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){let size=v.length;for(const [key,value]of storage)if(key!==k)size+=value.length;if(size>limit)throw Object.assign(new Error('Quota exceeded'),{name:'QuotaExceededError'});storage.set(k,v);},removeItem:k=>storage.delete(k)}});
 for(const [,f]of fs.readFileSync('index.html','utf8').matchAll(/src="\.\/(src\/[^" ]+\.js)"/g)){if(f==='src/app/menuUi.js')break;vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});}
 return {G:c.window.MC2D,storage,context:c};
}
test('three generated worlds save and reload within a constrained storage quota',()=>{
 const {G}=game(900000);
 for(const worldType of ['normal','seasons','infinite_village']){
  const s=G.state.createGameState({id:worldType,worldType});G.random.withSeed('size',()=>G.generation.generateWorld(s));
  s.player.x=123;assert.equal(G.saveSystem.saveWorld(s),true,worldType);assert.equal(G.saveSystem.loadWorld(worldType).player.x,123);
 }
 assert.equal(G.saveSystem.listWorlds().length,3);
});
test('layers share a foreground cell but preserve independent unbreakable background',()=>{
 const {G}=game(),s=G.state.createGameState({id:'layers'}),B=G.blocks.BLOCK;
 s.surfaceAt[10]=2;G.layers.initialize(s);
 assert.equal(G.layers.place(s,10,10,B.WOOD,2),true);
 assert.equal(G.layers.place(s,10,10,B.DIRT,3),false);
 assert.equal(G.world.isSolidAtPixel(s,161,161,s.player),false);
 assert.equal(G.world.blockSolid(B.WOOD),true);
 G.world.setBlock(s,10,10,B.AIR);
 assert.equal(G.backgroundRenderer.materialAt(s.backdrop,10,10),B.STONE);
 assert.equal(G.layers.place(s,10,10,B.WOOD,1),true);
 assert.equal(G.world.isSolidAtPixel(s,161,161,s.player),true);
 assert.equal(G.saveSystem.saveWorld(s),true);
 const loaded=G.saveSystem.loadWorld('layers');assert.equal(G.backgroundRenderer.materialAt(loaded.backdrop,10,10),B.STONE);
});
test('shift mapping matches mode, and only creative has third-layer placement',()=>{
 const {G}=game(),s=G.state.createGameState();
 for(const mode of ['survival','creative','infinite_inventory'])for(const key of ['','ShiftLeft','ShiftRight']){
  s.worldMeta.mode=mode;assert.equal(G.layers.selected(s,{keys:new Set([key])}),key?mode==='creative'&&key==='ShiftRight'?3:2:1);
 }
});
module.exports={game};

test('fourth layer is scenery with no grid, collisions, ground or spawn support',()=>{
 const {G}=game(),s=G.state.createGameState(),B=G.blocks.BLOCK;
 s._newLayerWorld=true; s.surfaceAt.fill(2);G.layers.initialize(s);
 assert.equal('background' in s,false,'no second world-sized grid');
 assert.equal(G.backgroundRenderer.materialAt(s.backdrop,10,10),B.STONE);
 for(const layer of [1,2,3]){
  const e={x:160,y:130,w:12,h:24,vx:0,vy:100,onGround:false,layer};
  assert.equal(G.world.isSolidAtPixel(s,161,161,e),false);
  assert.equal(G.layers.supportAt(s,161,160,e),false);
  G.physics.moveEntity(s,e,0.2);
  assert.ok(e.y>136,'entity falls through the top of the backdrop');
  assert.equal(e.onGround,false);
 }
});
test('new backdrop initialization examines columns, never a whole grid of cells',()=>{
 const {G}=game(),s=G.state.createGameState();
 s._newLayerWorld=true;s.worldMeta.landscape3d=true;
 let reads=0;
 s.world=s.world.map(row=>new Proxy(row,{get(target,key){if(/^\d+$/.test(String(key)))reads++;return target[key];}}));
 G.layers.initialize(s);
 assert.ok(reads<=G.constants.WORLD_W*6,`read ${reads} cells`);
 assert.equal(s.backdrop.columns.length,G.constants.WORLD_W);
 assert.ok(JSON.stringify(s.backdrop).length<40000);
});
test('legacy fourth-layer grid is discarded on load and is never saved again',()=>{
 const {G,storage}=game(),s=G.state.createGameState({id:'old-backdrop'});
 s.layersVersion=1;s.background=G.world.createGrid();s.background[10][10]=G.blocks.BLOCK.STONE;
 s.blockLayers['4,4']=2;s.world[4][4]=G.blocks.BLOCK.WOOD;
 storage.set('cavernfall-world-old-backdrop',JSON.stringify(s));
 const loaded=G.saveSystem.loadWorld('old-backdrop');
 assert.ok(loaded);assert.equal('background' in loaded,false);
 assert.equal(G.layers.at(loaded,4,4),2);
 assert.ok(loaded.backdrop);
 assert.equal(G.saveSystem.saveWorld(loaded),true);
 assert.equal(storage.get('cavernfall-world-old-backdrop').includes('"background"'),false);
});

test('backdrop pictures are built lazily and reused without per-frame tile drawing or filters',()=>{
 const {G,context}=game(),s=G.state.createGameState();
 let allocations=0,draws=0,filters=0;
 const makeContext=()=>new Proxy({drawImage(){draws++;}}, {
  get(target,key){return key in target?target[key]:()=>{};},
  set(target,key,value){if(key==='filter')filters++;target[key]=value;return true;}
 });
 context.document.createElement=()=>{allocations++;return {getContext:()=>makeContext()};};
 s._newLayerWorld=true;G.layers.initialize(s);
 assert.equal(allocations,0,'loading does not render the entire world');
 const ctx=makeContext(),cam={x:0,y:640};
 G.backgroundRenderer.draw(ctx,s.backdrop,cam,0,40,79,79);
 const built=allocations;assert.ok(built>0 && built<25);
 draws=0;
 G.backgroundRenderer.draw(ctx,s.backdrop,cam,0,40,79,79);
 assert.equal(allocations,built,'second frame reuses all pictures');
 assert.equal(draws,15,'one draw per visible picture, not per tile');
 assert.equal(filters,0);
});
test('surface landscape switch and biome-specific cave pictures survive dimension changes',()=>{
 const {G}=game(),B=G.blocks.BLOCK;
 const make=enabled=>{const s=G.state.createGameState({id:'backdrops',landscape3d:enabled});s._newLayerWorld=true;G.layers.initialize(s);return s;};
 const off=make(false),on=make(true);
 const x=20,y=on.backdrop.columns[x][0];
 assert.equal(G.backgroundRenderer.materialAt(off.backdrop,x,y),B.AIR);
 assert.equal(G.backgroundRenderer.materialAt(on.backdrop,x,y),B.GRASS);
 const original=on.backdrop;
 G.state.ensureDimensions(on);
 const desert=G.state.createGameState(on.worldMeta);desert._newLayerWorld=true;desert.biomeAt.fill('desert');G.layers.initialize(desert);
 on.dimensions.fire=G.state.captureDimensionState(desert);
 G.state.switchDimension(on,'fire');
 assert.equal(G.backgroundRenderer.materialAt(on.backdrop,20,on.backdrop.columns[20][0]),B.SAND);
 G.state.switchDimension(on,'overworld');assert.equal(on.backdrop,original);
});

test('cave backdrop starts directly below the surface with earth before stone, including old profiles',()=>{
 const {G}=game(),B=G.blocks.BLOCK,s=G.state.createGameState();
 s._newLayerWorld=true;G.layers.initialize(s);
 const x=12,y=s.surfaceAt[x];
 assert.equal(G.backgroundRenderer.materialAt(s.backdrop,x,y),B.AIR);
 assert.equal(G.backgroundRenderer.materialAt(s.backdrop,x,y+1),B.DIRT);
 assert.equal(G.backgroundRenderer.materialAt(s.backdrop,x,y+4),B.DIRT);
 assert.equal(G.backgroundRenderer.materialAt(s.backdrop,x,y+5),B.STONE);
 s.layersVersion=2;s.backdrop={columns:[],regions:[]};G.layers.initialize(s);
 assert.equal(G.backgroundRenderer.materialAt(s.backdrop,x,y+1),B.DIRT);
});

test('3D surface hills usually rise one or two tiles and never exceed four or expose stone above plains',()=>{
 const {G}=game(),s=G.state.createGameState({landscape3d:true}),B=G.blocks.BLOCK;
 s._newLayerWorld=true;s.surfaceAt.fill(30);
 // Structures/player-built stone must not turn grassy background hills into rocks.
 for(let x=0;x<G.constants.WORLD_W;x++){s.world[30][x]=B.STONE;s.world[31][x]=B.STONE;}
 G.layers.initialize(s);let small=0;
 for(let x=0;x<G.constants.WORLD_W;x++){
  const rise=s.surfaceAt[x]-s.backdrop.columns[x][0];
  assert.ok(rise>=1&&rise<=4,`height ${rise} at ${x}`);if(rise<=2)small++;
  for(let y=s.backdrop.columns[x][0];y<30;y++)assert.notEqual(G.backgroundRenderer.materialAt(s.backdrop,x,y),B.STONE);
 }
 assert.ok(small>G.constants.WORLD_W*0.65,'most hills should be one or two tiles');
});

test('field biome hides only 3D surface hills and retains the underground backdrop',()=>{
 const {G}=game(),s=G.state.createGameState({landscape3d:true}),B=G.blocks.BLOCK;
 s._newLayerWorld=true;s.biomeAt[10]='field';s.biomeAt[11]='plains';
 G.layers.initialize(s);
 for(let y=0;y<=s.surfaceAt[10];y++)assert.equal(G.backgroundRenderer.materialAt(s.backdrop,10,y),B.AIR);
 assert.equal(G.backgroundRenderer.materialAt(s.backdrop,10,s.surfaceAt[10]+1),B.DIRT);
 assert.ok(s.backdrop.columns[11][0]<s.surfaceAt[11]);
});

test('player passes through second and third layer blocks in every direction',()=>{
 const {G}=game(),T=G.constants.TILE;
 for(const layer of [2,3])for(const [dx,dy]of [[0,1],[0,-1],[1,0],[-1,0]]){
  const s=G.state.createGameState(),p=s.player;
  G.layers.place(s,10,10,G.blocks.BLOCK.STONE,layer);
  Object.assign(p,{x:10*T+2-dx*20,y:10*T+2-dy*20,w:12,h:12,vx:dx*60,vy:dy*60,onGround:false});
  const x=p.x,y=p.y;
  G.physics.moveEntity(s,p,1);
  assert.ok(Math.abs(p.x-(x+dx*60))<0.001,`horizontal layer ${layer}`);
  assert.ok(Math.abs(p.y-(y+dy*60))<0.001,`vertical layer ${layer}, direction ${dy}`);
  assert.equal(p.onGround,false);
 }
});

test('player still lands on first layer and background mobs ignore it',()=>{
 const {G}=game(),s=G.state.createGameState(),T=G.constants.TILE,p=s.player;
 G.layers.place(s,10,10,G.blocks.BLOCK.STONE,1);
 Object.assign(p,{x:10*T+2,y:8*T,w:12,h:12,vx:0,vy:60,onGround:false});
 G.physics.moveEntity(s,p,1);
 assert.equal(p.onGround,true);
 assert.equal(p.vy,0);
 assert.equal(G.layers.supportAt(s,10*T+3,10*T+1,{layer:2}),false);
});


test('mobs collide only with their own layer in every direction',()=>{
 const {G}=game(),T=G.constants.TILE;
 for(const mobLayer of [1,2,3])for(const blockLayer of [1,2,3]){
  for(const [dx,dy]of [[0,1],[0,-1],[1,0],[-1,0]]){
   const s=G.state.createGameState();
   G.layers.place(s,10,10,G.blocks.BLOCK.STONE,blockLayer);
   const mob={layer:mobLayer,x:10*T+2-dx*20,y:10*T+2-dy*20,w:12,h:12,vx:dx*60,vy:dy*60,onGround:false};
   const x=mob.x,y=mob.y;
   G.physics.moveEntity(s,mob,1);
   const passed=Math.abs(mob.x-(x+dx*60))<0.001 && Math.abs(mob.y-(y+dy*60))<0.001;
   assert.equal(passed,mobLayer!==blockLayer,`mob ${mobLayer}, block ${blockLayer}, direction ${dx},${dy}`);
   assert.equal(mob.onGround,dy===1 && mobLayer===blockLayer);
  }
 }
});
