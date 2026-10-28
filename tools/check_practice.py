"""Validate completed paper files; use --require-complete before a full release."""
from pathlib import Path
from collections import Counter
import json,re,sys
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
EXPECTED={'korean':45,'math':30,'english':45,'physics':20,'earth':20}
MONTH={'6월':'06','9월':'09','수능':'11'}
articles={a['id']:a for s in EXPECTED for a in json.loads((ROOT/f'content/{s}.json').read_text(encoding='utf8'))}
errors=[];counts=Counter();ids=set();step_sets=set()
region_path=ROOT/'content/practice-regions.json'
regions=json.loads(region_path.read_text(encoding='utf8')) if region_path.exists() else {}
def require(condition,message):
    if not condition: errors.append(message)
for file in sorted((ROOT/'content/practice').glob('*/*.json')):
    try: paper=json.loads(file.read_text(encoding='utf8'))
    except (ValueError,OSError) as exc: errors.append(f'{file.name}: {exc}');continue
    name=paper.get('id',file.name);subject=paper.get('subject');questions=paper.get('questions',[])
    require(name not in ids,f'{name}: duplicate id');ids.add(name)
    require(subject in EXPECTED,f'{name}: unexpected subject')
    require(paper.get('year') in range(2022,2027),f'{name}: unexpected year')
    require(paper.get('session') in MONTH,f'{name}: unexpected session')
    if subject not in EXPECTED or paper.get('session') not in MONTH:continue
    require(name==f"{subject}-{paper['year']}-{MONTH[paper['session']]}",f'{name}: inconsistent id')
    require(file.parent.name==subject and file.stem==name,f'{name}: inconsistent path')
    require([q.get('number') for q in questions]==list(range(1,EXPECTED[subject]+1)),f'{name}: incomplete or unordered paper')
    require(paper.get('variant')=={'math':'미적분','korean':'화법과 작문'}.get(subject,paper.get('variant')),f'{name}: wrong selection')
    require(isinstance(paper.get('pageCount'),int) and paper['pageCount']>0,f'{name}: invalid page count')
    for key in ['sourceUrl','answerSourceUrl']:
        parsed=urlparse(paper.get(key,''))
        require(parsed.scheme=='https' and parsed.hostname=='wdown.ebsi.co.kr' and parsed.path.lower().endswith('.pdf'),f'{name}: {key} is not a direct official PDF')
    for question in questions:
        label=f"{name} #{question.get('number')}"
        require(isinstance(question.get('page'),int) and 1<=question['page']<=paper.get('pageCount',0),f'{label}: invalid page')
        require(all(isinstance(p,int) and 1<=p<=paper.get('pageCount',0) for p in question.get('pages',[])),f'{label}: invalid passage pages')
        require(bool(re.fullmatch(r'[①②③④⑤]|\d{1,3}',str(question.get('answer','')))),f'{label}: invalid answer')
        if subject!='math':require(question.get('answer') in ['①','②','③','④','⑤'],f'{label}: expected multiple-choice answer')
        require(isinstance(question.get('topic'),str) and len(question['topic'])>=2,f'{label}: missing topic')
        steps=question.get('steps',[])
        # A final answer step can be short; do not force filler into a clear solution.
        require(isinstance(steps,list) and len(steps)>=3 and all(isinstance(s,str) and len(s.strip())>=5 for s in steps),f'{label}: incomplete reasoning')
        key=tuple(steps)
        require(key not in step_sets,f'{label}: duplicated full reasoning');step_sets.add(key)
        require(isinstance(question.get('check'),str) and len(question['check'])>=12,f'{label}: missing check')
        for note_id in question.get('noteIds',[]):
            require(note_id in articles and articles[note_id]['subject']==subject,f'{label}: invalid note {note_id}')
        require(not re.search(r'TODO|TBD|추후 작성|풀이 준비 중|해설 준비 중',' '.join(steps)),f'{label}: placeholder')
        if '--require-complete' in sys.argv and subject!='korean':
            region=regions.get(f"{name}:{question['number']}")
            require(bool(region),f'{label}: missing PDF view region')
            if region:
                parts=region if isinstance(region[0],list) else [region]
                require(all(isinstance(p,list) and len(p)==4 and all(isinstance(v,(int,float)) for v in p) and 0<=p[0]<p[2]<=1 and 0<=p[1]<p[3]<=1 for p in parts),f'{label}: invalid PDF view region')
    counts[subject]+=len(questions)
if '--require-complete' in sys.argv:
    for subject,n in EXPECTED.items(): require(counts[subject]==15*n,f'{subject}: {counts[subject]} / {15*n} completed')
print(json.dumps({'papers':len(ids),'questions':sum(counts.values()),'bySubject':dict(counts),'errors':errors},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
