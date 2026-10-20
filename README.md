# 삼국시대 역사 마블 온라인 (교실용 시범판)

## 파일
- `index.html` : 게임 화면
- `app.js` : 실시간 게임, 문제 제출·승인 기능
- `questions.js` : 나라별 6개씩 총 24문제 기본 자료
- `map.jpg` : 사용자가 제공한 원본 역사 지도
- `firebase-config.js` : **직접 Firebase 웹 앱 설정을 넣어야 함**
- `database.rules.json` : Firebase Realtime Database 규칙 예시

## 1. Firebase 설정
1. https://console.firebase.google.com 에서 새 프로젝트 생성.
2. 프로젝트 설정(톱니바퀴) → 내 앱 → 웹 앱 등록 → `firebaseConfig` 복사.
3. `firebase-config.js` 파일에서 `PASTE_...` 값들을 실제 설정값으로 교체.
4. 빌드 → Authentication → 시작하기 → 로그인 방법 → **익명(Anonymous)** 사용 설정.
5. 빌드 → Realtime Database → 데이터베이스 만들기 → 적절한 지역 선택 → 잠금 모드.
6. Realtime Database → 규칙(Rules)에 `database.rules.json`의 내용을 붙여넣고 게시.
7. Firebase 웹 설정의 `databaseURL`이 실제 Realtime Database URL과 일치하는지 확인.

## 2. GitHub Pages 배포
1. https://github.com 에 로그인 후 오른쪽 상단 `+` → New repository.
2. 저장소 이름 예: `history-marble`; Public으로 생성 (Pages 무료 공개 배포에 적합).
3. `Add file` → `Upload files` → 이 폴더의 **6개 파일을 모두** 업로드 → Commit changes.
4. Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, Folder: `/(root)` → Save.
5. 몇 분 후 `https://사용자아이디.github.io/history-marble/` 에서 접속.
6. Firebase 콘솔 → Authentication → Settings → Authorized domains에 `사용자아이디.github.io`를 추가 (기본 제공되지 않는 경우).

## 3. 교실에서 플레이
- 교사: 웹사이트 접속 → `교사: 새 방 만들기` → 방 코드 공유.
- 학생: 각자 아이패드에서 같은 웹사이트 → 별명·팀 선택 → 방 코드 입력 → `학생: 방 입장`.
- 교사: 주사위 굴리기 → 문제 출제 → 팀 학생이 정답 제출 → 교사 화면에서 결과 자동 반영 → 다음 팀.
- 학생: 문제 출제 양식에 입력 → 교사 검토 → 승인 후 해당 거점의 문제로 교체.

## 중요 제약
- Firebase 설정 전에는 온라인 플레이가 동작하지 않습니다. GitHub Pages는 정적 파일 배포만 담당합니다.
- 시범판은 교사가 게임 진행을 제어하며 **한 팀에서 첫 번째로 제출한 답만 채점**합니다. 학생별 점수·채팅·문제 출제 제한은 포함하지 않습니다.
- 답과 해설이 실시간 DB에 저장되므로 개발자 도구로 볼 수 있습니다. 경쟁이 치열한 공식 대회용 보안은 아닙니다.
- 교사 브라우저를 닫으면 답안 자동 채점이 일시 중단됩니다. 다시 접속하면 재개됩니다.
- 익명 로그인은 브라우저별로 계정이 생성됩니다. 저장된 브라우저 데이터가 삭제되면 교사 권한을 잃을 수 있으니 수업 종료까지 같은 브라우저를 사용하세요.
- Firebase 요금 및 사용량을 확인하고, 수업 후 필요 없는 방 데이터는 콘솔에서 삭제하세요.
- 출제 문항은 학생 수준 및 역사적 정확성을 교사가 검토해야 합니다. 원본 지도는 특정 시점의 영토 표현입니다.
