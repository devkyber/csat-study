import {Marked} from './vendor/marked.esm.js';
import {createMarkdown} from './markdown.mjs';
import {subjects, escape, icon, external as link, decayFigure} from './ui.js';
import {createArchive} from './archive.js';
import {insertExamples, openQuestionImage} from './examples.js';
import {createPractice} from './practice.js';
import {createBites} from './bites.js';
import {searchCards} from './bite-engine.mjs';
import {startOffline} from './offline.js';
import {insertMathLabs} from './math-labs.js';

const $ = selector => document.querySelector(selector);
const issues = [['조건을 놓쳤을 때','조건'],['비교 기준이 헷갈릴 때','비교'],['선지 둘 중 고민될 때','선지'],['풀이가 떠오르지 않을 때','발상'],['계산이 꼬일 때','계산'],['복습할 때','복습']];
let articles=[], exams=[], manifest={}, references={}, examples=[], biteCards=[], archive, practice, bites;
let currentRoute='', currentBase='', restoreScroll=false;
const scrollPositions=new Map();
let saved=readLocal('csat-saved',[]), recent=readLocal('csat-recent',[]);

function readLocal(key, fallback) {
  try {const value=JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value.filter(x => typeof x === 'string') : fallback;} catch {return fallback;}
}
function writeLocal(key, value) {
  try {localStorage.setItem(key,JSON.stringify(value)); return true;} catch {return false;}
}
function notify(message) {
  $('#toast').textContent=message;
  $('#toast').classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(() => $('#toast').classList.remove('show'),2400);
}
function group(items,key) {return Object.groupBy(items,item => item[key]);}
function subjectTabs(current='') {
  return `<nav class="chip-list subject-tabs" aria-label="과목 선택">${Object.entries(subjects).map(([key,s]) => `<a href="#/subject/${key}" class="chip ${key === current ? 'selected' : ''}" ${key === current ? 'aria-current="page"' : ''}>${s.name}</a>`).join('')}</nav>`;
}
function articleRow(article, withSubject=false) {
  return `<a class="article-row" href="#/read/${article.id}">${withSubject ? `<small>${subjects[article.subject].name} / ${escape(article.category)}</small>` : ''}<h3>${escape(article.title)}</h3><p>${escape(article.summary)}</p>${icon('arrow')}</a>`;
}
function cardPreviewUrl(card,from) {return `#/bites/card/${card.id}?from=${encodeURIComponent(from)}`;}
function cardRow(card,from) {
  return `<a class="article-row card-result" href="${escape(cardPreviewUrl(card,from))}"><small>${subjects[card.subject].name} · ${escape(card.topic)} · 약 ${card.seconds}초</small><h3>${escape(card.kind==='vocab' ? card.term : card.title)}</h3>${icon('arrow')}</a>`;
}
function cardSearchUrl(query,subject='all') {
  return '#/bites?'+new URLSearchParams({subject:subject || 'all',q:query,kind:'all',topic:'',mode:'mix',note:'',paper:'',number:'',size:'5'});
}
function notePractice(article) {
  const kind=article.subject==='english' ? 'quiz' : 'all';
  const count=biteCards.filter(c=>c.noteIds?.includes(article.id) && (kind!=='quiz' || ['choice','recall'].includes(c.kind))).length;
  return {count,size:Math.min(5,count),href:'#/bites?'+new URLSearchParams({subject:article.subject,kind,note:article.id,paper:'',number:'',q:'',topic:'',mode:'mix',size:'5'})};
}
function home() {
  const recently=recent.map(id => articles.find(a => a.id === id)).filter(Boolean).slice(0,3);
  return `<div class="page">
    <section class="intro"><div><h1>배운 개념을<br>문제에 쓰는 법.</h1><p>문제를 풀며 적어 둔 생각과 공부 팁을 모았습니다.<br>어디서 막혔는지 짚고, 실제 기출에 적용해 보세요.</p><button class="intro-search" data-action="search">${icon('search')}<span>단원이나 막힌 부분을 검색하세요</span>${icon('arrow')}</button></div>${decayFigure()}</section>
    <a class="bite-home-link" href="#/bites"><div><h2>지금은 한 과목, 5장만.</h2><p>짧은 퀴즈·기출 영단어·공부 팁을 틈날 때 조금씩 익혀요.</p></div><span class="button primary">잠깐 공부 시작 ${icon('arrow')}</span></a>
    <section><div class="section-top"><h2>과목별로 읽기</h2><span>강령부터 문항 분석까지</span></div><div class="subject-grid">${Object.entries(subjects).map(([key,s]) => {const items=articles.filter(a => a.subject === key); return `<a class="subject-entry" href="#/subject/${key}">${icon(key)}<div><h3>${s.name}</h3><p>${s.desc}</p><span class="category-preview">${Object.keys(group(items,'category')).slice(0,4).map(escape).join(' / ')}</span></div><span class="count">${items.length}개 글</span></a>`;}).join('')}</div></section>
    <section><div class="section-top"><h2>이럴 때 찾아보세요</h2></div><div class="chip-list">${issues.map(([label,q]) => `<a class="chip" href="#/search?q=${encodeURIComponent(q)}">${label}</a>`).join('')}</div></section>
    ${recently.length ? `<section><div class="section-top"><h2>이어서 읽기</h2><span>최근 읽은 글</span></div><div class="article-list">${recently.map(a => articleRow(a,true)).join('')}</div></section>` : ''}
    <a class="link-row" href="#/practice"><div><h3>최근 5개년, 한 문제씩 풀어 보세요.</h3><p>2022–2026학년도 6월·9월·수능. 실제 문제를 보고 단계별 풀이로 확인해요.</p></div><span class="button primary">5개년 분석 ${icon('arrow')}</span></a>
    <a class="link-row" href="#/exams"><div><h3>시험지가 필요할 때.</h3><p>과목과 학년도를 고르면 평가원 기출 PDF를 바로 열 수 있어요.</p></div><span class="button">기출 PDF 찾기 ${icon('arrow')}</span></a>
  </div>`;
}
function subjectPage(id) {
  const s=subjects[id]; if (!s) return notFound();
  const items=articles.filter(a => a.subject === id), groups=Object.entries(group(items,'category'));
  return `<div class="page"><div class="crumb"><a href="#/">학습 노트</a><span>/</span><span>${s.name}</span></div><div class="subject-heading"><div><h1>${s.name}</h1><p class="page-description">${s.desc}</p></div><span class="total">${items.length}개 글</span></div>${subjectTabs(id)}<div class="subject-quick-links"><a href="#/bites?subject=${id}&kind=all&topic=&mode=mix">이 과목 잠깐 공부</a>${id!=='study' ? `<a href="#/practice?subject=${id}">5개년 문제 풀기</a>` : ''}</div>
    <div class="subject-layout"><nav class="category-index" aria-label="단원 색인"><p>단원별 목차</p>${groups.map(([category,rows],i) => `<a href="#/subject/${id}?section=category-${i}" data-section="category-${i}">${escape(category)}<span>${rows.length}</span></a>`).join('')}</nav><div>${groups.map(([category,rows],i) => `<section class="category-section" id="category-${i}"><h2>${escape(category)}</h2><div class="article-list">${rows.map(a => articleRow(a)).join('')}</div></section>`).join('')}</div></div>
  </div>`;
}
const markdown=createMarkdown(Marked,html=>window.DOMPurify.sanitize(html),escape);
function parseRef(raw,subject,articleId='') {
  const verified=references[articleId+':'+raw] || references[subject+':'+raw] || references[raw];
  if (verified) return {...verified,raw};
  const m=raw.trim().match(/^(\d{2})(06|09|11)$/);
  if (!m) return {raw,status:'unresolved',label:raw};
  const year=2000+Number(m[1]), session={'06':'6월','09':'9월','11':'수능'}[m[2]];
  return {raw,year,session,status:'exam',label:`${year}학년도 ${session === '수능' ? '수능' : session+' 모의평가'}`};
}
function refsHtml(article) {
  if (!article.refs?.length) return '<p class="tiny-note">원문에는 별도의 기출 번호가 적혀 있지 않습니다.</p>';
  return article.refs.map(raw => {
    const r=parseRef(raw,article.subject,article.id);
    const variant=article.subject === 'math' ? r.label?.match(/(?:가|나|A|B)형/)?.[0] || '' : '';
    const original=exams.flatMap(e => e.files).find(f => f.url === r.sourceUrl && f.format.toLowerCase() === 'pdf' && f.kind === 'question');
    const paper=original || archive.questionFor(r.year,r.session,article.subject,variant);
    const compressed=exams.some(e => e.files.some(f => f.url === r.sourceUrl && ['zip','exe','hwp'].includes(f.format.toLowerCase()))) || /\.(zip|exe|hwp)(\?|$)/i.test(r.sourceUrl || '');
    return `<div class="exam-ref"><strong>${escape(r.label || raw)}</strong><small>${r.status === 'question' ? '문항 대조 완료'+(r.questions ? ' · '+r.questions+'번' : '') : r.status === 'exam' ? '시험 회차 확인 · 문항 번호 대조 전' : '원문 표기 · 출처 확인 중'}${r.note ? '<br>'+escape(r.note) : ''}</small>${paper ? link(paper.url,'문제 PDF 열기','ref-primary') : ''}${r.sourceUrl && r.sourceUrl !== paper?.url && !compressed ? link(r.sourceUrl,'대조 자료') : ''}${r.year ? `<a href="#/exams?year=${r.year}&session=${encodeURIComponent(r.session)}&subject=${article.subject === 'study' ? '' : article.subject}">같은 시험 자료</a>` : ''}</div>`;
  }).join('');
}
function readPage(id) {
  const a=articles.find(x => x.id === id); if (!a) return notFound();
  const s=subjects[a.subject]; recent=[id,...recent.filter(x => x !== id)].slice(0,12); writeLocal('csat-recent',recent);
  const groups=Object.entries(group(articles.filter(x => x.subject === a.subject),'category'));
  const nav=groups.map(([category,items]) => `<details ${category === a.category ? 'open' : ''}><summary>${escape(category)}</summary>${items.map(x => `<a href="#/read/${x.id}" class="${x.id === id ? 'current' : ''}" ${x.id === id ? 'aria-current="page"' : ''}>${escape(x.title)}</a>`).join('')}</details>`).join('');
  const related=articles.filter(x => x.id !== id && x.subject === a.subject).map(x => ({a:x,score:(x.category === a.category ? 4 : 0)+(x.tags || []).filter(t => a.tags?.includes(t)).length})).sort((x,y) => y.score-x.score).slice(0,3);
  const short=notePractice(a);
  return `<div class="read-shell"><aside class="sidebar" aria-label="${s.name} 목차"><a href="#/subject/${a.subject}">${s.name} 전체 목차</a>${nav}</aside>
    <article class="reading"><div class="crumb"><a href="#/">학습 노트</a><span>/</span><a href="#/subject/${a.subject}">${s.name}</a><span>/</span><span>${escape(a.category)}</span></div><details class="mobile-index"><summary>${s.name} 목차</summary>${nav}</details><h1>${escape(a.title)}</h1><p class="lead">${escape(a.summary)}</p><div class="article-actions">${short.count ? `<a class="button" href="${escape(short.href)}">이 노트 ${short.size}장 연습</a>` : ''}<button class="button ${saved.includes(id) ? 'saved' : ''}" data-action="save" data-id="${id}" aria-pressed="${saved.includes(id)}">${saved.includes(id) ? '저장됨' : '글 저장'}</button><button class="button" data-action="share">링크 복사</button><button class="button" data-action="print">인쇄</button><a class="button" href="#/exams?subject=${a.subject === 'study' ? '' : a.subject}">기출 PDF</a></div>
    <div class="prose">${markdown(a.body)}</div>${short.count ? `<section class="note-practice"><h2>읽은 판단을 짧게 써 봐요.</h2><p>이 노트에 연결된 카드 ${short.count}장 중 ${short.size}장만 꺼내 볼게요. 답을 고르고, 방금 읽은 생각을 썼는지 확인해 보세요.</p><a class="button primary" href="${escape(short.href)}">이 노트 ${short.size}장 연습 ${icon('arrow')}</a></section>` : ''}<section class="related"><h2>함께 읽을 노트</h2>${related.map(({a:x}) => `<a href="#/read/${x.id}">${escape(x.title)}</a>`).join('')}</section></article>
    <aside class="aside"><div class="toc"><h2>이 글의 순서</h2><div id="toc-links"></div></div><section class="exam-links"><h2>원문에 적힌 기출</h2><div>${refsHtml(a)}</div></section></aside>
  </div>`;
}
function searchArticles(query) {
  const terms=query.toLowerCase().split(/\s+/).filter(Boolean); if (!terms.length) return [];
  return articles.map(a => {
    const text=[a.title,a.summary,a.category,...a.tags,a.body,...(a.refs || [])].join(' ').toLowerCase();
    return {a,score:terms.every(q => text.includes(q)) ? terms.reduce((score,q) => score+(a.title.toLowerCase().includes(q) ? 10 : 0)+(a.summary.toLowerCase().includes(q) ? 3 : 0)+1,0) : 0};
  }).filter(x => x.score).sort((x,y) => y.score-x.score).map(x => x.a);
}
function searchPage(params) {
  const q=params.get('q') || '', items=searchArticles(q), subject=params.get('subject') || '';
  const foundCards=q.trim() ? searchCards(biteCards,q) : [];
  const searchOrigin='#/search?'+new URLSearchParams({q,subject});
  const filtered=subject ? items.filter(a => a.subject === subject) : items, cards=subject ? foundCards.filter(c=>c.subject===subject) : foundCards;
  return `<div class="page"><div class="crumb"><a href="#/">학습 노트</a><span>/</span><span>검색</span></div><h1>노트와 카드에서 찾아보기</h1><form id="page-search" class="filters search-form"><div><label for="page-search-input">검색어</label><input id="page-search-input" name="q" value="${escape(q)}" type="search" placeholder="반감기, 변곡점, objective, 2406…"></div><input type="hidden" name="subject" value="${escape(subject)}"><button class="button primary" type="submit">검색</button></form><div class="chip-list"><a class="chip ${!subject ? 'selected' : ''}" href="#/search?q=${encodeURIComponent(q)}">전체 ${items.length+foundCards.length}</a>${Object.entries(subjects).map(([key,s]) => {const n=items.filter(a => a.subject === key).length+foundCards.filter(c=>c.subject===key).length;return n ? `<a class="chip ${subject === key ? 'selected' : ''}" href="#/search?q=${encodeURIComponent(q)}&subject=${key}">${s.name} ${n}</a>` : '';}).join('')}</div><div class="result-meta"><span>${escape(q || '검색어를 입력하세요')}</span><span>노트 ${filtered.length}개 · 카드 ${cards.length}장</span></div>
    ${cards.length ? `<section class="search-section"><div class="section-top"><h2>잠깐 공부 ${cards.length}장</h2><a href="${escape(cardSearchUrl(q,subject))}">카드 목록에서 고르기 ${icon('arrow')}</a></div><div class="article-list">${cards.slice(0,12).map(c=>cardRow(c,searchOrigin)).join('')}</div>${cards.length>12 ? `<a class="button search-more" href="${escape(cardSearchUrl(q,subject))}">카드 ${cards.length}장 모두 보기</a>` : ''}</section>` : ''}
    ${filtered.length ? `<section class="search-section"><h2>학습 노트 ${filtered.length}개</h2><div class="article-list">${filtered.map(a => articleRow(a,true)).join('')}</div></section>` : ''}${!filtered.length && !cards.length ? `<p class="empty">${q ? '검색 결과가 없어요. 더 짧은 단어를 입력하거나 과목별 목차를 살펴보세요.' : '막힌 단원이나 다시 볼 단어를 검색해 보세요.'}</p>` : ''}</div>`;
}
function savedPage() {
  const items=saved.map(id => articles.find(a => a.id === id)).filter(Boolean);
  return `<div class="page"><h1>저장한 글</h1><p class="page-description">다시 읽고 싶은 글을 모아 두세요. 저장한 글은 이 브라우저에만 남습니다.</p>${items.length ? `<div class="article-list" style="margin-top:36px">${items.map(a => articleRow(a,true)).join('')}</div>` : '<p class="empty">글에서 ‘글 저장’을 누르면 이곳에 모입니다.<br><a class="button" href="#/">학습 노트 읽기</a></p>'}</div>`;
}
function about() {
  return `<div class="page about"><h1>이 노트에 대하여</h1><p>공부하면서 적어 둔 풀이 방법, 자주 한 실수, 공부에 대한 생각을 모았습니다. 개념을 처음부터 설명하기보다는 이미 배운 것을 문제에 어떻게 쓸지 다룹니다.</p><h2>어떤 내용을 담았나요?</h2><ul><li>과목별로 문제를 읽고 푸는 방법</li><li>실제로 틀린 이유와 다음에 확인할 것</li><li>기출 지문·문항을 읽으며 남긴 분석</li><li>오답, 복습, 인강, 시험 운영에 관한 팁</li></ul><p>원본 ${manifest.sourceFiles || 113}개를 검토해 ${articles.length}개 글로 정리했습니다. 반복되는 내용은 합치고 개인 점수·신상·입시 기록은 제외했습니다. 언어와 매체도 학습 노트에서 제외했습니다. 원문이 짧은 과목을 별도의 개념 강의로 늘리지는 않았습니다.</p><h2>기출 표기 읽는 법</h2><ul><li><strong>2406</strong>: 2024학년도 6월 모의평가</li><li><strong>2409</strong>: 2024학년도 9월 모의평가</li><li><strong>2411</strong>: 2024학년도 수능</li></ul><p>학년도와 실제 시험을 치른 연도는 다릅니다. 수능 표기의 ‘11’이 항상 실제 시행 월을 뜻하는 것도 아닙니다. 문항 번호는 실제 문제와 대조한 경우에만 확정해 표시합니다.</p><h2>문제와 함께 읽는 방법</h2><p>2017–2026학년도 6월·9월·수능의 제재와 문항 유형을 검토하고, 노트의 판단을 연습할 실제 문제를 골랐습니다. 국어는 독서·문학, 수학은 원노트에 있는 수학Ⅰ·Ⅱ·미적분을 중심으로 연결했습니다. 설명 아래의 문제와 피드백은 원노트를 적용하는 연습을 위해 덧붙인 것입니다.</p><p>설명 아래의 문제에서 어디에 그 판단을 써야 할지 먼저 찾아보세요. 이미지를 누르면 크게 볼 수 있습니다. ‘판단 과정 확인하기’를 열면 이 문제와 노트가 어떻게 연결되는지 볼 수 있습니다.</p><p>과목별 기출 자료실에서는 평가원과 EBSi의 공식 PDF를 바로 엽니다. EBS 해설은 평가원 정답표와 구분했습니다. 공식 개별 PDF가 없는 옛 회차는 표지를 대조한 공개 보관본을 연결하고 보관소 이름을 표시합니다. 문제의 저작권은 한국교육과정평가원 및 해당 권리자에게 있습니다.</p><h2>5개년 기출 분석</h2><p>2022–2026학년도 6월·9월·수능은 전 문항을 따로 풀어 볼 수 있어요. 국어 공통·화법과 작문, 수학 공통·미적분, 영어, 물리학Ⅰ, 지구과학Ⅰ을 다룹니다. 원문 노트에 덧붙여 작성한 단계별 풀이이며, 문제와 EBS 해설을 대조했습니다.</p><p><a href="#/practice">5개년 분석에서 문제를 먼저 풀고</a>, 풀이의 판단 순서와 자신의 생각을 비교해 보세요. 다시 풀 문제도 표시할 수 있습니다.</p><h2>잠깐 공부</h2><p><a href="#/bites">잠깐 공부</a>에서는 한 과목을 골라 짧은 퀴즈·떠올리기·팁을 3·5·10장씩 볼 수 있어요. 기출에서 쓰인 영단어도 새 예문으로 연습합니다. 긴 문제를 다 푸는 대신 조건 하나와 판단 하나를 꺼내 보는 연습이에요.</p><p>이 카드는 노트와 기출 분석을 바탕으로 새로 작성했어요. 실제 기출 문장과는 구분하고, 같은 판단이 쓰이는 노트와 원래 문제를 연결했습니다. 헷갈린 카드는 다시 볼 목록에 남고, 진행 중인 묶음은 다음에 이어 볼 수 있어요.</p><p>오프라인 준비가 끝난 기기에서는 짧은 공부를 인터넷 연결 없이 열 수 있어요. 전체 기출 PDF·음원·문제 이미지는 연결이 필요합니다. 다른 기기로 복습 기록을 옮길 때는 기록 파일 저장과 가져오기를 이용해 주세요.</p><h2>저장과 수정</h2><p>저장한 글, 최근 읽은 글, 문항 복습 기록, 화면 테마는 현재 브라우저에 보관됩니다. 별도의 회원가입은 없습니다. 내용이나 문제 연결의 오류는 ${link('https://github.com/devkyber/csat-study/issues','GitHub 이슈')}로 알려 주세요.</p></div>`;
}
function notFound() {return '<div class="page"><h1>글을 찾을 수 없습니다.</h1><p class="page-description">과목별 목차에서 다시 찾아주세요.</p><a class="button" href="#/">전체 목차</a></div>';}
function formRoute(form,path) {
  const params=new URLSearchParams();
  for (const [key,value] of new FormData(form)) if (value) params.set(key,value);
  location.hash=path+'?'+params;
}
function goSection(id) {
  const target=document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
  target.tabIndex=-1; target.focus({preventScroll:true});
}
function route() {
  if (!practice) return;
  const raw=location.hash.slice(1) || '/', [path,query]=raw.split('?'), params=new URLSearchParams(query || '');
  const parts=path.split('/').filter(Boolean), baseParams=new URLSearchParams(params);
  baseParams.delete('section');
  const base=path+'?'+baseParams;
  if (currentBase === base && params.get('section')) {currentRoute=raw;restoreScroll=false;goSection(params.get('section'));return;}
  if (currentRoute) scrollPositions.set(currentRoute,window.scrollY);
  practice.destroy();
  bites.destroy();
  const readArticle=parts[0] === 'read' ? articles.find(a => a.id === parts[1]) : null;
  const views={subject:() => subjectPage(parts[1]),read:() => readPage(parts[1]),search:() => searchPage(params),saved:savedPage,exams:() => archive.archivePage(params),paper:() => archive.paperPage(parts[1]),practice:() => practice.render(parts,params),bites:() => bites.render(parts,params),about};
  $('#main').innerHTML=!parts.length ? home() : views[parts[0]] ? views[parts[0]]() : notFound();
  const continuation=bites.continuation();
  if (['read','practice'].includes(parts[0]) && continuation) $('#main').insertAdjacentHTML('afterbegin',`<nav class="study-return" aria-label="잠깐 공부로 돌아가기"><a href="${escape(continuation.href)}">${icon('arrow')} ${escape(continuation.label)}</a></nav>`);
  if (readArticle) {insertMathLabs(readArticle);insertExamples(readArticle,examples,markdown);}
  document.querySelectorAll('[data-nav]').forEach(a => {
    const active=a.dataset.nav === (['exams','paper'].includes(parts[0]) ? 'exams' : ['saved','practice','bites'].includes(parts[0]) ? parts[0] : 'home');
    a.classList.toggle('active',active);
    if (active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
  const title=$('main h1')?.textContent || '수능 판단 노트';document.title=title+' | 수능 판단 노트';
  const headings=[...document.querySelectorAll('.prose > h2,.prose > h3')];
  headings.forEach((h,i) => h.id='section-'+i);
  if ($('#toc-links')) {
    const contents=headings.map((h,i) => `<a href="#${escape(path)}?section=section-${i}" data-section="section-${i}" class="${h.tagName === 'H3' ? 'subheading' : ''}">${escape(h.textContent)}</a>`).join('');
    $('#toc-links').innerHTML=contents;
    if (headings.length>1) $('.article-actions').insertAdjacentHTML('afterend',`<details class="mobile-toc"><summary>이 글에서 필요한 부분 찾기</summary><nav aria-label="현재 글의 목차">${contents}</nav></details>`);
    if (!headings.length) $('.toc').hidden=true;
  }
  window.renderMathInElement?.($('#main'),{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false,strict:'ignore',trust:false});
  document.querySelectorAll('.prose table').forEach(table => {const wrap=document.createElement('div');wrap.className='table-wrap';table.before(wrap);wrap.append(table);});
  document.querySelectorAll('.prose a').forEach(a => {if (/^https?:\/\//i.test(a.getAttribute('href') || '')) {a.target='_blank';a.rel='noopener noreferrer';}});
  $('#exam-filter')?.addEventListener('change',event => {if (event.target.tagName === 'SELECT') formRoute(event.currentTarget,'/exams');});
  $('#exam-filter')?.addEventListener('submit',event => {event.preventDefault();formRoute(event.currentTarget,'/exams');});
  $('#page-search')?.addEventListener('submit',event => {event.preventDefault();formRoute(event.currentTarget,'/search');});
  $('#practice-filter')?.addEventListener('submit',event => {event.preventDefault();formRoute(event.currentTarget,'/practice');});
  $('#practice-filter')?.addEventListener('change',event => {if (event.target.tagName === 'SELECT') formRoute(event.currentTarget,'/practice');});
  currentBase=base;currentRoute=raw;
  $('#main').focus({preventScroll:true});
  const practiceScroll=parts[0]==='practice' && parts[1] && restoreScroll && scrollPositions.has(raw) ? scrollPositions.get(raw) : null;
  if (params.get('section')) requestAnimationFrame(() => goSection(params.get('section')));
  else window.scrollTo(0,practiceScroll!==null ? 0 : restoreScroll ? scrollPositions.get(raw) || 0 : 0);
  restoreScroll=false;
  if (parts[0] === 'practice') practice.mount(parts,{restoreScrollY:practiceScroll});
  if (parts[0] === 'bites') bites.mount();
}
function openSearch() {if (!$('#search-dialog').open) $('#search-dialog').showModal();$('#global-search').focus();searchDialog();}
function searchDialog() {
  const query=$('#global-search').value, found=searchArticles(query), cards=query.trim() ? searchCards(biteCards,query) : [];
  $('#search-results').innerHTML=query.trim() ? `${cards.length ? `<h3 class="search-group-title">잠깐 공부</h3>${cards.slice(0,4).map(c=>`<a href="${escape(cardPreviewUrl(c,'#/search?q='+encodeURIComponent(query)))}" data-close-search><small>${subjects[c.subject].name} · ${escape(c.topic)} · 약 ${c.seconds}초</small><strong>${escape(c.kind==='vocab' ? c.term : c.title)}</strong></a>`).join('')}` : ''}${found.length ? `<h3 class="search-group-title">학습 노트</h3>${found.slice(0,5).map(a => `<a href="#/read/${a.id}" data-close-search><small>${subjects[a.subject].name} / ${escape(a.category)}</small><strong>${escape(a.title)}</strong><p>${escape(a.summary)}</p></a>`).join('')}` : ''}${found.length || cards.length ? `<a href="#/search?q=${encodeURIComponent(query)}" data-close-search><strong>노트 ${found.length}개 · 카드 ${cards.length}장 모두 보기</strong></a>` : '<p class="empty">찾은 내용이 없어요. 더 짧은 단어로 검색해 보세요.</p>'}` : '<p class="tiny-note">예: 고지자기, 변곡점, 반감기, objective, 2406</p>';
}
function updateThemeButton() {
  const dark=document.documentElement.dataset.theme === 'dark';
  $('#theme-toggle').setAttribute('aria-pressed',String(dark));
  $('#theme-toggle').setAttribute('aria-label',dark ? '밝은 화면으로 전환' : '어두운 화면으로 전환');
  $('meta[name="theme-color"]').content=dark ? '#000000' : '#ffffff';
}
document.addEventListener('click',async event => {
  if (event.target.closest('.skip')) {event.preventDefault();$('#main').focus();window.scrollTo(0,0);return;}
  const section=event.target.closest('[data-section]');
  if (section && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();scrollPositions.set(currentRoute,window.scrollY);section.closest('.mobile-toc')?.removeAttribute('open');history.pushState(null,'',section.href);currentRoute=location.hash.slice(1);goSection(section.dataset.section);return;
  }
  const image=event.target.closest('[data-image]');
  if (image) {openQuestionImage(image.dataset.image,image.dataset.caption,image);return;}
  if (event.target.closest('[data-close-search]')) $('#search-dialog').close();
  const element=event.target.closest('[data-action]');if (!element) return;
  if (element.dataset.action === 'search') openSearch();
  if (element.dataset.action === 'save') {
    const id=element.dataset.id, existing=saved.includes(id), next=existing ? saved.filter(x => x !== id) : [id,...saved];
    if (writeLocal('csat-saved',next)) {saved=next;element.textContent=existing ? '글 저장' : '저장됨';element.classList.toggle('saved',!existing);element.setAttribute('aria-pressed',String(!existing));notify(existing ? '저장을 해제했습니다.' : '이 브라우저에 저장했습니다.');}
    else notify('브라우저 저장 공간을 사용할 수 없습니다.');
  }
  if (element.dataset.action === 'share') {
    try {await navigator.clipboard.writeText(location.href);notify('글 링크를 복사했습니다.');} catch {notify('주소창의 링크를 복사해 주세요.');}
  }
  if (element.dataset.action === 'print') window.print();
});
$('#search-open').addEventListener('click',openSearch);
$('#search-close').addEventListener('click',() => $('#search-dialog').close());
$('#global-search').addEventListener('input',searchDialog);
$('#global-search').addEventListener('keydown',event => {if (event.key === 'Enter') {$('#search-dialog').close();location.hash='/search?q='+encodeURIComponent(event.target.value);}});
$('#theme-toggle').addEventListener('click',() => {const theme=document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('csat-theme',theme);}catch{}updateThemeButton();});
$('#search-dialog').addEventListener('click',event => {if (event.target === $('#search-dialog')) {const r=event.target.getBoundingClientRect();if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) event.target.close();}});
document.addEventListener('keydown',event => {if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {event.preventDefault();openSearch();}});
window.addEventListener('popstate',() => {restoreScroll=true;if (location.hash.slice(1) !== currentRoute) route();});
updateThemeButton();
if (!navigator.platform.includes('Mac')) $('kbd').textContent='Ctrl K';
try {
  const responses=await Promise.all(['articles','exams','manifest','references','exam-pdfs','examples','practice-index','bites'].map(async name => {const response=await fetch(`./data/${name}.json`);if (!response.ok) throw Error(`${name}: ${response.status}`);return response.json();}));
  let supplement, practiceIndex, biteData;[articles,{entries:exams},manifest,references,supplement,examples,practiceIndex,biteData]=responses;
  biteCards=biteData.cards;
  archive=createArchive(exams,supplement,manifest);
  practice=createPractice(practiceIndex,articles,markdown,biteCards);
  bites=createBites(biteData,articles,markdown);
  window.addEventListener('hashchange',() => {if ((location.hash.slice(1) || '/') !== currentRoute) route();});
  route();
  startOffline();
} catch (error) {
  $('#main').innerHTML='<div class="page"><h1>노트를 불러오지 못했습니다.</h1><p class="page-description">네트워크 연결을 확인하고 새로고침해 주세요.</p><button class="button" onclick="location.reload()">다시 불러오기</button></div>';console.error(error);
}
