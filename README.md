# 뀨잇 (QQueue It)

할 일을 **슬롯**에 배치해 순서대로(때로는 병렬로) 처리하고, 진행과 성취를 테마별로 전시하는 개인용 투두/학습 큐잉 웹서비스.

- 요구사항 명세: [docs/spec-v3.md](docs/spec-v3.md)
- 스택: TypeScript · Vue 3 · Vite · Pinia · Dexie(IndexedDB)

## 현재 상태

> ⚠️ **임시 UI**: 현재 화면은 동작 검증용 임시 디자인입니다. 도메인 로직(`src/domain`)과 데이터 계층(`src/db`)은
> UI와 분리되어 있어 화면은 추후 교체될 예정입니다.

- 1단계(코어) 완료: 보드/레인/슬롯/노드, 드래그 규칙, 타임테이블, 리스트 뷰(심플), 진행도
- 2단계 진행 중: 파생 엣지·링크 필터, 큐 그래프, 템플릿/복제

## 개발

```bash
npm install
npm run dev     # 개발 서버
npm run build   # 타입체크 + 프로덕션 빌드 (dist/)
```

## 배포 구조

앱(이 저장소)은 Cloudflare Pages로 단독 배포하고, 릴리즈노트·위키·아키텍처·개발노트는
포트폴리오 허브 모노레포(`decalin-projects`)의 별도 문서 사이트에서 제공합니다.

## 남은 작업

앱 구현 후 진행할 배포·문서 사이트 작업은 [docs/TODO-deploy.md](docs/TODO-deploy.md)에 정리해 두었습니다.
