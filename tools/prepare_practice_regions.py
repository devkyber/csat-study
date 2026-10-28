"""Prepare conservative, reversible PDF view regions from local question papers.

Standalone questions retain their whole column through the next question marker.
Shared reading passages stay as complete pages. No PDF/image is republished.
"""
from pathlib import Path
import json,re
import pymupdf
ROOT=Path(__file__).resolve().parents[1]
regions={}; skipped=[]
for file in sorted((ROOT/'content/practice').glob('*/*.json')):
    paper=json.loads(file.read_text(encoding='utf8'));subject=paper['subject']
    if subject=='korean':continue
    year=paper['year'];month={'수능':'11','9월':'09','6월':'06'}[paper['session']]
    if subject in ['earth','physics']:
        path=ROOT/f'.cache/{subject}-ten-years/{str(year)[2:]}{month}-question.pdf'
        alternate=ROOT/f'.cache/{subject}-five-year-practice/{str(year)[2:]}{month}-question.pdf'
        if alternate.exists():path=alternate
    elif subject=='math':path=ROOT/f'.cache/math-ten-years/{year}-{month}-calc-question.pdf'
    else:path=ROOT/f".cache/english-ten-years/{year}-{'csat' if month=='11' else month}-question.pdf"
    if not path.exists():skipped.append(paper['id']);continue
    document=pymupdf.open(path)
    for q in paper['questions']:
        page=document[q['page']-1];w,h=page.rect.width,page.rect.height
        words=page.get_text('words')
        if subject=='english' and q['number']>=41:
            first=next(a for a in words if a[4]=='[41～42]')
            second=next(a for a in words if a[4]=='[43～45]')
            left=(first[0]-9)/w;middle=(w/2-2)/w
            if q['number']<=42:
                region=[left,(first[1]-7)/h,middle,(second[1]-10)/h]
            else:
                # Part A is at the foot of the left column; B–D and all three
                # questions continue at the top of the right column.
                region=[[left,(second[1]-7)/h,middle,.94],[(w/2+5)/w,(first[1]-7)/h,.925,.94]]
            regions[f"{paper['id']}:{q['number']}"]=region
            continue
        anchors=[word for word in words if re.fullmatch(r'\d{1,2}\.',word[4]) and .04*w<word[0]<.65*w and .04*h<word[1]<.94*h]
        matches=[a for a in anchors if a[4]==f"{q['number']}."]
        if len(matches)!=1:skipped.append(f"{paper['id']}:{q['number']}");continue
        anchor=matches[0];column=anchor[0]>w/2
        # Body numerals do not start at the exact question-number left margin.
        below=[a[1] for a in anchors if abs(a[0]-anchor[0])<4 and a[1]>anchor[1]+10]
        y1=min(below)-10 if below else .94*h
        x0=anchor[0]-9;x1=(w-.075*w) if column else (w/2-2)
        # Fractions, radicals and exponents can rise above the question number.
        # Keep the top of its entire text block, restricted to this column, then
        # add padding. This also preserves the first line of science/English.
        # A block can also contain the previous question's choices. The PDF's
        # line order keeps those before this number, while raised formula parts
        # belonging to this question follow it even when their y coordinate rises.
        stem_words=[a for a in words if a[5]==anchor[5] and a[6]>=anchor[6] and x0-3<=(a[0]+a[2])/2<=x1+3]
        y0=max(0,min([anchor[1]]+[a[1] for a in stem_words])-7)
        if subject=='math':
            # Keep all question text and vector diagrams, but omit the large
            # answer-work area and the separate end-of-section instructions.
            blocks=page.get_text('blocks')
            notices=[b[1] for b in blocks if '확인 사항' in b[4] and b[1]>anchor[1] and b[0]>w/2]
            limit=min(y1,min(notices)-8) if column and notices else y1
            lines=[line for block in page.get_text('dict')['blocks'] if block['type']==0 for line in block['lines']]
            text_boxes=[line['bbox'] for line in lines if not (line['bbox'][1]>.90*h and re.fullmatch(r'\s*\d+\s*',''.join(span['text'] for span in line['spans'])))]
            drawings=[tuple(d['rect']) for d in page.get_drawings()]
            drawings=[b for b in drawings if not (.43*w<b[0] and b[2]<.57*w and b[1]>.90*h)]
            boxes=text_boxes+drawings+[tuple(i['bbox']) for i in page.get_image_info()]
            bottoms=[b[3] for b in boxes if b[0]>=x0-3 and b[2]<=x1+3 and b[1]>=anchor[1]-2 and b[3]<=limit and b[3]>anchor[1]]
            if bottoms:y1=min(y1,max(bottoms)+16)
        region=[round(x0/w,6),round(y0/h,6),round(x1/w,6),round(y1/h,6)]
        assert 0<=region[0]<region[2]<=1 and 0<=region[1]<region[3]<=1,(paper['id'],q['number'],region)
        regions[f"{paper['id']}:{q['number']}"]=region
(ROOT/'content/practice-regions.json').write_text(json.dumps(regions,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'regions':len(regions),'skipped':skipped},ensure_ascii=False))
