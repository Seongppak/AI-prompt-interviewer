# @aipi/browser-adapter

공용 Core를 Browser/Chrome 환경에 연결하기 위한 병렬 Adapter다.

현재 상태는 **shadow implementation**이다. 기존 Chrome Extension의 `src/`에는 연결하지 않았고,
단위 테스트에서만 기존 사이트 정의와의 호환성을 확인한다.

## 구현 범위

- `BrowserTargetAdapter`: 대상 페이지 감지, Prompt 수신·삽입 Port 호출
- `ChromeStorageAdapter`: local/sync 정책, 기존 값 양방향 마이그레이션, 변경 구독
- `BROWSER_SITE_DEFINITIONS`: 기존 7개 호스트와 DOM selector의 병렬 Registry

## 검증

```bash
npm run typecheck:browser-adapter
npm test
```

## 운영 전환 조건

1. Core와 Test App 테스트 통과
2. Browser Adapter 테스트 통과
3. 기존 확장 소스 무변경 상태 확인
4. 사용자의 운영 통합 명시적 승인
5. 기존 확장에 최소 Facade 연결
6. 7개 호스트 수동 Browser Test Matrix 통과

운영 통합 승인 전에는 이 Adapter를 기존 확장에 import하지 않는다.
