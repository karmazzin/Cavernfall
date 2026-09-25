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

const variants=[['plains','plains_village','WATER'],['mountains','mountain_village','WATER'],['snow_plains','winter_village','SNOW'],['desert','desert_village','AIR']];
function generate(G,biome='plains') {
  const s=G.state.createGameState({id:'infinite-'+biome,mode:'creative',worldType:'infinite_village',singleBiome:biome});
  G.random.withSeed('infinite-check',()=>G.generation.generateWorld(s));
  return s;
}
for(const [biome,type,channel] of variants) test(`infinite village in ${biome} spans the map between two fields and two guard towers`,()=>{
  const {G}=loadGame(),s=generate(G,biome),B=G.blocks.BLOCK,W=G.constants.WORLD_W;
  assert.equal(s.humanSettlements.villages.length,1);
  const v=s.humanSettlements.villages[0];
  assert.equal(v.type,type);
  assert.equal(v.towers.length,2);
  assert.ok(v.houses.length>35);
  assert.ok(v.towers[0].x<50 && v.towers[1].x>W-50);
  assert.equal(v.houses.filter(h=>h.role==='guard').length,2);
  assert.equal(v.fields.length,2);
  for(const field of v.fields) for(let x=field.x;x<field.x+field.width;x++) {
    assert.equal(s.biomeAt[x],'field');
    if((x-field.x)%7===3) assert.equal(s.world[field.y][x],B[channel]);
  }
  const spawnX=Math.floor(s.player.x/G.constants.TILE);
  assert.equal(s.biomeAt[spawnX],biome);
  assert.ok(spawnX>v.towers[0].x && spawnX<v.towers[1].x);
  assert.ok(!G.world.isSolidAtPixel(s,s.player.x,s.player.y));
  G.humansEntity.updateHumans(s,0);
  assert.equal(s.humans.length,v.houses.length);
});

test('huge dwarf complex uses all three cave layers, has residents and survives saving unchanged',()=>{
  const {G}=loadGame(),s=generate(G),C=G.constants;
  for(const [lo,hi,biome] of [[40,65,'cave'],[74,95,'dwarf_caves'],[104,124,'deep']]) {
    const halls=s.dwarfColony.halls.filter(h=>h.y>=lo && h.y<=hi);
    assert.ok(halls.length>=10,biome);
    assert.ok(Math.min(...halls.map(h=>h.x))<70 && Math.max(...halls.map(h=>h.x))>C.WORLD_W-70);
    assert.ok(s.dwarfColony.homes.some(h=>h.y>=lo && h.y<=hi));
  }
  G.dwarvesEntity.updateDwarves(s,0);
  for(const [lo,hi] of [[40,68],[70,98],[100,126]]) assert.ok(s.dwarves.some(d=>d.y/C.TILE>=lo && d.y/C.TILE<hi));
  assert.equal(s.dwarves.length,s.dwarfColony.homes.length);
  assert.equal(G.saveSystem.saveWorld(s),true);
  const saved=G.saveSystem.loadWorld(s.worldMeta.id);
  assert.equal(saved.worldMeta.worldType,'infinite_village');
  const before=JSON.stringify(saved.world);
  G.generation.retrofitWorldFeatures(saved);
  assert.equal(JSON.stringify(saved.world),before);
  assert.equal(JSON.stringify(saved.dwarfColony),JSON.stringify(s.dwarfColony));
});

test('invalid biome falls back to plains and generation is reproducible',()=>{
  const {G}=loadGame(),s=generate(G,'field'),other=generate(G,'field');
  assert.equal(s.worldMeta.singleBiome,'plains');
  assert.equal(JSON.stringify(s.world),JSON.stringify(other.world));
});

test('new-world menu exposes only the four village biomes for infinite village',()=>{
  const {G,context}=loadGame();
  context.matchMedia=()=>({matches:false}); context.navigator={maxTouchPoints:0};
  const rootElement={innerHTML:'',addEventListener(){},classList:{toggle(){}}};
  vm.runInContext(fs.readFileSync(path.join(root,'src/app/menuUi.js'),'utf8'),context);
  const menu=G.menuUi.createMenuUi(rootElement,{});
  const app=G.appState.createAppState();app.screen='new-world';app.newWorld.worldType='infinite_village';app.newWorld.singleBiome='plains';
  menu.render(app);
  assert.match(rootElement.innerHTML,/Бесконечная деревня/);
  const choices=[...rootElement.innerHTML.matchAll(/data-menu-single-biome="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(choices,['plains','mountains','snow_plains','desert']);
  const selected=[...rootElement.innerHTML.matchAll(/class="menu-mode-btn is-active" data-menu-world-type="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(selected,['infinite_village']);
});

test('dwarf homes connect to the entrance, storage chests survive and mining sites retain rock',()=>{
  const {G}=loadGame(),s=generate(G),B=G.blocks.BLOCK,C=G.constants;
  const seen=new Set(),queue=[[50,Math.round(C.SURFACE_BASE)]];
  for(let i=0;i<queue.length;i++) {
    const [x,y]=queue[i],key=`${x},${y}`;
    if(x<0||x>=C.WORLD_W||y<26||y>=C.WORLD_H-1||seen.has(key)||G.world.blockSolid(G.world.getBlock(s,x,y))) continue;
    seen.add(key);queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  for(const home of s.dwarfColony.homes) assert.ok(seen.has(`${home.spawnX},${home.spawnY}`),home.id);
  for(const [key,chest] of Object.entries(s.chests)) {
    if(!chest.ownerSettlementId?.startsWith('dwarf-')) continue;
    const [x,y]=key.split(',').map(Number);
    assert.equal(s.world[y][x],B.CHEST,key);
    assert.ok(seen.has(key),`reachable chest ${key}`);
  }
  for(const site of s.dwarfColony.worksites) assert.ok(G.world.blockSolid(s.world[site.targetTy][site.targetTx]),`mine ${site.targetTx},${site.targetTy}`);
});
