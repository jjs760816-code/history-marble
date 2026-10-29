// Evaluate the exact member rule with small RTDB snapshot doubles. Firebase Console also validates syntax on publication.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url)));
class Snap{
 constructor(root,path=[]){this.root=root;this.path=path}
 child(p){return new Snap(this.root,[...this.path,...p.split('/')])}
 parent(){return new Snap(this.root,this.path.slice(0,-1))}
 val(){return this.path.reduce((a,k)=>a?.[k],this.root)??null}
 isNumber(){return typeof this.val()==='number'}
 isString(){return typeof this.val()==='string'}
}
const evaluate=new Function('auth','$uid','data','newData','return ('+rules.rules.rooms.$room.members.$uid['.write']+')');
function allowed(count,team,auth={uid:'student'},nickname='별명',pathUid='student'){
 const root={rooms:{ROOM01:{config:count===undefined?undefined:{teamCount:count}}}};
 return evaluate(auth,pathUid,new Snap(root,['rooms','ROOM01','members',pathUid]),new Snap({team,nickname}));
}
test('exact Firebase member rule: legacy/configured counts, integer bounds, identity and nickname preserved',()=>{
 for(const count of [undefined,null,0,1,2,3,4,5,6,'5',2.5])for(const team of [-1,0,1,2,3,4,5,1.5,'4',null]){
 const n=Number.isInteger(count)&&count>=2&&count<=5?count:4;
 assert.equal(allowed(count,team),Number.isInteger(team)&&team>=0&&team<n,JSON.stringify({count,team}));
 }
 assert.equal(allowed(5,4),true);assert.equal(allowed(5,4,null),false);
 assert.equal(allowed(5,4,{uid:'other'}),false);
 assert.equal(allowed(5,4,{uid:'student'},'x'.repeat(21)),false);
 assert.equal(allowed(5,4,{uid:'student'},42),false);
 assert.equal(rules.rules['.read'],false);assert.equal(rules.rules['.write'],false);
});
