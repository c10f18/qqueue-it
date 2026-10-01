// 스킨 계약 (명세 24.3): 스킨마다 Cell(레이어별)과 Chip(플랫) 한 쌍을 제공한다.
// 새 스킨은 폴더를 만들고 여기에 한 줄만 등록하면 된다. (NFR-02)
import type { Component } from 'vue'
import SimpleCell from './simple/Cell.vue'
import SimpleChip from './simple/Chip.vue'

export interface SkinModule {
  label: string
  Cell: Component
  Chip: Component
}

export const SKIN_MODULES = {
  simple: { label: '심플', Cell: SimpleCell, Chip: SimpleChip },
} satisfies Record<string, SkinModule>

export type SkinId = keyof typeof SKIN_MODULES
