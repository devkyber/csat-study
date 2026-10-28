// Small, explicit review intervals. This is a local practice queue, not a
// prediction of mastery, a diagnostic score, or a research-validated scheduler.
export const DAY=86400000;
export const INTERVALS=[DAY,3*DAY,7*DAY,14*DAY,30*DAY];
const object=value=>value && typeof value==='object' && !Array.isArray(value);
const finite=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number' && Number.isFinite(n) && n>=min && n<=max;
const subjectIds=['korean','math','english','physics','earth','study','all'];
const boundedText=(value,limit)=>typeof value==='string' ? value.trim().slice(0,limit) : '';
const searchable=card=>[card.title,card.term,card.topic,...(card.tags || []),card.prompt,card.example].filter(value=>typeof value==='string');
const normalized=text=>String(text || '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const topicAliases={'대칭기준':'대칭 기준','상수와함수':'상수와 함수','거리와변위':'거리와 변위','역함수미분':'역함수 미분','동치검증':'동치 검증','대칭적분':'대칭 적분','역함수대칭':'역함수 대칭','항사이간격':'항 사이 간격','인수차수':'인수 차수','함숫값차':'함숫값 차','접선과교점':'접선과 교점','높이와거리':'높이와 거리','치환선택':'치환 선택','사차함수비율':'사차함수 비율','수직항력':'수직 항력'};
export const topicLabel=topic=>topicAliases[topic] || topic;
const queryTerms=query=>normalized(query).slice(0,200).split(' ').filter(Boolean);
const contains=(text,term)=>text.includes(term) || text.replace(/\s+/g,'').includes(term.replace(/\s+/g,''));
const queryMatches=(card,query)=>{
  const text=normalized(searchable(card).join(' '));
  return queryTerms(query).every(term=>contains(text,term));
};

export function normalizeFilters(input={}) {
  const number=Number(input.number);
  return {subject:subjectIds.includes(input.subject) ? input.subject : 'earth',kind:['all','quiz','vocab','tip'].includes(input.kind) ? input.kind : 'all',mode:['mix','review','saved','new'].includes(input.mode) ? input.mode : 'mix',topic:topicLabel(boundedText(input.topic,100)),size:[3,5,10].includes(Number(input.size)) ? Number(input.size) : 5,note:boundedText(input.note,100),paper:boundedText(input.paper,100),number:Number.isInteger(number) && number>0 && number<=45 ? number : 0,q:boundedText(input.q,200)};
}

export function emptyState() {return {version:1,cards:{},session:null,prefs:normalizeFilters()};}
export function normalizeState(input, validIds) {
  const result=emptyState(), valid=new Set(validIds);
  if (!object(input) || input.version!==1) return result;
  if (object(input.prefs)) result.prefs=normalizeFilters(input.prefs);
  if (object(input.cards)) for (const [id,item] of Object.entries(input.cards)) {
    if (!valid.has(id) || !object(item)) continue;
    result.cards[id]={seen:finite(item.seen,0,100000) ? Math.floor(item.seen) : 0,last:finite(item.last) ? item.last : 0,updated:finite(item.updated) ? item.updated : finite(item.last) ? item.last : 0,due:finite(item.due) ? item.due : 0,level:finite(item.level,0,INTERVALS.length) ? Math.floor(item.level) : 0,lastRating:['again','known'].includes(item.lastRating) ? item.lastRating : '',starred:item.starred===true};
  }
  const s=input.session;
  if (object(s) && Array.isArray(s.ids) && s.ids.length>0 && s.ids.length<=10 && s.ids.every(id=>valid.has(id)) && new Set(s.ids).size===s.ids.length && Number.isInteger(s.cursor) && s.cursor>=0 && s.cursor<=s.ids.length) {
    result.session={ids:s.ids,cursor:s.cursor,completed:Array.isArray(s.completed) ? [...new Set(s.completed.filter(id=>s.ids.includes(id) && s.ids.indexOf(id)<s.cursor))] : [],skipped:Array.isArray(s.skipped) ? [...new Set(s.skipped.filter(id=>s.ids.includes(id) && s.ids.indexOf(id)<s.cursor))] : [],started:finite(s.started) ? s.started : 0,revealed:s.revealed===true,selected:Number.isInteger(s.selected) && s.selected>=0 && s.selected<4 ? s.selected : null};
    if (object(s.filters)) result.session.filters=normalizeFilters({...result.prefs,note:'',paper:'',number:0,q:'',...s.filters});
    result.session.orders={};
    if (object(s.orders)) for (const [id,order] of Object.entries(s.orders)) if (s.ids.includes(id) && Array.isArray(order) && order.length>=2 && order.length<=4 && new Set(order).size===order.length && order.every(n=>Number.isInteger(n) && n>=0 && n<order.length)) result.session.orders[id]=order;
  }
  return result;
}

export function matches(card, filters={}) {
  return (!filters.subject || filters.subject==='all' || card.subject===filters.subject)
    && (!filters.kind || filters.kind==='all' || (filters.kind==='quiz' ? ['choice','recall'].includes(card.kind) : card.kind===filters.kind))
    && (!filters.topic || topicLabel(card.topic)===topicLabel(filters.topic))
    && (!filters.note || (card.noteIds || []).includes(filters.note))
    && (!filters.paper || (Number.isInteger(Number(filters.number)) && Number(filters.number)>0 && (card.refs || []).some(ref=>ref.paperId===filters.paper && ref.number===Number(filters.number))))
    && (!filters.number || Boolean(filters.paper))
    && (!filters.q || queryMatches(card,filters.q));
}
// Search the exercise, never its choices, answer, explanation or takeaway.
export function searchCards(cards,query,filters={}) {
  const terms=queryTerms(query), candidates=cards.filter(card=>matches(card,{...filters,q:''}));
  if (!terms.length) return candidates;
  return candidates.filter(card=>queryMatches(card,query)).map((card,index)=>{
    const title=normalized(card.title),term=normalized(card.term),topic=normalized(card.topic),tags=normalized((card.tags || []).join(' '));
    const score=terms.reduce((sum,q)=>sum+(term===q ? 50 : contains(term,q) ? 20 : 0)+(title===q ? 30 : contains(title,q) ? 12 : 0)+(contains(topic,q) ? 6 : 0)+(contains(tags,q) ? 4 : 0),0);
    return {card,score,index};
  }).sort((a,b)=>b.score-a.score || a.index-b.index).map(row=>row.card);
}
export function isDue(record, now=Date.now()) {return Boolean(record?.seen && record.due<=now);}
export function poolFor(cards,state,filters={},now=Date.now()) {
  return cards.filter(card=>matches(card,filters)).filter(card=>{
    const r=state.cards[card.id];
    if (filters.mode==='review') return isDue(r,now) || r?.lastRating==='again';
    if (filters.mode==='saved') return r?.starred;
    if (filters.mode==='new') return !r?.seen;
    return true;
  });
}

export function makeQueue(cards,state,filters={},now=Date.now(),random=Math.random) {
  const size=[3,5,10].includes(filters.size) ? filters.size : 5;
  const rows=poolFor(cards,state,filters,now).map(card=>{
    const record=state.cards[card.id];
    // Due cards precede new ones. Future reviews are used only if needed.
    const tier=isDue(record,now) ? 0 : !record?.seen ? 1 : 2;
    return {card,tier,order:random(),last:record?.last || 0};
  });
  const queue=[];let previousSubject='',previousTopic='';
  while(rows.length && queue.length<size) {
    const tier=Math.min(...rows.map(row=>row.tier));
    let candidates=rows.filter(row=>row.tier===tier);
    const otherSubject=candidates.filter(row=>row.card.subject!==previousSubject);
    if (otherSubject.length) candidates=otherSubject;
    const otherTopic=candidates.filter(row=>topicLabel(row.card.topic)!==previousTopic);
    if (otherTopic.length) candidates=otherTopic;
    candidates.sort((a,b)=>tier===2 ? a.last-b.last || a.order-b.order : a.order-b.order);
    const chosen=candidates[0];queue.push(chosen.card.id);
    previousSubject=chosen.card.subject;previousTopic=topicLabel(chosen.card.topic);
    rows.splice(rows.indexOf(chosen),1);
  }
  return queue;
}

export function schedule(previous,grade,now=Date.now(),correct=null) {
  const old=previous || {}, again=grade==='again' || correct===false;
  const level=again ? 0 : Math.min((old.level || 0)+1,INTERVALS.length);
  return {seen:(old.seen || 0)+1,last:now,updated:now,due:now+(again ? 10*60000 : INTERVALS[level-1]),level,lastRating:again ? 'again' : 'known',starred:old.starred===true};
}
export function choiceOrder(count,random=Math.random) {
  const order=Array.from({length:count},(_,i)=>i);
  for(let i=count-1;i>0;i--) {const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  return order;
}
export function newSession(ids,now=Date.now(),filters=null,orders={}) {return {ids,cursor:0,completed:[],skipped:[],started:now,revealed:false,selected:null,orders,...(filters ? {filters:{...filters}} : {})};}
export function sessionCard(state) {return state.session?.ids[state.session.cursor] || null;}
export function advance(state,{grade='known',correct=null,skip=false}={},now=Date.now()) {
  const id=sessionCard(state);
  if (!id) return state;
  const s=state.session;
  return {...state,cards:skip ? state.cards : {...state.cards,[id]:schedule(state.cards[id],grade,now,correct)},session:{...s,cursor:s.cursor+1,completed:skip ? s.completed : [...s.completed,id],skipped:skip ? [...s.skipped,id] : s.skipped,revealed:false,selected:null}};
}
export function mergeProgress(current,incoming,validIds) {
  const imported=normalizeState(incoming,validIds), cards={...current.cards};
  for (const [id,item] of Object.entries(imported.cards)) {
    const existing=cards[id];
    cards[id]=!existing || (item.updated || item.last)>(existing.updated || existing.last) ? {...item,starred:item.starred || existing?.starred===true} : {...existing,starred:existing.starred || item.starred};
  }
  // Import never interrupts a currently open session or changes preferences.
  return {...current,cards};
}
export function mergeLatestCards(current,incoming) {
  const result={...current};
  for (const [id,item] of Object.entries(incoming)) {
    const old=result[id];
    if (!old || (item.updated || item.last || 0)>=(old.updated || old.last || 0)) result[id]=item;
  }
  return result;
}
