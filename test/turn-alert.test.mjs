// 개인 차례 알림 순수 도우미 확인: node --test test/turn-alert.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {turnAlertTarget,createTurnAlert} from '../game-config.mjs';

const d={hostUid:'T',members:{T:{nickname:'선생님',team:0},a1:{nickname:'별',team:0,joinedAt:1},a2:{nickname:'달',team:0,joinedAt:2},b1:{nickname:'해',team:1,joinedAt:1},e1:{nickname:'구름',team:4,joinedAt:1}}};
const roll={phase:'roll',team:0,turnId:5,playerIndices:{0:0},startedAt:9};
const at=(uid,g,host=false)=>turnAlertTarget({room:'AB12CD',uid,host,d,g});

test('굴릴 바로 그 학생만: 같은 팀 친구·다른 팀·교사는 제외',()=>{
 assert.equal(at('a1',roll).eligible,true);
 for(const who of ['a2','b1','e1'])assert.equal(at(who,roll).eligible,false,who);
 assert.equal(at('T',roll,true).eligible,false);
 assert.equal(at('a2',{...roll,playerIndices:{0:1}}).eligible,true);
 const order={phase:'order',orderTurn:4,turnId:0,rollStartedAt:3};
 assert.equal(at('e1',order).eligible,true);assert.equal(at('a1',order).eligible,false);
 for(const phase of ['quiz','author','wait','next','finished'])assert.equal(at('a1',{...roll,phase}).eligible,false,phase);
 assert.notEqual(at('a1',roll).key,at('a1',{...roll,turnId:6}).key);
 assert.notEqual(at('e1',order).key,at('e1',{...order,rollStartedAt:4}).key,'동점으로 다시 굴리면 새 알림');
 assert.equal(at('a1',roll).key,at('a1',{...roll,message:'다른 변화',owners:[1]}).key);
});

test('한 차례에 한 번만 열리고, 닫은 뒤 관계없는 스냅숏에는 다시 열리지 않아요',()=>{
 const t=createTurnAlert(),s=at('a1',roll);
 assert.equal(t.update(s).action,'open');
 assert.equal(t.update(s).action,'none');assert.equal(t.open,s.key);
 assert.equal(t.dismiss(),true);assert.equal(t.open,'');
 assert.equal(t.update(s).action,'none','닫은 뒤 같은 차례 스냅숏');
 assert.equal(t.update(at('a1',{...roll,turnId:7})).action,'open','다음 내 차례');
});

test('차례·단계가 바뀌거나 주사위 요청 중이면 스스로 닫혀요',()=>{
 const t=createTurnAlert(),s=at('a1',roll);
 t.update(s);assert.equal(t.update(at('a1',{...roll,phase:'next'})).action,'close');
 const t2=createTurnAlert();t2.update(s);assert.equal(t2.update({...s,pending:true}).action,'close');
 const t3=createTurnAlert();t3.update(s);const other=at('a1',{...roll,turnId:8});assert.equal(t3.update(other).action,'open','새 차례로 바로 교체');
 const t4=createTurnAlert();t4.update(s);assert.equal(t4.update({eligible:false,key:''}).action,'close','게임 종료·나가기');
});

test('화면이 안 보일 때는 미뤘다가 돌아오면 지금 차례만 띄우고, 지난 차례는 다시 띄우지 않아요',()=>{
 const t=createTurnAlert(),s=at('a1',roll);
 assert.equal(t.update({...s,visible:false}).action,'none');
 assert.equal(t.update({...s,visible:true}).action,'open');
 const reloaded=createTurnAlert(s.key);
 assert.equal(reloaded.update(s).action,'none','새로고침 뒤 이미 본 차례');
 assert.equal(reloaded.update(at('a1',{...roll,turnId:6})).action,'open');
});
