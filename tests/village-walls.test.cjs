const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function game(){
 const storage=new Map();
 const c=vm.createContext({window:{},document:{getElementById:()=>null},console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
 for(const [,file]of fs.readFileSync('index.html','utf8').matchAll(/src="\.\/(src\/[^" ]+\.js)"/g)){
  if(file==='src/app/menuUi.js')break;vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
 }
 return {G:c.window.MC2D,storage};
}
for(const biome of ['plains','snow_plains','mountains','desert'])test(`human houses in ${biome} have passable second-layer rear walls`,()=>{
 const {G}=game(),B=G.blocks.BLOCK,s=G.state.createGameState({worldType:'infinite_village',singleBiome:biome});
 G.random.withSeed('rear-walls',()=>G.generation.generateWorld(s));
 const v=s.humanSettlements.villages[0];assert.ok(v.houses.length>0);
 for(const h of v.houses){
  let walls=0;
  for(let y=h.groundY-h.height+1;y<h.groundY;y++)for(let x=h.x0+1;x<h.x1;x++){
   const id=G.world.getBlock(s,x,y);assert.notEqual(id,B.AIR,`unfilled room at ${x},${y}`);
   if(G.layers.at(s,x,y)===2){
    walls++;assert.equal(id,biome==='desert'?B.SANDSTONE:B.PLANK);
    assert.equal(G.world.isSolidAtPixel(s,x*16+1,y*16+1,s.player),false);
   }
  }
  assert.ok(walls>0);
  assert.equal(G.world.getBlock(s,h.x0,h.doorY),B.DOOR);
  assert.equal(G.layers.at(s,h.x0,h.doorY),1);
 }
});
test('old houses gain walls once, preserving furniture and player edits across saves',()=>{
 const {G}=game(),B=G.blocks.BLOCK,s=G.state.createGameState({id:'old-house'});
 const house={x0:10,x1:16,groundY:30,height:5};
 s.humanSettlements.villages=[{type:'plains_village',houses:[house]}];
 G.world.setBlock(s,12,29,B.CHEST);G.world.setBlock(s,13,29,B.WOOD,3);
 assert.equal(G.saveSystem.saveWorld(s),true);
 const loaded=G.saveSystem.loadWorld('old-house');
 assert.equal(G.world.getBlock(loaded,11,27),B.PLANK);
 assert.equal(G.layers.at(loaded,11,27),2);
 assert.equal(G.world.getBlock(loaded,12,29),B.CHEST);
 assert.equal(G.world.getBlock(loaded,13,29),B.WOOD);
 assert.equal(G.layers.at(loaded,13,29),3);
 G.world.setBlock(loaded,11,27,B.AIR);
 assert.equal(G.saveSystem.saveWorld(loaded),true);
 const again=G.saveSystem.loadWorld('old-house');G.generation.retrofitWorldFeatures(again);
 assert.equal(G.world.getBlock(again,11,27),B.AIR,'mined wall does not grow back');
});

test('roadside workyard piles move to layer two once, without altering roads or chests',()=>{
 const {G}=game(),B=G.blocks.BLOCK,s=G.state.createGameState({id:'yard'});
 const h={x:15,x0:10,x1:20,groundY:30,height:5,profession:'lumber',workNodeId:'yard-node',backWallsVersion:1};
 s.humanSettlements.villages=[{type:'plains_village',houses:[h]}];
 s.humanSettlements.nodes=[{id:'yard-node',x:24,y:29}];
 for(const [x,id]of [[24,B.WOOD],[25,B.WOOD],[26,B.PLANK],[27,B.CHEST]])G.world.setBlock(s,x,29,id);
 G.world.setBlock(s,25,30,B.PATH);
 G.generation.retrofitVillageWorkyards(s);
 for(const x of [24,25,26]){assert.equal(G.layers.at(s,x,29),2);assert.equal(G.world.isSolidAtPixel(s,x*16+1,29*16+1,s.player),false);}
 assert.equal(G.layers.at(s,27,29),1);assert.equal(G.layers.at(s,25,30),1);
 G.world.setBlock(s,26,29,B.AIR);G.world.setBlock(s,26,29,B.PLANK,1);
 assert.equal(G.saveSystem.saveWorld(s),true);
 const loaded=G.saveSystem.loadWorld('yard');
 assert.equal(G.layers.at(loaded,26,29),1,'player replacement is not moved again');
});
test('workyard migration protects a neighbouring house even if a pile position overlaps it',()=>{
 const {G}=game(),B=G.blocks.BLOCK,s=G.state.createGameState();
 const h={x:15,x0:10,x1:20,groundY:30,height:5,profession:'lumber',workNodeId:'yard-node',backWallsVersion:1};
 s.humanSettlements.villages=[{type:'plains_village',houses:[h,{x:28,x0:26,x1:30,groundY:30,height:5,backWallsVersion:1}]}];
 s.humanSettlements.nodes=[{id:'yard-node',x:24,y:29}];G.world.setBlock(s,26,29,B.PLANK);
 G.generation.retrofitVillageWorkyards(s);assert.equal(G.layers.at(s,26,29),1);
});

test('stone, ore, sandstone and winter timber piles are all passable after migration',()=>{
 const {G}=game(),B=G.blocks.BLOCK;
 for(const [profession,type,piles]of [
  ['mason','plains_village',[[-1,B.STONE],[0,B.DEEPSTONE],[2,B.STONE]]],
  ['miner','plains_village',[[1,B.COAL_ORE],[2,B.GOLD_ORE]]],
  ['guard','desert_village',[[-1,B.SANDSTONE],[0,B.CACTUS]]],
  ['guard','winter_village',[[-1,B.SPRUCE_WOOD],[0,B.PLANK]]]
 ]){
  const s=G.state.createGameState();
  s.humanSettlements.villages=[{type,houses:[{x:15,x0:10,x1:20,groundY:30,height:5,profession,workNodeId:'yard'}]}];
  s.humanSettlements.nodes=[{id:'yard',x:24,y:29}];
  for(const [dx,id]of piles)G.world.setBlock(s,25+dx,29,id);
  G.generation.retrofitVillageWorkyards(s);
  for(const [dx,id]of piles){assert.equal(G.world.getBlock(s,25+dx,29),id);assert.equal(G.layers.at(s,25+dx,29),2);}
 }
});
