"""Check the short practice collection, its source links and note coverage."""
from pathlib import Path
from collections import Counter
import json,re,sys
root=Path(__file__).resolve().parents[1]
subjects={'korean':50,'math':50,'english':110,'physics':40,'earth':54,'study':24}
notes={a['id']:a for s in subjects for a in json.loads((root/f'content/{s}.json').read_text(encoding='utf8'))}
papers={p.stem:json.loads(p.read_text(encoding='utf8')) for p in (root/'content/practice').glob('*/*.json')}
errors=[];warnings=[];ids=set();prompts=set();covered=set();counts=Counter();kinds=Counter();vocab=[]
def require(condition,message):
    if not condition:errors.append(message)
for subject,minimum in subjects.items():
    path=root/f'content/bites/{subject}.json'
    if not path.exists():errors.append(f'{subject}: missing collection');continue
    cards=json.loads(path.read_text(encoding='utf8'))
    require(isinstance(cards,list),f'{subject}: expected array')
    if not isinstance(cards,list):continue
    for c in cards:
        ident=c.get('id','?');counts[subject]+=1;kinds[c.get('kind')]+=1
        require(bool(re.fullmatch(r'bite-[a-z0-9-]+',ident)) and ident not in ids,f'{ident}: invalid/duplicate id');ids.add(ident)
        require(c.get('subject')==subject,f'{ident}: subject mismatch')
        require(c.get('kind') in ['choice','recall','tip','vocab'],f'{ident}: invalid kind')
        for field in ['title','topic','prompt','takeaway']:
            require(isinstance(c.get(field),str) and bool(c[field].strip()),f'{ident}: missing {field}')
        key=(subject,c.get('prompt'),c.get('example'))
        require(key not in prompts,f'{ident}: duplicate exercise');prompts.add(key)
        require(isinstance(c.get('seconds'),int) and 10<=c['seconds']<=90,f'{ident}: invalid time estimate')
        require(isinstance(c.get('explanation'),list) and 1<=len(c['explanation'])<=4 and all(isinstance(x,str) and len(x.strip())>=8 for x in c['explanation']),f'{ident}: missing reasoning')
        if c['kind'] in ['choice','vocab']:
            choices=c.get('choices',[])
            require(isinstance(choices,list) and 2<=len(choices)<=4 and all(isinstance(x,str) and x.strip() for x in choices),f'{ident}: invalid choices')
            require(len(set(choices))==len(choices),f'{ident}: duplicated choice')
            require(type(c.get('answer')) is int and 0<=c['answer']<len(choices),f'{ident}: invalid answer')
        if c['kind']=='recall':require(isinstance(c.get('answerText'),str) and bool(c['answerText'].strip()),f'{ident}: missing recall answer')
        if c['kind']=='vocab':
            vocab.append(c)
            require(subject=='english' and all(isinstance(c.get(f),str) and c[f].strip() for f in ['term','example']),f'{ident}: incomplete vocabulary')
            require(bool(c.get('refs')),f'{ident}: no actual exam reference for vocabulary')
        note_ids=c.get('noteIds',[]);refs=c.get('refs',[])
        require(bool(note_ids or refs),f'{ident}: no grounding')
        for n in note_ids:
            require(n in notes and notes[n]['subject']==subject,f'{ident}: wrong note {n}');covered.add(n)
        for ref in refs:
            p=papers.get(ref.get('paperId'));n=ref.get('number')
            require(bool(p) and type(n) is int and 1<=n<=len(p['questions']),f'{ident}: invalid exam reference {ref}')
            if p:require(subject=='study' or p['subject']==subject,f'{ident}: wrong exam subject')
        text=' '.join([c.get('prompt',''),*c.get('choices',[]),*c.get('explanation',[]),c.get('takeaway',''),c.get('example','')])
        require(not re.search(r'TODO|TBD|추후 작성|예시 예정|M03|\ufffd',text),f'{ident}: placeholder/removed source marker')
        if len(text)>850:warnings.append(f'{ident}: long card ({len(text)} characters)')
    require(len(cards)>=minimum,f'{subject}: {len(cards)} < {minimum} cards')
require(len(vocab)>=80,f'Vocabulary: {len(vocab)} < 80')
missing=sorted(set(notes)-covered)
require(not missing,f'Notes without short practice: {missing}')
report={'cards':sum(counts.values()),'bySubject':dict(counts),'byKind':dict(kinds),'notesCovered':len(set(notes)&covered),'totalNotes':len(notes),'errors':errors,'warnings':warnings}
print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(bool(errors))
