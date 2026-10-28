"""Build the public site from edited content; never copies the private source inventory."""
from pathlib import Path
import json, shutil, sys, hashlib
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'
SUBJECTS=['korean','math','english','physics','earth','study']
def main():
    articles=[]
    for subject in SUBJECTS:
        path=ROOT/'content'/f'{subject}.json'
        if not path.exists():
            if '--preview' in sys.argv: continue
            raise SystemExit(f'Missing required content: {subject}')
        data=json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(data,list) or not data: raise SystemExit(f'Empty subject: {subject}')
        articles.extend(data)
    ids=[a['id'] for a in articles]
    if len(ids)!=len(set(ids)): raise SystemExit('Duplicate article ids')
    OUT.mkdir(exist_ok=True)
    for p in (ROOT/'web').iterdir():
        if p.name.endswith('.template.js'): continue
        if p.is_file(): shutil.copy2(p,OUT/p.name)
        elif p.is_dir(): shutil.copytree(p,OUT/p.name,dirs_exist_ok=True)
    vendor=OUT/'vendor'; vendor.mkdir(exist_ok=True)
    deps=ROOT/'node_modules'
    shutil.copy2(deps/'marked/lib/marked.esm.js',vendor/'marked.esm.js')
    shutil.copy2(deps/'dompurify/dist/purify.min.js',vendor/'purify.min.js')
    for name in ['katex.min.css','katex.min.js']: shutil.copy2(deps/'katex/dist'/name,vendor/name)
    shutil.copy2(deps/'katex/dist/contrib/auto-render.min.js',vendor/'auto-render.min.js')
    shutil.copytree(deps/'katex/dist/fonts',vendor/'fonts',dirs_exist_ok=True)
    for package,license_name in [('katex','LICENSE'),('marked','LICENSE.md'),('dompurify','LICENSE'),('pdfjs-dist','LICENSE')]:
        shutil.copy2(deps/package/license_name,vendor/f'{package}-LICENSE.txt')
    pdfjs=vendor/'pdfjs';pdfjs.mkdir(exist_ok=True)
    for name in ['pdf.mjs','pdf.worker.mjs']:
        shutil.copy2(deps/'pdfjs-dist/build'/name,pdfjs/name)
    for name in ['cmaps','standard_fonts','wasm','iccs']:
        shutil.copytree(deps/'pdfjs-dist'/name,pdfjs/name,dirs_exist_ok=True)
    data_dir=OUT/'data';data_dir.mkdir(exist_ok=True)
    (data_dir/'articles.json').write_text(json.dumps(articles,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    archive=json.loads((ROOT/'content/exams.json').read_text(encoding='utf-8'))
    (data_dir/'exams.json').write_text(json.dumps(archive,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    pdf_path=ROOT/'content/exam-pdfs.json'
    pdfs=json.loads(pdf_path.read_text(encoding='utf-8')) if pdf_path.exists() else {'entries':[]}
    official_pdf_count=len(pdfs['entries'])
    legacy_path=ROOT/'content/legacy-pdfs.json'
    legacy=json.loads(legacy_path.read_text(encoding='utf-8')) if legacy_path.exists() else {'entries':[]}
    pdfs['entries'].extend(legacy['entries'])
    (data_dir/'exam-pdfs.json').write_text(json.dumps(pdfs,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    examples=[]
    for path in sorted((ROOT/'content').glob('*-examples.json')):
        examples.extend(json.loads(path.read_text(encoding='utf-8'))['examples'])
    for example in examples:
        images=example.get('images') or [{'src':example['image'],'alt':example['alt']}]
        for image in images:
            with Image.open(ROOT/'web'/image['src']) as source:
                image['width'],image['height']=source.size
        example['images']=images
        if example.get('scriptImage'):
            with Image.open(ROOT/'web'/example['scriptImage']) as source:
                example['scriptWidth'],example['scriptHeight']=source.size
    (data_dir/'examples.json').write_text(json.dumps(examples,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    refs={}
    for path in (ROOT/'content').glob('*reference-checks.json'):
        for item in json.loads(path.read_text(encoding='utf-8')):
            key=item.get('articleId') or item.get('subject')
            if not key: raise ValueError('Reference needs articleId or subject')
            refs[key+':'+item['raw']]=item
    (data_dir/'references.json').write_text(json.dumps(refs,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    practice=[]
    region_path=ROOT/'content/practice-regions.json'
    regions=json.loads(region_path.read_text(encoding='utf-8')) if region_path.exists() else {}
    for path in sorted((ROOT/'content/practice').glob('*/*.json')):
        paper=json.loads(path.read_text(encoding='utf-8'))
        for question in paper['questions']:
            region=regions.get(f"{paper['id']}:{question['number']}")
            if region:question['regions' if isinstance(region[0],list) else 'region']=region
        relative=path.relative_to(ROOT/'content/practice')
        target=data_dir/'practice'/relative;target.parent.mkdir(exist_ok=True,parents=True)
        target.write_text(json.dumps(paper,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        practice.append({key:paper[key] for key in ['id','subject','year','session','variant']})
        practice[-1].update(file=relative.as_posix(),questionCount=len(paper['questions']))
    practice.sort(key=lambda p:(-p['year'],{'수능':0,'9월':1,'6월':2}[p['session']],SUBJECTS.index(p['subject'])))
    practice_index={'papers':practice,'questionCount':sum(p['questionCount'] for p in practice),'targetQuestionCount':2400,'years':[2022,2023,2024,2025,2026]}
    (data_dir/'practice-index.json').write_text(json.dumps(practice_index,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    bites=[]
    for subject in SUBJECTS:
        path=ROOT/f'content/bites/{subject}.json'
        if path.exists():bites.extend(json.loads(path.read_text(encoding='utf8')))
    bite_data={'version':1,'cards':bites,'counts':{s:sum(c['subject']==s for c in bites) for s in SUBJECTS}}
    (data_dir/'bites.json').write_text(json.dumps(bite_data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    manifest={'sourceFiles':113,'nonemptySourceFiles':109,'articleCount':len(articles),'subjectCounts':{s:sum(a['subject']==s for a in articles) for s in SUBJECTS},'examCheckedAt':archive['checkedAt'],'examPosts':len(archive['entries']),'curriculum':'2027학년도까지','excludedSubject':'언어와 매체','verifiedQuestionLinks':sum(r.get('status')=='question' for r in refs.values()),'verifiedExamLinks':len(refs)}
    manifest['inlineExamples']=len(examples)
    subject_by_id={a['id']:a['subject'] for a in articles}
    manifest['exampleCounts']={s:sum(subject_by_id[e['articleId']]==s for e in examples) for s in SUBJECTS}
    manifest['directPdfEntries']=len(pdfs['entries'])
    manifest['officialPdfEntries']=official_pdf_count
    manifest['legacyPdfEntries']=len(legacy['entries'])
    manifest['practicePapers']=len(practice)
    manifest['practiceQuestions']=practice_index['questionCount']
    manifest['biteCards']=len(bites)
    manifest['biteCounts']=bite_data['counts']
    manifest['vocabularyCards']=sum(c['kind']=='vocab' for c in bites)
    (data_dir/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'.nojekyll').write_text('',encoding='utf-8')
    # Precache the text learning surface only. Full exam PDFs, audio and large
    # question images stay on demand and are never silently downloaded offline.
    files=['./','index.html','app.js','ui.js','archive.js','examples.js','practice.js','bites.js','bite-engine.mjs','offline.js','style.css','bites.css','manifest.webmanifest','favicon.svg','icons/app-192.png','icons/app-512.png','fonts/Pretendard.woff2','vendor/marked.esm.js','vendor/purify.min.js','vendor/katex.min.js','vendor/katex.min.css','vendor/auto-render.min.js']
    files += [p.relative_to(OUT).as_posix() for p in sorted((vendor/'fonts').glob('*.woff2'))]
    files += [f'data/{name}.json' for name in ['articles','exams','manifest','references','exam-pdfs','examples','practice-index','bites']]
    template=(ROOT/'web/sw.template.js').read_text(encoding='utf8')
    digest=hashlib.sha256(template.encode())
    for name in files:
        digest.update(name.encode());digest.update((OUT/('index.html' if name=='./' else name)).read_bytes())
    worker=template.replace('__VERSION__',digest.hexdigest()[:16]).replace('__FILES__',json.dumps(files))
    (OUT/'sw.js').write_text(worker,encoding='utf8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
