"""Index official KICE archive metadata. Does not mirror copyrighted exam files."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from urllib.parse import urlencode
import json, re, time, sys
import requests
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache'/'kice'; CACHE.mkdir(parents=True,exist_ok=True)
BASE='https://www.suneung.re.kr/boardCnts/'
DATE='2026-10-28'
def page(board, number):
    p=CACHE/f'{board}-{number}.html'
    if p.exists(): return p.read_text(encoding='utf-8')
    for attempt in range(3):
        try:
            r=requests.get(BASE+'list.do',params={'boardID':board,'m':'0403','s':'suneung','page':number},timeout=45)
            r.raise_for_status(); html=r.content.decode('utf-8');
            if 'goView(' not in html: raise ValueError('Expected archive rows missing')
            p.write_text(html,encoding='utf-8'); return html
        except Exception:
            if attempt==2: raise
            time.sleep(2+attempt)
def parse(board, number):
    soup=BeautifulSoup(page(board,number),'html.parser'); entries=[]
    for tr in soup.select('table.wb tbody tr'):
        cells=[c.get_text(' ',strip=True) for c in tr.select('td')]
        view=tr.select_one('a[onclick*="goView"]')
        if not view or len(cells)<5: continue
        ids=re.findall(r"'([^']*)'",view.get('onclick',''))
        seq=ids[1]; year=int(cells[1])
        session=cells[2] if board=='1500236' else '수능'
        area=cells[3] if board in ('1500235','1500236') else cells[2]
        track=cells[2] if board=='1500235' else ''
        subjects=[]
        if area in ('국어','언어'): subjects=['korean']
        elif area in ('수학','수리','수리탐구Ⅰ','수리탐구I','수리탐구(Ⅰ)','수리탐구( I )'): subjects=['math']
        elif area in ('영어','외국어','외국어(영어)'): subjects=['english']
        elif '과학' in area or ('수리' in area and ('Ⅱ' in area or 'II' in area)): subjects=['physics','earth']
        if not subjects: continue
        files=[]
        for a in tr.select('a[onclick*="fn_fileDown"]'):
            fid=re.search(r"fn_fileDown\('([^']+)'",a.get('onclick',''))
            if not fid: continue
            name=a.get('title') or (a.img.get('alt') if a.img else '') or '공식 첨부'
            kind='answer' if any(x in name for x in ['정답','답안']) else 'script' if '대본' in name else 'audio' if any(x in name for x in ['음원','듣기','mp3']) else 'question'
            files.append({'name':name,'url':BASE+'fileDown.do?fileSeq='+fid.group(1),'kind':kind,'format':name.rsplit('.',1)[-1].lower()})
        url=BASE+'view.do?'+urlencode({'boardID':board,'boardSeq':seq,'lev':0,'m':'0403','statusYN':'W','s':'suneung'})
        entries.append({'id':seq,'year':year,'session':session,'area':area,'track':track,'subjects':subjects,'title':f'{year}학년도 {session} {area}'+(' '+track if track else ''),'url':url,'files':files,'legacy':board=='1500235','checkedAt':DATE,'bundle':subjects==['physics','earth'],'publishedAt':cells[5] if board in ('1500235','1500236') else cells[4]})
    return entries
all_entries=[]; audits=[]
for board in ['1500234','1500235','1500236']:
    soup=BeautifulSoup(page(board,1),'html.parser')
    match=re.search(r'전체\s*([\d,]+)\s*건',soup.get_text(' ',strip=True))
    if not match: raise ValueError('Archive total missing')
    total=int(match.group(1).replace(',','')); pages=(total+9)//10
    with ThreadPoolExecutor(max_workers=3) as pool:
        batches=list(pool.map(lambda p:parse(board,p),range(1,pages+1)))
    selected=[x for b in batches for x in b]; all_entries.extend(selected)
    audits.append({'board':board,'officialPosts':total,'pagesRead':pages,'selectedPosts':len(selected)})
    print(json.dumps(audits[-1],ensure_ascii=False),flush=True)
unique={e['id']:e for e in all_entries}
entries=sorted(unique.values(),key=lambda x:(x['year'],{'수능':3,'9월':2,'6월':1}.get(x['session'],0),x['area']),reverse=True)
output={'checkedAt':DATE,'publisher':'한국교육과정평가원','archiveAudit':audits,'entries':entries,'notes':['공식 게시물과 첨부파일 주소를 수집한 자료실입니다. 모든 문항에 자체 해설이 있는 것은 아닙니다.','과학탐구는 여러 과목의 문제·정답이 묶여 있는 공식 ZIP/PDF로 제공될 수 있습니다.','옛 교육과정의 영역과 문항 구성은 현재와 다릅니다. 국어 원본 시험지는 공통·선택 영역을 함께 포함할 수 있습니다.']}
(ROOT/'content').mkdir(exist_ok=True)
(ROOT/'content'/'exams.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'entries':len(entries),'years':[min(e['year'] for e in entries),max(e['year'] for e in entries)],'areas':dict(Counter(e['area'] for e in entries))},ensure_ascii=False))
