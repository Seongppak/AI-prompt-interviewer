# Windows x64 패키징 체크포인트

마지막 갱신: 2026-08-23 (Asia/Seoul)

## 구성

- Electron Builder 26과 NSIS를 사용한다.
- 사용자 단위 설치이며 관리자 권한을 요구하지 않는다.
- 설치 경로 선택, 바탕화면 바로가기, 시작 메뉴 바로가기를 지원한다.
- 앱 본체는 ASAR로 묶는다.
- Windows 네이티브 Helper는 실행 가능하도록 `resources/native/AIPIInterceptor.exe`에 별도 포함한다.
- 개발 환경과 설치 환경에서 Helper 경로를 각각 해석한다.
- 패키저 공용 캐시 충돌을 피하기 위해 프로젝트 전용 `.electron-builder-cache`를 사용한다.
- Windows 실행 파일과 설치·제거 프로그램에 전용 앱 아이콘을 적용한다.

## 명령

```text
npm run package:desktop:win
```

## 산출물

```text
release-desktop/AI Prompt Interviewer-Setup-4.0.0-x64.exe
크기: 104,681,843 bytes
SHA-256: C850317A4072366BE04B759CC92A6EDA0FDE64B14A6C648237BF41E11894F2A0
```

## 검증

```text
npm test                         21 files / 69 tests PASS
npm run lint                     PASS
npm run build:desktop            PASS
Electron app PE machine          0x8664 (x64)
Native Helper PE machine         0x8664 (x64)
Packaged Native UTF-8 self-test  PASS
win-unpacked runtime smoke test  PASS
NSIS install/runtime/uninstall   PASS
```

## 배포 참고 사항

- 현재 설치 파일은 코드 서명 인증서가 없어 `NotSigned` 상태다. 다른 PC에서 SmartScreen 경고가 표시될 수 있다.
- 설치 프로그램은 격리된 임시 경로에서 설치·실행·제거까지 검증했다.
