// 방별 시대·팀 설정과 차례 진행 규칙을 위한 순수 도우미(브라우저·Firebase 의존 없음).
// 확인: node --test test/game-flow.test.mjs test/turn-alert.test.mjs
export const LEGACY_TEAM_COUNT=4,MIN_TEAMS=2,MAX_TEAMS=5,NEW_ROOM_TEAM_COUNT=5,DEFAULT_SCENARIO='three',NAME_MAX=20,LAND_COUNT=24;
export const LEGACY_NAMES=['고구려','백제','신라','가야'];
// 팀 이름은 시대 주제를 딴 놀이용 이름입니다. 그 시대에 다섯 나라가 있었다는 뜻이 아닙니다.
export const SCENARIOS={
 prehistory:{label:'선사 시대',teams:['뗀석기팀','주먹도끼팀','먹거리팀','이동 생활팀','전곡리 유적팀']},
 three:{label:'삼국 시대',teams:['고구려','백제','신라','가야','우산국'],countries:true},
 northsouth:{label:'남북국 시대',teams:['신라팀','발해팀','불국사팀','장보고팀','대조영팀']},
 goryeo:{label:'고려',teams:['청자팀','팔만대장경팀','직지팀','개경팀','강화도팀']},
 'joseon-early':{label:'조선 전기',teams:['한글팀','경복궁팀','측우기팀','앙부일구팀','집현전팀']},
 'joseon-late':{label:'조선 후기',teams:['이순신팀','거북선팀','권율팀','곽재우팀','의병팀']},
 opening:{label:'개항기',teams:['흥선 대원군팀','경복궁 중건팀','병인양요팀','신미양요팀','강화도 조약팀']},
 occupation:{label:'일제 강점기',teams:['3·1 운동팀','유관순팀','독립선언서팀','임시 정부팀','상하이팀']},
 republic:{label:'광복과 대한민국 수립',teams:['광복팀','38도선팀','김구팀','5·10 총선거팀','통일 정부팀']}
};
export const SCENARIO_KEYS=Object.keys(SCENARIOS);
// 팀 색: 배경·테두리·말 색. 한국어 클래스 이름 대신 team-0~4로 씁니다.
export const TEAM_COLORS=[
 {bg:'#e0f1e4',border:'#4a8e63',horse:'#bce8c8'},
 {bg:'#ffe1e1',border:'#d45559',horse:'#ffc3c5'},
 {bg:'#fff1c1',border:'#d5a42a',horse:'#ffe59a'},
 {bg:'#eee2ff',border:'#9967cb',horse:'#dec5ff'},
 {bg:'#dcf1f7',border:'#2a8aa3',horse:'#aee2ef'}
];
const range=n=>Array.from({length:n},(_,i)=>i);
const validCount=n=>Number.isInteger(n)&&n>=MIN_TEAMS&&n<=MAX_TEAMS;
export const defaultOrder=n=>range(n);
// '청자팀'처럼 이미 '팀'으로 끝나면 덧붙이지 않음
export const teamLabel=name=>{const s=String(name??'');return /팀$/.test(s)?s:s+' 팀'};
export function cleanTeamName(v){if(typeof v!=='string')return '';const s=v.trim().replace(/\s+/g,' ');return s.length>=1&&s.length<=NAME_MAX&&!/[<>&"'`]/.test(s)?s:''}
export const presetNames=(scenario,count=NEW_ROOM_TEAM_COUNT)=>(SCENARIOS[scenario]||SCENARIOS[DEFAULT_SCENARIO]).teams.slice(0,count);
function describe(c){const s=SCENARIOS[c.scenario];return {...c,label:s.label,countries:c.legacy||!!s.countries,colors:TEAM_COLORS.slice(0,c.teamCount)}}
// 설정이 없는 기존 방: 네 나라·원래 규칙
export const legacyConfig=()=>describe({scenario:DEFAULT_SCENARIO,teamCount:LEGACY_TEAM_COUNT,teamNames:[...LEGACY_NAMES],legacy:true});
// 교사가 새 방을 만들 때 고른 값 검사. 빈 이름은 시대 기본 이름으로 채움
export function buildRoomConfig({scenario=DEFAULT_SCENARIO,teamCount=NEW_ROOM_TEAM_COUNT,teamNames=[]}={},now=Date.now()){
 if(!Object.hasOwn(SCENARIOS,scenario))return {ok:false,message:'시대를 다시 선택해 주세요.'};
 const n=Number(teamCount);if(!validCount(n))return {ok:false,message:'팀 수는 2~5팀 중에서 골라 주세요.'};
 const preset=presetNames(scenario,n),list=range(n).map(i=>{const raw=teamNames?.[i];return raw==null||String(raw).trim()===''?preset[i]:cleanTeamName(String(raw))});
 if(list.some(x=>!x))return {ok:false,message:'팀 이름은 1~20자로 입력하고 < > & " \' ` 기호는 빼 주세요.'};
 if(new Set(list).size!==n)return {ok:false,message:'팀 이름이 서로 겹치지 않게 입력해 주세요.'};
 return {ok:true,config:{version:1,scenario,teamCount:n,teamNames:list,createdAt:now}};
}
// 방에 저장된 설정 읽기. 팀 수가 올바르지 않으면 보안 규칙과 똑같이 기존 4팀으로 봄
export function roomConfig(d){
 const c=d?.config;
 if(!c||typeof c!=='object'||Array.isArray(c)||!validCount(c.teamCount))return legacyConfig();
 const n=c.teamCount,scenario=Object.hasOwn(SCENARIOS,c.scenario)?c.scenario:DEFAULT_SCENARIO;
 let list=range(n).map(i=>cleanTeamName(c.teamNames?.[i]));
 if(list.some(x=>!x)||new Set(list).size!==n)list=presetNames(scenario,n);
 return describe({scenario,teamCount:n,teamNames:list,legacy:false});
}
export const isTeamIndex=(team,cfg)=>Number.isInteger(team)&&team>=0&&team<cfg.teamCount;
// 새 방 삼국 시대는 원래 기본 24문제, 다른 시대는 준비된 시대별 24문제. 없으면 빈 목록(삼국 문제로 대신하지 않음)
export function questionBankFor(cfg,defaults,scenarios){
 if(cfg.legacy||cfg.scenario==='three')return defaults;
 const bank=scenarios?.[cfg.scenario];
 return Array.isArray(bank)&&bank.length>=LAND_COUNT?bank.slice(0,LAND_COUNT):[];
}
// 기회·사건 카드: 숫자 효과는 기존 카드 값 그대로, 설명은 그 시대 문제 해설을 재사용
export const CHANCE_POINTS=[3,2,2,3,2,2,3,3],EVENT_POINTS=[-2,-2,-1,-1,2,1,1,2];
export function historyCardsFor(cfg,legacyCards,bank){
 if(cfg.legacy||cfg.scenario==='three')return legacyCards;
 const topics=[];
 for(const q of bank||[]){
  if(!q||typeof q.name!=='string'||typeof q.explain!=='string'||topics.some(t=>t[0]===q.name))continue;
  const pick=(bank.find(x=>x?.name===q.name&&typeof x.explain==='string'&&x.explain.startsWith(q.name+': ')&&!x.explain.includes('(가)'))||q).explain;
  topics.push([q.name,pick.startsWith(q.name+': ')?pick.slice(q.name.length+2):pick]);
 }
 if(!topics.length)return {chance:[['역사 탐구','이 시대의 인물·유물·사건을 친구와 함께 떠올려 보세요.',2]],event:[['역사 탐구','이 시대의 인물·유물·사건을 친구와 함께 떠올려 보세요.',1]]};
 return {chance:topics.map(([t,x],i)=>[t,x,CHANCE_POINTS[i%CHANCE_POINTS.length]]),event:topics.map(([t,x],i)=>[t,x,EVENT_POINTS[i%EVENT_POINTS.length]])};
}
export function initialGame(teamCount,now=Date.now(),message='팀별로 시작 순서 주사위를 굴려 주세요.'){
 const zeros=Array(teamCount).fill(0);
 return {positions:zeros,bonusRoll:false,lastDice:null,rollStartedAt:0,owners:Array(LAND_COUNT).fill(-1),laps:[...zeros],team:0,orderTurn:0,orderRolls:{},order:defaultOrder(teamCount),playerIndex:0,playerIndices:Object.fromEntries(range(teamCount).map(i=>[i,0])),phase:'order',turnId:0,startedAt:now,message};
}
export const rosterOf=(d,t)=>Object.entries(d?.members||{}).filter(([id,m])=>id!==d.hostUid&&Number(m?.team)===t).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0));
export const currentPlayer=(d,g)=>{const list=rosterOf(d,g?.team||0),index=Number(g?.playerIndices?.[g?.team]??g?.playerIndex??0);return list.length?list[index%list.length][0]:null};
export const firstPlayerOf=(d,t)=>rosterOf(d,t)[0]?.[0]||null;
export const startOrder=rolls=>Object.keys(rolls||{}).map(Number).sort((a,b)=>rolls[b]-rolls[a]);
// 시작 순서 주사위 한 번의 결과. 같은 숫자가 있으면 모두 다시 굴림
export function orderRollPatch(g,pair,{teamCount,names},now=Date.now()){
 const value=pair[0]+pair[1],turn=Number(g.orderTurn||0),rolls={...(g.orderRolls||{}),[turn]:value},base={lastRoll:value,lastDice:pair,rollStartedAt:now};
 if(turn<teamCount-1)return {...base,orderRolls:rolls,orderTurn:turn+1,message:teamLabel(names[turn])+' '+value+'! 다음 팀이 굴려 주세요.'};
 const order=startOrder(rolls),tie=order.some((x,i)=>i>0&&rolls[x]===rolls[order[i-1]]);
 if(tie)return {...base,orderRolls:{},orderTurn:0,message:'같은 숫자가 나왔습니다. 공정하게 다시 굴려 주세요.'};
 return {...base,order,team:order[0],orderTurn:teamCount,phase:'roll',message:'시작 순서: '+order.map(t=>names[t]).join(' → ')};
}
const orderOf=(g,teamCount)=>{const o=Object.values(g.order||{}).map(Number);return o.length?o:defaultOrder(teamCount)};
// 다음 차례 계산. force면 더블이어도 다음 팀으로 넘김
export function nextTurnState(g,force,{teamCount,names}){
 const order=orderOf(g,teamCount),bonus=!force&&g.bonusRoll;const nextTeam=bonus?g.team:order[(order.indexOf(g.team)+1)%order.length],indices={...(g.playerIndices||{})};if(!bonus)indices[g.team]=Number(indices[g.team]??g.playerIndex??0)+1;const skipTurns={...(g.skipTurns||{})},rest=Number(skipTurns[nextTeam]||0)>0;if(rest)skipTurns[nextTeam]--;
 return {...g,team:nextTeam,turnId:Number(g.turnId||0)+1,playerIndex:Number(indices[nextTeam]||0),playerIndices:indices,skipTurns,restingTeam:rest?nextTeam:null,bonusRoll:false,phase:rest?'next':'roll',questionId:null,message:rest?'💤 '+teamLabel(names[nextTeam])+'은(는) 이번 차례를 쉽니다. 다음 순서로 넘어갑니다.':bonus?'🎉 더블! '+teamLabel(names[nextTeam])+'이(가) 한 번 더 굴립니다.':teamLabel(names[nextTeam])+' 차례입니다.'};
}
// 출제(author)·출제 대기(wait) 자동 넘김
export const AUTO_HANDOFF_PHASES=['author','wait'];
export const handoffKey=g=>[g?.turnId,g?.team,g?.phase,g?.questionId].join(':');
export function shouldAutoHandoff(d,g){
 if(!g||!AUTO_HANDOFF_PHASES.includes(g.phase))return false;
 if(g.phase==='wait')return true;
 const claim=d?.pendingClaims?.[g.questionId];
 return !!claim&&Number(claim.team)===Number(g.team)&&Number(g.owners?.[g.questionId]??-1)<0;
}
// 트랜잭션 변환: 예상한 차례·단계·팀·거점이 그대로일 때만 한 번 넘김(중복 스냅숏·새로고침·요청에도 한 번).
// 출제(author)에 들어가면 더블이어도 다음 팀으로 넘김. 출제 대기(wait)는 원래 더블 규칙(같은 팀 한 번 더)을 그대로 따름.
// 출제 대기 거점(pendingClaims)은 건드리지 않으므로 출제 팀은 계속 문제를 쓸 수 있음.
export function handoffTransform(old,expected,ctx){
 if(!old||!expected||!AUTO_HANDOFF_PHASES.includes(old.phase)||old.phase!==expected.phase||old.turnId!==expected.turnId||old.team!==expected.team||old.questionId!==expected.questionId)return;
 const author=old.phase==='author',land=Number(old.questionId)+1,next=nextTurnState(author?{...old,bonusRoll:false}:old,author,ctx);
 return {...next,message:(author?'📝 '+teamLabel(ctx.names[old.team])+'이(가) 거점 '+land+' 문제를 출제하는 동안 ':'⏳ 거점 '+land+'은(는) 다른 팀이 출제 중이에요. ')+next.message};
}
// 출제 완료 반영: 거점 주인만 출제 팀으로(빈 거점일 때 한 번). 지금 다른 팀의 차례·단계·문제·turnId는 그대로 둠
export function completeClaimTransform(g,id,claimTeam,ctx){
 const topic=Number(id),team=Number(claimTeam);
 if(!g||g.phase==='finished'||Number(g.owners?.[topic])!==-1||!isTeamIndex(team,ctx))return;
 const owners=[...Object.values(g.owners)];owners[topic]=team;
 const finish=Number(g.team)===team&&Number(g.questionId)===topic&&(g.phase==='author'||g.phase==='wait');
 if(!finish)return {...g,owners};
 return {...g,owners,phase:'next',bonusRoll:false,message:'✅ '+teamLabel(ctx.names[team])+'이(가) 거점 '+(topic+1)+' 문제를 완성해 자동 점령했습니다.'};
}
// 개인 차례 알림: 지금 주사위를 굴릴 바로 그 학생만(같은 팀 친구·교사·다른 팀 제외)
export function turnAlertTarget({room,uid,host,d,g}){
 const none={eligible:false,key:''};
 if(host||!uid||!room||!d||!g)return none;
 let team,actor;
 if(g.phase==='order'){team=Number(g.orderTurn||0);actor=firstPlayerOf(d,team)}
 else if(g.phase==='roll'){team=Number(g.team||0);actor=currentPlayer(d,g)}
 else return none;
 if(!actor||actor!==uid)return none;
 return {eligible:true,team,phase:g.phase,key:[room,Number(g.startedAt||0),g.phase,Number(g.turnId||0),team,actor,g.phase==='order'?Number(g.orderTurn||0)+'@'+Number(g.rollStartedAt||0):''].join(':')};
}
// 같은 차례 키는 한 번만 띄움. 닫은 뒤 관계없는 스냅숏이 와도 다시 열지 않음. 화면이 보이지 않을 때는 미뤘다가 보일 때 띄움
export function createTurnAlert(seenKey=''){
 const seen=new Set(seenKey?[seenKey]:[]);let open='';
 return {
  update({eligible,key,pending=false,visible=true}){
   const want=eligible&&!pending&&key?key:'';
   if(open&&open!==want){open='';if(!want||seen.has(want)||!visible)return {action:'close'}}
   if(!want||seen.has(want)||!visible)return {action:'none'};
   seen.add(want);open=want;return {action:'open',key:want};
  },
  dismiss(){const was=!!open;open='';return was},
  get open(){return open}
 };
}
