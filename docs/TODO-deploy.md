# 나중에 할 일 (앱 구현 이후)

앱 구현이 어느 정도 끝나면(최소 MVP 1~2단계) 아래를 진행한다.

## 1. Cloudflare Pages 연결 (앱 배포)
- [ ] Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git → `c10f18/qqueue-it`
- [ ] Build command: `npm run build` / Output directory: `dist` / Production branch: `main`
- [ ] 이 앱은 SPA이므로 라우팅은 hash 모드(또는 앱 내부 상태)로 처리 (정적 Pages에 SPA 폴백 없음)

## 2. 문서 사이트 (포트폴리오 허브 모노레포)
- 대상 저장소: `D:\dev\workspace\decalin-projects` (`c10f18/decalin-projects`)
- [ ] `apps/_template-web`을 복사해 `apps/qqueue-it-docs` 생성 (앱 본체는 이 저장소에서 따로 배포하므로 문서 전용으로 사용)
- [ ] `package.json` name, `astro.config.mjs` site, `wrangler.toml` name 수정 (템플릿 주석은 인코딩이 깨져 있으니 같이 정리)
- [ ] 루트 `package.json`에 `build:qqueue-it-docs` 스크립트 추가
- [ ] 콘텐츠 이식
  - `docs/spec-v3.md` 1~15장 → `src/content/wiki/`
  - 17~24장(데이터 모델·드래그·Undo·엣지·태그) → `src/content/architecture.md`
  - 16장 기술 선택 이유 → `src/content/devnote/`
  - 단계별 완료 내용 → `src/content/changelog/`
- [ ] Cloudflare Pages 프로젝트 추가 (저장소는 반드시 `decalin-projects`, Build: `pnpm install && pnpm build:qqueue-it-docs`, Output: `apps/qqueue-it-docs/dist`)

## 3. 허브 카드 등록
- [ ] `apps/hub/src/data/projects.ts`에 항목 추가: `kind: 'web'`, `url`=앱 주소, `repoUrl`=`https://github.com/c10f18/qqueue-it`, `infoUrl`/`wikiUrl`/`archUrl`/`devNoteUrl`=문서 사이트 주소
- [ ] 허브 README 프로젝트 표에 한 줄 추가
