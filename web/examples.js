import {escape, external} from './ui.js';

function exampleHtml(example, markdown) {
  const images=example.images || (example.image ? [{src:example.image,alt:example.alt}] : []);
  const session=['6월','9월'].includes(example.session) ? example.session+' 모의평가' : example.session;
  const label=`${example.year}학년도 ${session}${example.variant ? ' '+example.variant : ''} ${example.question}번`;
  return `<section class="worked-example" id="example-${escape(example.id)}" aria-label="${escape(label)} 적용 문제">
    <div class="example-head"><strong>${escape(label)}</strong><span class="example-sources">${example.pdfUrl ? external(example.pdfUrl,'문제 PDF') : ''}${external(example.sourceUrl,escape(example.sourceLabel || (example.sourceUrl.includes('boardCnts/view') ? '공식 출처' : '원본 PDF')))}</span></div>
    ${example.prompt ? `<div class="example-prompt">${escape(example.prompt)}</div>` : ''}
    ${images.map(img => `<button class="question-image" type="button" data-image="${escape(img.src)}" data-caption="${escape(label)}" aria-label="${escape(label)} 크게 보기"><img src="./${escape(img.src)}" alt="${escape(img.alt || example.alt || label)}" width="${Number(img.width)}" height="${Number(img.height)}" loading="lazy" decoding="async"></button>`).join('')}
    ${example.audioUrl ? `<div class="example-audio"><p>${escape(example.audioLabel || '이 시험의 전체 듣기 음원')}</p><audio controls preload="none" src="${escape(example.audioUrl)}" aria-label="${escape(label)} 시험 듣기 음원"></audio></div>` : ''}
    <p class="example-caption">${escape(example.caption || '한국교육과정평가원 출제. 위 판단을 적용할 문항을 발췌했습니다.')} · 누르면 크게 볼 수 있습니다.</p>
    ${example.scope ? `<p class="example-scope">${escape(example.scope)}</p>` : ''}
    <details class="example-feedback"><summary>판단 과정 확인하기</summary>${markdown(example.explanation || '')}${example.answer ? `<p><strong>정답</strong> ${escape(example.answer)}</p>` : ''}${example.scriptImage ? `<p>해당 문항의 실제 듣기 대본</p><button class="question-image" type="button" data-image="${escape(example.scriptImage)}" data-caption="${escape(label)} 듣기 대본" aria-label="듣기 대본 크게 보기"><img src="./${escape(example.scriptImage)}" alt="${escape(label)} 듣기 대본" loading="lazy"></button>` : ''}</details>
  </section>`;
}

export function insertExamples(article, examples, markdown) {
  const prose=document.querySelector('.prose');
  if (!prose) return;
  const headings=[...prose.querySelectorAll('h2,h3')];
  const groups=Map.groupBy(examples.filter(e => e.articleId === article.id), e => e.afterHeading || '');
  for (const [heading, entries] of groups) {
    const match=headings.find(h => h.textContent.trim() === heading.trim());
    const html=entries.map(e => exampleHtml(e,markdown)).join('');
    if (!match) {prose.insertAdjacentHTML('beforeend',html); continue;}
    // Place each worked question after the explanation for its own heading.
    let next=match.nextElementSibling;
    while (next && !(next.matches('h2,h3') && next.tagName <= match.tagName)) next=next.nextElementSibling;
    if (next) next.insertAdjacentHTML('beforebegin',html);
    else prose.insertAdjacentHTML('beforeend',html);
  }
}

export function openQuestionImage(src, caption, trigger) {
  let dialog=document.querySelector('#image-dialog');
  if (!dialog) {
    dialog=document.createElement('dialog');
    dialog.id='image-dialog';dialog.className='image-dialog';
    document.body.append(dialog);
  }
  dialog.innerHTML=`<div class="dialog-top"><p>${escape(caption)}</p><button class="icon-button" aria-label="확대 이미지 닫기">×</button></div><img src="./${escape(src)}" alt="${escape(caption)}">`;
  dialog.querySelector('button').onclick=() => dialog.close();
  dialog.onclose=() => trigger?.focus();
  dialog.showModal();
}
