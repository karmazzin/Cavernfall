const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function loadGame({confirm=true,failSave=false}={}) {
  const storage = new Map();
  const prompts=[], alerts=[];
  const browser={confirm:message=>{prompts.push(message);return confirm;},alert:message=>alerts.push(message)};
  const context = vm.createContext({ window: browser, document: { getElementById: () => null }, console,
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => { if(failSave) throw new Error('Storage full'); storage.set(k,v); }, removeItem: k => storage.delete(k) } });
  for (const [, file] of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/src="\.\/(src\/[^" ]+\.js)"/g)) {
    if (file === 'src/app/menuUi.js') break;
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return {G:context.window.MC2D,prompts,alerts,context,browser};
}

function fixture(G) {
  const s=G.state.createGameState({id:'exit-test',worldType:'flat'});
  s.player.x=123;
  s.pause.open=true;
  return s;
}
test('cancelling native exit confirmation keeps the world and does not save',()=>{
  const {G,prompts}=loadGame({confirm:false}),s=fixture(G);
  assert.ok(G.worldExit,'exit protection exists');
  assert.equal(G.worldExit.confirmMenuExit(s,()=>G.saveSystem.saveWorld(s)),false);
  assert.equal(prompts.length,1);
  assert.equal(G.saveSystem.loadWorld('exit-test'),null);
  assert.equal(s.pause.open,true);
});
test('confirmed menu exit is permitted only after a successful real save',()=>{
  const {G}=loadGame(),s=fixture(G);
  assert.ok(G.worldExit);
  assert.equal(G.worldExit.confirmMenuExit(s,()=>G.saveSystem.saveWorld(s)),true);
  assert.equal(G.saveSystem.loadWorld('exit-test').player.x,123);
});
test('failed saving blocks menu exit and displays a native error message',()=>{
  const {G,alerts}=loadGame({failSave:true}),s=fixture(G);
  assert.ok(G.worldExit);
  assert.equal(G.worldExit.confirmMenuExit(s,()=>G.saveSystem.saveWorld(s)),false);
  assert.equal(s.pause.open,true);
  assert.ok(alerts.length===1 && s.pause.statusText.length>0);
});
for(const failSave of [false,true]) test(`reload requests the native browser warning while playing, save failure=${failSave}`,()=>{
  const {G,prompts}=loadGame({failSave}),s=fixture(G);
  assert.ok(G.worldExit);
  const e={preventDefault(){this.prevented=true;}};
  G.worldExit.beforeUnload(e,{screen:'playing'},s);
  assert.equal(e.prevented,true);
  assert.equal(e.returnValue,true);
  assert.equal(prompts.length,0,'reload uses beforeunload, not window.confirm');
  if(!failSave) assert.equal(G.saveSystem.loadWorld('exit-test').player.x,123);
});
test('main menu does not show unload warnings or save an inactive world',()=>{
  const {G}=loadGame(),s=fixture(G);
  assert.ok(G.worldExit);
  const e={preventDefault(){this.prevented=true;}};
  G.worldExit.beforeUnload(e,{screen:'menu'},s);
  assert.equal(e.prevented,undefined);
  assert.equal(e.returnValue,undefined);
  assert.equal(G.saveSystem.loadWorld('exit-test'),null);
});


for(const options of [{confirm:true},{confirm:false},{confirm:true,failSave:true}]) {
  test(`pause exit button and unload listener follow the actual app lifecycle ${JSON.stringify(options)}`,()=>{
    const {G,context,browser,prompts}=loadGame(options);
    const listeners=new Map();
    browser.innerWidth=1280; browser.innerHeight=800;
    browser.addEventListener=(name,fn)=>{if(!listeners.has(name)) listeners.set(name,new Set());listeners.get(name).add(fn);};
    browser.removeEventListener=(name,fn)=>listeners.get(name)?.delete(fn);
    const canvas={width:1280,height:800,getContext:()=>({}),toDataURL:()=>null};
    context.document={getElementById:id=>id==='game'?canvas:null,body:{classList:{toggle(){}}}};
    context.performance={now:()=>0};
    let frame, state, app, controls;
    context.requestAnimationFrame=fn=>{frame=fn;};
    const createState=G.state.createGameState,createApp=G.appState.createAppState;
    G.state.createGameState=(...args)=>(state=createState(...args));
    G.appState.createAppState=()=>(app=createApp());
    const input={mouse:{justPressed:false},syncUiState(){}};
    G.input.setupInput=(canvas,s,handlers)=>{controls=handlers;return input;};
    G.menuUi={createMenuUi:()=>({render(){}})};
    G.gameAssistant.createAssistantUi=()=>({setVisible(){},reset(){}});
    G.renderer.draw=()=>{};
    vm.runInContext(fs.readFileSync(path.join(root,'src/main.js'),'utf8'),context,{filename:'src/main.js'});
    assert.equal(listeners.get('beforeunload')?.size||0,0);
    state.worldMeta.id='exit-lifecycle'; state.player.x=321;
    app.screen='playing';
    controls.togglePause();
    assert.equal(listeners.get('beforeunload').size,1);
    const button=G.pauseRenderer.getPauseLayout(canvas,state).buttons.find(b=>b.id==='exit_to_menu');
    Object.assign(input.mouse,{x:button.x+1,y:button.y+1,justPressed:true,button:0});
    frame(16);
    assert.equal(prompts.length,1);
    const exited=options.confirm && !options.failSave;
    assert.equal(app.screen,exited?'menu':'playing');
    assert.equal(state.pause.open,!exited);
    assert.equal(listeners.get('beforeunload').size,exited?0:1);
    if(exited) assert.equal(G.saveSystem.loadWorld('exit-lifecycle').player.x,321);
  });
}

function bootMainForSaveTest(options={}) {
  const setup=loadGame(options),{G,context,browser}=setup;
  browser.innerWidth=1280;browser.innerHeight=800;
  browser.addEventListener=()=>{};browser.removeEventListener=()=>{};
  const canvas={width:1280,height:800,getContext:()=>({}),toDataURL:()=>null};
  context.document={getElementById:id=>id==='game'?canvas:null,body:{classList:{toggle(){}}}};
  context.performance={now:()=>0};
  let frame,state,app,controls;
  context.requestAnimationFrame=fn=>{frame=fn;};
  const createState=G.state.createGameState,createApp=G.appState.createAppState;
  G.state.createGameState=(...args)=>(state=createState(...args));
  G.appState.createAppState=()=>(app=createApp());
  const input={mouse:{justPressed:false},syncUiState(){}};
  G.input.setupInput=(canvas,s,handlers)=>{controls=handlers;return input;};
  G.menuUi={createMenuUi:()=>({render(){}})};
  G.gameAssistant.createAssistantUi=()=>({setVisible(){},reset(){}});
  G.renderer.draw=()=>{};
  return {...setup,canvas,input,boot(){
    vm.runInContext(fs.readFileSync(path.join(root,'src/main.js'),'utf8'),context,{filename:'src/main.js'});
    state.worldMeta.id='async-lifecycle';app.screen='playing';controls.togglePause();
    return {state,app,tick:now=>frame(now)};
  }};
}
test('repeated failed autosaves do not keep resetting the error notice',()=>{
 const h=bootMainForSaveTest({failSave:true}),{state,tick}=h.boot();
 let notices=0,value='';
 Object.defineProperty(state.ui,'noticeText',{get:()=>value,set(v){value=v;if(v)notices++;}});
 for(let i=1;i<=1600;i++)tick(i*50);
 assert.equal(notices,1,'one warning over multiple retry intervals');
 assert.equal(state.ui.noticeText,'','warning is allowed to expire');
});
for(const succeeds of [true,false])test(`menu waits for asynchronous durable saving: success=${succeeds}`,async()=>{
 const h=bootMainForSaveTest();let finish;
 h.G.saveSystem.saveWorld=()=>new Promise(resolve=>{finish=resolve;});
 const {state,app,tick}=h.boot();
 const button=h.G.pauseRenderer.getPauseLayout(h.canvas,state).buttons.find(b=>b.id==='exit_to_menu');
 Object.assign(h.input.mouse,{x:button.x+1,y:button.y+1,justPressed:true,button:0});
 tick(16);
 assert.equal(app.screen,'playing');assert.equal(state.pause.savingExit,true);
 finish(succeeds);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(app.screen,succeeds?'menu':'playing');
 assert.equal(state.pause.savingExit,false);
 assert.equal(h.alerts.length,succeeds?0:1);
});
