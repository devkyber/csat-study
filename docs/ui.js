export const subjects = {
  korean: {name: '국어', desc: '지문을 읽는 순서와 선지를 판단하는 근거'},
  math: {name: '수학', desc: '조건을 해석하고 풀이를 떠올리는 방법'},
  english: {name: '영어', desc: '글의 중심을 잡고 문장 사이를 연결하는 방법'},
  physics: {name: '물리학Ⅰ', desc: '상황을 그림으로 옮기고 물리량을 비교하는 방법'},
  earth: {name: '지구과학Ⅰ', desc: '자료를 읽고 개념을 적용할 때 놓치기 쉬운 것들'},
  study: {name: '공부하는 법', desc: '오답, 복습, 인강과 실전에서 남긴 공부 팁'}
};

export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const paths = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  external: '<path d="M14 4h6v6m0-6-11 11M10 4H4v16h16v-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  korean: '<path d="M3 4h8l1 2 1-2h8v16h-8l-1 1-1-1H3V4Zm9 2v15M6 8h3M6 12h3M15 8h3M15 12h3"/>',
  math: '<path d="M4 3v17h17M6 17c4 0 4-12 8-12s3 10 7 10"/>',
  english: '<path d="M3 4h18v13H9l-5 4v-4H3V4Zm4 5h10M7 13h7"/>',
  physics: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-35 12 12)"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(35 12 12)"/>',
  earth: '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6.5c5 2 11 2 16 0M4 17.5c5-2 11-2 16 0"/>',
  study: '<path d="M5 3h14v18H5V3Zm4 5 1.5 1.5L14 6M9 13h6M9 17h6"/>'
};
export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}
export function external(url, label, className = '') {
  return `<a class="${className}" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

export function decayFigure() {
  const points = Array.from({length: 81}, (_, i) => {
    const t = i / 20;
    return `${45 + t * 76},${181 - 144 * 2 ** -t}`;
  }).join(' ');
  return `<figure class="judgment-figure">
    <div class="figure-label"><strong>반감기 자료를 읽을 때</strong><span>지구과학Ⅰ</span></div>
    <svg class="decay-graphic" viewBox="0 0 390 235" role="img" aria-label="모원소의 남은 비율은 반감기가 한 번 지날 때마다 1, 2분의 1, 4분의 1로 줄어듭니다.">
      <path class="axis" d="M45 22v159h316"/>
      <path class="guide" d="M45 109h76v72M45 145h152v36"/>
      <polyline class="curve" points="${points}"/>
      <circle class="point" cx="121" cy="109" r="4"/><circle class="point" cx="197" cy="145" r="4"/>
      <text x="17" y="42">1</text><text x="7" y="113">½</text><text x="7" y="149">¼</text>
      <text x="41" y="204">0</text><text x="116" y="204">T</text><text x="189" y="204">2T</text>
      <text x="314" y="204">시간</text><text x="53" y="24">남은 비율</text>
    </svg>
    <div class="figure-steps"><div>처음 양 확인<strong>처음에 얼마였나?</strong></div><div>남은 비율 계산<strong>몇 분의 1인가?</strong></div><div>반감기 횟수 판단<strong>몇 번 반으로 줄었나?</strong></div></div>
    <figcaption>양이 얼마나 줄었는지보다 <a href="#/read/earth-decay">처음의 몇 분의 1이 남았는지</a> 비교합니다. T는 반감기입니다.</figcaption>
  </figure>`;
}
