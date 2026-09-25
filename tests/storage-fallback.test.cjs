const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// Transaction-level IndexedDB double. Writes only become visible on completion.
function databaseDouble({abortWrites=false}={}){
 const records=new Map();let commits=0;
 const db={createObjectStore(){},close(){},transaction(name,mode){
  const tx={error:null};let operation=null,read;
  tx.objectStore=()=>({getAll(){read={};return read;},put(record){operation=()=>records.set(record.id,record);},delete(id){operation=()=>records.delete(id);}});
  setImmediate(()=>{
   if(mode==='readwrite'&&abortWrites){tx.error=new Error('Disk write failed');tx.onabort?.();return;}
   if(read){read.result=[...records.values()];read.onsuccess?.();}
   operation?.();if(mode==='readwrite')commits++;
   tx.oncomplete?.();
  });return tx;
 }};
 return {records,get commits(){return commits;},open(){const req={};setImmediate(()=>{req.result=db;req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
}
function load(indexedDB,storage=new Map(),full=true){
 const c=vm.createContext({window:{indexedDB},document:{getElementById:()=>null},console,
 localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(full)throw Object.assign(new Error('full'),{name:'QuotaExceededError'});storage.set(k,v);},removeItem:k=>storage.delete(k)}});
 for(const [,file]of fs.readFileSync('index.html','utf8').matchAll(/src="\.\/(src\/[^" ]+\.js)"/g)){
  if(file==='src/app/menuUi.js')break;vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
 }
 return {G:c.window.MC2D,c,storage};
}
test('full localStorage saves durably in IndexedDB and loads after a fresh session',async()=>{
 const db=databaseDouble(),{G,storage}=load(db),s=G.state.createGameState({id:'durable'});
 s.player.x=321;
 assert.equal(await G.saveSystem.saveWorld(s),true);
 assert.equal(db.commits,1,'success waits for disk transaction completion');
 assert.equal(s.saveError,null);
 assert.equal(G.saveSystem.listWorlds()[0].id,'durable');
 const fresh=load(db,storage);
 const restored=await fresh.G.saveSystem.loadWorld('durable');
 assert.equal(restored.player.x,321);
});
test('a newer database save wins over the old localStorage snapshot',async()=>{
 const db=databaseDouble(),storage=new Map(),first=load(db,storage,false);
 await first.G.worldStorage.ready;
 const s=first.G.state.createGameState({id:'same-id'});s.player.x=1;
 assert.equal(await first.G.saveSystem.saveWorld(s),true);
 const full=load(db,storage,true);await full.G.worldStorage.ready;
 const next=await full.G.saveSystem.loadWorld('same-id');next.player.x=99;
 assert.equal(await full.G.saveSystem.saveWorld(next),true);
 const fresh=load(db,storage,true);
 assert.equal((await fresh.G.saveSystem.loadWorld('same-id')).player.x,99);
});
test('failed IndexedDB commit is not reported as saved',async()=>{
 const db=databaseDouble({abortWrites:true}),{G}=load(db),s=G.state.createGameState({id:'failed'});
 assert.equal(await G.saveSystem.saveWorld(s),false);
 assert.equal(db.records.size,0);
 assert.ok(s.saveError);
});
test('deleting a fallback world removes it from both stores and future sessions',async()=>{
 const db=databaseDouble(),{G,storage}=load(db),s=G.state.createGameState({id:'deleted'});
 assert.equal(await G.saveSystem.saveWorld(s),true);
 assert.equal(await G.saveSystem.deleteWorld('deleted'),true);
 const fresh=load(db,storage);await fresh.G.worldStorage.ready;
 assert.equal(await fresh.G.saveSystem.loadWorld('deleted'),null);
 assert.equal(fresh.G.saveSystem.listWorlds().length,0);
});
