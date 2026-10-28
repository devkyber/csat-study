# 수능 판단 노트

실제 공부 기록에서 정리한 과목별 강령, 풀이 분석, 실수 방지와 학습 팁을 찾아 읽는 위키입니다.

- [사이트](https://devkyber.github.io/csat-study/)
- 국어·수학·영어·물리학Ⅰ·지구과학Ⅰ·공통 공부법
- 2027학년도까지의 수능 체계, 언어와 매체 학습 노트 제외
- 설명 바로 아래 실제 기출 이미지, 펼쳐 보는 판단 과정과 정답
- 평가원·EBSi 문제지·정답·듣기 자료를 PDF/음원으로 직접 연결
- 개별 PDF가 없는 옛 시험은 표지를 대조한 공개 보관본과 보관소 출처 표시
- 키워드 검색, 과목·단원 목차, 기기 내 글 저장, 명암 테마, 인쇄

## 노트와 문제의 관계

2017–2026학년도 6월·9월·수능을 과목별로 검토했습니다. 국어는 공통 독서·문학의 제재와 문항 범위, 수학·영어·과탐은 문항 유형을 분류하고, 노트의 판단을 적용할 문제를 골라 그림·조건·정답을 추가 대조했습니다. 모든 문항의 완전한 해설집은 아닙니다. 원문에 있던 더 오래된 작품·문항과 예시문항은 최근 10개년과 구분해 유지합니다.

원문의 강령·조건·계산 요령은 짧은 소제목과 bullet로 정리했습니다. 일반적인 공부 습관은 실행할 행동과 예시로 설명하고, 과목별 판단에는 실제 기출을 붙입니다. 문제 전체가 그 소제목의 모든 사실을 묻는다고 단정하지 않으며, 대응하는 조건과 연습할 판단을 문제 위에 적습니다.

화면은 사용자가 지정한 [PSI 홈페이지](https://github.com/postech-psi/postech-psi.github.io)와 [시험 기록](https://github.com/postech-psi/test-results)의 Pretendard·흑백 바탕·구분선·제한된 강조색을 학습용 목차와 읽기 화면에 적용했습니다. 로고와 팀 사진은 사용하지 않습니다.

## 수정과 배포

`content/`의 과목별 JSON이 글의 원본입니다. 글은 `id`, `subject`, `category`, `title`, `summary`, `tags`, `body`(Markdown), `refs`를 가집니다. `refs`는 원문 표기이며 실제 문항을 검증한 경우에만 별도 `*-reference-checks.json`에 번호와 근거를 넣습니다.

`*-examples.json`의 `examples`에는 `articleId`, `afterHeading`(본문 소제목과 정확히 일치), 학년도·회차·문항, `sourceUrl`, `image` 또는 `images`, `prompt`, `explanation`(Markdown 문자열), `answer`를 넣습니다. 이미지는 `web/examples/`에 둡니다. `variant`에는 가형·나형·A형·짝수형 등의 판본을 표시합니다. 소제목을 바꿀 때 예시의 `afterHeading`도 함께 수정합니다. 빌드는 이미지 크기를 읽어 화면이 뒤늦게 밀리지 않도록 배포 데이터에 포함합니다.

Node.js와 Python이 필요합니다. 패키지 설치 후:

```sh
pnpm install --frozen-lockfile
python -m pip install -r requirements.txt
python tools/check.py
python tools/build.py
python -m http.server 4173 --directory docs --bind 127.0.0.1
```

`web/`은 화면 코드, `docs/`는 생성된 GitHub Pages 배포본입니다. 수정 후 빌드한 `docs/`까지 함께 커밋합니다. Pages는 `main` 브랜치의 `/docs`를 사용합니다. Pretendard와 Markdown·수식 라이브러리는 배포본에 포함합니다. 로그인 없이 공개 열람하며 글 저장은 현재 브라우저에만 남습니다.

`tools/fetch_exams.py`는 평가원 게시물 메타데이터, `tools/pdf_sources.py`는 EBSi 개별 파일 링크를 수집합니다. `content/legacy-pdfs.json`은 공식 개별 PDF가 없는 회차의 공개 보관본 링크와 검토 기록입니다. 갱신할 때 파일의 PDF 응답뿐 아니라 표지의 학년도·회차·과목·유형도 확인해야 합니다. 전체 문제지를 이 저장소에 복제하지 않습니다.

`tools/check.py`는 글 ID, 모든 과목별 소제목의 예시 연결, 이미지 경로, 출처, 판본 자료와 보관본 검토 기록을 검사합니다. 배포 전에는 실제 브라우저에서 수식, 문제 이미지, 피드백, 확대, 목차 링크, 검색·저장과 모바일 화면도 확인합니다.

## 편집과 출처

원문에 있는 판단 순서·계산 요령·조건을 보존하고 중복을 통합했습니다. 개인 점수·날짜·신상과 입시 기록은 제외했습니다. 의미가 달라질 수 있는 정정과 원본 수록표는 작성자의 로컬 편집 기록에서 관리합니다. 이 저장소에는 개인 원문과 로컬 조사 파일을 포함하지 않습니다.

기출의 학년도와 실제 시행 연도는 구별합니다. `2406`은 2024학년도 6월 모의평가입니다. 원문에 문항번호가 없거나 출처가 불명확하면 특정 문항으로 단정하지 않습니다.

문제지·정답의 권리는 한국교육과정평가원 및 해당 권리자에게 있습니다. 학습 예시에는 분석에 필요한 문항·지문 대목만 발췌하고 출처를 연결합니다. 전체 시험지는 공식 파일 또는 출처를 표시한 보관본 링크로 제공합니다. 학습 노트와 전체 시험지의 제공 범위는 서로 다릅니다.

제삼자 라이브러리 라이선스는 `docs/vendor/*-LICENSE.txt`, Pretendard의 SIL Open Font License는 `docs/fonts/Pretendard-LICENSE.txt`에 포함됩니다.
