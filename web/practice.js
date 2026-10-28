import {subjects, escape, external, icon} from './ui.js';

const sessionLabel = session => session === '수능' ? '수능' : `${session} 모의평가`;
const title = paper => `${paper.year}학년도 ${sessionLabel(paper.session)} ${subjects[paper.subject].name}`;
const url = (paper, number=1) => `#/practice/${paper.id}/${number}`;
const mathOptions = {delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false,strict:'ignore',trust:false};

export function createPractice(index, articles, markdown) {
  const papers = new Map(), articleById = new Map(articles.map(article => [article.id, article]));
  let generation=0, releaseViewer=() => {};
  let progress={};
  try { progress=JSON.parse(localStorage.getItem('csat-practice') || '{}'); } catch {}
  if (!progress || Array.isArray(progress) || typeof progress !== 'object') progress={};
  const mark = (paper, question) => progress[`${paper.id}:${question.number}`] || '';
  function destroy() { generation++; releaseViewer(); releaseViewer=() => {}; }
  function list(params) {
    const subject=params.get('subject') || '', year=params.get('year') || '', session=params.get('session') || '';
    const rows=index.papers.filter(p => (!subject || p.subject===subject) && (!year || String(p.year)===year) && (!session || p.session===session));
    const options=(items,value) => items.map(([key,label]) => `<option value="${escape(key)}" ${key===value ? 'selected' : ''}>${escape(label)}</option>`).join('');
    return `<div class="page practice-index"><div class="crumb"><a href="#/">학습 노트</a><span>/</span><span>5개년 기출 분석</span></div><h1>한 문제씩, 끝까지 풀어 보기.</h1><p class="page-description">2022–2026학년도 6월·9월·수능을 모았어요.<br>먼저 직접 풀고, 풀이에서 판단이 갈린 지점을 확인해 보세요.</p>
      <p class="tiny-note practice-scope">국어는 공통·화법과 작문, 수학은 공통·미적분이에요. 영어·물리학Ⅰ·지구과학Ⅰ도 함께 볼 수 있어요.</p>
      <form id="practice-filter" class="filters"><div><label for="practice-subject">과목</label><select id="practice-subject" name="subject"><option value="">모든 과목</option>${options(Object.entries(subjects).filter(([key]) => key!=='study').map(([key,s]) => [key,s.name]),subject)}</select></div><div><label for="practice-year">학년도</label><select id="practice-year" name="year"><option value="">5개년 전체</option>${options(['2026','2025','2024','2023','2022'].map(y => [y,`${y}학년도`]),year)}</select></div><div><label for="practice-session">시험</label><select id="practice-session" name="session"><option value="">모든 시험</option>${options(['수능','9월','6월'].map(s => [s,sessionLabel(s)]),session)}</select></div><button class="button primary" type="submit">찾기</button></form>
      <div class="result-meta"><span>${rows.length}회 · ${rows.reduce((n,p) => n+p.questionCount,0).toLocaleString()}문항</span><span>정답과 풀이를 가리고 시작해요</span></div>
      <div class="practice-papers">${rows.map(p => {const done=Array.from({length:p.questionCount},(_,i) => progress[`${p.id}:${i+1}`]).filter(v => v==='done').length;return `<a class="practice-paper" href="${url(p)}"><div><small>${subjects[p.subject].name}${p.variant ? ' · '+escape(p.variant) : ''}</small><h2>${p.year}학년도 ${sessionLabel(p.session)}</h2><p>${p.questionCount}문항${done ? ` · 다시 풀 수 있어요 ${done}` : ''}</p></div>${icon('arrow')}</a>`;}).join('') || '<p class="empty">선택한 조건의 해설을 준비하고 있어요. 다른 시험을 골라 주세요.</p>'}</div>
      ${index.questionCount<2400 ? `<p class="notice">현재 ${index.questionCount.toLocaleString()} / 2,400문항의 해설을 수록했어요. 완성한 회차부터 표시하며, 문제별 풀이를 대조한 뒤 추가해요.</p>` : ''}
    </div>`;
  }
  function render(parts, params) {
    if (!parts[1]) return list(params);
    const paper=index.papers.find(p => p.id===parts[1]);
    if (!paper) return '<div class="page"><h1>시험을 찾을 수 없어요.</h1><a class="button" href="#/practice">5개년 기출 목록</a></div>';
    return `<div class="practice-shell" id="practice-detail"><p class="loading" role="status">${escape(title(paper))} 문제와 풀이를 불러오고 있어요.</p></div>`;
  }
  function detail(paper, question) {
    const related=(question.noteIds || []).map(id => articleById.get(id)).filter(Boolean);
    const pages=[...new Set([question.page,...(question.pages || [])])];
    const pageButtons=pages.map(p => `<button type="button" class="button ${p===question.page ? 'selected' : ''}" data-pdf-page="${p}" aria-pressed="${p===question.page}">${p===question.page ? '문제' : '지문'} ${p}쪽</button>`).join('');
    const viewButtons=paper.subject==='korean' ? '<button class="button selected" type="button" data-pdf-view="columns" aria-pressed="true">열별로</button><button class="button" type="button" data-pdf-view="page" aria-pressed="false">전체 쪽</button>' : question.region || question.regions ? '<button class="button selected" type="button" data-pdf-view="question" aria-pressed="true">이 문제만</button><button class="button" type="button" data-pdf-view="page" aria-pressed="false">전체 쪽</button>' : '';
    return `<div class="crumb"><a href="#/practice?subject=${paper.subject}">5개년 기출 분석</a><span>/</span><span>${paper.year}학년도 ${sessionLabel(paper.session)}</span></div>
      <div class="practice-heading"><div><p>${subjects[paper.subject].name}${paper.variant ? ' · '+escape(paper.variant) : ''}</p><h1>${question.number}번 <span>${escape(question.topic)}</span></h1></div><a class="button" href="#/practice?subject=${paper.subject}">시험 목록</a></div>
      <details class="question-index"><summary>문항 선택 <span>${question.number} / ${paper.questions.length}</span></summary><nav aria-label="문항 번호">${paper.questions.map(q => `<a href="${url(paper,q.number)}" ${q.number===question.number ? 'aria-current="page"' : ''} class="${mark(paper,q)==='done' ? 'done' : mark(paper,q)==='review' ? 'review' : ''}" aria-label="${q.number}번${mark(paper,q)==='done' ? ', 다시 풀 수 있어요' : mark(paper,q)==='review' ? ', 다시 풀어 볼 문제' : ''}">${q.number}</a>`).join('')}</nav></details>
      <div class="practice-layout"><section class="question-document" aria-label="실제 기출 문제">
        ${paper.audioUrl && question.number<=17 ? `<div class="practice-audio"><p>듣기 평가 전체 음원이에요. 재생 막대로 해당 문항을 찾아 들어 보세요.</p><audio controls preload="none" src="${escape(paper.audioUrl)}">${external(paper.audioUrl,'듣기 음원 열기')}</audio>${paper.scriptUrl ? external(paper.scriptUrl,'듣기 대본 PDF') : ''}</div>` : ''}
        <div class="pdf-controls">${paper.subject==='korean' || !viewButtons ? `<div class="pdf-pages">${pageButtons}</div>` : ''}${viewButtons ? `<div class="pdf-views" role="group" aria-label="문제 보기 방식">${viewButtons}</div>` : ''}<div><button class="button" type="button" data-pdf-zoom="out" aria-label="문제 축소">−</button><output id="pdf-zoom">100%</output><button class="button" type="button" data-pdf-zoom="in" aria-label="문제 확대">＋</button></div></div>
        <p id="pdf-status" class="tiny-note" role="status">문제 PDF를 불러오고 있어요.</p><div class="pdf-scroll" id="practice-pdf"><canvas role="img" aria-label="${escape(title(paper))}, ${question.number}번이 있는 ${question.page}쪽"></canvas></div>
        <div class="pdf-bottom"><button type="button" class="button" data-pdf-turn="-1">앞쪽</button><span id="pdf-page-label">${question.page} / ${paper.pageCount}쪽</span><button type="button" class="button" data-pdf-turn="1">뒤쪽</button>${external(paper.sourceUrl,'원본 PDF 열기')}</div>
      </section><section class="practice-solution" aria-label="문항 풀이"><p class="solution-intro">먼저 답을 골라 보세요.<br>막혔다면 풀이의 첫 단계부터 따라가 봐요.</p><details class="solution-reveal"><summary>풀이 보기</summary><ol class="solution-steps">${question.steps.map(step => `<li>${markdown(step)}</li>`).join('')}</ol><p class="practice-answer"><span>정답</span> ${escape(question.answer)}</p><div class="solution-check"><h2>다음에 확인할 것</h2>${markdown(question.check)}</div>${related.length ? `<div class="practice-related"><h2>함께 읽을 노트</h2>${related.map(a => `<a href="#/read/${a.id}">${escape(a.title)} ${icon('arrow')}</a>`).join('')}</div>` : ''}<p class="tiny-note solution-source">정답과 풀이를 EBS 해설과 대조했어요. ${external(paper.answerSourceUrl,'대조한 해설 PDF')}</p></details>
      <fieldset class="practice-progress"><legend>이 문제는 어땠나요?</legend><button class="button" type="button" data-practice-mark="review" aria-pressed="${mark(paper,question)==='review'}">다시 풀어 볼래요</button><button class="button" type="button" data-practice-mark="done" aria-pressed="${mark(paper,question)==='done'}">다시 풀 수 있어요</button><p class="tiny-note" id="practice-save-status" role="status">기록은 이 브라우저에만 남아요.</p></fieldset>
      <nav class="practice-next" aria-label="앞뒤 문항">${question.number>1 ? `<a class="button" href="${url(paper,question.number-1)}">이전 문제</a>` : '<span></span>'}${question.number<paper.questions.length ? `<a class="button primary" href="${url(paper,question.number+1)}">다음 문제 ${icon('arrow')}</a>` : `<a class="button primary" href="#/practice?subject=${paper.subject}">다른 시험 보기</a>`}</nav></section></div>`;
  }
  async function mount(parts) {
    const current=++generation, record=index.papers.find(p => p.id===parts[1]);
    if (!record) return;
    const host=document.getElementById('practice-detail');
    try {
      let paper=papers.get(record.id);
      if (!paper) {
        const response=await fetch(`./data/practice/${record.file}`);
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        paper=await response.json(); papers.set(record.id,paper);
      }
      if (generation!==current || !host.isConnected) return;
      const question=paper.questions.find(q => q.number===Number(parts[2] || 1));
      if (!question) {host.innerHTML='<h1>문항을 찾을 수 없어요.</h1><a class="button" href="'+url(paper)+'">1번부터 보기</a>';return;}
      host.innerHTML=detail(paper,question);
      document.title=`${title(paper)} ${question.number}번 | 수능 판단 노트`;
      window.renderMathInElement?.(host,mathOptions);
      host.querySelectorAll('[data-practice-mark]').forEach(button => button.addEventListener('click',() => {
        const key=`${paper.id}:${question.number}`, value=button.dataset.practiceMark;
        const next={...progress,[key]:progress[key]===value ? '' : value};
        try {localStorage.setItem('csat-practice',JSON.stringify(next));progress=next;} catch {host.querySelector('#practice-save-status').textContent='브라우저 저장 공간을 사용할 수 없어요.';return;}
        host.querySelectorAll('[data-practice-mark]').forEach(b => b.setAttribute('aria-pressed',String(progress[key]===b.dataset.practiceMark)));
        const item=host.querySelector('.question-index [aria-current]');
        item.classList.toggle('done',progress[key]==='done'); item.classList.toggle('review',progress[key]==='review');
        item.setAttribute('aria-label',`${question.number}번${progress[key]==='done' ? ', 다시 풀 수 있어요' : progress[key]==='review' ? ', 다시 풀어 볼 문제' : ''}`);
        host.querySelector('#practice-save-status').textContent=progress[key] ? '이 브라우저에 기록했어요.' : '기록을 해제했어요.';
      }));
      releaseViewer=mountPdf(host,paper,question);
    } catch (error) {
      if (generation!==current || !host.isConnected) return;
      host.innerHTML='<h1>문제를 불러오지 못했어요.</h1><p>인터넷 연결을 확인한 뒤 다시 열어 주세요.</p><a class="button" href="#/practice">시험 목록으로</a>';
      console.error(error);
    }
  }
  return {render,mount,destroy};
}

// Each mounted reader owns its loading and rendering tasks. Leaving a question
// cancels them so a late response can never paint over the next question.
function mountPdf(host,paper,question) {
  let disposed=false, loadingTask, document, renderTask, renderVersion=0;
  let pageNumber=question.page, zoom=1, cropped=Boolean(question.region || question.regions), columns=paper.subject==='korean';
  const frame=host.querySelector('#practice-pdf'), status=host.querySelector('#pdf-status');
  const updateButtons=() => {
    host.querySelector('#pdf-page-label').textContent=`${pageNumber} / ${paper.pageCount}쪽`;
    host.querySelector('#pdf-zoom').textContent=`${Math.round(zoom*100)}%`;
    host.querySelector('[data-pdf-turn="-1"]').disabled=pageNumber===1;
    host.querySelector('[data-pdf-turn="1"]').disabled=pageNumber===paper.pageCount;
    host.querySelector('[data-pdf-zoom="out"]').disabled=zoom<=1;
    host.querySelector('[data-pdf-zoom="in"]').disabled=zoom>=2.5;
    host.querySelectorAll('[data-pdf-page]').forEach(b => {const active=Number(b.dataset.pdfPage)===pageNumber;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);});
    const view=columns ? 'columns' : cropped && pageNumber===question.page ? 'question' : 'page';
    host.querySelectorAll('[data-pdf-view]').forEach(b => {const active=b.dataset.pdfView===view;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);});
  };
  async function render() {
    updateButtons(); if (!document || disposed) return;
    const version=++renderVersion;
    renderTask?.cancel();
    status.textContent='문제를 표시하고 있어요.';
    frame.setAttribute('aria-busy','true');
    try {
      const page=await document.getPage(pageNumber);
      if (disposed || version!==renderVersion) return;
      const original=page.getViewport({scale:1});
      // Overlap at the fold and retain the full page height and outer margins.
      // Shared passages, figures and choices remain available on every page.
      const regions=columns ? [[0,0,.51,1],[.49,0,1,1]] : cropped && pageNumber===question.page ? question.regions || [question.region] : [[0,0,1,1]];
      frame.replaceChildren();
      for (const [i,region] of regions.entries()) {
        if (disposed || version!==renderVersion) return;
        const viewport=page.getViewport({scale:Math.max(frame.clientWidth-2,260)/(original.width*(region[2]-region[0]))*zoom});
        const ratio=Math.min(window.devicePixelRatio || 1,2), canvas=globalThis.document.createElement('canvas');
        const visibleWidth=viewport.width*(region[2]-region[0]), visibleHeight=viewport.height*(region[3]-region[1]);
        canvas.width=Math.ceil(visibleWidth*ratio);canvas.height=Math.ceil(visibleHeight*ratio);
        canvas.style.width=`${visibleWidth}px`;canvas.style.height=`${visibleHeight}px`;
        const columnLabel=columns ? `${pageNumber}쪽 · ${i===0 ? '왼쪽' : '오른쪽'} 열` : '';
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${title(paper)}, ${columnLabel || `PDF ${pageNumber}쪽${regions.length>1 ? `, 이어지는 지문 ${i+1}/${regions.length}` : ''}`}`);
        if (columns) {
          const label=globalThis.document.createElement('p');label.className='pdf-column-label';label.textContent=columnLabel;frame.append(label);
        }
        frame.append(canvas);
        renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,-viewport.width*region[0]*ratio,-viewport.height*region[1]*ratio]});
        await renderTask.promise;
      }
      if (disposed || version!==renderVersion) return;
      status.textContent=columns ? `${pageNumber}쪽의 왼쪽 열 다음 오른쪽 열을 읽어요. 글씨가 작으면 ＋ 버튼으로 확대해 보세요.` : cropped && pageNumber===question.page ? `${question.number}번을 크게 보고 있어요. 글씨가 작으면 ＋ 버튼으로 더 확대할 수 있어요.` : `${pageNumber}쪽이에요. 글씨가 작으면 ＋ 버튼으로 확대해 보세요.`;
      frame.scrollTo(0,0);
    } catch(error) {
      if (disposed || version!==renderVersion || error.name==='RenderingCancelledException') return;
      status.textContent='문제를 표시하지 못했어요. 아래의 원본 PDF를 열어 주세요.';
      console.error(error);
    } finally {
      if (!disposed && version===renderVersion) frame.setAttribute('aria-busy','false');
    }
  }
  host.querySelectorAll('[data-pdf-page]').forEach(b => b.addEventListener('click',() => {pageNumber=Number(b.dataset.pdfPage);render();}));
  host.querySelectorAll('[data-pdf-view]').forEach(b => b.addEventListener('click',() => {columns=b.dataset.pdfView==='columns';cropped=b.dataset.pdfView==='question';if (paper.subject!=='korean') pageNumber=question.page;zoom=1;render();}));
  host.querySelectorAll('[data-pdf-turn]').forEach(b => b.addEventListener('click',() => {pageNumber=Math.min(paper.pageCount,Math.max(1,pageNumber+Number(b.dataset.pdfTurn)));render();}));
  host.querySelectorAll('[data-pdf-zoom]').forEach(b => b.addEventListener('click',() => {zoom=Math.min(2.5,Math.max(1,zoom+(b.dataset.pdfZoom==='in' ? .25 : -.25)));render();}));
  let resizeTimer, width=frame.clientWidth;
  const observer=new ResizeObserver(() => {if (Math.abs(width-frame.clientWidth)<2) return;width=frame.clientWidth;clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120);});
  observer.observe(frame);updateButtons();
  (async () => {
    try {
      const pdfjs=await import('./vendor/pdfjs/pdf.mjs');
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
      const base=new URL('./vendor/pdfjs/',import.meta.url).href;
      loadingTask=pdfjs.getDocument({url:paper.sourceUrl,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',iccUrl:base+'iccs/'});
      document=await loadingTask.promise;
      if (disposed) return;
      await render();
    } catch(error) {
      if (disposed) return;
      status.textContent='문제 PDF를 불러오지 못했어요. 아래의 원본 PDF를 열어 주세요.';
      console.error(error);
    }
  })();
  return () => {disposed=true;renderVersion++;clearTimeout(resizeTimer);observer.disconnect();renderTask?.cancel();loadingTask?.destroy();};
}
