# Desktop 프로젝트 영구 저장 체크포인트

마지막 갱신: 2026-08-23 (Asia/Seoul)

## 저장되는 데이터

- 프로젝트 id와 사용자 지정 이름
- 원본 프롬프트
- 생성·수정 시각
- 인터뷰 단계, 질문, 답변, 현재 질문 위치
- 선택한 대상 AI와 Provider 모드
- 완성된 최종 프롬프트

Gemini API 키는 프로젝트 파일에 포함하지 않고 계속 메모리에만 유지한다.

## 저장 위치와 안전장치

Electron의 `app.getPath('userData')/projects.json`에 저장한다. 임시 파일을 먼저 완전히 쓴 뒤
rename하는 방식으로 갱신하며, 쓰기는 순차 큐로 처리한다.

- 최대 최근 프로젝트 50개
- 같은 id는 최신 `updatedAt` 항목만 유지
- 잘못된 프로젝트 항목은 로딩 시 제외
- JSON 전체가 손상되면 `projects.json.corrupt-<timestamp>`로 원본을 보존하고 빈 목록으로 복구
- 실행 중 `generating`이던 프로젝트는 중단 오류 상태로 복구해 무한 로딩을 방지

## 데스크톱 UI

- 최근 프로젝트 선택
- 앱 재실행 후 마지막 프로젝트 자동 복원
- 진행 중인 질문 위치에서 이어하기
- 프로젝트 이름 변경
- 삭제 전 확인 후 프로젝트 삭제
- 새 프로젝트 시작

## 검증

```text
npm test             19 files / 58 tests PASS
npm run build:desktop PASS
npm run lint          PASS
npm audit             0 vulnerabilities
git diff --check      PASS
```

임시 Electron userData 디렉터리를 사용한 통합 테스트에서 저장 후 새 Store 인스턴스 복원,
삭제 영속화, 손상 JSON 백업과 복구를 검증했다.
