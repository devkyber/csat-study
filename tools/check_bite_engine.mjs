import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DAY,emptyState,normalizeState,normalizeFilters,topicLabel,matches,searchCards,poolFor,makeQueue,schedule,newSession,advance,mergeProgress,mergeLatestCards,choiceOrder} from '../web/bite-engine.mjs';
const cards=Array.from({length:12},(_,i)=>({id:`c${i}`,subject:i%2 ? 'earth':'english',kind:i%3 ? 'choice':'vocab',topic:`t${i%4}`}));
const ids=cards.map(c=>c.id), now=1800000000000;
let state=emptyState();state.cards.c0={seen:1,last:now-DAY,due:now-1,level:1,lastRating:'known'};
state.cards.c2={seen:1,last:now-1000,due:now+DAY,level:1,lastRating:'known'};
const queue=makeQueue(cards,state,{size:5},now,()=>.5);
assert.equal(queue[0],'c0');assert.equal(queue.length,5);assert.equal(new Set(queue).size,5);assert.ok(!queue.includes('c2'));
assert.deepEqual(makeQueue(cards,state,{subject:'math'},now),[]);
assert.ok(makeQueue(cards,state,{kind:'vocab',size:10},now).every(id=>cards.find(c=>c.id===id).kind==='vocab'));
assert.equal(schedule(undefined,'known',now).due,now+DAY);
assert.equal(schedule({level:1,seen:1},'known',now).due,now+3*DAY);
assert.equal(schedule({level:5,seen:5},'known',now,false).due,now+600000);
assert.equal(schedule({level:5,seen:5},'known',now,false).level,0);
state.session=newSession(['c0','c1'],now);
state=advance(state,{skip:true},now);assert.equal(state.cards.c0.seen,1);assert.equal(state.session.cursor,1);assert.equal(state.session.completed.length,0);
state=advance(state,{grade:'again'},now);assert.equal(state.cards.c1.lastRating,'again');assert.equal(state.session.completed.length,1);
const finished=JSON.stringify(state);assert.equal(JSON.stringify(advance(state,{},now)),finished);
assert.deepEqual(normalizeState({version:1,cards:{c0:{seen:-3,due:Infinity,level:99}},session:{ids:['c0','no'],cursor:0}},ids).session,null);
assert.equal(normalizeState({version:1,cards:{c0:{seen:-3,due:Infinity,level:99}}},ids).cards.c0.seen,0);
const corrupt=normalizeState({version:1,session:{ids:['c0','c0'],cursor:0}},ids);assert.equal(corrupt.session,null);
const incoming=emptyState();incoming.cards.c1={seen:10,last:now-1,due:now+DAY,level:4,starred:true};
const merged=mergeProgress(state,incoming,ids);assert.equal(merged.cards.c1.seen,1);assert.equal(merged.cards.c1.starred,true);assert.deepEqual(merged.session,state.session);
assert.equal(makeQueue(cards,state,{mode:'saved'},now).length,0);
assert.ok(makeQueue(cards,merged,{mode:'saved'},now).includes('c1'));
assert.ok(makeQueue(cards,state,{mode:'review'},now).includes('c1'));
const oldTab={c1:{last:now,updated:now,starred:true}},newTab={c1:{last:now,updated:now+1,starred:false},c2:{last:now,updated:now}};
assert.equal(mergeLatestCards(newTab,oldTab).c1.starred,false);assert.ok(mergeLatestCards(oldTab,newTab).c2);
assert.deepEqual(choiceOrder(3,()=>0),[1,2,0]);
const ordered=emptyState();ordered.session=newSession(['c1'],now,{subject:'earth',size:3},{c1:[2,0,1]});ordered.session.selected=0;ordered.session.revealed=true;
assert.deepEqual(normalizeState(ordered,ids).session.orders.c1,[2,0,1]);assert.equal(normalizeState(ordered,ids).session.selected,0);assert.equal(normalizeState(ordered,ids).session.filters.subject,'earth');

const root=new URL('../',import.meta.url),subjects=['korean','math','english','physics','earth','study'];
const actual=subjects.flatMap(s=>JSON.parse(fs.readFileSync(new URL(`content/bites/${s}.json`,root),'utf8')));
const notes=subjects.flatMap(s=>JSON.parse(fs.readFileSync(new URL(`content/${s}.json`,root),'utf8')));
const actualIds=actual.map(c=>c.id),empty=emptyState();
assert.equal(poolFor(actual,empty,{note:'math-cubic'}).length,12);
assert.equal(makeQueue(actual,empty,{note:'math-study',size:5},now).length,2);
assert.ok(makeQueue(actual,empty,{note:'math-cubic',subject:'math',size:5},now).every(id=>actual.find(c=>c.id===id).noteIds.includes('math-cubic')));
assert.deepEqual(poolFor(actual,empty,{note:'missing-note'}),[]);
assert.deepEqual(poolFor(actual,empty,{paper:'korean-2022-06',number:18}).map(c=>c.id),['bite-korean-105']);
assert.deepEqual(poolFor(actual,empty,{paper:'korean-2022-06',number:0}),[]);
assert.deepEqual(poolFor(actual,empty,{number:18}),[]);
assert.deepEqual(poolFor(actual,empty,{paper:'missing-paper',number:18}),[]);
assert.deepEqual(poolFor(actual,empty,{note:'math-cubic',paper:'korean-2022-06',number:18}),[]);
const scope=normalizeFilters({subject:'math',note:'math-cubic',paper:'math-2026-11',number:'9',q:'  접선  ',size:'3'});
const scoped=emptyState();scoped.session=newSession(['bite-math-020'],now,scope);
assert.deepEqual(normalizeState(scoped,actualIds).session.filters,scope);
assert.equal(normalizeFilters({number:'bad',q:'x'.repeat(300)}).q.length,200);
assert.equal(normalizeFilters({number:'bad'}).number,0);
const aliases=[['대칭 기준','대칭기준'],['상수와 함수','상수와함수'],['거리와 변위','거리와변위'],['역함수 미분','역함수미분'],['동치 검증','동치검증'],['대칭 적분','대칭적분'],['역함수 대칭','역함수대칭'],['항 사이 간격','항사이간격'],['인수 차수','인수차수'],['함숫값 차','함숫값차'],['접선과 교점','접선과교점'],['높이와 거리','높이와거리'],['치환 선택','치환선택'],['사차함수 비율','사차함수비율'],['수직 항력','수직항력']];
for (const [canonical,alias] of aliases) {
  assert.equal(topicLabel(alias),canonical);
  assert.deepEqual(poolFor(actual,empty,{topic:alias}).map(c=>c.id),poolFor(actual,empty,{topic:canonical}).map(c=>c.id));
}
assert.equal(poolFor(actual,empty,{subject:'math',topic:'접선과교점'}).length,5);
assert.notEqual(topicLabel('기울기'),topicLabel('기울기 변화'));
const searchFixture=[
 {id:'keyword',subject:'math',kind:'choice',title:'접선에서 무엇을 볼까요',topic:'대칭 기준',tags:['변곡점'],prompt:'두 점의 위치를 비교해요.',choices:['선지전용토큰','다른선지'],answer:0,explanation:['해설전용토큰'],takeaway:'요령전용토큰',answerText:'정답전용토큰'},
 {id:'word',subject:'english',kind:'vocab',title:'문맥 속 단어',term:'Observe',topic:'어휘',tags:[],prompt:'어떤 뜻일까요?',example:'We observe a distant star.',choices:['관찰하다','제출하다'],answer:0,explanation:['관찰하다라는 뜻이에요.']}
];
for (const query of ['접선','변곡점','두 위치','대칭기준']) assert.equal(searchCards(searchFixture,query)[0].id,'keyword');
assert.equal(searchCards(searchFixture,'OBSERVE')[0].id,'word');
assert.equal(searchCards(searchFixture,'distant star')[0].id,'word');
for (const query of ['선지전용토큰','해설전용토큰','요령전용토큰','정답전용토큰','관찰하다']) assert.deepEqual(searchCards(searchFixture,query),[]);
assert.deepEqual(searchCards(searchFixture,'observe',{subject:'math'}),[]);
assert.equal(matches(searchFixture[0],{q:'변곡점 위치'}),true);
const reviewState=emptyState(),vocab=actual.find(c=>c.kind==='vocab');
reviewState.cards[vocab.id]={seen:1,due:now+DAY,lastRating:'again',starred:true};
for (const mode of ['review','saved']) {
  assert.equal(poolFor(actual,reviewState,{subject:'english',kind:'quiz',mode},now).length,0);
  assert.equal(poolFor(actual,reviewState,{subject:'english',kind:'vocab',mode},now).length,1);
}

// Exercise controller state with a minimal host; full browser layout is checked separately.
const storage=new Map(),handlers=new Map();
globalThis.window={addEventListener(){},scrollTo(){}};
globalThis.localStorage={getItem:key=>storage.get(key) || null,setItem:(key,value)=>storage.set(key,value)};
globalThis.location={hash:'#/bites',href:'https://example.test/#/bites'};
globalThis.matchMedia=()=>({matches:true});
const target={focus(){},scrollIntoView(){}};
const host={innerHTML:'',addEventListener:(type,fn)=>handlers.set(type,fn),removeEventListener:type=>handlers.delete(type),contains:()=>true,querySelector:selector=>selector==='.bite-guide' ? null : target};
globalThis.document={getElementById:()=>host,querySelectorAll:()=>[]};
const {createBites}=await import('../web/bites.js');
storage.set('csat-bites-v1',JSON.stringify({...reviewState,prefs:{...empty.prefs,subject:'math',note:'math-cubic',paper:'math-2026-11',number:9,q:'old-filter'}}));
const controller=createBites({cards:actual},notes,text=>String(text));
const html=(query='',parts=['bites'])=>controller.render(parts,new URLSearchParams(query));
assert.match(html('subject=math'),/150장 중 골라요/);
assert.doesNotMatch(html('subject=math'),/value="old-filter"/);
assert.match(html('note=math-study'),/수학 2장 시작/);
assert.match(html('note=en-main-idea'),/25장 중 골라요/);
assert.match(html('paper=korean-2022-06&number=18'),/국어 1장 시작/);
assert.match(html('subject=english&kind=quiz&mode=review'),/다시 볼 것 0/);
assert.match(html('subject=english&kind=vocab&mode=saved'),new RegExp(`href="#/bites/card/${vocab.id}\\?from=`));
assert.match(html('subject=english&kind=vocab&mode=review'),/id="bite-results-title">다시 볼 카드/);
assert.match(html('subject=all&q=접선'),/type="submit" disabled>묶음으로 보려면 과목을 골라 주세요/);
assert.match(html('subject=math&topic=접선과교점'),/5장 중 골라요/);
assert.equal((html('subject=math').match(/<option[^>]*>접선과 교점<\/option>/g)||[]).length,1);
const previewId='bite-math-001', previewCard=actual.find(c=>c.id===previewId);
let previewHtml=html('', ['bites','card',previewId]);host.innerHTML=previewHtml;controller.mount();
const originalOrder=[...previewHtml.matchAll(/data-bite-choice="(\d)"/g)].map(m=>m[1]);
const click=async (attribute,dataset={})=>{
 const button={hasAttribute:key=>key===attribute,dataset};
 await handlers.get('click')({target:{closest:()=>button}});
};
await click('data-bite-choice',{biteChoice:String(previewCard.answer)});
assert.match(host.innerHTML,/맞아요. 이유도 짚어 봐요/);
controller.destroy();
assert.ok(controller.continuation().href.startsWith(`#/bites/card/${previewId}?from=`));
previewHtml=html('', ['bites','card',previewId]);
assert.match(previewHtml,/맞아요. 이유도 짚어 봐요/);
assert.doesNotMatch(previewHtml,/data-bite-reveal/);
assert.deepEqual([...previewHtml.matchAll(/data-bite-choice="(\d)"/g)].map(m=>m[1]),originalOrder);
const origin='#/search?q=geometry&subject=math';
previewHtml=html(new URLSearchParams({from:origin}).toString(),['bites','card',previewId]);
assert.match(previewHtml,/href="#\/search\?q=geometry&amp;subject=math"/);
assert.match(previewHtml,/맞아요. 이유도 짚어 봐요/);
previewHtml=html('', ['bites','card',previewId]);
assert.match(previewHtml,/href="#\/search\?q=geometry&amp;subject=math"/);
const newerOrigin='#/bites?subject=math&q=new-search';
previewHtml=html(new URLSearchParams({from:newerOrigin}).toString(),['bites','card',previewId]);
assert.match(previewHtml,/href="#\/bites\?subject=math&amp;q=new-search"/);
for(const invalid of ['https://example.com/','#/bites/card/'+previewId,'#/bites/unknown','#/search#bad']) {
  const result=html(new URLSearchParams({from:invalid}).toString(),['bites','card',previewId]);
  assert.match(result,/href="#\/bites\?subject=math&amp;q=new-search"/);
}
host.innerHTML=previewHtml;controller.mount();await click('data-bite-rate',{biteRate:'known'});
assert.equal(controller.continuation(),null);
assert.equal(location.hash,newerOrigin.slice(1));
assert.match(html('', ['bites','card',previewId]),/data-bite-reveal/);
controller.destroy();
storage.set('csat-bites-v1',JSON.stringify({...empty,prefs:{...empty.prefs,subject:'english',kind:'vocab'}}));
const vocabPrefs=createBites({cards:actual},notes,text=>String(text));
assert.match(vocabPrefs.render(['bites'],new URLSearchParams('subject=math')),/150장 중 골라요/);
console.log('Short practice: scheduling, scope/refs, safe search, 15 topic aliases, filtered counts, saved/review lists and preview continuation passed.');
