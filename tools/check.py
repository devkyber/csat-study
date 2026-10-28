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
by_id={a['id']:a for a in all_articles}
example_ids=[]; examples=[]; heading_coverage=set()
official_hosts={'www.suneung.re.kr','wdown.ebsi.co.kr','www.ebsi.co.kr'}
for path in sorted((ROOT/'content').glob('*-examples.json')):
    payload=json.loads(path.read_text(encoding='utf-8'))
    for example in payload['examples']:
        label=example.get('id',str(path));example_ids.append(label);examples.append(example)
        article=by_id.get(example.get('articleId'))
        if not article:errors.append(f'{label}: orphan example');continue
        headings=re.findall(r'^#{2,3}\s+(.+)$',article['body'],re.M)
        if example.get('afterHeading') not in headings:errors.append(f'{label}: heading not found')
        heading_coverage.add((article['id'],example.get('afterHeading')))
        for field in ['year','session','question','sourceUrl','prompt','explanation']:
            if not example.get(field):errors.append(f'{label}: missing {field}')
        if urlparse(example.get('sourceUrl','')).hostname not in official_hosts:errors.append(f'{label}: nonofficial source')
        images=example.get('images') or [{'src':example.get('image'),'alt':example.get('alt')}]
        for image in images:
            src=image.get('src') or ''
            if not src.startswith('examples/') or '..' in src or not (ROOT/'web'/src).is_file():errors.append(f'{label}: invalid image {src}')
            if not image.get('alt'):errors.append(f'{label}: missing image alternative')
        if example.get('scriptImage') and not (ROOT/'web'/example['scriptImage']).is_file():errors.append(f'{label}: missing script image')
        if not isinstance(example.get('explanation'),str):errors.append(f'{label}: feedback must be Markdown text')
        elif len(example['explanation'])<50:errors.append(f'{label}: feedback too short')
if len(example_ids)!=len(set(example_ids)):errors.append('Duplicate example ids')
for article in all_articles:
    # Each subject teaching section must have a visible question. General habits
    # (sleep, planning, breaks) are not falsely mapped to an exam question.
    if article['subject']=='study':continue
    for heading in re.findall(r'^#{2,3}\s+(.+)$',article['body'],re.M):
        if (article['id'],heading) not in heading_coverage:errors.append(f'{article["id"]}: no example for {heading}')
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
pdfs=json.loads((ROOT/'content/exam-pdfs.json').read_text(encoding='utf-8'))
archive_ids={e['id'] for e in archive['entries']}
for item in pdfs['entries']:
    if item.get('archiveId') not in archive_ids:errors.append(f'{item["id"]}: unknown archive post')
    for file in item['files']:
        if file['format'] not in ['pdf','png','jpg','jpeg','mp3']:errors.append(f'{item["id"]}: archive file is not directly readable')
        if urlparse(file['url']).hostname not in official_hosts:errors.append(f'{item["id"]}: nonofficial PDF')
        if not file.get('verifiedAt'):errors.append(f'{item["id"]}: unverified PDF')
legacy_path=ROOT/'content/legacy-pdfs.json'
if legacy_path.exists():
    legacy=json.loads(legacy_path.read_text(encoding='utf-8'))
    for item in legacy['entries']:
        if item.get('archiveId') not in archive_ids:errors.append(f'{item["id"]}: unknown legacy archive post')
        if not item.get('provider') or not item.get('sourcePage'):errors.append(f'{item["id"]}: missing mirror attribution')
        receipt=item.get('verification',{})
        if not receipt.get('sha256') or not receipt.get('pages'):errors.append(f'{item["id"]}: unreviewed mirror PDF')
        for file in item['files']:
            if file['format']!='pdf' or urlparse(file['url']).scheme!='https':errors.append(f'{item["id"]}: unsafe legacy file')
            if not file.get('verifiedAt') or file.get('source')!=item['provider']:errors.append(f'{item["id"]}: incomplete mirror verification')
print(json.dumps({'articles':len(all_articles),'examPosts':len(archive['entries']),'inlineExamples':len(examples),'teachingSectionsWithExamples':len(heading_coverage),'errors':errors},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
