import {subjects, escape, external, icon} from './ui.js';

const fileLabels = {question:'문제지', answer:'정답', explanation:'EBS 해설', script:'듣기 대본', audio:'듣기 음원'};
const examName = e => `${e.year}학년도 ${e.session === '수능' ? '수능' : e.session === '6월' || e.session === '9월' ? e.session + ' 모의평가' : e.session}`;
const option = (value, label, current) => `<option value="${escape(value)}" ${String(value) === current ? 'selected' : ''}>${escape(label)}</option>`;

export function createArchive(exams, supplement, manifest) {
  const paperIndex = new Map();
  const rows = exams.map(exam => {
    let additions = supplement.entries.filter(p => p.archiveId === exam.id);
    // A few old KICE listening uploads have a separate post from their paper.
    // Link the same year's/session's subject PDF rather than report it missing.
    const companion=!additions.length && exam.files.every(f => ['audio','script'].includes(f.kind) || ['zip','exe'].includes(f.format));
    if (companion) additions=supplement.entries.filter(p => p.year === exam.year && p.session === exam.session && exam.subjects.includes(p.subject));
    let groups = additions.map(p => ({subject:p.subject, label:(p.subjectLabel || subjects[p.subject]?.name || exam.area) + (p.variant ? ` ${p.variant}` : ''), files:p.files, provider:p.provider, sourcePage:p.sourcePage, note:p.note}));
    const urls = new Set(groups.flatMap(g => g.files.map(f => f.url)));
    const original = exam.files.filter(f => ['pdf','mp3'].includes(f.format.toLowerCase()) && !urls.has(f.url));
    // EBS supplies individual subject papers. Keep the official answer when the
    // supplement has only an explanation, but do not repeat entire paper sets.
    const keep = groups.length ? original.filter(f => f.kind === 'audio' || (f.kind === 'answer' && !groups.some(g => g.files.some(x => x.kind === 'answer')))) : original;
    if (keep.length) groups.push({subject:exam.subjects.length === 1 ? exam.subjects[0] : '', label:groups.length ? '평가원 원본' : exam.area + (exam.track ? ` ${exam.track}` : ''), files:keep});
    groups = groups.map((g, gi) => ({...g, files:g.files.filter(f => ['pdf','png','jpg','jpeg','mp3'].includes(f.format.toLowerCase())).map((f, fi) => {
      const file = {...f, id:`${exam.id}-${gi}-${fi}`, exam, groupLabel:g.label, provider:g.provider, sourcePage:g.sourcePage};
      paperIndex.set(file.id, file);
      return file;
    })})).filter(g => g.files.length);
    return {...exam, groups};
  });

  function fileLink(file) {
    const label = fileLabels[file.kind] || '자료';
    const format = file.format.toUpperCase();
    return external(file.url, `${escape(label)}<b>${format}</b>${icon('external')}`, `file-link ${file.kind}`);
  }

  function groupsFor(exam, subject) {
    return exam.groups.filter(g => !subject || !g.subject || g.subject === subject);
  }

  function questionFor(year, session, subject, variant='') {
    return rows.filter(e => e.year === year && e.session === session && e.subjects.includes(subject))
      .flatMap(e => groupsFor(e, subject)).flatMap(g => g.files)
      .find(f => f.kind === 'question' && f.format.toLowerCase() === 'pdf' && (!variant || f.groupLabel.includes(variant))) || null;
  }

  function archivePage(params) {
    let subject=params.get('subject') || '', year=params.get('year') || '', session=params.get('session') || '', q=params.get('q') || '';
    const code=q.match(/^(\d{2})(06|09|11)$/);
    if (code) {year=String(2000 + Number(code[1])); session={'06':'6월','09':'9월','11':'수능'}[code[2]]; q='';}
    const terms=q.toLowerCase().split(/\s+/).filter(Boolean);
    const found=rows.filter(e => (!subject || e.subjects.includes(subject)) && (!year || String(e.year) === year) && (!session || e.session === session) && terms.every(t => [e.title,...e.files.map(f => f.name),...e.groups.map(g => g.label)].join(' ').toLowerCase().includes(t)));
    const pageCount=Math.max(1,Math.ceil(found.length/20));
    const page=Math.min(pageCount,Math.max(1,parseInt(params.get('page'),10) || 1));
    const shown=found.slice((page-1)*20,page*20);
    const years=[...new Set(rows.map(e => e.year))].sort((a,b) => b-a);
    const pageLink=n => {const p=new URLSearchParams(params);p.set('page',n);return '#/exams?'+p;};
    const available=found.filter(e => groupsFor(e,subject).some(g => g.files.some(f => f.kind === 'question' && f.format === 'pdf'))).length;
    return `<div class="page">
      <div class="crumb"><a href="#/">홈</a><span>/</span><span>기출 PDF</span></div>
      <h1>평가원 기출 자료실</h1>
      <p class="page-description">과목과 시험을 고르면 문제지를 PDF로 바로 열 수 있습니다.<br>학습 노트에서 다룬 문제는 본문에서도 함께 확인하세요.</p>
      <form id="exam-filter" class="filters">
        <div><label for="exam-query">시험 검색</label><input type="search" id="exam-query" name="q" value="${escape(q)}" placeholder="2406, 홀수형, 미적분…"></div>
        <div><label for="exam-subject">과목</label><select id="exam-subject" name="subject">${option('','5과목 전체',subject)}${Object.entries(subjects).filter(([k]) => k !== 'study').map(([k,s]) => option(k,s.name,subject)).join('')}</select></div>
        <div><label for="exam-year">학년도</label><select id="exam-year" name="year">${option('','전 연도',year)}${years.map(y => option(String(y),y+'학년도',year)).join('')}</select></div>
        <div><label for="exam-session">시험</label><select id="exam-session" name="session">${option('','전체 회차',session)}${[...new Set(rows.map(e => e.session))].map(s => option(s,s,session)).join('')}</select></div>
        <div class="filter-actions"><button type="submit" class="button primary">기출 찾기</button><a class="button" href="#/exams">초기화</a></div>
      </form>
      <div class="result-meta"><span>${found.length}개 시험 자료 · 문제 PDF ${available}건</span><span>학년도 기준 · ${escape(supplement.checkedAt || manifest.examCheckedAt)} 확인</span></div>
      ${available < found.length ? '<p class="notice">일부 오래된 회차는 공식 공개본이 압축·실행 파일뿐입니다. 확인된 PDF를 먼저 제공하고, 개별 PDF가 없는 회차에는 공식 게시물 위치를 표시했습니다.</p>' : ''}
      <div class="archive-head" aria-hidden="true"><span>학년도 / 시험 / 영역</span><span>문제와 정답</span></div>
      <div class="exam-list">${shown.map(e => {
        const groups=groupsFor(e,subject);
        return `<section class="exam-row"><div><h3>${escape(examName(e))}</h3><div class="exam-area">${escape(e.area)}${e.track ? ' · '+escape(e.track) : ''}${e.legacy ? ' · 옛 교육과정' : ''}</div>${external(e.url,'평가원 게시물','source-link')}</div><div class="exam-files">${groups.map(g => `<div class="pdf-group"><strong>${escape(g.label)}</strong>${g.provider ? `<span class="pdf-provenance">공개 PDF 보관본 · ${external(g.sourcePage,escape(g.provider))}</span>` : ''}${g.note ? `<span class="pdf-provenance">${escape(g.note)}</span>` : ''}${g.files.map(fileLink).join('')}${g.files.some(f => f.kind === 'question' && f.format === 'pdf') ? `<a class="source-link" href="#/paper/${g.files.find(f => f.kind === 'question' && f.format === 'pdf').id}">화면에서 보기</a>` : ''}</div>`).join('') || '<p class="pdf-unavailable">개별 PDF 미확인 · 왼쪽 공식 게시물에서 원본 제공 상태를 확인할 수 있습니다.</p>'}</div></section>`;
      }).join('') || '<p class="empty">해당하는 시험이 없습니다. 과목이나 학년도 조건을 바꿔보세요.</p>'}</div>
      <div class="pagination">${page>1 ? `<a class="button" href="${pageLink(page-1)}">이전</a>` : '<button class="button" disabled>이전</button>'}<span>${page} / ${pageCount}</span>${page<pageCount ? `<a class="button" href="${pageLink(page+1)}">다음</a>` : '<button class="button" disabled>다음</button>'}</div>
      <p class="tiny-note">평가원·EBSi의 공식 파일을 우선 연결합니다. 개별 PDF가 없는 옛 시험은 실제 표지를 대조한 공개 보관본을 제공하며 보관소 이름을 표시합니다. EBS 해설은 평가원의 정답표와 구분합니다. 국어 시험지에는 선택 영역이 포함될 수 있으며 학습 노트에서는 언어와 매체를 제외했습니다. 기출 문제의 저작권은 한국교육과정평가원 및 해당 권리자에게 있습니다.</p>
    </div>`;
  }

  function paperPage(id) {
    const file=paperIndex.get(id);
    if (!file || file.format !== 'pdf') return '<div class="page"><h1>문제지를 찾을 수 없습니다.</h1><a class="button" href="#/exams">기출 자료실</a></div>';
    return `<div class="paper-shell"><div class="paper-toolbar"><div><h1>${escape(examName(file.exam))} ${escape(file.groupLabel)}</h1><p>${file.provider ? escape(file.provider)+'에 보관된 PDF입니다.' : '공식 PDF 원본입니다.'} 문서가 표시되지 않으면 ‘PDF 직접 열기’를 눌러주세요.</p></div><div>${external(file.url,'PDF 직접 열기','button primary')}<a class="button" href="#/exams?year=${file.exam.year}&session=${encodeURIComponent(file.exam.session)}">같은 시험 자료</a></div></div><iframe class="paper-frame" src="${escape(file.url)}" title="${escape(examName(file.exam)+' '+file.groupLabel+' 문제지')}" referrerpolicy="no-referrer"></iframe></div>`;
  }
  return {archivePage, paperPage, questionFor, rows};
}
