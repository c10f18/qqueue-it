# 뀨잇(QQueue It) 요구사항 명세 v3

Sep 30, 2026

## 1. 서비스 개요

- **한 줄 정의**: 할 일을 "슬롯"에 배치해 순서대로(때로는 병렬로) 처리하고, 진행 과정과 성취를 다양한 테마로 전시할 수 있는 개인용 투두/학습 큐잉 서비스
- **핵심 차별점**: ① 슬롯×레인 그리드 기반 순서 관리, ② 슬롯에서 파생되는 큐 그래프, ③ 성취 전시(자랑용 export)
- **문제 배경**: 공부할 것과 할 일이 너무 많아 우선순위가 아니라 순서(큐)로 관리하고 싶음

## 2. 핵심 개념 (도메인 용어)

| 용어 | 정의 |
| --- | --- |
| **보드(Board)** | 최상위 컨테이너. 카테고리(레인)와 슬롯을 소유 |
| **카테고리 / 레인(Category = Lane)** | 보드당 1\~5개. 큐 = 레인이며, 노드는 반드시 레인 하나에 속함 |
| **슬롯(Slot)** | 순서 자리. 슬롯 번호는 저장하지 않고 표시 시점에 계산 |
| **셀(Cell)** | (슬롯, 레인) 교차점. 노드가 들어가는 자리, 셀당 노드 1개 |
| **노드/작업(Node/Task)** | 큐에 들어가는 최소 단위 |
| **파생 엣지(Derived Edge)** | 슬롯 배치에서 자동 계산되는 화살표. 저장하지 않음 |
| **링크 필터(Link Filter)** | 노드별로 다음 슬롯 중 어느 레인에 연결할지 정하는 제외 목록 |
| **태그(Tag)** | 작업당 최대 5개. 태그 뷰(별도 그래프)에서 연관관계로 표시 |
| **전시(Showcase)** | 진행/성취를 시각적 테마로 보여주는 출력물 |

## 3. 데이터 구조 요구사항

- FR-01. 보드는 레인 목록(1\~5개)과 슬롯 순서 목록을 가진다.
- FR-02. 슬롯은 보드에 최소 1개 존재한다. 마지막 슬롯은 비어도 자동 삭제되지 않는다.
- FR-03. 그 외 슬롯은 소속 노드가 0개가 되면 자동 삭제된다.
- FR-04. 슬롯 번호는 저장하지 않고 표시할 때 계산하며, 번호 표시 여부는 옵션이다.
- FR-05. 셀(슬롯×레인)당 노드는 최대 1개이다.
- FR-06. 노드의 카테고리는 별도 필드가 아니라 "어느 레인에 속해 있는가"로 결정된다.
- FR-07. 엣지는 저장하지 않고 슬롯 배치에서 파생한다.
- FR-08. 큐 안의 큐(노드 하위 트리)는 지원하지 않는다.

## 4. 카테고리(레인) 요구사항

- FR-10. 보드 생성 시 기본 카테고리 "Default" 1개가 자동 생성된다.
- FR-11. 카테고리는 최소 1개, 최대 5개이다. 마지막 카테고리는 삭제 버튼이 비활성화된다.
- FR-12. 카테고리 이름은 보드 내에서 중복될 수 없다.
- FR-13. 카테고리 이름 수정을 지원한다.
- FR-14. 카테고리(열) 순서는 드래그로 변경할 수 있다.
- FR-15. 카테고리는 활성/비활성 토글을 가진다. 비활성 카테고리는 화면에서 숨겨진다.
- FR-16. 카테고리 삭제 시(노드가 있는 경우) "노드도 삭제" 또는 "다른 카테고리로 이동" 중 선택한다.
- FR-17. "다른 카테고리로 이동" 시 셀 충돌은 드래그 이동과 같은 규칙(밀어내기, 연쇄 밀림 시 새 슬롯 삽입)을 따른다.

## 5. 노드(작업) 요구사항

### 5.1 속성

| 속성 | 비고 |
| --- | --- |
| 작업 이름 / 설명 | 필수 / 선택 |
| 레인(=카테고리) | 필수, 1개, 셀 위치로 결정 |
| 태그 | 선택, 최대 5개 |
| 아이콘 | 이모지/아이콘 선택 |
| 생성시간 | 자동 |
| 진행도 | 0\~100% |
| 횟수 | 독립 숫자 속성. 진행도·완료여부와 무관, 사용자가 직접 증감 |
| 완료여부 | 진행도 100이면 자동 완료 |
| 표시/비표시 | 뷰·export에서 숨김 |
| 데드라인 | 정렬 기준으로만 사용 (알림/강제 없음) |
| 링크 필터 | 다음 슬롯 연결에서 제외할 레인 목록 |

### 5.2 생성/수정/삭제/복제

- FR-20. 노드 생성, 수정, 삭제, 복제를 지원한다.
- FR-21. 노드 우클릭 시 2레벨 컨텍스트 메뉴를 제공한다: 위에 추가 / 아래에 추가 / 삭제 / 링크 필터(하위 메뉴: 카테고리 체크박스 목록 + 전체 선택 + 전체 해제)
- FR-22. "위에 추가", "아래에 추가", 노드 호버 시 "+" 버튼은 같은 레인에 새 슬롯을 삽입하고 즉시 이름 입력 상태로 진입한다.
- FR-23. 빈 셀에 호버 시 "+"가 표시되며, 클릭하면 그 슬롯·그 레인에 바로 노드가 생성된다(비어 있는 레인도 동일).

### 5.3 링크 필터 (파생 엣지 상세)

- FR-30. 기본값: 노드는 다음 슬롯의 모든 노드에 연결된다.
- FR-31. 필터를 한 번이라도 조정한 노드는 "체크된 각 레인마다, 그 노드 이후 가장 가까운 노드"에 연결된다.
- FR-32. 필터는 "제외한 레인 목록"으로 저장하여, 이후 추가된 레인은 기본으로 포함된다.

## 6. 순서 조작(드래그) 요구사항

| 드롭 위치 | 결과 |
| --- | --- |
| 같은 레인의 노드 위 | 끌어온 노드가 그 자리를 차지, 기존 노드들이 각자 다음 노드 자리로 연쇄 밀림 |
| 다른 레인의 노드 위 | 위와 동일하게 밀어내되, 끌어온 노드의 레인(=카테고리)이 그 레인으로 변경됨 |
| 같은 슬롯의 빈 칸 | 합류 (다른 레인이면 레인도 변경) |
| 슬롯 사이 경계선 | 분리: 새 슬롯 생성, 커서가 놓인 열의 레인에 단독 배치 |
| 행(슬롯) 손잡이 | 슬롯 전체 이동 |

- FR-40. 연쇄 밀림으로 더 이상 밀 자리가 없는 마지막 노드는 바로 뒤에 새 슬롯을 삽입해 단독 배치한다.
- FR-41. 드래그 중 유효한 드롭 위치를 하이라이트하고, 레인이 바뀌는 드롭은 시각적으로 구분한다.
- FR-42. Undo/Redo를 지원한다.

## 7. 진행도 관리 요구사항

- FR-50. 개별 노드 진행도를 수정할 수 있다.
- FR-51. 일괄 진행: 지정한 슬롯까지 진행 처리한다. 기본은 모든 레인이며, 특정 레인만 선택해 적용할 수 있다.
- FR-52. 진행도 리셋은 개별/큐(레인) 전체 모두 가능하다.
- FR-53. 진행도 100 = 완료로 자동 연동된다.
- FR-54. 횟수는 회독/반복 로직 없이 순수 카운터로만 존재한다(사용자가 직접 증감).

## 8. 화면 모드

### 8.1 수정 모드

- FR-60. 좌측: 파생 엣지가 반영된 실시간 큐 그래프(레인별 배치)
- FR-61. 우측: 슬롯(행) × 레인(열) 타임테이블
  - 마지막 카테고리 우측에 "+"로 카테고리 추가
  - 노드/빈 셀 호버 시 "+" 표시
  - 우클릭 컨텍스트 메뉴(5장 FR-21)
- FR-62. 빈 보드에도 최초 슬롯 1개가 항상 존재한다.

### 8.2 보기 전용 모드 — 뷰 3종

**① 리스트 뷰**

- FR-70. 레이어별(슬롯×레인 그리드) 모드와 플랫 모드를 토글로 전환
- FR-71. 플랫 모드에서는 같은 슬롯의 노드들을 한 행에 칩으로 병합 표시. 진행도는 노드별로 유지, 슬롯 완료는 소속 노드 전원 완료 시
- FR-72. 표시할 속성을 체크박스로 멀티 선택
- FR-73. 리스트 스킨 6종: 심플 / 블록 진행바(클로드st) / 영수증 / 도트 게임기 / 노트 / 설정파일

**② 큐 그래프 뷰**

- FR-74. 파생 엣지(링크 필터 반영)를 화살표로 표시, 회전/확대/이동 가능

**③ 태그 뷰(태그 그래프)**

- FR-75. 슬롯 순서와 무관한 별도 뷰. 같은 작업에 함께 붙은 태그끼리 연결(동시 출현 빈도)
- FR-76. 방향 없는 그래프. 링크 빈도는 선 굵기, 태그 크기는 연결된 작업 수로 표현
- FR-77. 태그 클릭 시 해당 태그가 붙은 작업 목록 표시
- FR-78. 수동 태그 연결은 미지원(후순위)
- FR-79. 비활성 카테고리·비표시 노드는 모든 뷰에서 숨김 처리되며, 숨겨진 셀만 남은 슬롯은 접혀서 표시된다.

## 9. 템플릿 요구사항

- FR-80. 큐(보드) 전체 복제를 지원하며 슬롯 구조도 함께 복제된다. 틀만 유지한 채 분기하는 용도이므로 복제본의 progress/count/완료여부는 0으로 리셋된다.
- FR-81. 템플릿으로 저장, 템플릿에서 새 보드 생성, 템플릿 삭제를 지원한다. 템플릿에서 새로 만든 보드의 progress/count/완료여부도 0으로 리셋된다.

## 10. 성취 전시(Showcase) 요구사항

- FR-90. 계획/달성 내용을 테마별로 전시한다.
- FR-91. 전시 테마: 책장, 벽화(이집트풍), 다이어리, 원형 일과표, 리스트(엑셀), 커널, 흑백 — 추후 추가 가능한 구조
- FR-92. MVP에서는 테마 2\~3개로 제한을 권장(에셋 제작 부담)

## 11. Export / 공유 요구사항

- FR-100. 기본값은 표시 중인 노드 전체 선택(비표시 노드는 애초에 후보에서 제외), 사용자가 개별 노드를 추가로 제외 가능
- FR-101. 원클릭 다운로드(간편)와 전시용(자랑용) 세트를 별도로 제공
- FR-102. PPT/Figma 등에 붙여넣기용 **SVG 클립보드 복사**를 지원
- FR-103. 마크다운으로 옮겼을 때 보기 좋은 템플릿 형태의 **텍스트(마크다운) 복사**를 지원

## 12. 비기능 요구사항

- NFR-01. 드래그 순서 변경은 즉각 반응해야 한다(체감 지연 없음)
- NFR-02. 리스트 스킨, 전시 테마는 플러그인처럼 추가 가능한 구조로 설계한다
- NFR-03. Export 결과물(전시용)의 시각 디자인 품질을 중요하게 다룬다
- NFR-04. 데드라인 등 부담되는 기능은 최소 범위(정렬 용도)로 제한한다
- NFR-05. 노드/슬롯 수가 많아질 때 그래프 뷰(큐 그래프, 태그 그래프)의 렌더링 성능을 고려한다

## 13. 범위 제외 (현재 버전)

- 팀 협업, 알림/푸시, 결제
- 회독 모드(진행도 자동 리셋 로직) — 횟수는 단순 카운터로만 제공
- 태그 수동 연결
- 노드 하위 트리(큐 안의 큐)

## 14. MVP 단계 제안

1. **1단계(코어)**: 보드/레인/슬롯 CRUD, 수정 모드(타임테이블+드래그 규칙), 리스트 뷰(심플 스킨), 진행도
2. **2단계**: 파생 엣지 + 링크 필터, 일괄 진행/리셋, 템플릿/복제, 큐 그래프 뷰
3. **3단계**: 태그 뷰, 추가 리스트 스킨, export(다운로드/SVG/마크다운)
4. **4단계**: 전시 테마, 자랑용 export 세트

## 15. 디자인/저작권 주의

- "젤다처럼" 하트 UI, 특정 게임/브랜드의 아이콘·폰트·로고를 직접 쓰지 않고 분위기만 참고한 고유 디자인으로 제작
- 이집트 벽화 테마 등은 직접 제작 또는 라이선스 프리 에셋 사용

## 16. 기술 스택 결정

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 언어 | TypeScript |  |
| 프레임워크 | Vue 3 (Composition API) + Vite |  |
| 상태 관리 | Pinia |  |
| 타임테이블/드래그 | 직접 구현 (Pointer Events) | 우리 드래그 규칙(밀어내기/합류/분리)이 일반 정렬 라이브러리와 안 맞아 직접 구현이 더 쉽고 유지보수하기 쉬움 |
| 로컬 저장 | IndexedDB (Dexie.js) | 구조화된 데이터에 적합, Ctrl+Shift+R에 안전. 보안은 전체 보드 JSON export/import가 담당. 데이터 접근은 어댑터로 감싸 후일 서버 동기화로 교체 용이하게 |
| 큐 그래프 렌더링 | **Canvas 2D** (직접 구현) | 슬롯/레인 좌표가 이미 정해져 있어 자동 배치가 불필요. 회전은 3D 회전 행렬(Y→X→원근)을 직접 계산, 조명/재질 없이 DOM 없이 픽셀만 그려 수천 노드까지 성능 여유 확보. 노드가 수만 개 단위로 커지면 three.js(InstancedMesh/Points)로 교체 검토 |
| 태그 그래프 렌더링 | v-network-graph (대안: Cytoscape.js) | 포스 기반 자동 배치가 실제로 필요한 영역 |
| (향후) 백엔드 | Node.js + TypeScript (Fastify 또는 Hono) | 계정 동기화 도입 시 |
| (향후) 인증 | Google OAuth |  |
| (향후) DB | PostgreSQL |  |
| 배포 | 포트폴리오 허브와 동일한 무료 인프라 |  |

로커/웹 접근: 웹 단일, 모바일은 모바일 웹 브라우저에서 사용 가능하게 반응형으로 설계.

> NFR-05를 이에 맞춰 갱신: 큐 그래프는 Canvas 2D로 구현하여 수백\~수천 노드 규모에서도 DOM 부담 없이 동작하도록 한다.

## 17. 데이터 모델 (IndexedDB / Dexie)

### 17.1 엔티티 구조

```
Board 1 ── N Lane
Board 1 ── N Slot
Board 1 ── N Node
Node N ── 1 Slot   (slotId)
Node N ── 1 Lane   (laneId)
```

슬롯의 순서는 슬롯 자신이 아니라 **Board가 들고 있는 배열**(`slotOrder`)이 결정한다. Slot 레코드 자체에는 순번을 저장하지 않는다(FR-04).

### 17.2 Dexie 스토어

```ts
db.version(1).stores({
  boards: 'id, updatedAt',
  lanes: 'id, boardId, [boardId+order]',
  slots: 'id, boardId',
  nodes: 'id, boardId, slotId, laneId, [slotId+laneId], *tags, visible',
  templates: 'id, updatedAt'
});
```

- `[slotId+laneId]`: 셀 유일성(FR-05) 검사용
- `*tags`: 태그 그래프용 multiEntry 인덱스
- `[boardId+order]`: 레인 열 순서 정렬 조회용

### 17.3 레코드 타입

```ts
interface Board {
  id: string;
  name: string;
  slotOrder: string[];       // 슬롯 ID 배열. 이 순서 = 진행 순서 (FR-01, FR-04)
  settings: { showSlotNumbers: boolean }; // FR-04 옵션
  createdAt: number;
  updatedAt: number;
}

interface Lane {
  id: string;
  boardId: string;
  name: string;               // 보드 내 중복 불가 (FR-12, 앱 레벨 검증)
  order: number;               // 0~4, 열 순서 (FR-14)
  active: boolean;             // FR-15
}

interface Slot {
  id: string;
  boardId: string;
  // 순번 없음 — board.slotOrder 안에서의 위치가 곳 순번 (표시 시점 계산, FR-04)
}

interface Node {
  id: string;
  boardId: string;
  slotId: string;
  laneId: string;               // = 카테고리 (FR-06, 별도 필드 아님)
  name: string;
  description?: string;
  icon?: string;
  tags: string[];               // 최대 5개, 앱 레벨 검증
  progress: number;             // 0~100
  count: number;                // 순수 카운터 (FR-54)
  visible: boolean;             // FR-79
  deadline?: number;            // epoch, 정렬용만 (NFR-04)
  linkFilter: { touched: boolean; excludedLaneIds: string[] }; // touched=false면 다음 슬롯 전체 연결 (FR-30~32, 20장)
  
  createdAt: number;
}

interface Template {
  id: string;
  name: string;
  snapshot: {
    lanes: Omit<Lane, 'id' | 'boardId'>[];
    slotCount: number;
    nodes: (Omit<Node, 'id' | 'boardId' | 'slotId' | 'laneId'> & { slotIndex: number; laneIndex: number })[];
  };
  updatedAt: number;
}
```

`completed`는 별도 필드로 두지 않음 — FR-53에 따라 `progress === 100`이 곳 완료(파생 값으로만 판정).

### 17.4 불변식 (트랜잭션에서 매번 검증)

1. 셀 유일성: `[slotId+laneId]` 조회 후 충돌 시 드래그 규칙대로 밀어내기 처리
2. 슬롯 최소 1개/마지막 자동삭제 금지: 노드 0개 && 마지막 슬롯 아님 일 때만 삭제
3. 레인 최소1/최대5, 이름 중복 불가: 생성/수정 시 검증
4. 태그 최대 5개: 노드 저장 시 검증

이 네 가지는 여러 테이블을 함께 건드는 로직이라 `db.transaction('rw', [boards, slots, nodes], async () => {...})`로 묶어 원자적으로 처리한다.

## 18. 드래그 트랜잭션 로직

4가지 드롭 케이스(같은/다른 레인 노드 위, 빈 칸, 경계선) 중 "노드 위에 드롭" 두 케이스는 하나의 공통 함수(체인 밀어내기)로 처리된다.

### 18.1 공통 함수: 체인 밀어내기 (같은/다른 레인 노드 위 드롭)

```ts
async function insertNodeIntoLane(
  boardId: string, nodeId: string, laneId: string, targetSlotId: string
) {
  await db.transaction('rw', [boards, slots, nodes], async () => {
    const board = await boards.get(boardId);

    // 1. 이 레인에 이미 있는 노드들을 슬롯 순서대로 정렬 (드래그된 노드 제외)
    const laneNodes = (await nodes.where({ boardId, laneId }).toArray())
      .filter(n => n.id !== nodeId)
      .sort((a, b) => board.slotOrder.indexOf(a.slotId) - board.slotOrder.indexOf(b.slotId));

    // 2. targetSlotId 위치부터 뒤로 밀릴 노드들 추출
    const insertIdx = laneNodes.findIndex(n =>
      board.slotOrder.indexOf(n.slotId) >= board.slotOrder.indexOf(targetSlotId));
    const displaced = insertIdx === -1 ? [] : laneNodes.slice(insertIdx);

    // 3. 밀려날 노드 수만큼 슬롯이 필요 + 마지막 노드는 새 슬롯 필요 (FR-40)
    const displacedSlotIds = displaced.map(n => n.slotId);
    const lastSlotId = displacedSlotIds.at(-1) ?? targetSlotId;
    const newSlotId = await insertSlotAfter(board, lastSlotId);

    const chainSlots = [targetSlotId, ...displacedSlotIds.slice(1), newSlotId];

    // 4. 드래그된 노드부터 체인 순서대로 재배치
    await nodes.update(nodeId, { slotId: chainSlots[0], laneId });
    for (let i = 0; i < displaced.length; i++) {
      await nodes.update(displaced[i].id, { slotId: chainSlots[i + 1] });
    }

    // 5. 원래 슬롯이 비면 정리 (FR-02/03)
    await cleanupEmptySlots(board);
  });
}
```

같은 레인 드롭이든 다른 레인 드롭이든 **레인을 무엇으로 넘기는지만 다를 뿐** 로직은 동일하다.

### 18.2 나머지 3가지 드롭

```ts
// 같은 슬롯의 빈 칸: 밀어낼 대상이 없으므로 단순 배치
async function joinCell(boardId: string, nodeId: string, slotId: string, laneId: string) {
  await db.transaction('rw', [boards, slots, nodes], async () => {
    const board = await boards.get(boardId);
    await nodes.update(nodeId, { slotId, laneId });
    await cleanupEmptySlots(board);
  });
}

// 슬롯 사이 경계선: 새 슬롯을 그 위치에 끼워넣고 단독 배치 (FR-41)
async function splitAtBoundary(boardId: string, nodeId: string, afterSlotId: string, laneId: string) {
  await db.transaction('rw', [boards, slots, nodes], async () => {
    const board = await boards.get(boardId);
    const newSlotId = await insertSlotAfter(board, afterSlotId);
    await nodes.update(nodeId, { slotId: newSlotId, laneId });
    await cleanupEmptySlots(board);
  });
}

// 슬롯(행) 손잡이: 노드는 그대로, slotOrder 배열만 재정렬
async function moveWholeSlot(boardId: string, slotId: string, toIndex: number) {
  await db.transaction('rw', boards, async () => {
    const board = await boards.get(boardId);
    const from = board.slotOrder.indexOf(slotId);
    board.slotOrder.splice(from, 1);
    board.slotOrder.splice(toIndex, 0, slotId);
    await boards.put(board);
  });
}
```

이 마지막 함수가 짧은 이유가 곳 "슬롯을 엔티티로 두자"는 결정의 실제 이득이다 — 어떤 노드도 건드리지 않고 배열 순서만 바꾸면 슬롯 전체 이동이 끝난다.

### 18.3 슬롯 삽입 헬퍼 (FR-40 핵심)

```ts
async function insertSlotAfter(board: Board, afterSlotId: string): Promise<string> {
  const newSlot = { id: uuid(), boardId: board.id };
  await slots.add(newSlot);
  const idx = board.slotOrder.indexOf(afterSlotId);
  board.slotOrder.splice(idx + 1, 0, newSlot.id);
  await boards.put(board);
  return newSlot.id;
}
```

## 19. Undo/Redo 설계

역연산을 작업마다 개별 작성하지 않고, **작업 전후 상태를 통째로 스낵샷해 갈아끼우는 방식**을 채택한다. 보드 하나의 데이터(레인/슬롯/노드)는 개인 프로젝트 규모에서 수백 개 수준이라 매번 통째로 스낵샷해도 비용이 거의 없다.

### 19.1 구조

```ts
interface BoardSnapshot {
  board: Board;
  lanes: Lane[];
  slots: Slot[];
  nodes: Node[];
}

const history: BoardSnapshot[] = [];  // 보드별로 독립 스택 (실제로는 boardId -> history 맵)
let cursor = -1;
const MAX_DEPTH = 50;

async function snapshotBoard(boardId: string): Promise<BoardSnapshot> {
  return {
    board: await boards.get(boardId),
    lanes: await lanes.where({ boardId }).toArray(),
    slots: await slots.where({ boardId }).toArray(),
    nodes: await nodes.where({ boardId }).toArray(),
  };
}

// 모든 보드 변경 작업은 반드시 이 함수를 통해서만 실행한다
async function withUndo<T>(boardId: string, mutation: () => Promise<T>): Promise<T> {
  if (cursor === -1) {
    history.push(await snapshotBoard(boardId));
    cursor = 0;
  }
  const result = await mutation();

  history.splice(cursor + 1);
  history.push(await snapshotBoard(boardId));
  cursor = history.length - 1;

  if (history.length > MAX_DEPTH) {
    history.shift();
    cursor--;
  }
  return result;
}

async function undo(boardId: string) {
  if (cursor <= 0) return;
  cursor -= 1;
  await restoreSnapshot(boardId, history[cursor]);
}

async function redo(boardId: string) {
  if (cursor >= history.length - 1) return;
  cursor += 1;
  await restoreSnapshot(boardId, history[cursor]);
}

async function restoreSnapshot(boardId: string, snap: BoardSnapshot) {
  await db.transaction('rw', [boards, lanes, slots, nodes], async () => {
    await boards.put(snap.board);
    await lanes.where({ boardId }).delete();  await lanes.bulkAdd(snap.lanes);
    await slots.where({ boardId }).delete();  await slots.bulkAdd(snap.slots);
    await nodes.where({ boardId }).delete();  await nodes.bulkAdd(snap.nodes);
  });
}
```

### 19.2 18장 함수와의 연결

18장 함수는 그대로 "실제 변경 로직"으로 두고, UI가 직접 부르는 건 이 함수들을 감싼 래퍼다.

```ts
export const boardActions = {
  dropOnNode: (boardId, nodeId, laneId, targetSlotId) =>
    withUndo(boardId, () => insertNodeIntoLane(boardId, nodeId, laneId, targetSlotId)),
  dropOnEmptyCell: (boardId, nodeId, slotId, laneId) =>
    withUndo(boardId, () => joinCell(boardId, nodeId, slotId, laneId)),
  dropOnBoundary: (boardId, nodeId, afterSlotId, laneId) =>
    withUndo(boardId, () => splitAtBoundary(boardId, nodeId, afterSlotId, laneId)),
  dragSlotHandle: (boardId, slotId, toIndex) =>
    withUndo(boardId, () => moveWholeSlot(boardId, slotId, toIndex)),
  bulkProgress: (boardId, upToSlotId, laneIds) =>
    withUndo(boardId, async () => applyBulkProgress(await boards.get(boardId), upToSlotId, laneIds)),
  resetLaneProgress: (boardId, laneId) =>
    withUndo(boardId, () => resetLaneProgress(boardId, laneId)),
  deleteLane: (boardId, laneId, mode, targetLaneId) =>
    withUndo(boardId, () => deleteLane(boardId, laneId, mode, targetLaneId)),
  // 노드/카테고리 CRUD도 같은 패턴
};
```

**규칙**: UI 코드는 `nodes.update()` 같은 Dexie 호출을 직접 하면 안 되고, 반드시 `boardActions`를 거쳐야 한다. 안 그러면 그 변경은 undo 기록에서 빠진다.

### 19.3 트레이드오프

- 히스토리는 메모리에만 있어 새로고침하면 사라진다(데이터 자체는 IndexedDB에 안전).
- 보드별로 독립적인 undo 스택을 가진다(`Map<boardId, {history, cursor}>`).
- 깊이 제한 50단계, 초과 시 가장 오래된 기록부터 버려진다.
- Ctrl+Z / Ctrl+Shift+Z(Cmd 포함)를 전역 키 핸들러에 연결해 현잮 보드의 undo/redo를 호출한다.

## 20. 파생 엣지 계산 (링크 필터)

17장 `Node.linkFilter`에 플래그를 하나 추가해야 한다. "필터를 안 건드린 상태"와 "전체를 다 체크해서 결과적으로 `excludedLaneIds`가 빈 배열인 상태"는 동작이 다르기 때문이다.

```ts
linkFilter: {
  touched: boolean;            // 사용자가 필터를 한 번이라도 조작했는지
  excludedLaneIds: string[];
};
```

- 안 건드림 → 다음 슬롯 전체에 연결 (슬롯 단위, FR-30)
- 건드림(전체선택이라도) → 포함된 레인마다 "가장 가까운 다음 노드"에 연결 (레인 단위, FR-31)

### 20.1 계산 함수

```ts
interface DerivedEdge { from: string; to: string }

function computeDerivedEdges(
  board: Board, allNodes: Node[], activeLaneIds: string[]
): DerivedEdge[] {
  const slotIndex = new Map(board.slotOrder.map((id, i) => [id, i]));
  const nodesBySlot = groupBy(allNodes, n => n.slotId);
  const edges: DerivedEdge[] = [];

  for (const n of allNodes) {
    const myIdx = slotIndex.get(n.slotId)!;

    if (!n.linkFilter.touched) {
      const nextSlotId = board.slotOrder[myIdx + 1];
      for (const target of nodesBySlot.get(nextSlotId) ?? []) {
        edges.push({ from: n.id, to: target.id });
      }
      continue;
    }

    const includedLaneIds = activeLaneIds.filter(id => !n.linkFilter.excludedLaneIds.includes(id));
    for (const laneId of includedLaneIds) {
      for (let i = myIdx + 1; i < board.slotOrder.length; i++) {
        const candidate = (nodesBySlot.get(board.slotOrder[i]) ?? []).find(x => x.laneId === laneId);
        if (candidate) {
          edges.push({ from: n.id, to: candidate.id });
          break;
        }
      }
    }
  }
  return edges;
}
```

### 20.2 설계 포인트

- 저장하지 않고 매번 계산한다(FR-07). 보드 규모에서는 비용이 미미하며, Vue에서는 `computed`로 감싸 노드/슬롯 데이터가 바끈 때만 재계산되게 한다.
- 비활성 레인(`active: false`)은 `activeLaneIds`에서 자동 제외된다(FR-15).
- `touched`는 한 번 true가 되면 되돌리지 않는다. 전체선택/전체해제를 눌러도 `touched`는 그대로 true다. UI에서는 체크박스를 처음 클릭하는 순간 `touched = true`로 전환한다.
- 18장의 Canvas 2D 렌더러가 이 함수의 결과(`edges` 배열)를 그대로 받아 그린다. 데이터 변경 시에만 재계산되므로 드래그 중 회전 애니메이션(60fps)과는 분리된다.

## 21. 나머지 트랜잭션 함수

18장에서 이름만 등장했던 헬퍼들을 채운다. 레인 삭제는 18.1의 체인 밀어내기를 그대로 재사용해서 따로 짤는 이동 로직이 거의 없다.

### 21.1 `cleanupEmptySlots` — 빈 슬롯 정리 (FR-02/03)

```ts
async function cleanupEmptySlots(board: Board) {
  const allNodes = await nodes.where({ boardId: board.id }).toArray();
  const occupiedSlotIds = new Set(allNodes.map(n => n.slotId));
  const lastSlotId = board.slotOrder.at(-1); // 마지막 슬롯은 보존 (FR-02)

  const toRemove = board.slotOrder.filter(
    id => !occupiedSlotIds.has(id) && id !== lastSlotId
  );
  if (toRemove.length === 0) return;

  board.slotOrder = board.slotOrder.filter(id => !toRemove.includes(id));
  await slots.bulkDelete(toRemove);
  await boards.put(board);
}
```

"마지막 슬롯만 예외"라는 규칙 하나로 FR-02와 FR-03을 동시에 만족시킨다.

### 21.2 `applyBulkProgress` / 레인 전체 리셋 (FR-51/52)

"지정 슬롯까지 진행"은 그 슬롯(포함)까지의 노드를 전부 완료 처리하는 것으로 해석한다.

```ts
async function applyBulkProgress(board: Board, upToSlotId: string, laneIds: string[]) {
  await db.transaction('rw', nodes, async () => {
    const upToIdx = board.slotOrder.indexOf(upToSlotId);
    const targets = (await nodes.where('boardId').equals(board.id).toArray())
      .filter(n => laneIds.includes(n.laneId)
        && board.slotOrder.indexOf(n.slotId) <= upToIdx);

    for (const n of targets) {
      await nodes.update(n.id, { progress: 100 });
    }
  });
}

// 레인 전체 리셋 (FR-52)
async function resetLaneProgress(boardId: string, laneId: string) {
  await db.transaction('rw', nodes, async () => {
    const targets = await nodes.where({ boardId, laneId }).toArray();
    for (const n of targets) await nodes.update(n.id, { progress: 0 });
  });
}
```

개별 리셋은 `nodes.update(id, { progress: 0 })` 한 줄이라 별도 함수가 필요 없다.

### 21.3 레인 삭제 (FR-16/17)

```ts
async function deleteLane(
  boardId: string, laneId: string,
  mode: 'deleteNodes' | 'moveTo', targetLaneId?: string
) {
  await db.transaction('rw', [boards, lanes, slots, nodes], async () => {
    const board = await boards.get(boardId);
    const affected = await nodes.where({ boardId, laneId }).toArray();

    if (mode === 'deleteNodes') {
      await nodes.bulkDelete(affected.map(n => n.id));
    } else {
      // 다른 카테고리로 이동: 드래그와 같은 체인 밀어내기 규칙 (FR-17)
      const sorted = affected.sort((a, b) =>
        board.slotOrder.indexOf(a.slotId) - board.slotOrder.indexOf(b.slotId));
      for (const n of sorted) {
        await insertNodeIntoLane(boardId, n.id, targetLaneId!, n.slotId); // 18.1 재사용
      }
    }

    await lanes.delete(laneId);
    const remaining = await lanes.where({ boardId }).sortBy('order');
    for (let i = 0; i < remaining.length; i++) {
      await lanes.update(remaining[i].id, { order: i });
    }

    await cleanupEmptySlots(board);
  });
}
```

눈여겨봼 지점 두 가지:

- `insertNodeIntoLane`을 노드 자신의 원래 슬롯(`n.slotId`)을 타겟으로 다시 호출하면, "같은 자리에서 레인만 바꾸기"가 된다. 그 자리에 대상 레인 노드가 이미 있으면 18.1의 체인 밀어내기가 자동으로 작동한다.
- `insertNodeIntoLane` 내부에도 `db.transaction(...)`이 있는데, Dexie는 중첩 트랜잭션을 같은 트랜잭션으로 합쳐준다. 그래서 `deleteLane`의 바깥 트랜잭션 안에서 안전하게 재사용할 수 있다.

이 셋 모두 `withUndo`로 감싸 `boardActions`에 추가되는 것을 전제로 한다(19장 패턴 그대로).

## 22. 태그 집계 정의

같은 노드에 함께 붙은 태그 쌍을 세는 것뿐이라, 노드당 태그 최대 5개(쌍 최대 10개)로 제한되어 보드 규모에서 성능 부담이 없다.

### 22.1 집계 함수

```ts
interface TagGraphNode { name: string; size: number }      // size = 이 태그가 붙은 노드 수
interface TagGraphEdge { source: string; target: string; count: number } // count = 동시 출현 횟수

function computeTagGraph(boardNodes: Node[]) {
  const tagNodeCount = new Map<string, number>();
  const pairCount = new Map<string, number>(); // key: "태그A␟Ttag그B" (정렬된 쌍)

  for (const n of boardNodes) {
    const tags = [...new Set(n.tags)];
    for (const t of tags) tagNodeCount.set(t, (tagNodeCount.get(t) ?? 0) + 1);

    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = [tags[i], tags[j]].sort().join('␟');
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  const vNodes: Record<string, TagGraphNode> = {};
  for (const [tag, count] of tagNodeCount) vNodes[tag] = { name: tag, size: count };

  const vEdges: Record<string, TagGraphEdge> = {};
  let i = 0;
  for (const [key, count] of pairCount) {
    const [a, b] = key.split('␟');
    vEdges[`e${i++}`] = { source: a, target: b, count };
  }

  return { nodes: vNodes, edges: vEdges };
}
```

태그 이름 자체를 노드 ID로 쓴다 — 태그는 자연스러운 고유 키라 별도 ID 체계가 필요 없다. 다만 "영어"와 " 영어"(앞 공백)를 다른 태그로 취급한다는 뜻이라, 태그 입력받는 쪽(노드 저장 시)에서 trim을 해주는 게 좋다.

### 22.2 v-network-graph 연결

```ts
import { ForceLayout } from "v-network-graph/lib/force-layout";

const configs = defineConfigs({
  node: {
    normal: { radius: node => 8 + Math.sqrt(node.size) * 4 }, // FR-76: 크기 = 연결된 작업 수
  },
  edge: {
    normal: { width: edge => Math.min(1 + Math.log2(edge.count + 1) * 2, 10) }, // FR-76: 굵기 = 빈도
  },
  view: {
    layoutHandler: new ForceLayout(), // 좌표 계산 없이 물리 시뮬레이션에 맡김
  },
});
```

노드 크기는 `sqrt`로(면적이 개수에 비례하게), 엣지 굵기는 로그 스케일로 완만하게 키운다 — 선형으로 하면 자주 쓰는 태그 하나가 화면을 다 잡아먹기 쉬다.

### 22.3 태그 클릭 (FR-77)

```ts
graph.on('node:click', ({ node: tagId }) => {
  selectedTag.value = tagId;
});

const nodesWithSelectedTag = computed(() =>
  boardNodes.value.filter(n => n.tags.includes(selectedTag.value))
);
```

태그 이름이 곳 ID라서 "이 태그가 붙은 노드"를 찾는 게 `includes` 한 줄이다.

### 22.4 반응성

`computeTagGraph`는 Vue `computed`로 감싸 보드의 노드 데이터가 바끈 때만 재계산되게 한다. 20장의 `computeDerivedEdges`와 같은 패턴이라, 두 그래프 뷰 모두 "저장 안 하고 보여줄 때마다 계산"이라는 원칙을 일관되게 따른다.

## 23. 모바일/반응형 레이아웃 — 수정 모드 분할 방향

가로세로 비율에 따라 CSS의 `orientation` 미디어쿼리 하나로 분할 방향을 결정한다. JS로 가로세로를 계산할 필요가 없다.

```css
.board-edit-layout {
  display: flex;
  width: 100%;
  height: 100%;
}

/* 가로 > 세로 (landscape) → 위/아래 분할 */
@media (orientation: landscape) {
  .board-edit-layout { flex-direction: column; }
}

/* 세로 >= 가로 (portrait) → 좌/우 분할 */
@media (orientation: portrait) {
  .board-edit-layout { flex-direction: row; }
}

.graph-pane {
  flex: 1 1 40%;
  min-height: 160px; /* column일 때 너무 납작해지지 않도록 */
  min-width: 140px;  /* row일 때 너무 좋아지지 않도록 */
  overflow: hidden;
}

.timetable-pane {
  flex: 1 1 60%;
  overflow: auto; /* 슬롯이 많아지면 그 안에서 스크롤 */
}
```

```vue
<template>
  <div class="board-edit-layout">
    <section class="graph-pane"><QueueGraph :board="board" /></section>
    <section class="timetable-pane"><Timetable :board="board" /></section>
  </div>
</template>
```

DOM 순서만 지키면 된다 — `graph-pane`을 항상 먼저 두면, `column`일 때는 위쪽, `row`일 때는 왼쪽에 자연스럽게 온다(flex는 기본적으로 DOM 순서대로 배치된다).

### 23.1 이점

- 모바일 전용 분기가 따로 없다. 데스크톱 창을 좋혀도 같은 미디어쿼리가 적용되고, 모바일을 가로로 돌려도 자동 전환된다. "모바일 반응형"과 "창 크기 반응형"을 하나의 규칙으로 통일한 셔이다.
- Pointer Events 기반 드래그(16장)가 마우스/터치를 이미 통합해서 다루기 때문에, `row` 레이아웃에서도 타임테이블 드래그가 동일하게 작동한다.

### 23.2 실무 포인트

- `row`(좌우 분할) 상태에서는 타임테이블 폭이 좋아진다. 레인이 5개까지 있을 수 있으니, 이 상태에서는 타임테이블 자체를 가로 스크롤(`overflow-x: auto`)하게 두고, 레인 열 너비에 `min-width`를 줌다.
- `column`(위아래 분할) 상태에서 그래프 패널 높이가 너무 작으면 `min-height`로 하한선을 둔다.
- Canvas 2D 큐 그래프(18장)의 resize 처리는 `window.resize` 대신 `ResizeObserver`로 `graph-pane` 엘리먼트를 직접 관찰해야 한다(창 크기가 아니라 패널 자체 크기 변화를 감지해야 하므로).

## 24. 리스트 뷰 스킨 컴포넌트 구조

"포맷팅(공통)"과 "레이아웃(스킨별)"을 분리한다. 플랫 모드(FR-71)도 스킨을 반영해야 하므로, 스킨마다 `Cell`(레이어별 모드용)과 `Chip`(플랫 모드용) 두 변형을 짝으로 정의한다.

### 24.1 컴포넌트 트리

```
ListView.vue
 ├─ AttributePicker.vue
 ├─ LayeredList.vue      ─ 셀마다 SKIN_MODULES[skin].Cell 렌더
 └─ FlatList.vue         ─ 슬롯당 한 행, 그 안에 SKIN_MODULES[skin].Chip을 노드 수만큼 렌더

components/skins/
 ├─ simple/      { Cell.vue, Chip.vue }
 ├─ block/       { Cell.vue, Chip.vue }
 ├─ receipt/     { Cell.vue, Chip.vue }
 ├─ dotGame/     { Cell.vue, Chip.vue }
 ├─ note/        { Cell.vue, Chip.vue }
 └─ config/      { Cell.vue, Chip.vue }
```

### 24.2 공통 포맷팅 계층

```ts
// composables/useNodeDisplay.ts
type AttrKey = 'name'|'description'|'tags'|'icon'|'progress'|'count'|'completed'|'deadline'|'createdAt';

const ATTR_LABELS: Record<AttrKey, string> = {
  name: '이름', description: '설명', tags: '태그', icon: '아이콘',
  progress: '진행도', count: '횟수', completed: '완료', deadline: '데드라인', createdAt: '생성일',
};

function formatAttr(key: AttrKey, node: Node): string {
  switch (key) {
    case 'progress': return `${node.progress}%`;
    case 'completed': return node.progress === 100 ? '완료' : '진행중';
    case 'deadline': return node.deadline ? formatDate(node.deadline) : '-';
    case 'tags': return node.tags.join(', ');
    default: return String(node[key] ?? '');
  }
}

export function useNodeDisplay(node: Node, visibleAttrs: AttrKey[]) {
  const fields = computed(() =>
    visibleAttrs.map(key => ({ key, label: ATTR_LABELS[key], value: formatAttr(key, node) }))
  );
  return { fields, completed: computed(() => node.progress === 100) };
}
```

### 24.3 스킨 계약

```ts
interface SkinProps {
  node: Node;
  visibleAttrs: AttrKey[];
}

interface SkinModule {
  Cell: Component;   // 레이어별 모드: 칸 전체 차지, 모든 속성 자세히
  Chip: Component;   // 플랫 모드: 한 행 안에 여러 개가 나란히, 압축된 표현
}

const SKIN_MODULES: Record<SkinId, SkinModule> = {
  simple: { Cell: SimpleCell, Chip: SimpleChip },
  block: { Cell: BlockCell, Chip: BlockChip },
  receipt: { Cell: ReceiptCell, Chip: ReceiptChip },
  dotGame: { Cell: DotGameCell, Chip: DotGameChip },
  note: { Cell: NoteCell, Chip: NoteChip },
  config: { Cell: ConfigCell, Chip: ConfigChip },
};
```

```vue
<!-- FlatList.vue 핵심 -->
<div v-for="slotId in board.slotOrder" :key="slotId" class="flat-row">
  <component
    v-for="n in nodesInSlot(slotId)"
    :key="n.id"
    :is="SKIN_MODULES[selectedSkin].Chip"
    :node="n"
    :visible-attrs="visibleAttrs"
  />
</div>
```

### 24.4 예시: config / dotGame 스킨

```vue
<!-- skins/config/Cell.vue -->
<template>
  <pre class="config-skin-cell">
#############################################################
<span v-for="f in fields" :key="f.key"># {{ f.label }}: {{ f.value }}
</span>#############################################################
  </pre>
</template>
<script setup lang="ts">
const { fields } = useNodeDisplay(props.node, props.visibleAttrs);
</script>
```

```vue
<!-- skins/config/Chip.vue — 한 줄 주석으로 압축 -->
<template>
  <span class="config-skin-chip"># {{ node.name }} ({{ fields.find(f => f.key==='progress')?.value }})</span>
</template>
```

```vue
<!-- skins/dotGame/Cell.vue — 도트 10개 + 전체 속성 -->
<template>
  <div class="dot-game-cell">
    <span v-for="i in 10" :key="i">{{ filled(i) ? dotChar : emptyChar }}</span>
    <span v-for="f in otherFields" :key="f.key">{{ f.label }}: {{ f.value }}</span>
  </div>
</template>
```

```vue
<!-- skins/dotGame/Chip.vue — 도트 5개로 축소, 이름만 -->
<template>
  <span class="dot-game-chip">{{ node.name }} <span v-for="i in 5" :key="i">{{ filled(i) ? dotChar : emptyChar }}</span></span>
</template>
```

압축 규칙은 스킨마다 다르게 판단한다 — 설정파일 스킨은 "진행도만 뿑아서 한 줄"로, 도트 스킨은 "도트 개수를 10→5로 줄이기"로, 서로 다른 방식이 자연스럽다. 공통 규칙으로 강제하기보다 스킨의 정체성에 맞게 고르는 영역으로 남겨둡다.

포맷팅 로직(`useNodeDisplay`)은 하나에만 있어, "진행도 표시 형식을 바꾸다" 같은 수정은 여전히 한 곳만 고치면 된다. 늘어나는 건 순수하게 레이아웃 코드뿐이다.
