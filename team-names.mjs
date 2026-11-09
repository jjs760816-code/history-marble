import {roomConfig,validateTeamNames} from './game-config.mjs?v=20261109-team-names2';
// 진행 신호·답 제출로 화면이 갱신돼도 입력 중인 이름은 덮어쓰지 않습니다.
export function createTeamNameEditor(onSave){
 let root,inputs=[],latest=[],base=[],dirty=false,saving=false,roomKey='',status,save;
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const sync=()=>{if(!root)return;const stale=dirty&&!equal(base,latest);if(!dirty)inputs.forEach((x,i)=>x.value=latest[i]);save.disabled=saving||stale||!dirty;inputs.forEach(x=>x.disabled=saving);if(stale)status.textContent='다른 화면에서 팀 이름이 바뀌었어요. 최신 이름 불러오기를 눌러 주세요.';};
 return {render(data,host,anchor,key){
  if(!root){root=document.createElement('section');root.id='teamNameEditor';root.className='panel';anchor.before(root);}
  root.hidden=!host;root.classList.toggle('hidden',!host);if(!host)return;
  latest=roomConfig(data).teamNames;
  if(roomKey!==key||inputs.length!==latest.length){
   roomKey=key;dirty=false;root.replaceChildren();inputs=[];
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='✏️ 참가팀 이름 변경 (관리자)';details.append(summary);
   const note=document.createElement('p');note.className='muted';note.textContent='이름만 바뀌고 팀 번호·참가자·점수·땅·말 위치는 그대로예요. 학생 화면에도 함께 반영돼요.';details.append(note);
   const form=document.createElement('form');form.className='team-name-form';
   latest.forEach((name,i)=>{const label=document.createElement('label');label.textContent=(i+1)+'번 팀 이름';const input=document.createElement('input');input.value=name;input.maxLength=20;input.style.minHeight='44px';input.required=true;input.style.width='100%';input.style.boxSizing='border-box';input.addEventListener('input',()=>{if(!dirty)base=[...latest];dirty=true;status.textContent='';sync();});label.append(input);form.append(label);inputs.push(input);});
   status=document.createElement('p');status.setAttribute('role','status');status.style.overflowWrap='anywhere';form.append(status);
   const actions=document.createElement('div');actions.className='actions';save=document.createElement('button');save.type='submit';save.style.minHeight='44px';save.className='primary';save.textContent='팀 이름 저장';const reload=document.createElement('button');reload.type='button';reload.style.minHeight='44px';reload.textContent='최신 이름 불러오기';reload.onclick=()=>{if(saving)return;dirty=false;status.textContent='최신 이름을 불러왔어요.';sync();};actions.append(save,reload);form.append(actions);
   form.onsubmit=async e=>{e.preventDefault();if(saving||!dirty)return;const v=validateTeamNames(inputs.map(x=>x.value),latest.length);if(!v.ok){status.textContent=v.message;return;}saving=true;sync();try{await onSave(v.names,base);if(equal(latest,base))latest=[...v.names];dirty=false;status.textContent='팀 이름이 저장됐어요. 학생 화면에도 반영됩니다.';}catch(e){status.textContent=e.message||'저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.';}finally{saving=false;sync();}};
   details.append(form);root.append(details);
  }
  sync();
 }};
}
