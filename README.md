# 뀨잇 (QQueue It)

할 일을 **슬롯**에 배치해 순서대로(때로는 병렬로) 처리하고, 진행과 성취를 테마별로 전시하는 개인용 투두/학습 큐잉 웹서비스.

- 요구사항 명세: [docs/spec-v3.md](docs/spec-v3.md)
- 스택: TypeScript · Vue 3 · Vite · Pinia · Dexie(IndexedDB)

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
