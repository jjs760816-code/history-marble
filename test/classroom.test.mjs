// 교실 동시 참여 규칙 확인: node --test test/classroom.test.mjs
// 가짜 시각(now 숫자)과 5팀 × 4명 방으로 동시 퀴즈·연구·공사·보안 규칙을 실제로 실행해 봅니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRoll,settleQuiz,settleDueAt,nextDueAt,quizStage,canConfirm,finalAnswers,hostAttemptKey,quizReps,teamRoles,quizSettings,questionFor,landLevel,buildBonus,researchOf,addResearch,validateAuthoredQuestion,validateDecoration,makeBuildRequest,buildPrecheck,applyBuildTransform,busyRequests,hostStatus,QUIZ_LEAD_MS,THINK_MS,RESEARCH_CAP,SETTLE_GRACE_MS} from '../classroom.mjs';
import {initialGame,roomConfig,buildRoomConfig,legacyConfig,nextTurnState,orderRollPatch,completeClaimTransform,handoffTransform} from '../game-config.mjs';

const cfg=roomConfig({config:buildRoomConfig({scenario:'goryeo',teamCount:5}).config}),ctx={teamCount:5,names:cfg.teamNames};
const members={T:{team:0,nickname:'선생님'}};for(let t=0;t<5;t++)for(let i=0;i<4;i++)members['u'+t+i]={team:t,nickname:'학생'+t+i,joinedAt:t*10+i};
const d={hostUid:'T',members};
// 시작 → 거점0 → 거점1 → 거점2 → 기회 → 거점3 → 사건 → 거점4 …
const spaces=[{kind:'start'},{kind:'property',id:0},{kind:'property',id:1},{kind:'property',id:2},{kind:'chance'},{kind:'property',id:3},{kind:'event'},{kind:'property',id:4},{kind:'rest'}];
const Q={q:'고려의 인쇄물은?',options:['가','나','다','라'],answer:2,explain:'해설',name:'팔만대장경'};
const NOW=1_000_000;
const rollGame=(extra={})=>({...initialGame(5,0),phase:'roll',order:[0,1,2,3,4],team:0,turnId:5,...extra});
const roll=(g,pair=[1,2],now=NOW,extra={})=>applyRoll(g,{expectTurnId:g.turnId,pair,now,spaces,teamCount:5,names:ctx.names,reps:quizReps(d,g,5),quizSeconds:30,resultSeconds:4,drawCard:()=>['카드','설명',2],questionFor:()=>Q,...extra});
const att=(turnId,team,choice,at=1)=>({turnId,team,choice,submittedAt:at});
const quizGame=(extra={})=>roll(rollGame(extra));

test('도착: 빈 땅은 저절로 주지 않고 모든 팀 동시 문제, 대표는 팀별 주사위 담당',()=>{
 const g=quizGame();
 assert.equal(g.phase,'quiz');assert.equal(g.owners[2],-1,'출제·도착만으로 땅을 주지 않음');assert.equal(g.turnId,6);assert.equal(g.positions[0],3);
 assert.equal(g.quiz.startedAt,NOW+QUIZ_LEAD_MS);assert.equal(g.quiz.thinkUntil,NOW+QUIZ_LEAD_MS+THINK_MS);assert.equal(g.quiz.deadline,NOW+QUIZ_LEAD_MS+30000);
 assert.deepEqual(g.quiz.reps,{0:'u00',1:'u10',2:'u20',3:'u30',4:'u40'});
 assert.equal(g.studentTokens,null,'학생별 말은 쓰지 않음');
 assert.equal(roll(g),undefined,'이미 굴린 차례(phase·turnId 다름)는 다시 굴리지 않음');
 assert.equal(roll(rollGame(),[1,2],NOW,{questionFor:()=>null}).phase,'next','문제 자료가 없으면 막히지 않고 다음');
});

test('우리 땅 도착: 연구 +1 후 곧바로 다음, 기회 칸은 카드',()=>{
 const owners=Array(24).fill(-1);owners[2]=0;
 const own=roll(rollGame({owners}));assert.equal(own.phase,'next');assert.equal(researchOf(own,0),1);assert.ok(own.nextAt>NOW);
 const card=roll(rollGame(),[2,2]);assert.equal(card.phase,'next');assert.equal(card.lastCard.title,'카드');assert.equal(card.bonusRoll,true);
});

test('정산: 도전 팀 대표 정답만 점령, 다른 팀 정답은 연구 +2, 대표가 아닌 답·다른 팀 표시는 무시',()=>{
 const g=quizGame(),due=g.quiz.deadline;
 const attempts={u00:att(6,0,2),u01:att(6,0,1),u10:att(6,1,2),u20:att(6,2,0),u40:att(6,0,2),u41:att(6,4,2)};
 const r=settleQuiz(g,attempts,ctx,due,{resultSeconds:4});
 assert.equal(r.owners[2],0);assert.equal(r.decorationVersions[2],1);assert.equal(landLevel(r,2),1);
 assert.deepEqual([0,1,2,3,4].map(t=>researchOf(r,t)),[1,2,0,0,0]);
 assert.equal(r.lastQuiz.teams[2].submitted,true);assert.equal(r.lastQuiz.teams[2].correct,false);
 assert.equal(r.lastQuiz.teams[3].submitted,false);assert.equal(r.lastQuiz.teams[4].submitted,false,'대표가 아닌 학생(u41) 답은 팀 답이 아님');
 assert.equal(r.phase,'next');assert.equal(r.nextAt,due+4000);assert.equal(r.quiz,null);assert.equal(r.lastQuiz.captured,true);
});

test('먼저 맞혀도 일찍 끝나지 않음: 마감 전에는 정산 없음, 교사 화면은 여유 시간 뒤 처리',()=>{
 const g=quizGame();
 assert.equal(settleQuiz(g,{u00:att(6,0,2)},ctx,g.quiz.deadline-1),undefined);
 assert.equal(settleDueAt(g),g.quiz.deadline+SETTLE_GRACE_MS);
 assert.equal(quizStage(g.quiz,NOW),'ready');assert.equal(quizStage(g.quiz,g.quiz.startedAt),'think');assert.equal(canConfirm('think'),false);
 assert.equal(quizStage(g.quiz,g.quiz.thinkUntil),'discuss');assert.equal(quizStage(g.quiz,g.quiz.deadline-5000),'confirm');assert.equal(quizStage(g.quiz,g.quiz.deadline),'closed');
});

test('도전 팀 3명 오답 + 1명 결석, 그리고 전원 미제출: 마감에 끝나고 벌점·쉬기 없음',()=>{
 const g=quizGame({skipTurns:{0:0},bonusRoll:false});
 const wrong=settleQuiz(g,{u00:att(6,0,1),u01:att(6,0,1),u02:att(6,0,3)},ctx,g.quiz.deadline);
 assert.equal(wrong.owners[2],-1);assert.deepEqual(wrong.skipTurns,{0:0});assert.match(wrong.message,/벌점 없음/);
 const none=settleQuiz(g,{},ctx,g.quiz.deadline+60000);
 assert.equal(none.phase,'next');assert.ok(none.lastQuiz.teams.every(x=>!x.submitted&&!x.correct));assert.deepEqual(none.skipTurns,{0:0});
 const dbl=settleQuiz({...g,bonusRoll:true},{},ctx,g.quiz.deadline);assert.equal(dbl.bonusRoll,true,'틀려도 더블 기회를 빼앗지 않음');
});

test('지난 차례 답·반복 정산·바뀐 차례는 거절, 대표는 마감 전까지 답을 바꿀 수 있음',()=>{
 const g=quizGame();
 const stale=settleQuiz(g,{u00:att(5,0,2)},ctx,g.quiz.deadline);assert.equal(stale.owners[2],-1,'이전 turnId 답');
 const r=settleQuiz(g,{u00:att(6,0,2)},ctx,g.quiz.deadline);
 assert.equal(settleQuiz(r,{u00:att(6,0,2)},ctx,g.quiz.deadline+1),undefined,'두 번째 정산 없음');
 assert.equal(settleQuiz({...g,turnId:7},{},ctx,g.quiz.deadline),undefined);
 assert.equal(settleQuiz({...g,lastQuiz:{turnId:6}},{},ctx,g.quiz.deadline),undefined);
 const revised=finalAnswers({u00:att(6,0,2,10),[hostAttemptKey(0)]:att(6,0,1,5),[hostAttemptKey(1)]:att(6,1,2,99)},g.quiz,5);
 assert.equal(revised[0],2,'더 늦게 고친 답');assert.equal(revised[1],null,'교사 시연은 도전 팀만');
});

test('연구 상한 20 · 문제마다 한 번',()=>{
 assert.deepEqual(addResearch({1:19},1,2),{research:{1:20},gained:1});
 assert.equal(addResearch({1:RESEARCH_CAP},1,2).gained,0);
 const g=quizGame({research:{0:20,1:19}}),r=settleQuiz(g,{u00:att(6,0,2),u10:att(6,1,2)},ctx,g.quiz.deadline);
 assert.equal(researchOf(r,0),20);assert.equal(researchOf(r,1),20);assert.equal(r.lastQuiz.teams[1].gained,1);
});

// 팀 0이 거점 2를 가진 상태(LV1)에서 출발
const ownedGame=(extra={})=>{const owners=Array(24).fill(-1);owners[2]=0;return {...rollGame(),owners,decorationVersions:{2:1},research:{0:5},...extra}};
const lv2Req=g=>makeBuildRequest({uid:'u02',nickname:'학생02',team:0,g,topic:2,level:2,fields:{q:'질문?',options:['가','나','다','라'],answer:1,explain:'해설'},now:NOW}).request;

test('LV2 공사: 검토자 필요·연구 2 차감·재시도 안전·다른 팀 차례는 그대로',()=>{
 const busy={...quizGame({team:3,turnId:5}),owners:ownedGame().owners,decorationVersions:{2:1},research:{0:5}};
 const req=lv2Req(busy);assert.equal(req.ownerTeam,0);assert.equal(req.territoryVersion,1);
 assert.equal(applyBuildTransform(busy,req,{requestId:'k1',reviewerUid:'u02',now:NOW}).reason,'review','작성자 본인 검토 불가');
 assert.equal(applyBuildTransform(busy,req,{requestId:'k1',reviewerUid:'',now:NOW}).reason,'review');
 const out=applyBuildTransform(busy,req,{requestId:'k1',reviewerUid:'u03',now:NOW,originName:'팔만대장경'});
 assert.equal(out.status,'applied');const g=out.game;
 assert.equal(landLevel(g,2),2);assert.equal(researchOf(g,0),3);assert.equal(buildBonus(g,0),2);
 assert.equal(g.buildings[2].reviewerUid,'u03');assert.equal(g.buildings[2].question.name,'팔만대장경','원래 시대 주제 이름 유지');
 for(const k of ['phase','team','turnId','quiz','message'])assert.deepEqual(g[k],busy[k],k);
 assert.equal(applyBuildTransform(g,req,{requestId:'k1',reviewerUid:'u03',now:NOW+1}).status,'already','같은 요청 재실행');
 assert.equal(applyBuildTransform(g,req,{requestId:'k2',reviewerUid:'u03',now:NOW+1}).reason,'level','이중 공사 없음');
 assert.equal(questionFor(g,{2:Q},()=>null,2).q,'질문?');
 assert.equal(questionFor(busy,{2:Q},()=>null,2).q,Q.q,'승인 전에는 원래 문제');
});

test('연구 부족·형식 오류·한 팀 한 건',()=>{
 const g=ownedGame({research:{0:1}});
 assert.equal(applyBuildTransform(g,lv2Req(g),{requestId:'k',reviewerUid:'T',now:NOW}).reason,'research');
 assert.equal(validateAuthoredQuestion({q:'q',options:['a','a','b','c'],answer:0,explain:'e'}).ok,false);
 assert.equal(validateAuthoredQuestion({q:'q',options:['a','b','c'],answer:0,explain:'e'}).ok,false);
 assert.equal(validateAuthoredQuestion({q:'q',options:['a','b','c','d'],answer:4,explain:'e'}).ok,false);
 assert.equal(validateAuthoredQuestion({q:'x'.repeat(201),options:['a','b','c','d'],answer:0,explain:'e'}).ok,false);
 assert.equal(validateAuthoredQuestion({q:'q',options:['a','b','c','d'],answer:3,explain:''}).ok,false);
 assert.equal(validateDecoration({icon:'tower',meaning:'짧아요'}).ok,false);assert.equal(validateDecoration({icon:'castle',meaning:'충분히 긴 역사적 의미 한 줄'}).ok,false);
 assert.deepEqual(busyRequests({a:{ownerTeam:0,createdAt:2},b:{ownerTeam:0,createdAt:1},c:{ownerTeam:1,createdAt:3}}),['a']);
});

test('재점령: 공사·버전 초기화, 이전 요청은 주인/버전 불일치로 거절(초안 유지 안내)',()=>{
 let g=applyBuildTransform(ownedGame(),lv2Req(ownedGame()),{requestId:'k1',reviewerUid:'u03',now:NOW}).game;
 const pendingLv3=makeBuildRequest({uid:'u01',nickname:'학생01',team:0,g,topic:2,level:3,fields:{icon:'gate',meaning:'우리 역사의 기록 문화를 보여 주는 땅'},now:NOW}).request;
 // 팀 1이 거점 2에서 문제를 맞혀 빼앗음
 const q={...rollGame({team:1,turnId:9}),owners:g.owners,decorationVersions:g.decorationVersions,buildings:g.buildings,research:g.research,positions:[0,0,0,0,0]};
 const taken=settleQuiz(roll(q),{u10:att(10,1,2)},ctx,NOW+QUIZ_LEAD_MS+30000);
 assert.equal(taken.owners[2],1);assert.equal(landLevel(taken,2),1);assert.equal(buildBonus(taken,0),0);assert.equal(taken.buildings[2],undefined);
 const lost=applyBuildTransform(taken,pendingLv3,{requestId:'k3',reviewerUid:'u03',now:NOW});assert.equal(lost.reason,'owner');assert.match(lost.message,/초안/);
 const back={...taken,owners:Object.assign([...taken.owners],{2:0}),decorationVersions:{2:3}};
 assert.equal(buildPrecheck(back,pendingLv3).reason,'version');
});

test('LV3 상징: LV2 땅 + 연구 3 → 보너스 합계 5, 반복 보너스 없음',()=>{
 let g=applyBuildTransform(ownedGame({research:{0:5}}),lv2Req(ownedGame()),{requestId:'k1',reviewerUid:'T',now:NOW}).game;
 const lv3=makeBuildRequest({uid:'u01',nickname:'학생01',team:0,g,topic:2,level:3,fields:{icon:'pavilion',meaning:'기록을 소중히 지킨 마음을 보여 줘요'},now:NOW}).request;
 const out=applyBuildTransform(g,lv3,{requestId:'k3',reviewerUid:'T',now:NOW});assert.equal(out.status,'applied');g=out.game;
 assert.equal(landLevel(g,2),3);assert.equal(buildBonus(g,0),5);assert.equal(researchOf(g,0),0);assert.equal(g.buildings[2].decoration.icon,'pavilion');assert.equal(g.buildings[2].question.q,'질문?');
 assert.equal(applyBuildTransform({...g,research:{0:9}},lv3,{requestId:'k4',reviewerUid:'T',now:NOW}).reason,'level');
});

test('5팀 차례 넘김·역할 회전·대표, 같은 시작 주사위는 한 번에 정함',()=>{
 const g={...initialGame(5,0),phase:'next',order:[0,1,2,3,4],team:4,turnId:9,playerIndices:{0:0,1:0,2:0,3:0,4:0}};
 const n=nextTurnState(g,false,ctx);assert.equal(n.team,0);assert.equal(n.playerIndices[4],1);
 assert.equal(quizReps(d,n,5)[4],'u41');
 const roles=teamRoles(d,n,4);assert.deepEqual(roles.map(r=>r.roles[0].key),['helper','roller','reader','author'].map((k,i)=>i===0?'reviewer':k));
 assert.equal(teamRoles({hostUid:'T',members:{solo:{team:2,joinedAt:1}}},n,2)[0].roles.length,4,'기기 한 대 팀은 모든 역할');
 let o=initialGame(5,0);for(const p of [[3,3],[3,3],[3,3],[3,3]])o={...o,...orderRollPatch(o,p,ctx,1)};
 const done=orderRollPatch(o,[3,3],ctx,2);assert.equal(done.phase,'roll');assert.deepEqual(done.order,[0,1,2,3,4]);
});

test('기존 방 설정 기본값·교사 설정 검사·진행 화면 신호',()=>{
 assert.deepEqual(quizSettings(legacyConfig()),{quizSeconds:30,resultSeconds:4});
 assert.deepEqual(quizSettings(roomConfig({config:{...buildRoomConfig({scenario:'three',teamCount:4,quizSeconds:60,resultSeconds:6}).config}})),{quizSeconds:60,resultSeconds:6});
 assert.equal(buildRoomConfig({scenario:'three',quizSeconds:20}).ok,false);assert.equal(buildRoomConfig({scenario:'three',resultSeconds:12}).ok,false);
 assert.equal(roomConfig({config:{scenario:'three',teamCount:5,quizSeconds:99}}).quizSeconds,30);
 assert.equal(hostStatus(0,NOW),'unknown');assert.equal(hostStatus(NOW-14000,NOW),'ok');assert.equal(hostStatus(NOW-16000,NOW),'stale');
 assert.ok(nextDueAt({phase:'next',nextAt:5})===5&&nextDueAt({phase:'roll'})===Infinity);
 // 예전 도우미는 호환용으로 남아 있음(새 흐름에서는 app.js가 쓰지 않음)
 assert.equal(typeof completeClaimTransform,'function');assert.equal(typeof handoffTransform,'function');
});

// ── 보안 규칙을 작은 스냅숏 대역으로 실제 평가 ──
const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url))).rules,R=rules.rooms.$room;
class Snap{constructor(root,path=[]){this.root=root;this.path=path}child(p){return new Snap(this.root,[...this.path,...String(p).split('/')])}parent(){return new Snap(this.root,this.path.slice(0,-1))}val(){return this.path.reduce((a,k)=>a?.[k],this.root)??null}exists(){return this.val()!==null}isNumber(){return typeof this.val()==='number'}isString(){return typeof this.val()==='string'}isBoolean(){return typeof this.val()==='boolean'}}
const rule=s=>new Function('auth','$uid','$key','now','data','newData','return ('+s+')');
const room=(extra={})=>({rooms:{R1:{hostUid:'T',members:{s1:{team:2},s2:{team:2},s3:{team:0}},game:{turnId:7,phase:'quiz',quiz:{turnId:7,thinkUntil:500,deadline:1000,reps:{2:"s1",0:"s3"}}},...extra}}});
const at=(root,...p)=>new Snap(root,['rooms','R1',...p]);

test('규칙: 학생 답은 내 uid·내 팀·지금 문제·마감 전, 0~3만',()=>{
 const w=rule(R.attempts.$uid['.write']),root=room(),go=(uid,payload,now=1500,r=root)=>w(uid?{uid}:null,'s1',null,now,at(r,'attempts','s1'),new Snap(payload));
 assert.equal(go('s1',{turnId:7,team:2,choice:1}),true,'도전 팀이 아니어도 내 팀으로 답');
 assert.equal(go('s1',{turnId:7,team:0,choice:1}),false,'다른 팀 이름으로 못 냄');
 assert.equal(go('s1',{turnId:6,team:2,choice:1}),false);assert.equal(go('s1',{turnId:7,team:2,choice:4}),false);
 assert.equal(go('s1',{turnId:7,team:2,choice:1},2001),false,'마감 뒤');assert.equal(go('s2',{turnId:7,team:2,choice:1}),false,'다른 uid 자리');
 assert.equal(go(null,{turnId:7,team:2,choice:1}),false);
 assert.equal(go('s1',{turnId:7,team:2,choice:1},1500,room({game:{turnId:7,phase:'next'}})),false);
 assert.equal(go('s1',null),true,'내 답 지우기');
 assert.equal(go('s1',{turnId:7,team:2,choice:1},499),false,'혼자 생각 시간에는 확정 불가');
 assert.equal(w({uid:'s2'},'s2',null,1500,at(root,'attempts','s2'),new Snap({turnId:7,team:2,choice:1})),false,'대표 아닌 친구는 연습 답만');
 assert.equal(R.attempts.$uid.$other['.validate'],false);
});

test('규칙: 공사 요청은 내 팀·내 uid·크기 제한, 학생은 게임 상태를 직접 못 씀',()=>{
 const w=rule(R.buildRequests.$key['.write']),root=room();
 const lv2={authorUid:'s1',author:'별명',ownerTeam:2,topic:3,level:2,territoryVersion:1,createdAt:5,q:'질문',options:['a','b','c','d'],answer:0,explain:'해설'};
 const go=(uid,payload,r=root)=>w({uid},null,'k1',1,at(r,'buildRequests','k1'),new Snap(payload));
 assert.equal(go('s1',lv2),true);
 assert.equal(go('s1',{...lv2,ownerTeam:0}),false);assert.equal(go('s3',{...lv2,authorUid:'s3'}),false,'다른 팀 땅');
 assert.equal(go('T',{...lv2,authorUid:'T'}),false,'교사는 학생 요청 자리를 쓰지 않음');
 assert.equal(go('s1',{...lv2,q:'x'.repeat(201)}),false);assert.equal(go('s1',{...lv2,answer:5}),false);
 const lv3={...lv2,level:3,q:undefined,options:undefined,answer:undefined,explain:undefined,icon:'tower',meaning:'열 글자보다 긴 의미 한 줄'};
 assert.equal(go('s1',lv3),true);assert.equal(go('s1',{...lv3,meaning:'짧음'}),false);assert.equal(go('s1',{...lv3,icon:'https://x'}),false);
 const existing=room({buildRequests:{k1:lv2}});
 assert.equal(go('s1',{...lv2,q:'바꿈'},existing),false,'덮어쓰기 불가');assert.equal(go('s1',null,existing),true,'작성자 취소');assert.equal(go('s2',null,existing),false);
 for(const key of ['game','questions','config','hostBeat'])assert.equal(R[key],undefined,key+'는 교사(방 주인)만');
 assert.equal(rules['.read'],false);assert.equal(rules['.write'],false);
});

test('규칙: 친구 검토는 같은 팀·작성자 아님, 승인 확인은 본인만 지움',()=>{
 const w=rule(R.buildReviews.$key['.write']),root=room({buildRequests:{k1:{authorUid:'s1',ownerTeam:2}}});
 const go=(uid,r=root)=>w({uid},null,'k1',1,at(r,'buildReviews','k1'),new Snap({reviewerUid:uid,ok:true,at:1}));
 assert.equal(go('s2'),true);assert.equal(go('s1'),false,'작성자 본인');assert.equal(go('s3'),false,'다른 팀');assert.equal(go('s2',room()),false,'없는 요청');
 const ack=rule(R.buildAcks.$uid.$key['.write']),ackRoot=room({buildAcks:{s1:{k1:{status:'approved'}}}});
 assert.equal(ack({uid:'s1'},'s1','k1',1,at(ackRoot,'buildAcks','s1','k1'),new Snap(null)),true);
 assert.equal(ack({uid:'s1'},'s1','k1',1,at(ackRoot,'buildAcks','s1','k1'),new Snap({status:'approved'})),false,'학생이 승인 기록을 만들 수 없음');
 assert.equal(ack({uid:'s2'},'s1','k1',1,at(ackRoot,'buildAcks','s1','k1'),new Snap(null)),false);
});
