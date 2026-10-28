"""Validate substantive site data and links between authored records."""
from pathlib import Path
from urllib.parse import urlparse
import json,re,sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
errors=[]; all_articles=[]
for subject in ['korean','math','english','physics','earth','study']:
    path=ROOT/'content'/f'{subject}.json'
    if not path.exists(): errors.append(f'missing subject {subject}');continue
    data=json.loads(path.read_text(encoding='utf-8'))
    for a in data:
        for field in ['id','subject','category','title','summary','tags','body','refs']:
            if field not in a: errors.append(f'{subject}: missing {field}')
        if a.get('subject')!=subject: errors.append(f'{a.get("id")}: subject mismatch')
        if not re.fullmatch(r'[a-z0-9-]+',a.get('id','')): errors.append(f'unsafe id {a.get("id")}')
        if len(a.get('body',''))<80: errors.append(f'{a.get("id")}: thin/empty body')
        if '[[' in a.get('body',''): errors.append(f'{a.get("id")}: unresolved Obsidian markup')
        if re.search(r'C:[/\\]|tae06|태호|정주|\b010[- ]\d|gh[pousr]_[A-Za-z0-9]',json.dumps(a,ensure_ascii=False)): errors.append(f'{a.get("id")}: private data candidate')
    all_articles.extend(data)
ids=[a['id'] for a in all_articles]
if len(ids)!=len(set(ids)):errors.append('Duplicate ids')
archive=json.loads((ROOT/'content/exams.json').read_text(encoding='utf-8'))
for e in archive['entries']:
    if not e['files']:errors.append(f'No files: {e["id"]}')
    for url in [e['url']]+[f['url'] for f in e['files']]:
        if urlparse(url).hostname!='www.suneung.re.kr':errors.append(f'Nonofficial archive link: {e["id"]}')
if len(set(e['id'] for e in archive['entries']))!=len(archive['entries']):errors.append('Duplicate exam ids')
for path in (ROOT/'content').glob('*reference-checks.json'):
    for ref in json.loads(path.read_text(encoding='utf-8')):
        if ref.get('articleId') and ref['articleId'] not in ids:errors.append(f'Orphan ref {ref}')
        if ref.get('status')=='question' and not ref.get('questions'):errors.append(f'Question ref lacks number: {ref}')
print(json.dumps({'articles':len(all_articles),'examPosts':len(archive['entries']),'errors':errors},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
