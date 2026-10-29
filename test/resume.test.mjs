// 같은 기기 재입장 도우미 확인: node --test test/resume.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PROFILE_KEY,DRAFT_KEY,safeStorage,normalizeRoom,makeProfile,parseProfile,resumePlan,checkRoom,makeDraft,parseDraft,draftIsEmpty} from '../resume.mjs';

const now=Date.UTC(2026,9,27);
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};

test('저장값은 같은 Firebase uid에서만 쓰여요',()=>{
 const raw=JSON.stringify(makeProfile({uid:'u1',room:'ab12cd',host:false,nickname:'역사탐험가',team:2,now}));
 const p=parseProfile(raw,'u1',now);
 assert.deepEqual(p,{v:1,uid:'u1',room:'AB12CD',host:false,nickname:'역사탐험가',team:2,savedAt:now});
 assert.equal(parseProfile(raw,'other',now),null);
 assert.equal(parseProfile(raw,null,now),null);
});

test('깨지거나 오래되었거나 형식이 다른 저장값은 버려요',()=>{
 const good=makeProfile({uid:'u1',room:'AB12CD',host:false,nickname:'a',team:1,now});
 for(const bad of ['{nope',null,'[]',JSON.stringify({...good,v:2}),JSON.stringify({...good,room:'AB'}),JSON.stringify({...good,host:'1'}),JSON.stringify({...good,team:7}),JSON.stringify({...good,savedAt:now-15*864e5}),JSON.stringify({...good,nickname:'x'.repeat(21)})])
  assert.equal(parseProfile(bad,'u1',now),null,String(bad));
 const teacher=parseProfile(JSON.stringify(makeProfile({uid:'u1',room:'AB12CD',host:true,now})),'u1',now);
 assert.equal(teacher.host,true);
});

test('같은 방 초대 링크는 이어서 입장, 다른 방 링크는 고르게 하고 저장값을 지우지 않아요',()=>{
 const profile={room:'AB12CD'};
 assert.deepEqual(resumePlan({profile,invited:''}),{action:'resume',room:'AB12CD'});
 assert.deepEqual(resumePlan({profile,invited:'ab12cd'}),{action:'resume',room:'AB12CD'});
 assert.deepEqual(resumePlan({profile,invited:'ZZ99ZZ'}),{action:'choose',room:'ZZ99ZZ',saved:'AB12CD'});
 assert.deepEqual(resumePlan({profile:null,invited:'ZZ99ZZ'}),{action:'none',room:'ZZ99ZZ'});
 assert.deepEqual(resumePlan({profile:null,invited:'<bad>'}),{action:'none',room:''});
});

test('서버의 hostUid·members/{uid}로만 재입장 여부를 정해요',()=>{
 const d={hostUid:'teacher',members:{teacher:{nickname:'선생님',team:0},s1:{nickname:'별',team:3},s2:{nickname:'달',team:1,leaving:true}}};
 assert.deepEqual(checkRoom(d,'s1',false),{ok:true,member:{nickname:'별',team:3}});
 assert.equal(checkRoom(d,'teacher',true).ok,true);
 assert.equal(checkRoom(d,'s1',true).reason,'not-host');           // 저장값의 host 표시만으로 교사 권한 없음
 assert.equal(checkRoom(d,'teacher',false).reason,'host-browser');
 assert.equal(checkRoom(d,'nobody',false).reason,'missing-member');
 assert.equal(checkRoom(d,'s2',false).reason,'leaving');
 assert.equal(checkRoom(null,'s1',false).reason,'missing-room');
 assert.equal(checkRoom({members:{}},'s1',false).reason,'missing-room');
 assert.equal(checkRoom({hostUid:'t',members:{s1:{nickname:'x',team:'9'}}},'s1',false).reason,'bad-member');
});

test('5팀: 저장값 팀 4는 유효, 7은 무효이고 서버 방 설정으로 다시 판정해요',()=>{
 const p=parseProfile(JSON.stringify(makeProfile({uid:'u1',room:'AB12CD',host:false,nickname:'a',team:4,now})),'u1',now);
 assert.equal(p.team,4);
 assert.equal(parseProfile(JSON.stringify(makeProfile({uid:'u1',room:'AB12CD',host:false,nickname:'a',team:7,now})),'u1',now),null);
 const m={s1:{nickname:'x',team:4}};
 assert.equal(checkRoom({hostUid:'t',members:m},'s1',false).reason,'bad-member');
 assert.deepEqual(checkRoom({hostUid:'t',config:{scenario:'goryeo',teamCount:5},members:m},'s1',false),{ok:true,member:{nickname:'x',team:4}});
 assert.equal(checkRoom({hostUid:'t',config:{scenario:'three',teamCount:3},members:{s1:{nickname:'x',team:3}}},'s1',false).reason,'bad-member');
});

test('초안은 같은 uid·같은 방에서만 되살려요',()=>{
 const raw=JSON.stringify(makeDraft({uid:'u1',room:'AB12CD',fields:{q:'문제',opts:'1\n2\n3\n4',explain:'해설',answer:'2',topic:'5',landmarkName:'',landmarkImage:''},now}));
 assert.equal(parseDraft(raw,'u1','AB12CD',now).q,'문제');
 assert.equal(parseDraft(raw,'u2','AB12CD',now),null);
 assert.equal(parseDraft(raw,'u1','ZZ99ZZ',now),null);
 assert.equal(parseDraft(raw,'u1','AB12CD',now+13*36e5),null);
 assert.equal(parseDraft('{oops','u1','AB12CD',now),null);
 assert.equal(parseDraft(JSON.stringify({...JSON.parse(raw),fields:{q:'x'.repeat(201)}}),'u1','AB12CD',now),null);
 assert.equal(parseDraft(JSON.stringify({...JSON.parse(raw),fields:{answer:'9',topic:'abc'}}),'u1','AB12CD',now),null);
 assert.equal(draftIsEmpty({q:'',answer:'1',topic:'3'}),true);
 assert.equal(draftIsEmpty({q:'a'}),false);
});

test('저장소 접근이 막혀도 예외 없이 동작해요',()=>{
 const denied=safeStorage(()=>{throw new Error('SecurityError')});
 assert.equal(denied.get(PROFILE_KEY),null);
 assert.equal(denied.set(PROFILE_KEY,'x'),false);
 denied.remove(DRAFT_KEY);
 const throwing=safeStorage(()=>({getItem(){throw 1},setItem(){throw 1},removeItem(){throw 1}}));
 assert.equal(throwing.get('a'),null);assert.equal(throwing.set('a','b'),false);throwing.remove('a');
 const ok=safeStorage(()=>mem());
 assert.equal(normalizeRoom(' ab12cd '),'AB12CD');assert.equal(normalizeRoom('ab'),'');
 assert.equal(typeof ok.set,'function');
});

test('app.js: 교사 권한 확인·학생 처리 흐름이 그대로이고 저장값은 서버 확인 뒤에만 사용해요',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/snapshot\.val\(\)\.hostUid!==uid\)throw Error\('이 방의 교사 권한이 없습니다/);
 assert.match(app,/const check=checkRoom\(d,uid,p\.host\)/);
 assert.match(app,/await auth\.authStateReady\(\)/);
 assert.match(app,/ref\(db,'\.info\/connected'\)/);
 assert.doesNotMatch(app,/sessionStorage\.setItem\('historyRoom'/);
 for(const fn of ['processAttempts','processRollRequests','processAuthoringRequests','processCompletedQuestions','processLandmarkProposals','processLeavingMembers'])assert.match(app,new RegExp('async function '+fn));
});
