// Small, explicit review intervals. This is a local practice queue, not a
// prediction of mastery, a diagnostic score, or a research-validated scheduler.
export const DAY=86400000;
export const INTERVALS=[DAY,3*DAY,7*DAY,14*DAY,30*DAY];
const object=value=>value && typeof value==='object' && !Array.isArray(value);
const finite=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number' && Number.isFinite(n) && n>=min && n<=max;

export function emptyState() {return {version:1,cards:{},session:null,prefs:{subject:'earth',kind:'all',mode:'mix',topic:'',size:5}};}
export function normalizeState(input, validIds) {
  const result=emptyState(), valid=new Set(validIds);
  if (!object(input) || input.version!==1) return result;
  if (object(input.prefs)) {
    for (const key of ['subject','kind','mode','topic']) if (typeof input.prefs[key]==='string' && input.prefs[key].length<100) result.prefs[key]=input.prefs[key];
    if ([3,5,10].includes(input.prefs.size)) result.prefs.size=input.prefs.size;
  }
  if (object(input.cards)) for (const [id,item] of Object.entries(input.cards)) {
    if (!valid.has(id) || !object(item)) continue;
    result.cards[id]={seen:finite(item.seen,0,100000) ? Math.floor(item.seen) : 0,last:finite(item.last) ? item.last : 0,updated:finite(item.updated) ? item.updated : finite(item.last) ? item.last : 0,due:finite(item.due) ? item.due : 0,level:finite(item.level,0,INTERVALS.length) ? Math.floor(item.level) : 0,lastRating:['again','known'].includes(item.lastRating) ? item.lastRating : '',starred:item.starred===true};
  }
  const s=input.session;
  if (object(s) && Array.isArray(s.ids) && s.ids.length>0 && s.ids.length<=10 && s.ids.every(id=>valid.has(id)) && new Set(s.ids).size===s.ids.length && Number.isInteger(s.cursor) && s.cursor>=0 && s.cursor<=s.ids.length) {
    result.session={ids:s.ids,cursor:s.cursor,completed:Array.isArray(s.completed) ? [...new Set(s.completed.filter(id=>s.ids.includes(id) && s.ids.indexOf(id)<s.cursor))] : [],skipped:Array.isArray(s.skipped) ? [...new Set(s.skipped.filter(id=>s.ids.includes(id) && s.ids.indexOf(id)<s.cursor))] : [],started:finite(s.started) ? s.started : 0,revealed:s.revealed===true,selected:Number.isInteger(s.selected) && s.selected>=0 && s.selected<4 ? s.selected : null};
    if (object(s.filters)) result.session.filters={subject:typeof s.filters.subject==='string' ? s.filters.subject : result.prefs.subject,kind:['all','quiz','vocab','tip'].includes(s.filters.kind) ? s.filters.kind : 'all',mode:['mix','review','saved','new'].includes(s.filters.mode) ? s.filters.mode : 'mix',topic:typeof s.filters.topic==='string' ? s.filters.topic : '',size:[3,5,10].includes(s.filters.size) ? s.filters.size : 5};
    result.session.orders={};
    if (object(s.orders)) for (const [id,order] of Object.entries(s.orders)) if (s.ids.includes(id) && Array.isArray(order) && order.length>=2 && order.length<=4 && new Set(order).size===order.length && order.every(n=>Number.isInteger(n) && n>=0 && n<order.length)) result.session.orders[id]=order;
  }
  return result;
}

export function matches(card, filters={}) {
  return (!filters.subject || filters.subject==='all' || card.subject===filters.subject) && (!filters.kind || filters.kind==='all' || (filters.kind==='quiz' ? ['choice','recall'].includes(card.kind) : card.kind===filters.kind)) && (!filters.topic || card.topic===filters.topic);
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
    const otherTopic=candidates.filter(row=>row.card.topic!==previousTopic);
    if (otherTopic.length) candidates=otherTopic;
    candidates.sort((a,b)=>tier===2 ? a.last-b.last || a.order-b.order : a.order-b.order);
    const chosen=candidates[0];queue.push(chosen.card.id);
    previousSubject=chosen.card.subject;previousTopic=chosen.card.topic;
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
