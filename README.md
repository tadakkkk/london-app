# juhyun · london — exchange assistant

라이트 격자노트 톤의 개인 비서 PWA. 데일리 체크리스트 · 듀얼 아날로그 시계(seoul + 현재 도시) ·
날씨 · 데이 카운터(`day N in <city>`) · 오늘만 할 일 · this month 목표 · 운동/릴스 추천 ·
유럽 이벤트 · 음성(말로 할 일 추가 / "노션 열어").

## 로컬 실행
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ 생성
```

## 배포 (셋 중 택1)

### A. Vercel CLI (제일 빠름)
```bash
npm i -g vercel
vercel               # 로그인 후 안내따라 엔터
vercel --prod        # 정식 배포
```
Framework는 자동으로 **Vite** 감지됨. 추가 설정 불필요.

### B. GitHub + Vercel 대시보드 (제일 쉬움, 권장)
1. 이 폴더를 GitHub 새 repo에 올림.
2. vercel.com → Add New → Project → 그 repo import.
3. Framework: **Vite** (자동). Build `npm run build`, Output `dist`. Deploy.

### C. Claude Code 한 줄
터미널에서 이 폴더로 들어가 `claude` 실행 후:
> 이 Vite 앱을 깃 초기화해서 새 GitHub repo에 푸시하고 Vercel에 배포해줘. Framework는 Vite야.

## 배포 후 첫 세팅 (앱 안 more 탭)
- **current city** 입력 → set : 데이라인 + 날씨 + 옆 시계 한 번에 바뀜
- **day 1 date** : 런던 도착일(릴스 day 1)
- **links** : 타닥타닥 / blog / notion / reels / 가계부 / email 소정 실제 주소 붙여넣기

## 배포 도메인에서만 작동하는 것 (https 필요)
- 날씨 (open-meteo, 키 불필요)
- "use my location" 위치 권한
- 음성 (Web Speech API)
아티팩트 미리보기에선 막혀서 안 됐던 것들 — Vercel https에선 정상.

## 아이폰 홈에 추가
사파리로 배포 주소 열기 → 공유 → "홈 화면에 추가". 매니페스트+아이콘 들어있어 앱처럼 뜸.

## 데이터
브라우저 localStorage에 저장됨(그 기기·그 브라우저 한정). 기기 바꾸면 안 넘어감.
다음 버전 후보: csv 내보내기, 진짜 알림(서비스워커+web-push).
