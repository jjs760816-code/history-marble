// 교실 동시 참여 규칙: 모든 팀이 같은 문제를 함께 풀고, 연구 포인트로 우리 땅을 공사합니다.
// 브라우저·Firebase 의존 없는 순수 함수와 HTML 문자열 도우미입니다. 확인: node --test test/classroom.test.mjs
// 공사 그림(야영지·배움터·탑 등)은 놀이용 가상 건물이며 역사적 사실을 주장하지 않습니다.
import {LAND_COUNT,rosterOf,teamLabel} from './game-config.mjs';

export const QUIZ_SECONDS=[30,45,60],DEFAULT_QUIZ_SECONDS=30,RESULT_SECONDS=[3,4,6,8],DEFAULT_RESULT_SECONDS=4;
export const THINK_MS=8000,CONFIRM_MS=10000,QUIZ_LEAD_MS=2600,SETTLE_GRACE_MS=1500,ATTEMPT_GRACE_MS=1000;
export const RESEARCH_CAP=20,ACTIVE_RESEARCH=1,OTHER_RESEARCH=2,OWN_LAND_RESEARCH=1;
export const BUILD_COST={2:2,3:3},BUILD_BONUS={2:2,3:3};
export const HOST_BEAT_MS=5000,HOST_STALE_MS=15000;
export const Q_MAX=200,OPTION_MAX=100,EXPLAIN_MAX=300,MEANING_MIN=10,MEANING_MAX=120;
export const STAGE_ART={1:{src:'assets/stage1-camp.svg',label:'1단계 · 깃발 야영지'},2:{src:'assets/stage2-academy.svg',label:'2단계 · 배움터(연구관)'}};
export const BUILD_ICONS={tower:{src:'assets/stage3-tower.svg',label:'3단계 · 전망 탑'},gate:{src:'assets/stage3-gate.svg',label:'3단계 · 큰 성문'},pavilion:{src:'assets/stage3-pavilion.svg',label:'3단계 · 기념 정자'}};
export const ART_NOTE='그림은 놀이용 가상 건물이에요(실제 유적 모습이 아니에요).';
// 팀 차례마다 한 칸씩 돌아가는 역할. 0번(대표)은 그 팀의 주사위 담당(currentPlayer)과 같은 학생
export const ROLES=[
 {key:'roller',icon:'🎲',name:'대표',task:'주사위를 굴리고, 문제 시간에 팀의 최종 답을 눌러요.'},
 {key:'reader',icon:'📖',name:'읽기·근거',task:'문제를 소리 내어 읽고 “왜 그 답인지” 근거를 말해요.'},
 {key:'author',icon:'✍️',name:'출제',task:'우리 땅 LV2 공사용 문제 초안을 써요.'},
 {key:'reviewer',icon:'🔍',name:'검토·꾸미기',task:'친구 문제를 검토하고 LV3 상징과 의미를 골라요.'}
];
export const HELPER={key:'helper',icon:'🤝',name:'도우미',task:'보기마다 맞는지 틀린지 함께 따져요.'};
export const BUILD_REASONS={finished:'게임이 끝나 공사를 할 수 없어요.',invalid:'요청 내용을 다시 확인해 주세요.',owner:'이 땅의 주인이 바뀌었어요. 초안은 남겨 둘게요.',version:'땅을 빼앗겼다가 다시 찾은 땅이라 이전 요청은 쓸 수 없어요. 초안은 남겨 둘게요.',level:'이미 공사가 끝났거나 이전 단계 공사가 먼저 필요해요.',research:'연구 포인트가 부족해요. 문제를 맞혀 연구를 모아 주세요.',review:'작성자가 아닌 친구(또는 선생님)의 검토가 필요해요.',busy:'우리 팀의 다른 공사가 먼저 검토 중이에요.',teacher:'선생님이 반려했어요.'};

const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const range=n=>Array.from({length:n},(_,i)=>i);
const list=v=>Array.isArray(v)?v:Object.values(v||{});
const bad=message=>({ok:false,message});

// 방 설정(config)에 저장된 문제 시간·결과 표시 시간. 없거나 잘못되면 30초·4초
export function quizSettings(config){
 const q=num(config?.quizSeconds),r=num(config?.resultSeconds);
 return {quizSeconds:QUIZ_SECONDS.includes(q)?q:DEFAULT_QUIZ_SECONDS,resultSeconds:RESULT_SECONDS.includes(r)?r:DEFAULT_RESULT_SECONDS};
}

// ── 땅·단계·연구 ──
export const ownerOf=(g,id)=>{const o=Number(g?.owners?.[id]??-1);return Number.isInteger(o)?o:-1};
export const versionOf=(g,id)=>num(g?.decorationVersions?.[id]);
// 0=빈 땅, 1=차지함, 2=배움터, 3=상징 건물. 주인·버전이 맞는 공사만 인정(재점령되면 1로)
export function landLevel(g,id){
 const owner=ownerOf(g,id);if(owner<0)return 0;
 const b=g?.buildings?.[id];
 if(b&&num(b.ownerTeam,-1)===owner&&num(b.version,-1)===versionOf(g,id)){const l=num(b.level,1);return l>=3?3:l>=2?2:1}
 return 1;
}
export const buildingOf=(g,id)=>landLevel(g,id)>=2?g.buildings[id]:null;
export function buildBonus(g,team){let s=0;for(let id=0;id<LAND_COUNT;id++){if(ownerOf(g,id)!==team)continue;const l=landLevel(g,id);if(l>=2)s+=BUILD_BONUS[2];if(l>=3)s+=BUILD_BONUS[3]}return s}
export const researchOf=(g,t)=>Math.max(0,Math.min(RESEARCH_CAP,num(g?.research?.[t])));
export function addResearch(research,team,amount){
 const before=Math.max(0,Math.min(RESEARCH_CAP,num(research?.[team]))),after=Math.min(RESEARCH_CAP,before+Math.max(0,num(amount)));
 return {research:{...(research||{}),[team]:after},gained:after-before};
}
export function stageArt(g,id){const l=landLevel(g,id);if(!l)return null;if(l<3)return STAGE_ART[l];return BUILD_ICONS[g.buildings[id].decoration?.icon]||BUILD_ICONS.tower}

// ── 문제 ──
export function validQuestion(q){const o=list(q?.options);return !!q&&typeof q.q==='string'&&q.q.length>0&&o.length===4&&Number.isInteger(Number(q.answer))&&Number(q.answer)>=0&&Number(q.answer)<=3}
// 승인된 LV2 문제 → 방의 원래 시대 문제 → 기본 문제. 검토 중인 요청은 쓰지 않음
export function questionFor(g,questions,fallback,id){
 const b=buildingOf(g,id);if(b?.question&&validQuestion(b.question))return b.question;
 const q=questions?.[id];return validQuestion(q)?q:(fallback?.(id)||null);
}

// ── 역할(팀 차례마다 회전) ──
export function teamRoles(d,g,team){
 const members=rosterOf(d,team),n=members.length;if(!n)return [];
 const offset=num(g?.playerIndices?.[team]??(num(g?.team)===team?g?.playerIndex:0))%n;
 return members.map(([uid,m],i)=>{const k=((i-offset)%n+n)%n,roles=[];for(let r=k;r<ROLES.length;r+=n)roles.push(ROLES[r]);if(!roles.length)roles.push(HELPER);return {uid,nickname:String(m?.nickname||''),roles,representative:k===0}});
}
// 팀별 대표 = 그 팀의 지금 주사위 담당(playerIndices 회전)
export function quizReps(d,g,teamCount){const reps={};for(let t=0;t<teamCount;t++){const r=teamRoles(d,g,t).find(x=>x.representative);if(r)reps[t]=r.uid}return reps}

// ── 이동 ──
// 호스트 트랜잭션 변환. 빈 땅·다른 팀 땅·예전 출제 대기 땅은 모두 같은 시대 문제로. 우리 땅이면 연구 +1 후 바로 다음
export function applyRoll(g,o){
 if(!g||g.phase!=='roll'||num(g.turnId)!==num(o.expectTurnId,-1))return;
 const {pair,now,spaces,teamCount,names}=o,team=num(g.team),steps=pair[0]+pair[1],bonusRoll=pair[0]===pair[1];
 const positions=range(teamCount).map(i=>num(g.positions?.[i])),laps=range(teamCount).map(i=>num(g.laps?.[i]));
 const abs=positions[team]+steps,at=abs%spaces.length;if(abs>=spaces.length)laps[team]++;positions[team]=at;
 const sp=spaces[at],turnId=num(g.turnId)+1,start=now+QUIZ_LEAD_MS,label=teamLabel(names[team]),cardPoints={...(g.cardPoints||{})};
 let lastCard=null;const card=sp.kind==='chance'||sp.kind==='event'?o.drawCard?.(sp.kind):null;
 if(card){lastCard={kind:sp.kind,title:card[0],text:card[1],points:card[2],team};cardPoints[team]=num(cardPoints[team])+card[2]}
 const base={...g,positions,laps,turnId,lastCard,cardPoints,lastRoll:steps,lastDice:pair,rollStartedAt:now,bonusRoll,studentTokens:null,quiz:null,restingTeam:null};
 const target=sp.kind==='property'?sp.id:null,resultMs=num(o.resultSeconds,DEFAULT_RESULT_SECONDS)*1000;
 if(target===null)return {...base,questionId:null,phase:'next',nextAt:start+(lastCard?resultMs+2000:1200),message:lastCard?'📜 '+label+' · '+lastCard.title+' · 국력 '+(lastCard.points>0?'+':'')+lastCard.points+'점':label+' '+steps+'칸 이동! 다음 차례로 넘어가요.'};
 if(ownerOf(g,target)===team){const r=addResearch(g.research,team,OWN_LAND_RESEARCH);return {...base,research:r.research,questionId:target,phase:'next',nextAt:start+1200,message:'🏠 '+label+' 우리 땅(거점 '+(target+1)+') 도착! 연구 +'+r.gained+' · 공사는 언제든 할 수 있어요.'}}
 const q=o.questionFor?.(target);
 if(!validQuestion(q))return {...base,questionId:target,phase:'next',nextAt:start+1200,message:'거점 '+(target+1)+' 문제 자료가 없어 다음 차례로 넘어가요.'};
 const seconds=QUIZ_SECONDS.includes(num(o.quizSeconds))?num(o.quizSeconds):DEFAULT_QUIZ_SECONDS;
 return {...base,questionId:target,phase:'quiz',nextAt:null,quiz:{turnId,questionId:target,activeTeam:team,startedAt:start,thinkUntil:start+THINK_MS,deadline:start+seconds*1000,seconds,reps:o.reps||{},question:{q:String(q.q),options:list(q.options).slice(0,4).map(String),answer:num(q.answer),explain:String(q.explain||''),name:String(q.name||'')}},message:'❓ 거점 '+(target+1)+' 문제! 모든 팀이 함께 풀어요. '+label+'이(가) 맞히면 땅을 차지해요.'};
}

// ── 동시 퀴즈 ──
export function quizStage(quiz,now){if(!quiz)return 'none';if(now<num(quiz.startedAt))return 'ready';if(now<num(quiz.thinkUntil))return 'think';if(now<num(quiz.deadline)-CONFIRM_MS)return 'discuss';if(now<num(quiz.deadline))return 'confirm';return 'closed'}
export const canConfirm=stage=>stage==='discuss'||stage==='confirm';
export const hostAttemptKey=t=>'host-'+t;
const validAttempt=(a,quiz,t)=>!!a&&num(a.turnId,-1)===num(quiz.turnId)&&num(a.team,-1)===t&&a.passed!==true&&Number.isInteger(a.choice)&&a.choice>=0&&a.choice<=3;
// 팀별 최종 답: 그 팀 대표의 답(교사는 도전 팀 대신 시연 가능, 더 늦게 고친 답을 씀). 없으면 null(=패스)
export function finalAnswers(attempts,quiz,teamCount){
 const out={};
 for(let t=0;t<teamCount;t++){
  const c=[],rep=quiz?.reps?.[t];
  if(rep&&validAttempt(attempts?.[rep],quiz,t))c.push(attempts[rep]);
  if(t===num(quiz?.activeTeam,-1)&&validAttempt(attempts?.[hostAttemptKey(t)],quiz,t))c.push(attempts[hostAttemptKey(t)]);
  c.sort((a,b)=>num(b.submittedAt)-num(a.submittedAt));out[t]=c.length?c[0].choice:null;
 }
 return out;
}
export const settleDueAt=g=>g?.phase==='quiz'&&g.quiz?num(g.quiz.deadline)+SETTLE_GRACE_MS:Infinity;
// 마감 뒤 한 번만(같은 turnId·quiz 단계일 때) 결과·점령·연구를 같은 트랜잭션으로 반영. 일찍 끝내지 않고, 틀리거나 빠져도 벌점 없음
export function settleQuiz(g,attempts,{teamCount,names},now,{resultSeconds=DEFAULT_RESULT_SECONDS}={}){
 const z=g?.quiz;
 if(!g||g.phase!=='quiz'||!z||num(z.turnId,-1)!==num(g.turnId)||now<num(z.deadline))return;
 if(g.lastQuiz&&num(g.lastQuiz.turnId,-1)===num(g.turnId))return;
 const q=z.question,id=num(z.questionId),active=num(z.activeTeam),answers=finalAnswers(attempts,z,teamCount),teams=[];
 let research={...(g.research||{})};
 for(let t=0;t<teamCount;t++){const choice=answers[t],correct=choice!==null&&choice===num(q.answer);let gained=0;if(correct){const r=addResearch(research,t,t===active?ACTIVE_RESEARCH:OTHER_RESEARCH);research=r.research;gained=r.gained}teams.push({choice:choice===null?-1:choice,submitted:choice!==null,correct,gained})}
 const owners=range(LAND_COUNT).map(i=>ownerOf(g,i)),versions={...(g.decorationVersions||{})},buildings={...(g.buildings||{})};
 const won=teams[active]?.correct===true,captured=won&&owners[id]!==active;
 if(captured){owners[id]=active;versions[id]=num(versions[id])+1;delete buildings[id]}
 const label=teamLabel(names[active]),place='거점 '+(id+1)+(q.name?'('+q.name+')':''),others=teams.filter((x,t)=>t!==active&&x.correct).length;
 const message=(captured?'🏯 '+label+' 정답! '+place+'을(를) 차지했어요(LV1).':'⏰ 마감! '+label+'은(는) 이번에는 땅을 얻지 못했어요(벌점 없음).')+(others?' 💎 다른 팀 '+others+'곳도 정답 · 연구 +'+OTHER_RESEARCH+'.':'');
 return {...g,owners,decorationVersions:versions,buildings,research,phase:'next',nextAt:now+num(resultSeconds,DEFAULT_RESULT_SECONDS)*1000,quiz:null,
  lastQuiz:{turnId:num(g.turnId),questionId:id,name:String(q.name||''),q:String(q.q),answer:num(q.answer),answerText:String(list(q.options)[num(q.answer)]??''),explain:String(q.explain||''),activeTeam:active,captured,teams,settledAt:now},message};
}
export function nextDueAt(g){if(g?.phase!=='next')return Infinity;const at=Number(g.nextAt);return Number.isFinite(at)&&at>0?at:num(g.rollStartedAt)+QUIZ_LEAD_MS+3000}

// 이전 버전 quiz에는 공통 기한이 없었음. 교사 재접속 때 문제·소유권을 유지하고 새 30/45/60초를 줌.
export function recoverLegacyQuiz(g,{question,reps,now,quizSeconds=30}){
 if(!g||g.phase!=='quiz'||g.quiz)return;
 if(!validQuestion(question))return {...g,phase:'next',nextAt:now+4000,message:'이전 문제 자료가 없어 다음 차례로 넘어가요. 소유권은 그대로예요.'};
 const seconds=QUIZ_SECONDS.includes(quizSeconds)?quizSeconds:30;
 return {...g,nextAt:null,quiz:{turnId:g.turnId,questionId:g.questionId,activeTeam:g.team,startedAt:now,thinkUntil:now+THINK_MS,deadline:now+seconds*1000,seconds,reps,question},message:'이전 문제를 모든 모둠이 함께 이어 풀어요. 제한 시간을 새로 드렸어요.'};
}

// ── 공사 ──
export function validateAuthoredQuestion(f){
 const q=String(f?.q??'').trim(),explain=String(f?.explain??'').trim(),options=list(f?.options).map(s=>String(s??'').trim()),answer=Number(f?.answer);
 if(!q||q.length>Q_MAX)return bad('문제를 1~200자로 써 주세요.');
 if(options.length!==4||options.some(o=>!o||o.length>OPTION_MAX))return bad('보기 4개를 한 줄에 하나씩, 각각 1~100자로 써 주세요.');
 if(new Set(options).size!==4)return bad('보기 4개가 서로 달라야 해요.');
 if(!Number.isInteger(answer)||answer<0||answer>3)return bad('정답 번호를 1~4 중에서 골라 주세요.');
 if(!explain||explain.length>EXPLAIN_MAX)return bad('해설을 1~300자로 써 주세요.');
 return {ok:true,value:{q,options,answer,explain}};
}
export function validateDecoration(f){
 const icon=String(f?.icon??''),meaning=String(f?.meaning??'').trim();
 if(!Object.hasOwn(BUILD_ICONS,icon))return bad('상징 그림을 하나 골라 주세요.');
 if(meaning.length<MEANING_MIN||meaning.length>MEANING_MAX)return bad('역사적 의미를 10~120자 한 줄로 써 주세요.');
 return {ok:true,value:{icon,meaning}};
}
const no=reason=>({ok:false,reason,message:BUILD_REASONS[reason]});
// 승인 직전·요청 직후 공통 검사: 주인·땅 버전·단계·연구 포인트·내용
export function buildPrecheck(g,req){
 if(!g||g.phase==='finished')return no('finished');
 const level=num(req?.level),id=num(req?.topic,-1),team=num(req?.ownerTeam,-1);
 if((level!==2&&level!==3)||!Number.isInteger(id)||id<0||id>=LAND_COUNT)return no('invalid');
 const v=level===2?validateAuthoredQuestion(req):validateDecoration(req);if(!v.ok)return {ok:false,reason:'invalid',message:v.message};
 if(ownerOf(g,id)!==team)return no('owner');
 if(versionOf(g,id)!==num(req.territoryVersion,-1))return no('version');
 if(landLevel(g,id)!==level-1)return no('level');
 if(researchOf(g,team)<BUILD_COST[level])return no('research');
 return {ok:true,value:v.value};
}
export function makeBuildRequest({uid,nickname,team,g,topic,level,fields,now}){
 const base={authorUid:uid,author:String(nickname||'참가자').slice(0,20),ownerTeam:team,topic:num(topic),level,territoryVersion:versionOf(g,topic),createdAt:now};
 if(level===2){const v=validateAuthoredQuestion(fields);return v.ok?{ok:true,request:{...base,...v.value}}:v}
 const v=validateDecoration(fields);return v.ok?{ok:true,request:{...base,...v.value}}:v;
}
// 교사 승인 트랜잭션 변환. 현재 차례·단계·팀·turnId는 그대로. 같은 요청 ID는 한 번만(재시도·재실행 안전)
export function applyBuildTransform(g,req,{requestId,reviewerUid,now,originName}){
 if(!g)return {status:'abort'};
 if(!requestId)return {status:'rejected',reason:'invalid',message:BUILD_REASONS.invalid};
 if(g.buildOps?.[requestId])return {status:'already'};
 if(!reviewerUid||reviewerUid===req?.authorUid)return {status:'rejected',...no('review')};
 const c=buildPrecheck(g,req);if(!c.ok)return {status:'rejected',reason:c.reason,message:c.message};
 const id=num(req.topic),team=num(req.ownerTeam),level=num(req.level),version=versionOf(g,id),prev=g.buildings?.[id]||{};
 const building=level===2
  ?{level:2,ownerTeam:team,version,requestId,author:String(req.author||''),authorUid:req.authorUid,reviewerUid,approvedAt:now,question:{...c.value,name:String(originName||'거점 '+(id+1))}}
  :{...prev,level:3,decoration:{...c.value,author:String(req.author||''),authorUid:req.authorUid,reviewerUid,requestId,approvedAt:now}};
 return {status:'applied',game:{...g,buildings:{...(g.buildings||{}),[id]:building},research:{...(g.research||{}),[team]:researchOf(g,team)-BUILD_COST[level]},buildOps:{...(g.buildOps||{}),[requestId]:now},lastBuild:{topic:id,level,team,at:now,requestId}}};
}
// 팀마다 가장 먼저 낸 요청만 검토. 나머지는 'busy'로 돌려보냄
export function busyRequests(requests){
 const first={},busy=[];
 for(const [key,r] of Object.entries(requests||{}).sort((a,b)=>num(a[1]?.createdAt)-num(b[1]?.createdAt)||(a[0]<b[0]?-1:1))){const t=num(r?.ownerTeam,-1);if(t in first)busy.push(key);else first[t]=key}
 return busy;
}
export const hostStatus=(beat,now)=>!beat?'unknown':now-num(beat)>HOST_STALE_MS?'stale':'ok';

// ── 화면 조각(HTML 문자열). esc는 HTML 이스케이프 함수 ──
const stageLabels={ready:'🎲 주사위 이동 중 · 곧 시작',think:'🤔 1단계 · 혼자 생각하기',discuss:'💬 2단계 · 팀 토의',confirm:'✅ 3단계 · 대표가 확정',closed:'⏰ 마감 · 결과 계산 중'};
export const researchHTML=n=>'<span class="research-badge" title="연구 포인트: 공사 재료(점수 아님) · 최대 '+RESEARCH_CAP+'"><span aria-hidden="true">💎</span> 연구 '+n+'/'+RESEARCH_CAP+' <progress max="'+RESEARCH_CAP+'" value="'+n+'" aria-label="연구 포인트 '+n+' / '+RESEARCH_CAP+'"></progress></span>';
export function quizHTML({g,d,uid,host,myTeam,now,names,esc,practice=null}){
 const z=g.quiz,q=z.question,stage=quizStage(z,now),active=num(z.activeTeam),answers=finalAnswers(d.attempts,z,names.length);
 const nick=id=>d.members?.[id]?.nickname||'대표 없음',rep=z.reps?.[myTeam],isRep=!host&&!!rep&&rep===uid,open=canConfirm(stage);
 const total=Math.max(0,Math.ceil((num(z.deadline)-now)/1000)),think=Math.max(0,Math.ceil((num(z.thinkUntil)-now)/1000));
 const teamPick=host?answers[active]:answers[myTeam];
 const buttons=list(q.options).map((o,i)=>{
  const final=(host||isRep)&&teamPick===i,mine=!host&&!isRep&&practice===i,attr=host||isRep?'data-answer="'+i+'"':'data-practice="'+i+'"';
  return '<button type="button" '+attr+' aria-pressed="'+(final||mine)+'" class="'+(final?'picked':mine?'practiced':'')+'"'+((host||isRep)&&!open||!host&&!isRep&&stage==='closed'?' disabled':'')+'>'+(final?'👉 ':mine?'✏️ ':'')+(i+1)+'. '+esc(o)+(final?' · 우리 팀 답':mine?' · 내 연습':'')+'</button>';
 }).join('');
 let me;
 if(host)me='👩‍🏫 선생님은 도전 팀('+esc(names[active])+') 대신 답을 눌러 시연할 수 있어요. 결과는 마감 때 한 번에 공개돼요.';
 else if(isRep)me=stage==='think'||stage==='ready'?'🤔 먼저 혼자 생각해요. 토의가 시작되면 대표인 내가 답을 눌러요.':'👉 나는 우리 팀 대표! 팀과 의논해 최종 답을 눌러요. 마감 전까지 바꿀 수 있어요.';
 else me=rep?'🗣️ 우리 팀 대표: <b>'+esc(nick(rep))+'</b>. 내 생각을 연습 답으로 골라 두고(내 화면에만 남아요) 근거를 말해 주세요.':'우리 팀 대표가 없어요. 선생님께 알려 주세요.';
 const reward=host?'':myTeam===active?'🏯 우리 팀이 맞히면 이 땅을 차지(LV1)하고 연구 +'+ACTIVE_RESEARCH+'!':'💎 다른 팀 땅 도전 문제지만 우리 팀도 맞히면 연구 +'+OTHER_RESEARCH+'!';
 const teamPickText=!host&&answers[myTeam]!==null?'<p class="quiz-pick" role="status">✅ 우리 팀 답 제출됨: '+(answers[myTeam]+1)+'번 (마감 때 공개)</p>':'';
 const rows=names.map((n,t)=>'<li>'+(t===active?'🏯 ':'')+esc(n)+' · 대표 '+esc(nick(z.reps?.[t]))+' · '+(answers[t]!==null?'✅ 제출함':'⏳ 고르는 중')+'</li>').join('');
 return '<div class="quiz-live" id="quizLive"><div class="quiz-head"><span class="quiz-stage stage-'+stage+'">'+stageLabels[stage]+'</span> <span id="quizClock" class="quiz-clock">⏱ '+(stage==='think'?'혼자 생각 '+think+'초 · ':'')+'남은 시간 '+total+'초</span></div><p class="quiz-land">📍 거점 '+(num(z.questionId)+1)+(q.name?' · '+esc(q.name):'')+' · 도전 팀: '+esc(names[active])+' · 모든 팀이 함께 풀어요</p><p class="quiz-q"><b>'+esc(q.q)+'</b></p><div class="choices" id="choices">'+buttons+'</div>'+teamPickText+'<p class="quiz-me">'+me+'</p><p class="muted">'+reward+' 미제출은 패스(벌점 없음).</p><ul class="quiz-teams" aria-label="팀별 제출 현황">'+rows+'</ul></div>';
}
export function resultHTML(lq,names,myTeam,esc,open=false){
 if(!lq)return '';
 const rows=names.map((n,t)=>{const x=lq.teams?.[t]||{};return '<li>'+esc(n)+(t===num(lq.activeTeam)?' (도전 팀)':'')+' · '+(x.correct?'⭕ 정답'+(x.gained?' · 💎 연구 +'+x.gained:' · 연구 최대치'):x.submitted?'✖ 오답('+(num(x.choice)+1)+'번)':'— 미제출 · 패스')+(t===myTeam?' ◀ 우리 팀':'')+'</li>'}).join('');
 return '<details class="quiz-result" id="lastQuizCard"'+(open?' open':'')+'><summary><b>📢 지난 문제 결과 · 거점 '+(num(lq.questionId)+1)+(lq.name?' · '+esc(lq.name):'')+'</b> · 눌러서 해설 보기</summary><p><b>정답: '+(num(lq.answer)+1)+'번 '+esc(lq.answerText)+'</b>'+(lq.captured?' · 🏯 '+esc(names[num(lq.activeTeam)])+' 땅 차지!':'')+'</p><p>'+esc(lq.explain)+'</p><ul>'+rows+'</ul></details>';
}
export function statusHTML({d,g,uid,myTeam,names,esc}){
 const roles=teamRoles(d,g,myTeam),me=roles.find(r=>r.uid===uid),rep=roles.find(r=>r.representative);
 return '<div class="my-status"><b>'+esc(names[myTeam])+'</b> '+researchHTML(researchOf(g,myTeam))+'<span class="my-role">'+(me?me.roles.map(r=>r.icon+' '+r.name).join(' · '):'역할 대기')+'</span><span>🎲 이번 대표: '+esc(rep?.nickname||'없음')+'</span></div>'+(me?'<p class="role-task">'+me.roles.map(r=>r.icon+' '+esc(r.task)).join(' ')+'</p>':'')+'<p class="team-roster" aria-label="우리 팀 역할">'+roles.map(r=>esc(r.nickname)+' '+r.roles.map(x=>x.icon).join('')).join(' · ')+'</p>';
}
export function buildPanelHTML({g,d,uid,myTeam,names,esc}){
 const mine=range(LAND_COUNT).filter(id=>ownerOf(g,id)===myTeam),reqs=Object.entries(d.buildRequests||{}),pending=reqs.find(([,r])=>num(r?.ownerTeam,-1)===myTeam);
 const lands=mine.length?mine.map(id=>{const l=landLevel(g,id),art=stageArt(g,id),dec=buildingOf(g,id)?.decoration,next=l===1?'다음: LV2 배움터 (연구 '+BUILD_COST[2]+' + 우리 문제)':l===2?'다음: LV3 상징 (연구 '+BUILD_COST[3]+' + 의미 한 줄)':'완성!';return '<li><img src="'+art.src+'" alt="'+esc(art.label)+'" width="40" height="40"> 거점 '+(id+1)+' · LV'+l+(dec?' · '+esc(dec.meaning):'')+' <small>'+next+'</small></li>'}).join(''):'<li>아직 우리 땅이 없어요. 우리 팀 차례에 문제를 맞히면 땅을 차지해요.</li>';
 const status=pending?'<p class="build-pending" role="status">⏳ 거점 '+(num(pending[1].topic)+1)+' LV'+pending[1].level+' 공사 요청: '+(d.buildReviews?.[pending[0]]?'👩‍🏫 선생님 승인 대기':'🔍 친구 검토 대기')+' · '+esc(pending[1].author)+'</p>':'';
 const reviews=reqs.filter(([k,r])=>num(r?.ownerTeam,-1)===myTeam&&r.authorUid!==uid&&!d.buildReviews?.[k]).map(([k,r])=>'<article class="review-item"><b>🔍 친구 검토: 거점 '+(num(r.topic)+1)+' LV'+r.level+' · '+esc(r.author)+'</b>'+(r.level===2?'<p>'+esc(r.q)+'</p><p class="muted">'+list(r.options).map((o,i)=>(i+1)+'. '+esc(o)).join(' / ')+' · 정답 '+(num(r.answer)+1)+'번</p><p class="muted">해설: '+esc(r.explain)+'</p>':'<p>'+esc(BUILD_ICONS[r.icon]?.label||'')+' · '+esc(r.meaning)+'</p>')+'<button type="button" data-review="'+esc(k)+'">✅ 사실·맞춤법 확인했어요</button></article>').join('');
 const acks=Object.entries(d.buildAcks?.[uid]||{}).map(([k,a])=>'<p class="build-ack '+(a.status==='approved'?'ok':'no')+'" role="status">'+(a.status==='approved'?'🎉 승인 완료: 거점 '+(num(a.topic)+1)+' LV'+a.level+' 공사!':'↩️ 반려: 거점 '+(num(a.topic)+1)+' LV'+a.level+' · '+esc(a.reason||'')+' (초안은 남아 있어요)')+' <button type="button" data-ack="'+esc(k)+'">확인</button></p>').join('');
 return '<h2>🏗️ 우리 땅 공사 <small>(차례와 상관없이 언제든)</small></h2>'+researchHTML(researchOf(g,myTeam))+'<p class="muted">LV2 배움터: 연구 '+BUILD_COST[2]+' + 우리 팀이 만든 문제(친구 검토 → 선생님 승인) → 점수 +'+BUILD_BONUS[2]+'. LV3 상징: 연구 '+BUILD_COST[3]+' + 상징 그림·의미 한 줄 → 점수 +'+BUILD_BONUS[3]+'. 연구 포인트는 점수가 아니라 공사 재료예요. 공사는 한 팀에 한 건씩 검토해요. '+ART_NOTE+'</p>'+acks+status+'<ul class="land-list">'+lands+'</ul>'+reviews;
}
export function teacherQueueHTML({g,d,names,esc,originName}){
 const reqs=Object.entries(d.buildRequests||{});
 if(!reqs.length)return '<p class="muted">검토할 공사 요청이 없어요. (요청이 오면 친구 검토 → 선생님 승인 순서예요. 기기 한 대 팀은 ‘선생님 검토+승인’을 쓰세요.)</p>';
 return reqs.map(([k,r])=>{const c=buildPrecheck(g,r),rev=d.buildReviews?.[k],t=num(r.ownerTeam,-1);
  return '<article><b>'+esc(names[t]||'?')+' · 거점 '+(num(r.topic)+1)+' ('+esc(originName(num(r.topic)))+') LV'+r.level+' · 작성 '+esc(r.author)+'</b>'+(r.level===2?'<p>'+esc(r.q)+'</p><p class="muted">'+list(r.options).map((o,i)=>(i+1)+'. '+esc(o)).join(' / ')+'</p><p class="muted">정답 '+(num(r.answer)+1)+'번 · 해설: '+esc(r.explain)+'</p>':'<p>'+esc(BUILD_ICONS[r.icon]?.label||'')+' · 의미: '+esc(r.meaning)+'</p>')+'<p class="muted">'+(c.ok?'✔ 연구·주인·단계 확인됨 (연구 '+BUILD_COST[r.level]+' 사용)':'⚠ '+esc(c.message||''))+' · '+(rev?'🔍 친구 검토 완료: '+esc(d.members?.[rev.reviewerUid]?.nickname||'검토자'):'🔍 친구 검토 전')+'</p><div class="actions">'+(rev?'<button class="primary" data-approve="'+esc(k)+'">✅ 승인</button>':'')+'<button data-approve-self="'+esc(k)+'">👩‍🏫 선생님 검토+승인</button><button data-reject="'+esc(k)+'">↩️ 반려(이유 입력)</button></div></article>';
 }).join('');
}
