// 시대·팀 설정과 차례 진행 순수 도우미 확인: node --test test/game-flow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCENARIOS,SCENARIO_KEYS,LEGACY_NAMES,buildRoomConfig,roomConfig,isTeamIndex,presetNames,initialGame,orderRollPatch,nextTurnState,handoffTransform,shouldAutoHandoff,completeClaimTransform,questionBankFor,historyCardsFor,currentPlayer,rosterOf,teamLabel,CHANCE_POINTS} from '../game-config.mjs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const five=roomConfig({config:buildRoomConfig({scenario:'goryeo',teamCount:5}).config});
const ctx=c=>({teamCount:c.teamCount,names:c.teamNames});

test('9개 시대 프리셋 × 2~5팀 설정이 만들어지고 scenario-questions.js 키와 같아요',()=>{
 assert.equal(SCENARIO_KEYS.length,9);
 const bankKeys=[...read('../scenario-questions.js').matchAll(/^ {2}"([a-z-]+)": \[/gm)].map(m=>m[1]).sort();
 assert.deepEqual(bankKeys,[...SCENARIO_KEYS].sort());
 for(const key of SCENARIO_KEYS){
  assert.equal(new Set(SCENARIOS[key].teams).size,5,key);
  for(let n=2;n<=5;n++){const r=buildRoomConfig({scenario:key,teamCount:n});assert.equal(r.ok,true,key+n);assert.deepEqual(r.config.teamNames,presetNames(key,n));const c=roomConfig({config:r.config});assert.equal(c.teamCount,n);assert.equal(c.legacy,false);assert.equal(c.colors.length,n);assert.equal(new Set(c.colors.map(x=>x.bg)).size,n)}
 }
 assert.deepEqual(presetNames('three'),['고구려','백제','신라','가야','우산국']);
});

test('교사 입력 검사: 팀 수 2~5, 이름 1~20자·중복 불가·빈칸은 기본 이름',()=>{
 for(const n of [1,6,'x',2.5])assert.equal(buildRoomConfig({scenario:'three',teamCount:n}).ok,false,String(n));
 assert.equal(buildRoomConfig({scenario:'nope'}).ok,false);
 assert.equal(buildRoomConfig({scenario:'three',teamCount:2,teamNames:['가','가']}).ok,false);
 assert.equal(buildRoomConfig({scenario:'three',teamCount:2,teamNames:['x'.repeat(21)]}).ok,false);
 assert.equal(buildRoomConfig({scenario:'three',teamCount:2,teamNames:['<b>']}).ok,false);
 assert.deepEqual(buildRoomConfig({scenario:'goryeo',teamCount:3,teamNames:['  우리  팀 ','','']}).config.teamNames,['우리 팀','팔만대장경팀','직지팀']);
});

test('설정 없는 기존 방·잘못된 설정은 4팀으로, 이름만 깨지면 팀 수는 지키고 기본 이름',()=>{
 for(const d of [null,{},{config:null},{config:[]},{config:{teamCount:7}},{config:{teamCount:'5'}},{config:{teamCount:1}}]){const c=roomConfig(d);assert.equal(c.teamCount,4);assert.equal(c.legacy,true);assert.deepEqual(c.teamNames,LEGACY_NAMES)}
 const broken=roomConfig({config:{scenario:'goryeo',teamCount:5,teamNames:['a','a','<x>',null,'']}});
 assert.equal(broken.teamCount,5);assert.deepEqual(broken.teamNames,presetNames('goryeo',5));
 assert.equal(roomConfig({config:{scenario:'??',teamCount:3}}).scenario,'three');
});

test('팀 범위: 기존 방은 0~3, 새 3팀 방은 0~2, 5팀 방은 0~4',()=>{
 const legacy=roomConfig({}),three=roomConfig({config:buildRoomConfig({scenario:'three',teamCount:3}).config});
 assert.equal(isTeamIndex(3,legacy),true);assert.equal(isTeamIndex(4,legacy),false);
 assert.equal(isTeamIndex(3,three),false);assert.equal(isTeamIndex(4,five),true);
 for(const bad of [-1,5,1.5,'1',NaN])assert.equal(isTeamIndex(bad,five),false,String(bad));
});

test('database.rules.json: 팀 0~4 정수, 설정 팀 수 또는 기존 4팀 제한, 다른 규칙은 그대로',()=>{
 const rules=JSON.parse(read('../database.rules.json')).rules,room=rules.rooms.$room;
 assert.equal(rules['.read'],false);assert.equal(rules['.write'],false);
 const w=room.members.$uid['.write'];
 assert.match(w,/auth\.uid === \$uid/);assert.match(w,/newData\.child\('team'\)\.val\(\) === 4\)/);assert.doesNotMatch(w,/=== 5\) \|\| newData/);
 assert.match(w,/< data\.parent\(\)\.parent\(\)\.child\('config\/teamCount'\)\.val\(\)/);assert.match(w,/newData\.child\('team'\)\.val\(\) < 4\)/);
 assert.match(w,/nickname'\)\.val\(\)\.length <= 20/);
 assert.match(room.attempts.$uid['.write'],/choice'\)\.val\(\) <= 3/);
 assert.doesNotMatch(JSON.stringify(rules),/"\.(read|write)":\s*"?true/);
});

test('새 게임 상태: 5팀 배열·순서·담당 학생, 땅 24칸',()=>{
 const g=initialGame(5,123);
 assert.deepEqual(g.positions,[0,0,0,0,0]);assert.deepEqual(g.laps,[0,0,0,0,0]);assert.deepEqual(g.order,[0,1,2,3,4]);
 assert.deepEqual(Object.keys(g.playerIndices),['0','1','2','3','4']);assert.equal(g.owners.length,24);assert.equal(g.phase,'order');assert.equal(g.startedAt,123);
 assert.equal(initialGame(4).positions.length,4);
});

test('5팀 시작 순서: 차례대로 굴리고, 같은 숫자면 처음부터, 다르면 순서 확정',()=>{
 let g=initialGame(5,0);const c=ctx(five);
 for(const [i,pair] of [[0,[1,1]],[1,[2,2]],[2,[3,3]],[3,[4,4]]].map(([i,p])=>[i,p])){const patch=orderRollPatch(g,pair,c,1);assert.equal(patch.orderTurn,i+1);g={...g,...patch}}
 const tie=orderRollPatch(g,[1,1],c,2);assert.equal(tie.orderTurn,0);assert.deepEqual(tie.orderRolls,{});assert.equal(tie.phase,undefined);
 const done=orderRollPatch(g,[6,6],c,2);assert.equal(done.phase,'roll');assert.deepEqual(done.order,[4,3,2,1,0]);assert.equal(done.team,4);assert.equal(done.orderTurn,5);
});

test('5팀 차례 넘김: 다섯째→첫째, 쉬기, 더블, 강제 넘김',()=>{
 const c=ctx(five),base={...initialGame(5,0),phase:'next',order:[2,0,4,1,3],turnId:9};
 const wrap=nextTurnState({...base,team:3},false,c);assert.equal(wrap.team,2);assert.equal(wrap.turnId,10);assert.equal(wrap.phase,'roll');assert.equal(wrap.playerIndices[3],1);
 const rest=nextTurnState({...base,team:3,skipTurns:{2:1}},false,c);assert.equal(rest.phase,'next');assert.equal(rest.restingTeam,2);assert.equal(rest.skipTurns[2],0);
 const dbl=nextTurnState({...base,team:4,bonusRoll:true},false,c);assert.equal(dbl.team,4);assert.equal(dbl.playerIndices[4],0);
 const forced=nextTurnState({...base,team:4,bonusRoll:true},true,c);assert.equal(forced.team,1);assert.equal(forced.bonusRoll,false);
 assert.match(wrap.message,/직지팀 차례/);assert.equal(teamLabel('고구려'),'고구려 팀');
});

test('빈 팀은 담당 학생이 없고, 교사는 담당에서 빠져요',()=>{
 const d={hostUid:'T',members:{T:{team:0},a:{team:0,joinedAt:2},b:{team:0,joinedAt:1},e:{team:4,joinedAt:1}}};
 assert.deepEqual(rosterOf(d,0).map(x=>x[0]),['b','a']);
 assert.equal(currentPlayer(d,{team:0,playerIndices:{0:3}}),'a');
 assert.equal(currentPlayer(d,{team:2}),null);assert.equal(currentPlayer(d,{team:4}),'e');
});

const authorGame=(extra={})=>({...initialGame(5,0),order:[0,1,2,3,4],phase:'author',team:4,turnId:20,questionId:7,bonusRoll:true,...extra});

test('자동 출제 넘김: 한 번만, 더블이어도 다음 팀(5→첫째), 오래된 기대값·재실행은 무시',()=>{
 const c=ctx(five),g=authorGame(),d={pendingClaims:{7:{topic:7,team:4,turnId:20}}};
 assert.equal(shouldAutoHandoff(d,g),true);
 assert.equal(shouldAutoHandoff({pendingClaims:{}},g),false);
 assert.equal(shouldAutoHandoff({pendingClaims:{7:{team:1}}},g),false);
 assert.equal(shouldAutoHandoff(d,{...g,owners:Object.assign(Array(24).fill(-1),{7:2})}),false);
 const next=handoffTransform(g,g,c);
 assert.equal(next.team,0);assert.equal(next.phase,'roll');assert.equal(next.turnId,21);assert.equal(next.bonusRoll,false);assert.equal(next.questionId,null);
 assert.equal(handoffTransform(next,g,c),undefined,'같은 요청·스냅숏 재실행');
 assert.equal(handoffTransform({...g,turnId:19},g,c),undefined);
 assert.equal(handoffTransform({...g,questionId:8},g,c),undefined);
 assert.equal(handoffTransform({...g,phase:'quiz'},{...g,phase:'quiz'},c),undefined);
});

test('출제 대기(wait) 거점: 막지 않고 넘기며, 더블 규칙은 그대로',()=>{
 const c=ctx(five),w=authorGame({phase:'wait',team:1,bonusRoll:false});
 assert.equal(shouldAutoHandoff({},w),true);
 const n=handoffTransform(w,w,c);assert.equal(n.team,2);assert.equal(n.phase,'roll');
 const dbl=handoffTransform({...w,bonusRoll:true},{...w,bonusRoll:true},c);assert.equal(dbl.team,1);
 assert.equal(n.owners[7],-1,'출제 중인 거점을 대기 팀에게 주지 않음');
});

test('넘긴 뒤 출제 완료: 출제 팀에게 한 번만, 지금 다른 팀 차례는 그대로',()=>{
 const c=ctx(five),g=authorGame(),now=handoffTransform(g,g,c);
 const done=completeClaimTransform(now,'7',4,c);
 assert.equal(done.owners[7],4);
 for(const k of ['phase','team','turnId','questionId','message','bonusRoll'])assert.deepEqual(done[k],now[k],k);
 assert.equal(completeClaimTransform(done,'7',4,c),undefined,'두 번 주지 않음');
 assert.equal(completeClaimTransform(now,7,5,c),undefined,'팀 범위 밖');
 const same=completeClaimTransform(g,7,4,c);assert.equal(same.phase,'next');assert.equal(same.bonusRoll,false);
 assert.equal(handoffTransform(same,g,c),undefined,'완료 후 넘김이 또 진행되지 않음');
 assert.equal(completeClaimTransform({...now,phase:'finished'},7,4,c),undefined);
});

test('문제·카드 자료: 삼국/기존 방은 기본 문제, 다른 시대는 그 시대 자료만',()=>{
 const defaults=[{name:'광개토대왕릉비'}],bank=Array.from({length:24},(_,i)=>({name:'주제'+(i%6),explain:'주제'+(i%6)+': 설명'+i}));
 assert.equal(questionBankFor(roomConfig({}),defaults,{}),defaults);
 assert.equal(questionBankFor(roomConfig({config:{scenario:'three',teamCount:5}}),defaults,{}),defaults);
 assert.equal(questionBankFor(five,defaults,{goryeo:bank}).length,24);
 assert.deepEqual(questionBankFor(five,defaults,{}),[]);
 const legacyCards={chance:[['태학 설립','고구려',3]],event:[]};
 assert.equal(historyCardsFor(roomConfig({}),legacyCards,defaults),legacyCards);
 const cards=historyCardsFor(five,legacyCards,bank);
 assert.equal(cards.chance.length,6);assert.deepEqual(cards.chance[0],['주제0','설명0',CHANCE_POINTS[0]]);
 assert.doesNotMatch(JSON.stringify(cards),/고구려|태학/);
 assert.ok(historyCardsFor(five,legacyCards,[]).chance.length>0);
});

test('app.js: 팀 수 4 고정값 대신 방 설정을 쓰고 순수 도우미를 연결해요',()=>{
 const app=read('../app.js');
 assert.doesNotMatch(app,/\[0,1,2,3\]|owner<4|team>3|%4\b|orderTurn:4/);
 for(const fn of ['handoffTransform(','completeClaimTransform(','orderRollPatch(','initialGame(','turnAlertTarget(','buildRoomConfig(','scheduleAutoHandoff()','lookupRoomTeams()'])assert.ok(app.includes(fn),fn);
 for(const id of ['roll','next','authoring','team','roomCode','scenario','teamCount','teamNameInputs','teamHint'])assert.match(read('../index.html')+app,new RegExp('id="'+id+'"|\\$\\(\''+id+'\'\\)'),id);
});
