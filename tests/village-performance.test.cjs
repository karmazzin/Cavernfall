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


test('resident updates validate each home only once per tick', () => {
  const {G}=loadGame();
  const s=G.state.createGameState({mode:'creative',worldType:'infinite_village',singleBiome:'plains'});
  G.random.withSeed('village-perf',()=>G.generation.generateWorld(s));
  for (const [update,homes] of [
    [G.humansEntity.updateHumans,s.humanSettlements.villages.flatMap(v=>v.houses)],
    [G.dwarvesEntity.updateDwarves,s.dwarfColony.homes],
  ]) {
    update(s,0);
    let reads=0;
    for (const home of homes) {
      let value=home.respawnTimer;
      Object.defineProperty(home,'respawnTimer',{configurable:true,get(){reads++;return value;},set(v){value=v;}});
    }
    update(s,1/60);
    assert.ok(reads<=homes.length*3, `${reads} home checks for ${homes.length} homes`);
    homes[0].respawnTimer=NaN;
    update(s,0);
    assert.ok(Number.isFinite(homes[0].respawnTimer),'normalization still runs on the next tick');
  }
});

test('second-layer house walls reuse bounded sprites without per-frame filters', () => {
  const {G,context}=loadGame();
  let canvases=0,images=0,filterWrites=0;
  const noop=()=>{};
  const spriteContext=new Proxy({}, {get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>{if(k==='filter')filterWrites++;o[k]=v;return true;}});
  context.document.createElement=()=>{canvases++;return {getContext:()=>spriteContext};};
  const screen={drawImage(){images++;}};
  for(let i=0;i<1000;i++) {
    assert.equal(G.worldRenderer.drawSecondLayerBlock(screen,G.blocks.BLOCK.PLANK,i,0),true);
    assert.equal(G.worldRenderer.drawSecondLayerBlock(screen,G.blocks.BLOCK.SANDSTONE,i,16),true);
  }
  assert.equal(canvases,2);
  assert.equal(images,2000);
  assert.equal(filterWrites,0);
  assert.equal(G.worldRenderer.drawSecondLayerBlock(screen,G.blocks.BLOCK.TORCH,0,0),false);
  assert.equal(canvases,2);
});
