import {subjects,escape,icon} from './ui.js';
import {emptyState,normalizeState,poolFor,makeQueue,newSession,advance,sessionCard,mergeProgress,mergeLatestCards,choiceOrder,isDue} from './bite-engine.mjs';
import {refreshOfflineStatus} from './offline.js';

const STORAGE='csat-bites-v1';
const kindNames={choice:'판단 하나',recall:'떠올리기',tip:'공부 팁',vocab:'영단어'};
const options={delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false,strict:'ignore',trust:false};
const routeFor=filters=>'#/bites?'+new URLSearchParams(Object.entries(filters).map(([k,v])=>[k,String(v)]));
const refTitle=ref=>{const [,year,month]=ref.paperId.split('-');return `${year}학년도 ${month==='11' ? '수능' : `${Number(month)}월`} ${ref.number}번`;};

export function createBites(data,articles,markdown) {
  const cards=data.cards, ids=cards.map(c=>c.id), byId=new Map(cards.map(c=>[c.id,c])), notes=new Map(articles.map(a=>[a.id,a]));
  let state=emptyState(), storageWarning='', activePreview=null, host=null, lastParts=[], lastParams=new URLSearchParams(),settingsOpen=false,pendingFocus=null,speechToken=0;
  const stopSpeech=()=>{speechToken++;if ('speechSynthesis' in window) speechSynthesis.cancel();};
  try {state=normalizeState(JSON.parse(localStorage.getItem(STORAGE) || 'null'),ids);} catch {storageWarning='저장된 기록을 읽지 못했어요. 현재 화면에서는 계속 공부할 수 있어요.';}
  const save=next=>{
    const sessionChanged=next.session!==state.session,prefsChanged=next.prefs!==state.prefs;
    try {
      let disk=null;
      try {const raw=localStorage.getItem(STORAGE);disk=raw ? normalizeState(JSON.parse(raw),ids) : null;} catch {}
      state={...next,cards:mergeLatestCards(disk?.cards || {},next.cards),session:sessionChanged || lastParts[1]==='play' ? next.session : disk ? disk.session : next.session,prefs:prefsChanged ? next.prefs : disk?.prefs || next.prefs};
      localStorage.setItem(STORAGE,JSON.stringify(state));storageWarning='';
    } catch {state=next;storageWarning='기록을 기기에 저장하지 못했어요. 이 화면에서는 계속할 수 있지만, 창을 닫으면 진행이 사라질 수 있어요.';}
  };
  const filters=params=>{
    const f={...state.prefs};
    for (const [key,value] of params) if (key in f) f[key]=key==='size' ? Number(value) : value;
    if (![...Object.keys(subjects),'all'].includes(f.subject)) f.subject='earth';
    if (!['all','quiz','vocab','tip'].includes(f.kind)) f.kind='all';
    if (!['mix','review','saved','new'].includes(f.mode)) f.mode='mix';
    if (![3,5,10].includes(f.size)) f.size=5;
    if (f.kind==='vocab') f.subject='english';
    if (f.topic && !cards.some(c=>c.subject===f.subject && c.topic===f.topic)) f.topic='';
    return f;
  };
  const warning=()=>storageWarning ? `<p class="notice" role="status">${escape(storageWarning)}</p>` : '';
  const subtitle=f=>f.kind==='vocab' ? '영단어' : subjects[f.subject]?.name || '여러 과목';
  function landing(params) {
    const f=filters(params),pool=poolFor(cards,state,f), subjectCards=cards.filter(c=>f.subject==='all' || c.subject===f.subject);
    const review=subjectCards.filter(c=>isDue(state.cards[c.id]) || state.cards[c.id]?.lastRating==='again').length;
    const saved=subjectCards.filter(c=>state.cards[c.id]?.starred).length;
    const active=state.session && state.session.cursor<state.session.ids.length;
    const activeCard=active ? byId.get(sessionCard(state)) : null;
    const label=pool.length ? `${subtitle(f)} ${Math.min(f.size,pool.length)}장 시작` : '이 조건에는 카드가 없어요';
    const topics=[...new Set(subjectCards.map(c=>c.topic))];
    return `<div class="page bites-page"><div class="bites-intro"><div><h1>과목 하나 골라,<br>조금씩 익혀요.</h1><p>긴 문제 대신 조건 하나, 단어 하나.<br>답을 고르고 이유를 확인하면 한 장이 끝나요.</p></div><div class="bite-sample" aria-hidden="true"><span>지구과학Ⅰ · 비율</span><p>반감기가 두 번 지나면<br>처음 양의 얼마가 남을까요?</p><div>½ <strong>¼</strong> ⅛</div><small>한 번마다 절반. 두 번이면 ¼.</small></div></div>
      ${warning()}${active ? `<div class="bite-resume"><div><strong>${subjects[activeCard.subject].name}, 이어서 볼까요?</strong><p>${state.session.cursor+1} / ${state.session.ids.length}번째 카드가 기다리고 있어요.</p></div><a class="button primary" href="#/bites/play">이어서 보기</a></div>` : ''}
      <form id="bite-filter"><fieldset class="bite-subjects"><legend>오늘 볼 과목</legend>${Object.entries(subjects).map(([key,s])=>`<label class="bite-subject ${f.subject===key ? 'selected' : ''}"><input type="radio" name="subject" value="${key}" ${f.subject===key ? 'checked' : ''}>${icon(key)}<span>${s.name}</span></label>`).join('')}</fieldset>
      <div class="bite-start"><button class="button primary" type="submit" ${pool.length ? '' : 'disabled'}>${label} ${icon('arrow')}</button><p>${pool.length ? `${pool.length}장 중 골라요. 한 장에 보통 20~60초, 중간에 멈춰도 괜찮아요.` : f.mode==='review' ? '지금 다시 볼 카드가 없어요. 아래에서 새것과 복습을 골라 보세요.' : f.mode==='saved' ? '카드의 ‘모아두기’를 누르면 여기에 모여요.' : '아래에서 주제나 카드 종류를 바꿔 보세요.'}</p></div>
      <details class="bite-options" ${settingsOpen ? 'open' : ''}><summary>주제·장수·복습 고르기</summary><div class="bite-settings"><div><label for="bite-kind">무엇을 볼까요?</label><select id="bite-kind" name="kind"><option value="all" ${f.kind==='all' ? 'selected' : ''}>퀴즈와 팁 함께</option><option value="quiz" ${f.kind==='quiz' ? 'selected' : ''}>짧은 퀴즈</option>${f.subject==='english' ? `<option value="vocab" ${f.kind==='vocab' ? 'selected' : ''}>기출 영단어</option>` : ''}<option value="tip" ${f.kind==='tip' ? 'selected' : ''}>팁만 읽기</option></select></div>
      <div><label for="bite-topic">주제</label><select id="bite-topic" name="topic"><option value="">전체 주제</option>${topics.map(t=>`<option ${f.topic===t ? 'selected' : ''}>${escape(t)}</option>`).join('')}</select></div>
      <div><label for="bite-size">한 번에</label><select id="bite-size" name="size">${[3,5,10].map(n=>`<option value="${n}" ${f.size===n ? 'selected' : ''}>${n}장</option>`).join('')}</select></div></div>
      <fieldset class="bite-modes"><legend class="sr-only">카드 고르기</legend>${[['mix','새것과 복습'],['review',`다시 볼 것 ${review}`],['saved',`모아 둔 것 ${saved}`],['new','처음 보는 것']].map(([value,label])=>`<label><input type="radio" name="mode" value="${value}" ${f.mode===value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>
      </details></form>
      <div class="bite-shortcuts"><a href="${routeFor({...f,subject:'english',kind:'vocab',topic:'',mode:'mix'})}">영단어만 잠깐 ${icon('arrow')}</a><a href="${routeFor({...f,subject:'study',kind:'all',topic:'',mode:'mix'})}">공부가 안 풀릴 때 읽기 ${icon('arrow')}</a></div>
      <details class="bite-guide"><summary>반복 방식과 내 기록</summary><ul><li>맞혔어도 헷갈리면 ‘다시 볼래요’를 눌러요. 틀린 카드도 다시 볼 목록에 남아요.</li><li>기억난 카드는 1일·3일·7일·14일·30일 간격으로 다시 나와요. 점수나 실력 판정은 하지 않아요.</li><li>기록은 이 브라우저에만 저장돼요. 다른 폰이나 태블릿으로 옮기려면 기록 파일을 저장한 뒤 가져오세요.</li></ul><div class="bite-record-tools"><button class="button" data-bite-export type="button">기록 파일 저장</button><label class="button bite-import">기록 가져오기<input type="file" accept=".json,application/json" data-bite-import></label></div><p id="bite-import-status" role="status"></p></details>
      <div class="bite-offline"><p data-offline-status>인터넷 연결 없이도 볼 수 있도록 준비하고 있어요.</p><p>전체 기출 PDF·음원·문제 이미지는 인터넷 연결이 필요해요.</p><button class="button" type="button" data-install hidden>홈 화면에 추가</button><details><summary>홈 화면에서 바로 열기</summary><p>브라우저의 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 이용해 보세요. 로그인 없이 이 화면을 바로 열 수 있어요.</p></details></div>
    </div>`;
  }
  function current() {return activePreview || byId.get(sessionCard(state));}
  function session() {return activePreview ? activePreview.session : state.session;}
  function ordersFor(queue) {return Object.fromEntries(queue.filter(id=>byId.get(id).choices).map(id=>[id,choiceOrder(byId.get(id).choices.length)]));}
  function cardView(card,s,preview=false) {
    const isChoice=['choice','vocab'].includes(card.kind), revealed=s.revealed, selected=s.selected;
    const correct=isChoice && selected!==null ? selected===card.answer : null;
    const record=state.cards[card.id];
    const answer=isChoice ? card.choices[card.answer] : card.answerText;
    const order=isChoice ? s.orders?.[card.id]?.length===card.choices.length ? s.orders[card.id] : card.choices.map((_,i)=>i) : [];
    return `<div class="bite-reader"><div class="bite-reader-top"><a href="#/bites">${icon('arrow')} 과목 고르기</a><span>${preview ? '함께 보는 카드' : `${s.cursor+1} / ${s.ids.length}장`}</span><button type="button" class="bite-save" data-bite-star aria-pressed="${record?.starred===true}">${record?.starred ? '모아둠' : '모아두기'}</button></div>
      <div class="bite-progress" role="progressbar" aria-label="이번 묶음 진행" aria-valuemin="0" aria-valuemax="${s.ids.length}" aria-valuenow="${s.cursor}">${s.ids.map((_,i)=>`<span class="${i<s.cursor ? 'done' : i===s.cursor ? 'current' : ''}"></span>`).join('')}</div>
      <article class="bite-card"><div class="bite-meta"><span>${subjects[card.subject].name} · ${escape(card.topic)}</span><span>${kindNames[card.kind]} · 약 ${card.seconds}초</span></div>${card.kind!=='vocab' ? `<h1 tabindex="-1" id="bite-title">${escape(card.title)}</h1>` : ''}
      ${card.kind==='vocab' ? `<div class="bite-word"><h1 lang="en" tabindex="-1" id="bite-title">${escape(card.term)}</h1><button type="button" data-bite-speak aria-label="영어 예문 듣기">${icon('english')} 예문 듣기</button></div><blockquote class="bite-example" lang="en">${escape(card.example)}</blockquote>` : ''}
      <div class="bite-prompt">${markdown(card.prompt)}</div>
      ${isChoice ? `<div class="bite-choices" role="group" aria-label="답 고르기">${order.map(i=>`<button type="button" data-bite-choice="${i}" ${revealed ? 'disabled' : ''} class="${revealed && i===card.answer ? 'correct' : ''} ${revealed && i===selected && i!==card.answer ? 'incorrect' : ''}"><span class="choice-letter" aria-hidden="true">${revealed && i===card.answer ? '✓' : ''}</span><span>${markdown(card.choices[i])}</span>${revealed && i===card.answer ? '<span class="choice-result">정답</span>' : revealed && i===selected ? '<span class="choice-result">내 선택</span>' : ''}</button>`).join('')}</div>` : ''}
      ${!revealed ? `<div class="bite-before">${!isChoice ? `<p class="tiny-note">${card.kind==='tip' ? '읽고 나서 오늘 할 행동 하나만 골라 봐요.' : '잠깐 생각해 보고 답을 펼쳐 보세요.'}</p>` : ''}<button type="button" class="button ${isChoice ? '' : 'primary'}" data-bite-reveal>${card.kind==='tip' ? '어떻게 해 볼까요?' : isChoice ? '모르겠어요 · 이유 보기' : '답과 이유 보기'}</button><button type="button" class="text-button" data-bite-skip>이번엔 건너뛰기</button></div>` : ''}
      ${revealed ? `<section class="bite-feedback" id="bite-feedback" tabindex="-1"><h2>${card.kind==='tip' ? '이렇게 해 봐요' : correct===true ? '맞아요. 이유도 짚어 봐요.' : correct===false ? '여기서 판단이 갈려요.' : '핵심은 이거예요.'}</h2>${answer ? `<div class="bite-answer">${markdown(answer)}</div>` : ''}<ul>${card.explanation.map(line=>`<li>${markdown(line)}</li>`).join('')}</ul><div class="bite-takeaway"><span>하나만 기억한다면</span>${markdown(card.takeaway)}</div>
      <details class="bite-sources"><summary>노트와 기출에 연결하기</summary><p>${card.kind==='vocab' ? '기출에서 쓰인 뜻을 새 예문으로 연습했어요. 실제 문항은 아래에서 확인할 수 있어요.' : '노트와 기출 분석을 바탕으로 새로 만든 짧은 연습이에요. 같은 판단이 쓰이는 기출도 함께 볼 수 있어요.'}</p>${(card.noteIds || []).map(id=>notes.get(id)).filter(Boolean).map(note=>`<a href="#/read/${note.id}">${escape(note.title)} ${icon('arrow')}</a>`).join('')}${(card.refs || []).map(ref=>`<a href="#/practice/${ref.paperId}/${ref.number}">${refTitle(ref)} ${icon('arrow')}</a>`).join('')}</details></section>
      <div class="bite-rating"><p>${correct===false || (isChoice && selected===null) ? '이 카드는 다시 볼 목록에 남겨 둘게요.' : '맞혔어도 헷갈렸다면 다시 봐요.'}</p><div><button type="button" class="button" data-bite-rate="again">다시 볼래요</button><button type="button" class="button primary" data-bite-rate="known">${correct===false || (isChoice && selected===null) ? '알겠어요, 다음' : card.kind==='tip' ? '기억할게요' : '기억나요'} ${icon('arrow')}</button></div></div>` : ''}
      <div class="bite-card-footer"><button class="text-button" type="button" data-bite-share>이 카드 링크 복사</button><span id="bite-action-status" role="status"></span></div>${warning()}</article>
    </div>`;
  }
  function finished() {
    const s=state.session,done=s?.completed || [], again=done.filter(id=>state.cards[id]?.lastRating==='again');
    const f=s?.filters || state.prefs,more=poolFor(cards,state,f).length;
    return `<div class="page bite-finish"><p class="bite-finish-count">${done.length}장 확인했어요.</p><h1>여기까지 해도 좋아요.</h1><p>잠깐 꺼내 본 생각이 다음 문제에서 떠오르도록,<br>다시 볼 내용은 목록에 남겨 두었어요.</p>${s?.skipped.length ? `<p class="tiny-note">건너뛴 ${s.skipped.length}장은 공부한 것으로 기록하지 않았어요.</p>` : ''}${again.length ? `<section><h2>다시 만나 볼 내용</h2><ul>${again.map(id=>`<li>${escape(byId.get(id).title)}</li>`).join('')}</ul></section>` : ''}
      <div class="bite-finish-actions">${more ? `<button class="button primary" data-bite-more type="button">${subtitle(f)} ${Math.min(f.size,more)}장 더</button>` : `<a class="button primary" href="${routeFor({...f,mode:'mix'})}">복습도 함께 골라 보기</a>`}<a class="button" href="#/bites">과목 고르기 · 마치기</a></div>${warning()}</div>`;
  }
  function render(parts,params) {
    lastParts=parts;lastParams=params;activePreview=null;
    if (!parts[1]) return landing(params);
    if (parts[1]==='card') {
      const card=byId.get(parts[2]);
      if (!card) return '<div class="page"><h1>카드를 찾을 수 없어요.</h1><a class="button" href="#/bites">과목 고르기</a></div>';
      activePreview={...card,session:newSession([card.id],Date.now(),null,ordersFor([card.id]))};
      return cardView(activePreview,activePreview.session,true);
    }
    if (parts[1]!=='play' || !state.session) return landing(params);
    return sessionCard(state) ? cardView(current(),session()) : finished();
  }
  function typeset() {window.renderMathInElement?.(host,options);}
  function refreshLanding(message='') {
    if (!host || lastParts[1]) return;
    const guideOpen=host.querySelector('.bite-guide')?.open;
    host.innerHTML=landing(lastParams);typeset();refreshOfflineStatus();
    const guide=host.querySelector('.bite-guide');if (guide) guide.open=guideOpen;
    if (message) host.querySelector('#bite-import-status').textContent=message;
  }
  function updateReader(focus) {
    host.innerHTML=activePreview ? cardView(activePreview,activePreview.session,true) : sessionCard(state) ? cardView(current(),session()) : finished();
    typeset();
    if (focus) {
      const target=host.querySelector(focus);target?.focus({preventScroll:true});
      if (focus==='#bite-title') window.scrollTo({top:0,behavior:'instant'});
      else target?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant':'smooth'});
    }
  }
  function reveal(selected=null) {
    const s=session();if (!s || s.revealed) return;
    if (activePreview) activePreview.session={...s,revealed:true,selected};
    else save({...state,session:{...s,revealed:true,selected}});
    updateReader('#bite-feedback');
  }
  function start(f) {
    const queue=makeQueue(cards,state,f);
    if (!queue.length) return;
    stopSpeech();
    save({...state,prefs:f,session:newSession(queue,Date.now(),f,ordersFor(queue))});activePreview=null;settingsOpen=false;
    if (location.hash==='#/bites/play') updateReader('#bite-title');
    else location.hash='/bites/play';
  }
  function readForm(form) {
    const values=Object.fromEntries(new FormData(form));values.size=Number(values.size);
    if (values.subject!=='english' && values.kind==='vocab') values.kind='all';
    return filters(new URLSearchParams(values));
  }
  async function onClick(event) {
    const button=event.target.closest('button');if (!button || !host.contains(button)) return;
    if (button.hasAttribute('data-bite-more')) {start(state.session?.filters || state.prefs);return;}
    if (button.hasAttribute('data-bite-export')) {
      const blob=new Blob([JSON.stringify({app:'csat-study-bites',exportedAt:new Date().toISOString(),progress:{version:1,cards:state.cards}},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`csat-review-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
    }
    const card=current(),s=session();if (!card || !s) return;
    if (button.hasAttribute('data-bite-choice')) {reveal(Number(button.dataset.biteChoice));return;}
    if (button.hasAttribute('data-bite-reveal')) {reveal();return;}
    if (button.hasAttribute('data-bite-star')) {
      save({...state,cards:{...state.cards,[card.id]:{...state.cards[card.id],updated:Date.now(),starred:!state.cards[card.id]?.starred}}});
      button.setAttribute('aria-pressed',String(state.cards[card.id].starred));button.textContent=state.cards[card.id].starred ? '모아둠':'모아두기';return;
    }
    if (button.hasAttribute('data-bite-share')) {
      const url=new URL(location.href),target=host.querySelector('#bite-action-status');url.hash=`/bites/card/${card.id}`;
      try {await navigator.clipboard.writeText(url.href);if (target?.isConnected) target.textContent='링크를 복사했어요.';}
      catch {if (target?.isConnected) target.textContent=url.href;}return;
    }
    if (button.hasAttribute('data-bite-speak')) {
      const target=host.querySelector('#bite-action-status');
      if (!('speechSynthesis' in window)) {target.textContent='이 브라우저에서는 음성 재생을 지원하지 않아요.';return;}
      stopSpeech();target.textContent='';const token=speechToken,utterance=new SpeechSynthesisUtterance(card.example || card.term);utterance.lang='en-US';utterance.rate=.85;
      utterance.onerror=event=>{if (token===speechToken && !['canceled','interrupted'].includes(event.error) && target.isConnected) target.textContent='영어 음성을 재생하지 못했어요. 기기의 음성 설정을 확인해 보세요.';};
      speechSynthesis.speak(utterance);return;
    }
    if (button.hasAttribute('data-bite-rate') || button.hasAttribute('data-bite-skip')) {
      const skip=button.hasAttribute('data-bite-skip');if (!skip && !s.revealed) return;
      stopSpeech();
      const correct=['choice','vocab'].includes(card.kind) ? s.selected!==null && s.selected===card.answer : null;
      const next=advance(activePreview ? {...state,session:s} : state,{skip,grade:button.dataset.biteRate,correct});
      if (activePreview) {save({...state,cards:next.cards});activePreview=null;location.hash='/bites';}
      else {save(next);updateReader('#bite-title');if (!sessionCard(state)) {host.querySelector('.bite-finish h1')?.setAttribute('tabindex','-1');host.querySelector('.bite-finish h1')?.focus({preventScroll:true});window.scrollTo(0,0);}}
    }
  }
  async function onChange(event) {
    const input=event.target;
    if (input.hasAttribute('data-bite-import')) {
      const status=host.querySelector('#bite-import-status'),file=input.files[0];if (!file) return;
      try {
        if (file.size>2*1024*1024) throw Error('too large');
        const data=JSON.parse(await file.text());
        if (data.app!=='csat-study-bites' || data.progress?.version!==1 || !data.progress.cards || typeof data.progress.cards!=='object' || Array.isArray(data.progress.cards)) throw Error('wrong format');
        save(mergeProgress(state,data.progress,ids));refreshLanding(storageWarning || '기록을 합쳤어요. 같은 카드는 더 최근 기록을 유지해요.');
      } catch {status.textContent='수능 판단 노트에서 저장한 복습 기록 JSON 파일을 골라 주세요.';}
      input.value='';return;
    }
    if (input.closest('#bite-filter')) {
      settingsOpen=host.querySelector('.bite-options')?.open===true;
      pendingFocus={name:input.name,value:input.value,scroll:window.scrollY};
      const f=readForm(input.form);if (input.name==='subject') {f.topic='';if (f.subject!=='english') f.kind='all';}
      save({...state,prefs:f});location.hash=routeFor(f).slice(1);
    }
  }
  function onSubmit(event) {
    if (event.target.id==='bite-filter') {event.preventDefault();start(readForm(event.target));}
  }
  function onToggle(event) {if (event.target.matches('.bite-options')) settingsOpen=event.target.open;}
  function mount() {
    host=document.getElementById('main');host.addEventListener('click',onClick);host.addEventListener('change',onChange);host.addEventListener('submit',onSubmit);host.addEventListener('toggle',onToggle,true);
    typeset();refreshOfflineStatus();
    if (pendingFocus) {
      const f=pendingFocus;pendingFocus=null;
      const selector=f.name==='subject' || f.name==='mode' ? `[name="${f.name}"][value="${CSS.escape(f.value)}"]` : `[name="${f.name}"]`;
      host.querySelector(selector)?.focus({preventScroll:true});window.scrollTo(0,f.scroll);
    }
  }
  function destroy() {
    host?.removeEventListener('click',onClick);host?.removeEventListener('change',onChange);host?.removeEventListener('submit',onSubmit);host?.removeEventListener('toggle',onToggle,true);host=null;
    stopSpeech();
  }
  window.addEventListener('storage',event=>{
    if (event.key!==STORAGE || !event.newValue) return;
    try {
      const incoming=normalizeState(JSON.parse(event.newValue),ids);
      state={...incoming,cards:mergeLatestCards(state.cards,incoming.cards),session:host && lastParts[1] ? state.session : incoming.session};
      refreshLanding();
    } catch {}
  });
  return {render,mount,destroy};
}
