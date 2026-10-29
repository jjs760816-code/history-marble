// Codex 독립 검수: 20명 명단과 시간 경계·차례 보존·중복 보상을 확인합니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,buildRoomConfig,nextTurnState} from '../game-config.mjs';
import {teamRoles,quizReps,applyRoll,settleQuiz,recoverLegacyQuiz,applyBuildTransform,landLevel,buildBonus,researchOf} from '../classroom.mjs';
const names=['청자팀','팔만대장경팀','직지팀','개경팀','강화도팀'];
const ctx={teamCount:5,names},members={T:{nickname:'선생님',team:0}};
for(let t=0;t<5;t++)for(let j=0;j<4;j++)members[`s${t}${j}`]={nickname:`검수${t}-${j}`,team:t,joinedAt:t*4+j+1};
const d={hostUid:'T',members,config:buildRoomConfig({scenario:'goryeo',teamCount:5}).config};
const q={q:'검수용 문제',options:['보기1','보기2','보기3','보기4'],answer:2,explain:'검수용 해설',name:'검수 유물'};
const now=100000,base=()=>({...initialGame(5,1),phase:'roll',turnId:9,team:0});
function quiz(){const g=base();return applyRoll(g,{...ctx,expectTurnId:9,pair:[1,1],now,spaces:[{kind:'start'},{kind:'property',id:0},{kind:'property',id:1}],reps:quizReps(d,g,5),quizSeconds:30,resultSeconds:4,questionFor:()=>q})}
const answers=(g,correctTeams)=>Object.fromEntries(correctTeams.map(t=>[g.quiz.reps[t],{team:t,turnId:g.turnId,choice:2,submittedAt:g.quiz.thinkUntil+1}]));

test('20명은 각 팀 4역할을 갖고 4차례 동안 대표가 한 번씩 회전한다',()=>{
 for(let t=0;t<5;t++){
  const reps=[];
  for(let i=0;i<4;i++){
   const roles=teamRoles(d,{...base(),playerIndices:{[t]:i}},t);
   assert.equal(roles.length,4);assert.equal(new Set(roles.flatMap(r=>r.roles.map(x=>x.key))).size,4);
   assert.ok(roles.every(r=>r.roles.length===1&&r.roles[0].task));
   reps.push(roles.find(r=>r.representative).uid);
  }
  assert.equal(new Set(reps).size,4);
 }
});

test('회색 땅도 즉시 공통 퀴즈: 일찍 맞혀도 기한 전 종료하지 않는다',()=>{
 const g=quiz();assert.equal(g.phase,'quiz');assert.equal(g.owners[1],-1);
 assert.equal(Object.keys(g.quiz.reps).length,5);
 const a=answers(g,[0,1,2,3,4]);
 assert.equal(settleQuiz(g,a,ctx,g.quiz.deadline-1),undefined);
 const n=settleQuiz(g,a,ctx,g.quiz.deadline);
 assert.equal(n.owners[1],0);assert.equal(landLevel(n,1),1);
 assert.deepEqual(Array.from({length:5},(_,t)=>researchOf(n,t)),[1,2,2,2,2]);
 assert.equal(settleQuiz(n,a,ctx,g.quiz.deadline+5),undefined);
 assert.equal(n.nextAt-g.quiz.deadline,4000);
});

test('이전 버전의 기한 없는 문제는 새 제한 시간을 주고 복구하며 두 번 초기화하지 않는다',()=>{
 const old={...base(),phase:'quiz',questionId:1,quiz:null};
 const recovered=recoverLegacyQuiz(old,{question:q,reps:quizReps(d,old,5),now,quizSeconds:45});
 assert.equal(recovered.quiz.deadline,now+45000);assert.equal(recovered.quiz.thinkUntil,now+8000);
 assert.deepEqual(recovered.owners,old.owners);assert.equal(recovered.turnId,old.turnId);
 assert.equal(recoverLegacyQuiz(recovered,{question:q,now:now+2000}),undefined);
 const missing=recoverLegacyQuiz(old,{question:null,now});assert.equal(missing.phase,'next');assert.deepEqual(missing.owners,old.owners);
});

test('다른 팀 정답은 점령을 대신하지 않고 연구만 준다; 전원 미제출도 멈추지 않는다',()=>{
 const g=quiz(),n=settleQuiz(g,answers(g,[1,2,3,4]),ctx,g.quiz.deadline);
 assert.equal(n.owners[1],-1);assert.equal(n.phase,'next');assert.equal(n.skipTurns?.[0]||0,0);
 assert.deepEqual(Array.from({length:5},(_,t)=>researchOf(n,t)),[0,2,2,2,2]);
 const absent=settleQuiz(g,{},ctx,g.quiz.deadline);assert.equal(absent.phase,'next');assert.ok(absent.lastQuiz.teams.every(t=>!t.submitted));
 const moved=nextTurnState(absent,true,ctx);assert.equal(moved.team,1);assert.equal(moved.phase,'roll');
});

test('대표 이외·지난 차례 답은 보상되지 않고 연구는 최대20이다',()=>{
 const g=quiz();g.research={0:20,1:19};
 const a={...answers(g,[0,1]),s21:{team:2,turnId:g.turnId,choice:2},s30:{team:3,turnId:g.turnId-1,choice:2}};
 const n=settleQuiz(g,a,ctx,g.quiz.deadline);
 assert.equal(researchOf(n,0),20);assert.equal(researchOf(n,1),20);assert.equal(researchOf(n,2),0);assert.equal(researchOf(n,3),0);
});

function buildGame(){const g=quiz();g.owners[3]=1;g.research={1:7};g.decorationVersions={3:2};return g}
const request={authorUid:'s12',author:'작성자',ownerTeam:1,topic:3,level:2,territoryVersion:2,q:q.q,options:q.options,answer:2,explain:q.explain};
test('다른 팀 퀴즈 중 LV2·LV3 공사가 차례·문제를 보존하고 연구·점수는 한 번만 반영된다',()=>{
 const g=buildGame(),a=applyBuildTransform(g,request,{requestId:'R1',reviewerUid:'s13',now:9,originName:q.name});
 assert.equal(a.status,'applied');assert.equal(a.game.turnId,g.turnId);assert.equal(a.game.team,0);assert.equal(a.game.phase,'quiz');assert.deepEqual(a.game.quiz,g.quiz);
 assert.equal(a.game.research[1],5);assert.equal(buildBonus(a.game,1),2);assert.equal(landLevel(a.game,3),2);
 assert.equal(applyBuildTransform(a.game,request,{requestId:'R1',reviewerUid:'s13',now:10}).status,'already');
 const b=applyBuildTransform(a.game,{...request,level:3,icon:'tower',meaning:'우리 팀이 함께 공부한 역사를 기억하는 탑이에요.'},{requestId:'R2',reviewerUid:'s13',now:11});
 assert.equal(b.status,'applied');assert.equal(b.game.research[1],2);assert.equal(buildBonus(b.game,1),5);assert.equal(landLevel(b.game,3),3);
});

test('재점령·버전 충돌·연구 부족·자기 검토는 승급을 막고 기존 차례를 건드리지 않는다',()=>{
 const g=buildGame();
 for(const [game,req,reviewer,reason] of [
  [{...g,owners:g.owners.map((x,i)=>i===3?2:x)},request,'s13','owner'],
  [{...g,decorationVersions:{3:3}},request,'s13','version'],
  [{...g,research:{1:1}},request,'s13','research'],
  [g,request,'s12','review']
 ]){const n=applyBuildTransform(game,req,{requestId:'BAD',reviewerUid:reviewer,now:9});assert.equal(n.status,'rejected');assert.equal(n.reason,reason);assert.equal(game.phase,'quiz')}
});
