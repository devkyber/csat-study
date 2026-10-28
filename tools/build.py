"""Build the public site from edited content; never copies the private source inventory."""
from pathlib import Path
import json, shutil, sys
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
        if p.is_file(): shutil.copy2(p,OUT/p.name)
    vendor=OUT/'vendor'; vendor.mkdir(exist_ok=True)
    deps=ROOT/'node_modules'
    shutil.copy2(deps/'marked/lib/marked.esm.js',vendor/'marked.esm.js')
    shutil.copy2(deps/'dompurify/dist/purify.min.js',vendor/'purify.min.js')
    for name in ['katex.min.css','katex.min.js']: shutil.copy2(deps/'katex/dist'/name,vendor/name)
    shutil.copy2(deps/'katex/dist/contrib/auto-render.min.js',vendor/'auto-render.min.js')
    shutil.copytree(deps/'katex/dist/fonts',vendor/'fonts',dirs_exist_ok=True)
    for package,license_name in [('katex','LICENSE'),('marked','LICENSE.md'),('dompurify','LICENSE')]:
        shutil.copy2(deps/package/license_name,vendor/f'{package}-LICENSE.txt')
    data_dir=OUT/'data';data_dir.mkdir(exist_ok=True)
    (data_dir/'articles.json').write_text(json.dumps(articles,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    archive=json.loads((ROOT/'content/exams.json').read_text(encoding='utf-8'))
    (data_dir/'exams.json').write_text(json.dumps(archive,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    refs={}
    for path in (ROOT/'content').glob('*reference-checks.json'):
        for item in json.loads(path.read_text(encoding='utf-8')):
            key=item.get('articleId') or item.get('subject')
            if not key: raise ValueError('Reference needs articleId or subject')
            refs[key+':'+item['raw']]=item
    (data_dir/'references.json').write_text(json.dumps(refs,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    manifest={'sourceFiles':113,'nonemptySourceFiles':109,'articleCount':len(articles),'subjectCounts':{s:sum(a['subject']==s for a in articles) for s in SUBJECTS},'examCheckedAt':archive['checkedAt'],'examPosts':len(archive['entries']),'curriculum':'2027학년도까지','excludedSubject':'언어와 매체','verifiedQuestionLinks':sum(r.get('status')=='question' for r in refs.values()),'verifiedExamLinks':len(refs)}
    (data_dir/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'.nojekyll').write_text('',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
