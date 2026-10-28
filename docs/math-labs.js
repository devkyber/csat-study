import {escape} from './ui.js';
import {cubicValue,cubicSlope,cubicTangent,quarticTangent} from './math-geometry.mjs';

const number=n=>String(Math.abs(n)<1e-8 ? 0 : +n.toFixed(3));
let serial=0;

function chart({id,title,description,xMin,xMax,yMin,yMax,curves=[],points=[],ticks=[]}) {
  const W=600,H=340,L=48,R=22,T=28,B=42,w=W-L-R,h=H-T-B;
  const X=x=>L+(x-xMin)/(xMax-xMin)*w,Y=y=>T+(yMax-y)/(yMax-yMin)*h;
  const path=f=>Array.from({length:321},(_,i)=>{
    const x=xMin+(xMax-xMin)*i/320;return `${i ? 'L':'M'}${X(x).toFixed(2)},${Y(f(x)).toFixed(2)}`;
  }).join(' ');
  const zeroX=Math.min(xMax,Math.max(xMin,0)),zeroY=Math.min(yMax,Math.max(yMin,0));
  return `<svg class="math-plot" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${escape(title)}</title><desc id="${id}-desc">${escape(description)}</desc><defs><clipPath id="${id}-clip"><rect x="${L}" y="${T}" width="${w}" height="${h}"/></clipPath></defs>
    <path class="math-axis" d="M${L},${Y(zeroY)}H${W-R}M${X(zeroX)},${T}V${H-B}"/>
    <text x="${W-R-2}" y="${Y(zeroY)-9}" text-anchor="end">x</text><text x="${X(zeroX)+10}" y="${T+3}">y</text>
    ${ticks.map(x=>`<path class="math-tick" d="M${X(x)},${Y(zeroY)}v5"/><text x="${X(x)}" y="${Y(zeroY)+23}" text-anchor="middle">${number(x)}</text>`).join('')}
    <g clip-path="url(#${id}-clip)">${curves.map(c=>`<path class="math-curve ${c.kind || ''}" d="${path(c.f)}"/>`).join('')}
    ${points.map(p=>`${p.guide ? `<path class="math-guide" d="M${X(p.x)},${Y(p.y)}V${H-B}"/>` : ''}<circle class="math-point ${p.kind || ''}" cx="${X(p.x)}" cy="${Y(p.y)}" r="5"/>`).join('')}</g>
    ${points.map(p=>`<text class="math-point-label ${p.kind || ''}" x="${Math.max(L+8,Math.min(W-R-8,X(p.x)+(p.dx || 10)))}" y="${Math.max(T+15,Math.min(H-B-8,Y(p.y)+(p.dy || -12)))}" text-anchor="${p.anchor || 'start'}">${escape(p.label)}</text>`).join('')}</svg>`;
}
function numberLine(points,segments=[]) {
  const sorted=[...points].sort((a,b)=>a.x-b.x),min=sorted[0].x,max=sorted.at(-1).x;
  const X=x=>max===min ? 300 : 62+(x-min)/(max-min)*476;
  return `<svg class="math-number-line" viewBox="0 0 600 130" role="img" aria-label="${escape(sorted.map(p=>`${p.label}의 x좌표 ${number(p.x)}`).join(', '))}"><path class="math-axis" d="M25,42H575"/>
    ${sorted.map(p=>`<path class="math-tick" d="M${X(p.x)},34v16"/><text x="${X(p.x)}" y="23" text-anchor="middle">${escape(p.label)}</text><text x="${X(p.x)}" y="73" text-anchor="middle">${number(p.x)}</text>`).join('')}
    ${segments.map(s=>`<path class="math-dimension" d="M${X(s.a)},88v6H${X(s.b)}v-6"/><text x="${(X(s.a)+X(s.b))/2}" y="120" text-anchor="middle">${escape(s.label)}</text>`).join('')}</svg>`;
}

const definitions={
  inflection:{title:'기울기가 바뀌는 모습을 직접 보세요',intro:'최고차항 계수가 1인 삼차함수 세 개를 비교해요. 검은 곡선은 원함수, 점선은 접선이에요. 아래 도함수 그래프에서는 같은 x에서의 기울기를 읽어요.',controls:id=>`<label for="${id}-family">비교할 삼차함수</label><select id="${id}-family" data-lab-family><option value="-3">x³ − 3x · 극점이 두 개</option><option value="0">x³ · 수평인 변곡접선</option><option value="3">x³ + 3x · 극점 없이 증가</option></select><label for="${id}-point">접점의 x좌표 <output data-lab-value>−1</output></label><input id="${id}-point" data-lab-t type="range" min="-1.5" max="1.5" step="0.25" value="-1"><p>좌우 화살표 키로도 점을 움직일 수 있어요.</p>`},
  'cubic-tangent':{title:'접점을 옮겨도 가로거리 1 : 2가 될까요?',intro:'P에서 그은 접선이 곡선과 다시 만나는 점이 Q예요. I는 변곡점이에요. 아래 수직선에서는 세 점의 x좌표만 비교해요.',controls:id=>`<label for="${id}-center">변곡점의 x좌표 h</label><select id="${id}-center" data-lab-center><option value="0">0 · y = x³ − 3x</option><option value="2">2 · y = (x − 2)³ − 3(x − 2)</option></select><label for="${id}-point">중심에서 접점까지의 좌표 차 t <output data-lab-value>1</output></label><input id="${id}-point" data-lab-t type="range" min="-1.2" max="1.2" step="0.1" value="1"><div class="math-lab-presets"><button type="button" data-lab-preset="0.7">기울어진 접선</button><button type="button" data-lab-preset="1">수평접선</button><button type="button" data-lab-preset="0">변곡접선</button></div>`},
  'quartic-tangent':{title:'사차함수의 3 : 1은 어느 구간일까요?',intro:'계산하기 쉬운 y = x³(x − 4)를 보세요. 이 예에서는 I의 변곡접선이 x축이고 Q에서 다시 만나요. M은 다른 변곡점, T는 I와 접선의 기울기가 같은 점이에요.',controls:()=>''}
};

function drawInflection(node,id) {
  const b=Number(node.querySelector('[data-lab-family]').value),t=Number(node.querySelector('[data-lab-t]').value),slope=cubicSlope(t,b);
  node.querySelector('[data-lab-value]').textContent=number(t);
  const expression=b===-3 ? 'x³ − 3x' : b===3 ? 'x³ + 3x' : 'x³', yBound=b===-3 ? 4 : b===0 ? 10:17;
  const extras=b===-3 ? [{x:-1,y:2,label:'극대',anchor:'end',dx:-10},{x:1,y:-2,label:'극소',dy:24}] : [];
  const points=[...extras,{x:0,y:0,label:Math.abs(t)<.001 ? 'I = P':'I',kind:'accent',dx:-12,anchor:'end'}];
  if (Math.abs(t)>.001) points.push({x:t,y:cubicValue(t,b),label:'P',kind:'accent',guide:true,dy:Math.abs(t-1)<.1 ? -12:24});
  node.querySelector('[data-lab-drawing]').innerHTML=`<p class="math-plot-label">원함수 f(x) = ${expression}</p>${chart({id:id+'-f',title:'삼차함수와 선택한 점의 접선',description:`변곡점 I는 (0, 0). 선택한 접점 P의 x좌표는 ${number(t)}, 접선 기울기는 ${number(slope)}.`,xMin:-2.1,xMax:2.1,yMin:-yBound,yMax:yBound,ticks:[-2,-1,0,1,2],curves:[{f:x=>cubicValue(x,b)},{kind:'tangent',f:x=>cubicValue(t,b)+slope*(x-t)}],points})}<p class="math-plot-label">도함수 f′(x) = 3x² ${b===0 ? '' : b<0 ? '− 3':'+ 3'}</p>${chart({id:id+'-df',title:'접선의 기울기를 나타낸 도함수',description:`도함수는 x=0에서 최소 ${b}. 왼쪽에서 기울기가 감소하고 오른쪽에서 증가한다.`,xMin:-2.1,xMax:2.1,yMin:-4,yMax:16,ticks:[-2,-1,0,1,2],curves:[{f:x=>cubicSlope(x,b)}],points:[{x:0,y:b,label:`최소 ${b}`,kind:'accent',anchor:'end',dx:-10},{x:t,y:slope,label:Math.abs(t)<.001 ? '' : `기울기 ${number(slope)}`,dx:t>0 ? -14:14,anchor:t>0 ? 'end':'start',dy:-35}]})}`;
  node.querySelector('[data-lab-reading]').innerHTML=`<p><strong>x = ${number(t)}에서 기울기는 ${number(slope)}.</strong> ${slope<0 ? '이 점에서는 오른쪽으로 갈수록 내려가요.' : slope>0 ? '이 점에서는 오른쪽으로 갈수록 올라가요.' : '이 점의 접선은 수평이에요.'}</p><ul><li>세 함수 모두 x = 0을 지나며 <strong>기울기가 감소하다 증가</strong>해요. 따라서 I가 변곡점이에요.</li><li>${b===-3 ? '극점은 x = −1, 1이에요. 변곡점 x = 0과 다른 위치예요.' : b===0 ? 'x = 0에서 기울기는 0이지만 계속 증가해요. 수평접선이라고 꼭 극점은 아니에요.' : '기울기가 항상 양수라 극점이 없어요. 그래도 변곡점은 있어요.'}</li></ul>`;
}
function drawCubic(node,id) {
  const t=Number(node.querySelector('[data-lab-t]').value),h=Number(node.querySelector('[data-lab-center]').value),g=cubicTangent(t,-3,h);
  node.querySelector('[data-lab-value]').textContent=number(t);
  const points=g.distinct ? [{x:h,y:0,label:'I',kind:'accent',dx:12,dy:-16},{x:g.p,y:g.yP,label:'P',kind:'accent',guide:true,dy:-14},{x:g.q,y:g.yQ,label:'Q',guide:true,dy:g.yQ>0 ? -12:24}] : [{x:h,y:0,label:'I = P = Q',kind:'accent'}];
  node.querySelector('[data-lab-drawing]').innerHTML=chart({id,title:'삼차함수의 접점과 다른 교점',description:g.distinct ? `P의 x좌표 ${number(g.p)}, I의 x좌표 ${h}, Q의 x좌표 ${number(g.q)}. I에서 P, Q까지 가로거리는 각각 ${number(g.near)}, ${number(g.far)}.` : 't=0에서는 접점과 다른 교점이 변곡점에 겹쳐 별개의 두 교점이 없다.',xMin:h-2.6,xMax:h+2.6,yMin:-11,yMax:11,ticks:[h-2,h-1,h,h+1,h+2],curves:[{f:x=>cubicValue(x,-3,h)},{f:g.tangent,kind:'tangent'}],points})+(g.distinct ? `<p class="math-plot-label">x좌표만 옮긴 수직선 · 선분 길이와 구별해요</p>${numberLine([{x:g.p,label:'P'},{x:h,label:'I'},{x:g.q,label:'Q'}],[{a:g.p,b:h,label:`${number(g.near)}`},{a:h,b:g.q,label:`${number(g.far)}`}])}` : '');
  node.querySelector('[data-lab-reading]').innerHTML=g.distinct ? `<p><strong>P: h + t = ${number(g.p)}, Q: h − 2t = ${number(g.q)}</strong></p><ul><li>I에서 P까지 가로거리는 ${number(g.near)}, I에서 Q까지는 ${number(g.far)}예요. 비는 <strong>1 : 2</strong>예요.</li><li>중심이 2로 옮겨져도 비는 같아요. 원래 x좌표끼리의 비가 아니라 <strong>변곡점에서 잰 가로거리의 비</strong>예요.</li></ul>` : '<p><strong>t = 0에서는 다른 교점이 따로 없어요.</strong></p><p>f(x) − 접선 = (x − h)³이므로 세 근이 h에 겹쳐요. 두 거리가 모두 0이어서 1 : 2라고 나누어 말할 수 없어요.</p>';
}
function drawQuartic(node,id) {
  const g=quarticTangent();
  node.querySelector('[data-lab-drawing]').innerHTML=chart({id,title:'사차함수 변곡접선의 2 대 1 대 1 가로 구간',description:'I(0,0)와 M(2,-16)은 변곡점, T(3,-27)는 I의 접선과 기울기가 같은 점, Q(4,0)는 I의 접선과 곡선의 다른 교점이다.',xMin:-.5,xMax:4.5,yMin:-33,yMax:5,ticks:[0,1,2,3,4],curves:[{f:g.value},{f:()=>0,kind:'tangent'},{f:()=>-27,kind:'tangent light'}],points:[{x:0,y:0,label:'I',kind:'accent',guide:true},{x:2,y:-16,label:'M',guide:true},{x:3,y:-27,label:'T',kind:'accent',guide:true,dx:12,dy:20},{x:4,y:0,label:'Q',guide:true,dx:-12,anchor:'end'}]})+`<p class="math-plot-label">x좌표만 비교하면 0 → 2 → 3 → 4</p>${numberLine([{x:0,label:'I'},{x:2,label:'M'},{x:3,label:'T'},{x:4,label:'Q'}],[{a:0,b:2,label:'2'},{a:2,b:3,label:'1'},{a:3,b:4,label:'1'}])}`;
  node.querySelector('[data-lab-reading]').innerHTML='<ul><li><strong>I → T → Q는 3 : 1.</strong> I와 Q 사이를 T가 나누는 가로 비예요.</li><li><strong>I → M → T → Q는 2 : 1 : 1.</strong> 다른 변곡점 M을 더 표시한 거예요.</li><li>이 예에서는 변곡접선이 수평이라 T가 극점이에요. 기울어진 변곡접선에서는 T를 원함수의 극점이라고 부르면 안 돼요.</li></ul>';
}

export function insertMathLabs(article) {
  const prose=document.querySelector('.prose');if (!prose) return;
  for (const spec of article.mathLabs || []) {
    const definition=definitions[spec.type];if (!definition) continue;
    const heading=[...prose.querySelectorAll(':scope > h2,:scope > h3')].find(h=>h.textContent.trim()===spec.afterHeading);
    if (!heading) continue;
    const id='math-lab-'+(++serial),node=document.createElement('section');node.className='math-lab';node.dataset.mathLab=spec.type;node.setAttribute('aria-labelledby',id+'-heading');
    node.innerHTML=`<h4 id="${id}-heading">${definition.title}</h4><p class="math-lab-intro">${definition.intro}</p>${definition.controls(id) ? `<div class="math-lab-controls">${definition.controls(id)}</div>` : ''}<div data-lab-drawing></div><div class="math-lab-reading" data-lab-reading aria-live="polite" aria-atomic="true"></div><p class="math-lab-caption">이해를 위한 새 예시예요. 아래 실제 기출에서도 같은 판단을 확인해 보세요.</p>`;
    let next=heading.nextElementSibling,anchor=null;
    while(next && !(next.matches('h2,h3') && next.tagName<=heading.tagName)) {
      if (spec.afterText && !anchor && next.matches('p') && next.textContent.includes(spec.afterText)) anchor=next;
      next=next.nextElementSibling;
    }
    if (anchor) anchor.after(node);else if (next) next.before(node);else prose.append(node);
    const update=()=>({inflection:drawInflection,'cubic-tangent':drawCubic,'quartic-tangent':drawQuartic}[spec.type](node,id));
    node.addEventListener('input',update);node.addEventListener('change',update);
    node.addEventListener('click',event=>{const button=event.target.closest('[data-lab-preset]');if (!button) return;node.querySelector('[data-lab-t]').value=button.dataset.labPreset;update();});update();
  }
}
