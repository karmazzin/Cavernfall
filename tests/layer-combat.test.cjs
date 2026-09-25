const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function game(){
 const c=vm.createContext({window:{},document:{getElementById:()=>null},console});
 for(const [,file]of fs.readFileSync('index.html','utf8').matchAll(/src="\.\/(src\/[^" ]+\.js)"/g)){
  if(file==='src/app/menuUi.js')break;vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
 }
 const G=c.window.MC2D;G.audio.playHit=()=>{};return G;
}
function fixture(G){
 const s=G.state.createGameState({mode:'creative'});
 s.player.x=150;s.player.y=160;
 return s;
}
function click(G,s,button=0){
 G.interaction.handleMouse(s,{keys:new Set(),mouse:{x:200*G.constants.VIEW_ZOOM,y:168*G.constants.VIEW_ZOOM,down:true,justPressed:true,button}}, {x:0,y:0},0.016);
}
for(const layer of [1,2,3])for(const group of ['zombies','spiders','animals','fireGuards','dwarves'])test(`player clicks damage and kill ${group} on layer ${layer}`,()=>{
 const G=game(),s=fixture(G),mob=group==='animals'?G.animalsEntity.createSheep(12,10):{};
 Object.assign(mob,{x:192,y:160,w:16,h:24,hp:2,layer});s[group].push(mob);
 click(G,s);assert.equal(mob.hp,1);
 assert.equal(s[group].length,1);
 mob.clickCd=0;click(G,s);
 assert.equal(s[group].length,0,'lethal hit removes the mob');
});
for(const layer of [2,3])test(`boss hits reach layer ${layer} through the real mouse handler`,()=>{
 const G=game();
 for(const key of ['fireBoss','fireKing','kraken','goldenFlowerGuardian','airGuardian','airThief','evilTrunk']){
  const s=fixture(G);s.player.steamForm=true;
  s[key]={x:192,y:160,w:16,h:24,hp:10,layer};
  click(G,s);assert.equal(s[key].hp,9,key);
 }
});
test('right click does not damage a mob on another layer',()=>{
 const G=game(),s=fixture(G);s.zombies.push({x:192,y:160,w:16,h:24,hp:2,layer:2});
 click(G,s,2);assert.equal(s.zombies[0].hp,2);
});
test('the click exception does not merge NPC simulation layers',()=>{
 const G=game(),s=fixture(G);
 for(const layer of [1,2,3])s.zombies.push({layer,hp:3});
 const seen=[];
 G.layers.simulate(s,view=>{seen.push(view._interactionLayer);assert.equal(view.zombies.length,1);assert.equal(view.zombies[0].layer,view._interactionLayer);});
 assert.deepEqual(seen,[1,2,3]);assert.equal(s.zombies.length,3);
});
