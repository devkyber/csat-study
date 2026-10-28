// Execute the production reader with only browser/storage/PDF boundaries faked.
// No browser, network, build, or output files are needed for these regressions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'web/practice.js'),'utf8');
const subjects=Object.fromEntries(['earth','physics','english','math','korean','study'].map(s=>[s,{name:s}]));
const disk=new Map(),events=[],scrolls=[],counts=[];
let failWrite=false,failRead=false,currentHost,waitForPdf=null;
global.localStorage={getItem(key){if(failRead)throw Error('read denied');return disk.get(key)??null;},setItem(key,value){if(failWrite)throw Error('quota');disk.set(key,value);}};
global.window={addEventListener(type,fn){if(type==='storage')events.push(fn);},scrollTo(...args){scrolls.push(args);},renderMathInElement(){},devicePixelRatio:1};
global.matchMedia=()=>({matches:true});
function el(dataset={}) {
  const attrs={},classes=new Set(),handlers={};
  return {dataset,attrs,handlers,textContent:'',open:false,style:{},classList:{toggle(c,on){on?classes.add(c):classes.delete(c);},contains:c=>classes.has(c)},
    setAttribute(k,v){attrs[k]=v;},hasAttribute:k=>k in attrs,addEventListener(k,fn){handlers[k]=fn;},focus(){this.focused=true;},scrollIntoView(){},getContext(){return {};},querySelector(){return this.marker;}};
}
global.document={getElementById:()=>currentHost,querySelectorAll:()=>counts,createElement:()=>el()};
global.ResizeObserver=class{observe(){}disconnect(){}};
const real=JSON.parse(fs.readFileSync(path.join(root,'content/practice/earth/earth-2026-11.json'),'utf8'));
real.questions[0].noteIds=['earth-read'];real.questions[1].noteIds=['earth-graphs'];
const index={papers:[{...real,file:'earth-2026-11.json',questionCount:20}],questionCount:2400};
global.fetch=async()=>({ok:true,json:async()=>real});
const pdfCalls=[];
const fakePdf=(host,paper,question,view)=>{pdfCalls.push({host,paper,question,view});const release=()=>{};release.ready=waitForPdf || Promise.resolve();return release;};
const factorySource=source.slice(0,source.indexOf('\nfunction mountQuestionNavigation')).replace(/^import .*;\r?\n/gm,'').replace('export function createPractice','function createPractice');
const create=new Function('subjects','escape','external','icon','mountPdf','mountQuestionNavigation',factorySource+'\nreturn createPractice;')(subjects,String,()=>'',()=>'',fakePdf,()=>()=>{});
const articles=[{id:'earth-read',title:'조건 읽기'},{id:'earth-graphs',title:'그래프 읽기'}];
function host(paper=real,number=1) {
  const buttons=['review','done'].map(mark=>el({practiceMark:mark})),reveal=el(),status=el();
  const steps=paper.questions.find(q=>q.number===number).steps.map(()=>el()),stageControls=el(),conclusion=el(),stageStatus=el();
  const stages=['next','all'].map(type=>{const button=el();button.setAttribute('data-solution-'+type,'');return button;});
  const numbers=Array.from({length:2},()=>paper.questions.map(q=>{const n=el({questionNumber:String(q.number)});n.marker=el();return n;})).flat();
  return {isConnected:true,buttons,reveal,status,numbers,steps,stages,stageControls,conclusion,stageStatus,html:'',
    set innerHTML(value){this.html=value;reveal.open=/<details class="solution-reveal" open>/.test(value);const shown=Number(value.match(/단계 중 (\d+)단계를/)?.[1]||1);steps.forEach((step,i)=>{step.hidden=i>=shown;});conclusion.hidden=shown<steps.length;stageControls.hidden=shown>=steps.length;},get innerHTML(){return this.html;},
    querySelector(s){if(s==='.solution-reveal')return reveal;if(s==='#practice-save-status')return status;if(s==='.solution-conclusion')return conclusion;if(s==='.solution-stage-controls')return stageControls;if(s==='.solution-stage-status')return stageStatus;throw Error('unexpected selector '+s);},
    querySelectorAll(s){if(s==='[data-practice-mark]')return buttons;if(s==='[data-question-number]')return numbers;if(s==='[data-solution-step]')return steps;if(s==='[data-solution-next],[data-solution-all]')return stages;return [];}};
}
const state=()=>JSON.parse(disk.get('csat-practice')||'{}');
const emit=raw=>events.forEach(fn=>fn({key:'csat-practice',newValue:raw,storageArea:localStorage}));
async function mount(instance,number=1,options){const h=host(real,number);currentHost=h;await instance.mount(['practice',real.id,String(number)],options);return h;}
const tested=[];
(async()=>{
  const a=create(index,articles,String),b=create(index,articles,String),ha=await mount(a,1),hb=await mount(b,2);
  ha.buttons[0].handlers.click();hb.buttons[1].handlers.click();
  assert.deepEqual(state(),{[real.id+':1']:'review',[real.id+':2']:'done'});
  tested.push('a stale tab saves another question without deleting the first tab record');
  const counter=el({practiceCount:real.id});counts.push(counter);emit(disk.get('csat-practice'));
  assert.equal(hb.numbers[0].classList.contains('review'),true);
  assert.equal(ha.numbers[1].classList.contains('done'),true);
  assert.equal(hb.buttons[1].attrs['aria-pressed'],'true');
  assert.match(counter.textContent,/다시 풀 수 있어요 1/);
  tested.push('storage event updates both number grids, active buttons and list totals');
  // Clear using the latest disk value, even when a local closure was stale.
  hb.buttons[1].handlers.click();assert.equal(state()[real.id+':2'],'');assert.equal(state()[real.id+':1'],'review');
  ha.buttons[0].handlers.click();assert.equal(state()[real.id+':1'],'');
  assert.equal(state()[real.id+':2'],'');tested.push('same-question toggle clears only that record');
  ha.buttons[0].handlers.click();emit(disk.get('csat-practice'));
  const before=disk.get('csat-practice');failWrite=true;hb.buttons[1].handlers.click();failWrite=false;
  assert.equal(disk.get('csat-practice'),before);assert.match(hb.status.textContent,/저장 공간/);
  assert.equal(hb.buttons[1].attrs['aria-pressed'],'false');
  failRead=true;hb.buttons[1].handlers.click();failRead=false;assert.equal(disk.get('csat-practice'),before);
  tested.push('read/write failure retains existing records and reports failure without optimistic UI');
  disk.delete('csat-practice');emit(null);
  assert.equal(ha.buttons[0].attrs['aria-pressed'],'false');assert.equal(counter.textContent,'20문항');
  assert.ok(ha.numbers.every(n=>!n.classList.contains('review')&&!n.classList.contains('done')));
  tested.push('storage removal clears live markers and totals');
  disk.set('csat-practice','{broken');const recovered=create(index,articles,String),hr=await mount(recovered);
  hr.buttons[0].handlers.click();assert.equal(state()[real.id+':1'],'review');
  tested.push('invalid saved JSON recovers into a valid record');

  const reader=create(index,articles,String),first=await mount(reader,1);
  first.reveal.open=true;Object.assign(pdfCalls.at(-1).view,{pageNumber:3,zoom:1.75,cropped:false,columns:false});
  reader.destroy();await mount(reader,2);assert.equal(pdfCalls.at(-1).view.pageNumber,undefined);
  reader.destroy();const returned=await mount(reader,1);
  assert.equal(returned.reveal.open,true);assert.match(returned.html,/<details class="solution-reveal" open>/);
  assert.equal(pdfCalls.at(-1).view.pageNumber,3);assert.equal(pdfCalls.at(-1).view.zoom,1.75);
  tested.push('solution/PDF settings survive note round-trip and stay separate for each question');
  const gradual=create(index,articles,String),g1=await mount(gradual,1);
  assert.ok(g1.steps.length>2);assert.equal(g1.steps.filter(s=>!s.hidden).length,1);assert.equal(g1.conclusion.hidden,true);
  g1.reveal.open=true;g1.stages[0].handlers.click();
  assert.equal(g1.steps.filter(s=>!s.hidden).length,2);assert.equal(g1.conclusion.hidden,true);assert.equal(g1.steps[1].focused,true);
  gradual.destroy();const g2=await mount(gradual,1);
  assert.equal(g2.steps.filter(s=>!s.hidden).length,2);assert.equal(g2.reveal.open,true);
  g2.stages[1].handlers.click();assert.ok(g2.steps.every(s=>!s.hidden));assert.equal(g2.conclusion.hidden,false);assert.equal(g2.stageControls.hidden,true);
  assert.equal(g2.steps[2].focused,true);
  gradual.destroy();const g3=await mount(gradual,1);assert.equal(g3.conclusion.hidden,false);assert.ok(g3.steps.every(s=>!s.hidden));
  const sequential=await mount(create(index,articles,String),1);
  for(let shown=1;shown<sequential.steps.length;shown++) {
    assert.equal(sequential.conclusion.hidden,true);
    sequential.stages[0].handlers.click();
    assert.equal(sequential.steps.filter(s=>!s.hidden).length,shown+1);
  }
  assert.equal(sequential.conclusion.hidden,false);assert.equal(sequential.stageControls.hidden,true);
  tested.push('first step only, next/all controls, answer gating and revealed stage persist with focus');
  let resolve;waitForPdf=new Promise(r=>resolve=r);const pendingHost=host();currentHost=pendingHost;scrolls.length=0;
  const pending=reader.mount(['practice',real.id,'1'],{restoreScrollY:777});await new Promise(r=>setImmediate(r));
  assert.deepEqual(scrolls,[]);resolve();await pending;assert.deepEqual(scrolls,[[0,777]]);
  waitForPdf=new Promise(r=>resolve=r);currentHost=host();scrolls.length=0;
  const obsolete=reader.mount(['practice',real.id,'1'],{restoreScrollY:999});await new Promise(r=>setImmediate(r));reader.destroy();resolve();await obsolete;
  assert.deepEqual(scrolls,[]);waitForPdf=null;
  tested.push('history scroll restores after PDF settles; stale async mount cannot scroll another route');

  const linked=create(index,articles,String,[
    {subject:'earth',refs:[{paperId:real.id,number:1}]},{subject:'earth',refs:[{paperId:real.id,number:1}]},
    {subject:'earth',refs:[{paperId:real.id,number:2}]},{subject:'earth',refs:[{paperId:'earth-2025-11',number:1}]},
    {subject:'english',refs:[{paperId:real.id,number:1}]},
  ]);
  const exact=await mount(linked,1);
  assert.match(exact.html,/이 문항에 연결된 2장/);assert.match(exact.html,/paper=earth-2026-11&number=1/);
  assert.ok(!exact.html.includes('note=earth-read'));
  const fallback=await mount(create(index,articles,String),1);
  assert.match(fallback.html,/노트의 판단 연습/);assert.match(fallback.html,/note=earth-read&paper=&number=/);
  tested.push('practice links constrain the exact paper/question; fallback constrains a related note');
  const english=structuredClone(real);english.id='english-2026-11';english.subject='english';
  english.questions[0].noteIds=['eng-read'];
  global.fetch=async()=>({ok:true,json:async()=>english});
  const en=create({papers:[{...english,file:'en.json',questionCount:20}],questionCount:2400},[{id:'eng-read',title:'읽기 판단'}],String);
  currentHost=host(english);await en.mount(['practice',english.id,'1']);
  assert.match(currentHost.html,/subject=english&kind=quiz/);assert.match(currentHost.html,/note=eng-read/);
  tested.push('English note fallback asks for quizzes rather than unrelated vocabulary');

  // Exercise the actual PDF view state code, substituting only PDF.js/canvas APIs.
  const pdfjs={GlobalWorkerOptions:{},getDocument(){return {destroy(){},promise:Promise.resolve({getPage:async()=>({getViewport:({scale})=>({width:1000*scale,height:1400*scale}),render:()=>({promise:Promise.resolve(),cancel(){}})})})};}};
  const pdfSource=source.slice(source.indexOf('function mountPdf(')).replace("import('./vendor/pdfjs/pdf.mjs')","Promise.resolve(fakePdfJs)").replaceAll('import.meta.url',"'https://example.test/practice.js'");
  const realMountPdf=new Function('fakePdfJs','title',pdfSource+'\nreturn mountPdf;')(pdfjs,()=> 'test');
  function pdfHost(){
    const frame={...el(),clientWidth:400,scrollLeft:0,scrollTop:0,replaceChildren(){},append(){},scrollTo(x,y){this.scrollLeft=x;this.scrollTop=y;}};
    const status=el(),zoom=el(),label=el();
    const groups={
      '[data-pdf-page]':[el({pdfPage:'1'}),el({pdfPage:'3'})],
      '[data-pdf-view]':[el({pdfView:'columns'}),el({pdfView:'page'}),el({pdfView:'question'})],
      '[data-pdf-turn]':[el({pdfTurn:'-1'}),el({pdfTurn:'1'})],
      '[data-pdf-zoom]':[el({pdfZoom:'out'}),el({pdfZoom:'in'})],
    };
    return {frame,groups,status,zoom,label,querySelector(s){if(s==='#practice-pdf')return frame;if(s==='#pdf-status')return status;if(s==='#pdf-zoom')return zoom;if(s==='#pdf-page-label')return label;const key=s.startsWith('[data-pdf-turn')?'[data-pdf-turn]':'[data-pdf-zoom]';return groups[key][s.includes('="-1"')||s.includes('="out"')?0:1];},querySelectorAll:s=>groups[s]||[]};
  }
  const stored={pageNumber:3,zoom:1.75,cropped:false,columns:false,scrollLeft:40,scrollTop:120};
  const ph=pdfHost(),release=realMountPdf(ph,{...real,subject:'korean'},real.questions[0],stored);await release.ready;
  assert.equal(ph.zoom.textContent,'175%');assert.match(ph.label.textContent,/^3 \/ /);
  assert.equal(ph.frame.scrollLeft,40);assert.equal(ph.frame.scrollTop,120);
  assert.equal(ph.groups['[data-pdf-view]'][1].attrs['aria-pressed'],'true');
  ph.groups['[data-pdf-zoom]'][1].handlers.click();await new Promise(r=>setImmediate(r));
  assert.equal(stored.zoom,2);assert.equal(ph.frame.scrollLeft,0);
  ph.frame.scrollLeft=60;ph.frame.scrollTop=220;release();assert.equal(stored.scrollLeft,60);assert.equal(stored.scrollTop,220);
  tested.push('real PDF state code restores page/zoom/view/internal scroll and persists later controls');
  console.log(JSON.stringify({passed:tested.length,checks:tested},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
