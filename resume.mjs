// 같은 기기·브라우저에서 방에 다시 들어가기 위한 저장 도우미.
// 저장값은 화면 편의용일 뿐 권한이 아닙니다. Firebase 서버에서 hostUid·members/{uid}를 확인한 뒤에만 사용합니다.
import {MAX_TEAMS,roomConfig} from './game-config.mjs';
export const PROFILE_KEY='historyMarble.room.v1';
export const DRAFT_KEY='historyMarble.draft.v1';
const VERSION=1,ROOM=/^[A-Z0-9]{6}$/,PROFILE_AGE=14*864e5,DRAFT_AGE=12*36e5;
const DRAFT_FIELDS={q:200,opts:500,explain:300,answer:1,topic:2,landmarkName:24,landmarkImage:500};

// 저장소 접근이 막힌 환경(사생활 보호 모드 등)에서도 예외 없이 동작
export function safeStorage(getStorage){
 const s=()=>{try{return getStorage()}catch{return null}};
 return {
  get(k){try{return s()?.getItem(k)??null}catch{return null}},
  set(k,v){try{const t=s();if(!t)return false;t.setItem(k,v);return true}catch{return false}},
  remove(k){try{s()?.removeItem(k)}catch{}}
 };
}
export const normalizeRoom=code=>{const c=typeof code==='string'?code.trim().toUpperCase():'';return ROOM.test(c)?c:''};
const parse=raw=>{if(typeof raw!=='string'||raw.length>5000)return null;try{const v=JSON.parse(raw);return v&&typeof v==='object'&&!Array.isArray(v)?v:null}catch{return null}};

export function makeProfile({uid,room,host,nickname='',team=0,now=Date.now()}){
 return {v:VERSION,uid,room:normalizeRoom(room),host:!!host,nickname:host?'':String(nickname||'').slice(0,20),team:host?0:Number(team)||0,savedAt:now};
}
// 현재 Firebase uid에 묶인 올바른 저장값만 돌려줌
export function parseProfile(raw,uid,now=Date.now()){
 const p=parse(raw);
 if(!p||p.v!==VERSION||typeof uid!=='string'||!uid||p.uid!==uid)return null;
 const room=normalizeRoom(p.room);
 if(!room||room!==p.room||typeof p.host!=='boolean')return null;
 if(!Number.isFinite(p.savedAt)||p.savedAt>now+6e4||now-p.savedAt>PROFILE_AGE)return null;
 if(!p.host&&(typeof p.nickname!=='string'||p.nickname.length>20||!Number.isInteger(p.team)||p.team<0||p.team>=MAX_TEAMS))return null;
 return {v:VERSION,uid,room,host:p.host,nickname:p.host?'':p.nickname,team:p.host?0:p.team,savedAt:p.savedAt};
}
// invited: 주소의 ?room= 값. 같은 방이면 이어서, 다른 방이면 고르게 함(저장값은 아직 지우지 않음)
export function resumePlan({profile,invited}){
 const room=normalizeRoom(invited||'');
 if(profile&&(!room||room===profile.room))return {action:'resume',room:profile.room};
 if(profile&&room)return {action:'choose',room,saved:profile.room};
 return {action:'none',room};
}
// 서버에서 읽은 방 데이터로 저장값이 아직 유효한지 판정. ok:false는 확정된 무효(저장값 삭제 대상)
export function checkRoom(d,uid,host){
 if(!d||typeof d!=='object'||!d.hostUid)return {ok:false,reason:'missing-room',message:'이전 방이 없어졌어요. 방 코드를 확인하고 다시 입장해 주세요.'};
 if(host)return d.hostUid===uid?{ok:true}:{ok:false,reason:'not-host',message:'이 브라우저에는 이 방의 교사 권한이 없어요. 다시 입장해 주세요.'};
 if(d.hostUid===uid)return {ok:false,reason:'host-browser',message:'이 브라우저는 이 방의 교사로 접속 중이에요. 학생은 다른 기기에서 입장해 주세요.'};
 const m=d.members?.[uid];
 if(!m)return {ok:false,reason:'missing-member',message:'이전 참가 정보가 없어요. 별명과 나라를 선택해 다시 입장해 주세요.'};
 if(m.leaving===true)return {ok:false,reason:'leaving',message:'팀에서 나가는 중이었어요. 나라를 다시 선택해 입장해 주세요.'};
 // 팀 범위는 그 방의 설정(없으면 기존 4팀)으로 판정
 const team=Number(m.team);
 if(!Number.isInteger(team)||team<0||team>=roomConfig(d).teamCount||typeof m.nickname!=='string')return {ok:false,reason:'bad-member',message:'참가 정보가 올바르지 않아요. 다시 입장해 주세요.'};
 return {ok:true,member:{nickname:m.nickname,team}};
}
// 작성 중인 문제·꾸미기 초안: 같은 uid·같은 방에서만 되살림. 자동 제출은 하지 않음
export function makeDraft({uid,room,fields,now=Date.now()}){
 const out={};for(const [k,max] of Object.entries(DRAFT_FIELDS))out[k]=String(fields?.[k]??'').slice(0,max);
 return {v:VERSION,uid,room:normalizeRoom(room),fields:out,savedAt:now};
}
export function parseDraft(raw,uid,room,now=Date.now()){
 const d=parse(raw);
 if(!d||d.v!==VERSION||!uid||d.uid!==uid||!room||d.room!==normalizeRoom(room)||!d.fields||typeof d.fields!=='object')return null;
 if(!Number.isFinite(d.savedAt)||now-d.savedAt>DRAFT_AGE||d.savedAt>now+6e4)return null;
 const out={};for(const [k,max] of Object.entries(DRAFT_FIELDS)){const v=d.fields[k];if(v!==undefined&&(typeof v!=='string'||v.length>max))return null;out[k]=v||''}
 if(out.answer&&!/^[1-4]$/.test(out.answer))out.answer='';
 if(out.topic&&!/^\d{1,2}$/.test(out.topic))out.topic='';
 return out;
}
export const draftIsEmpty=f=>!f||Object.entries(f).every(([k,v])=>!v||k==='answer'||k==='topic');
