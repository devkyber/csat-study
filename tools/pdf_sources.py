"""Add verified, directly linked EBS PDFs without changing KICE archive coverage.

Run: python tools/pdf_sources.py [--refresh]
Only URLs explicitly present in the public EBS archive response are indexed.
No exam files are saved or republished. The ignored cache contains source HTML
and small verification receipts. EBS explanations are labelled separately from
official answer sheets. Older KICE records remain available in exams.json.
"""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlencode, urlsplit
import argparse
import json
import re
import sys
import time
import unicodedata

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'ebs-pdfs'
LANDING = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs?targetCd=D300'
API = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax'
CDN = 'https://wdown.ebsi.co.kr/W61001/01exam'
SUBJECTS = '140117,140118,korPast,140119,140120,140121,mathPast,80003,140115,154,sciPast'
TODAY = date.today().isoformat()
KINDS = {'P': 'question', 'J': 'answer', 'J2': 'answer', 'H': 'explanation', 'D': 'script', 'R': 'audio'}


def get_html(year, page, refresh=False):
    params = {'targetCd': 'D300', 'yearList': str(year),
              'monthList': '03,04,05,06,07,08,09,10,11,12', 'arOrd': '1,2,3,6',
              'subjIdList': SUBJECTS, 'sort': 'recent', 'currentPage': page}
    url = API + '?' + urlencode(params)
    path = CACHE / f'allmonths-{year}-{page}.html'
    if path.exists() and not refresh:
        return path.read_text(encoding='utf-8'), url
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=35)
            response.raise_for_status()
            html = response.content.decode('utf-8')
            if 'pagingForm' not in html:
                raise ValueError('EBS archive response missing expected form')
            path.write_text(html, encoding='utf-8')
            return html, response.url
        except (requests.RequestException, ValueError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def quoted_args(value):
    return re.findall(r"'([^']*)'", value)


def parse_rows(html, source_url, 시행연도):
    soup = BeautifulSoup(html, 'html.parser')
    records = []
    for box in soup.select('.qus_box'):
        title = box.select_one('.qus_tit').get_text(' ', strip=True).replace('\xa0', ' ')
        if '평가원' not in title and '대학수학능력시험' not in title:
            continue
        session_match = re.search(r'(6|9)월', title)
        session = session_match.group(0) if session_match else '수능'
        if session == '수능' and '대학수학능력시험' not in title:
            continue
        cut = box.select_one('[onclick^="showGrdCutPopup"]')
        cut_args = quoted_args(cut['onclick']) if cut else []
        declared = re.search(r'(\d{4})학년도', title)
        cut_year = re.match(r'(\d{4})N', cut_args[0]) if cut_args else None
        year = int(declared.group(1)) if declared else int(cut_year.group(1)) if cut_year else 시행연도 + 1
        if year != 시행연도 + 1:
            raise ValueError(f'Academic-year mismatch: {title}')
        label = cut_args[5] if len(cut_args) > 5 else title
        normalized = unicodedata.normalize('NFKC', label).replace(' ', '')
        classes = box.get('class', [])
        if 'kor' in classes:
            subject = 'korean'
        elif 'math' in classes:
            subject = 'math'
        elif 'eng' in classes:
            subject = 'english'
        elif normalized in ('물리I', '물리학I'):
            subject = 'physics'
        elif normalized == '지구과학I':
            subject = 'earth'
        else:
            continue
        files = []
        question_args = None
        for button in box.select('button[onclick^="goDownLoad"]'):
            action = button['onclick']
            function = re.match(r'goDownLoad(\w+)\(', action)
            if not function or function.group(1) not in KINDS:
                continue
            args = quoted_args(action)
            if not args or not args[0]:
                continue
            if function.group(1) == 'P':
                question_args = args
            raw_url = args[0]
            url = raw_url.replace('http://', 'https://', 1) if raw_url.startswith(('http://', 'https://')) else CDN + raw_url
            if urlsplit(url).hostname != 'wdown.ebsi.co.kr':
                continue
            extension = Path(urlsplit(url).path).suffix.lower().lstrip('.')
            if extension not in ('pdf', 'png', 'mp3'):
                continue
            kind = KINDS[function.group(1)]
            if extension == 'png' and kind != 'answer' or extension == 'mp3' and kind != 'audio':
                continue
            files.append({'kind': kind, 'format': extension, 'url': url,
                          'name': button.get_text(' ', strip=True), 'source': 'EBSi'})
        if not question_args or not any(f['kind'] == 'question' for f in files):
            continue
        exam_date = question_args[2][:8]
        if not re.fullmatch(r'\d{8}', exam_date):
            raise ValueError(f'Unexpected EBS exam date: {question_args[2]}')
        paper_id = question_args[8] if len(question_args) > 8 else question_args[2] + ':' + question_args[5]
        records.append({'id': 'ebs-' + paper_id, 'year': year, 'session': session,
                        'subject': subject, 'subjectLabel': label, 'title': title,
                        'sourceRecordId': question_args[2],
                        'variant': '짝수형' if '짝수형' in title else '홀수형' if '홀수형' in title else '',
                        'files': files, 'sourcePage': source_url, 'sourceLanding': LANDING,
                        'checkedAt': TODAY})
    return records


def fetch_year(year, refresh):
    html, url = get_html(year, 1, refresh)
    soup = BeautifulSoup(html, 'html.parser')
    total = int(re.search(r'\d+', soup.select_one('.tot').get_text()).group())
    pages = max([int(x) for x in re.findall(r'goPage\((\d+)\)', html)] or [1])
    rows = parse_rows(html, url, year)
    observed = len(soup.select('.qus_box'))
    for page in range(2, pages + 1):
        html, url = get_html(year, page, refresh)
        observed += len(BeautifulSoup(html, 'html.parser').select('.qus_box'))
        rows.extend(parse_rows(html, url, year))
    if total != observed:
        raise ValueError(f'Pagination mismatch for {year}: {observed} != {total}')
    return rows, {'examYear': year, 'officialRows': total, 'pagesRead': pages,
                  'selectedRows': len(rows)}


def verify_url(url):
    for attempt in range(2):
        try:
            with requests.get(url, headers={'Range': 'bytes=0-15'}, stream=True, timeout=25) as r:
                signature = r.raw.read(8)
                is_pdf = signature.startswith(b'%PDF-')
                is_png = signature == b'\x89PNG\r\n\x1a\n'
                is_mp3 = signature.startswith(b'ID3') or len(signature) >= 2 and signature[0] == 255 and signature[1] & 224 == 224
                return {'ok': r.status_code in (200, 206) and (is_pdf or is_png or is_mp3),
                        'status': r.status_code, 'format': 'pdf' if is_pdf else 'png' if is_png else 'mp3' if is_mp3 else '',
                        'checkedAt': TODAY}
        except requests.RequestException as error:
            if attempt:
                return {'ok': False, 'error': type(error).__name__, 'checkedAt': TODAY}
            time.sleep(1)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--refresh', action='store_true')
    options = args.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = json.loads((ROOT / 'content' / 'exams.json').read_text(encoding='utf-8'))
    first_year = min(x['year'] for x in archive['entries']) - 1
    last_year = max(x['year'] for x in archive['entries']) - 1
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda y: fetch_year(y, options.refresh), range(first_year, last_year + 1)))
    rows = [row for group, audit in results for row in group]
    audits = [audit for group, audit in results]
    print(json.dumps({'stage': 'index', 'rows': len(rows), 'years': [first_year, last_year]}, ensure_ascii=False), flush=True)
    receipt_path = CACHE / 'verification.json'
    receipts = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() and not options.refresh else {}
    urls = sorted({f['url'] for row in rows for f in row['files']})
    pending = [url for url in urls if not receipts.get(url, {}).get('ok')]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for index, (url, result) in enumerate(zip(pending, pool.map(verify_url, pending)), 1):
            receipts[url] = result
            if index % 100 == 0:
                print(json.dumps({'stage': 'verify', 'done': index, 'total': len(pending)}), flush=True)
                receipt_path.write_text(json.dumps(receipts, ensure_ascii=False, indent=2), encoding='utf-8')
    receipt_path.write_text(json.dumps(receipts, ensure_ascii=False, indent=2), encoding='utf-8')
    mapped, failures, unmatched = [], [], []
    for row in rows:
        matches = [e for e in archive['entries'] if e['year'] == row['year'] and e['session'] == row['session'] and row['subject'] in e['subjects']]
        if len(matches) > 1:
            matches = [e for e in matches if any(f['kind'] == 'question' for f in e['files'])]
        if len(matches) > 1:
            track_match = re.search(r'(가형|나형|[AB])', row['subjectLabel'])
            if track_match:
                track = track_match.group(1)
                tokens = [track, '(' + track[0] + ')'] if track in ('가형', '나형') else [track]
                matches = [e for e in matches if any(any(token in f['name'] for token in tokens) for f in e['files'] if f['kind'] == 'question')]
        if len(matches) > 1:
            pdf_matches = [e for e in matches if any(f['kind'] == 'question' and f['format'] == 'pdf' for f in e['files'])]
            if len(pdf_matches) == 1:
                matches = pdf_matches
        if len(matches) != 1:
            unmatched.append({'id': row['id'], 'title': row['title'], 'matches': [e['id'] for e in matches]})
            continue
        row['archiveId'] = matches[0]['id']
        valid = []
        for file in row['files']:
            receipt = receipts[file['url']]
            if receipt['ok'] and receipt['format'] == file['format']:
                file['verifiedAt'] = receipt['checkedAt']
                valid.append(file)
            else:
                failures.append({'id': row['id'], 'url': file['url'], 'kind': file['kind'], 'verification': receipt})
        row['files'] = valid
        if any(f['kind'] == 'question' and f['format'] == 'pdf' for f in valid):
            mapped.append(row)
    keys = [(r['archiveId'], r['subject']) for r in mapped]
    gaps = [{'archiveId': e['id'], 'title': e['title'], 'subject': s}
            for e in archive['entries'] for s in e['subjects'] if (e['id'], s) not in keys
            and any(f['kind'] == 'question' for f in e['files'])
            and not any(f['format'] == 'pdf' and f['kind'] == 'question' for f in e['files'])]
    output = {'checkedAt': TODAY, 'publisher': 'EBSi', 'source': LANDING,
              'method': 'Exact URLs from official archive HTML; HTTP GET byte signature verified; no files mirrored.',
              'archiveAudit': audits, 'entries': mapped,
              'coverage': {'entries': len(mapped), 'archivePosts': len({r['archiveId'] for r in mapped}),
                           'subjects': dict(Counter(r['subject'] for r in mapped)), 'verifiedUrls': sum(receipts[u]['ok'] for u in urls),
                           'unmatchedRows': unmatched, 'unavailableFiles': failures, 'noDirectQuestionPdf': gaps},
              'notes': ['EBSi 해설은 평가원 정답표와 별도 자료입니다.',
                        'EBSi 목록의 다운로드 버튼은 로그인을 안내할 수 있습니다. 직접 링크는 확인일에 공개 응답한 공식 CDN 주소입니다.',
                        '직접 PDF를 확인하지 못한 과거 회차도 기존 평가원 자료실에서 보존합니다.']}
    (ROOT / 'content' / 'exam-pdfs.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in output['coverage'].items() if not isinstance(v, list)}, ensure_ascii=False), flush=True)
    print(json.dumps({'unmatched': len(unmatched), 'unavailableFiles': len(failures), 'noDirectQuestionPdf': len(gaps)}), flush=True)


if __name__ == '__main__':
    main()
