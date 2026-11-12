// 보드를 엑셀(.xlsx) 표로 내보낸다: 작업 한 개가 한 행.

import { isCompleted, labelGroupsOf, sortedLanes, NAME_LABEL_GROUP_ID, type BoardData } from '../domain'
import { zipStore } from './zip'

type Cell = string | number

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // XML에 넣을 수 없는 제어 문자는 뺀다.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

function formatDate(ms: number | undefined): string {
  if (!ms) return ''
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 표 내용: 첫 행은 머리글. 슬롯 순서, 그 안에서는 카테고리 순서로 정렬한다. */
export function boardRows(data: BoardData): Cell[][] {
  const lanes = sortedLanes(data)
  const laneOrder = new Map(lanes.map((l, i) => [l.id, i]))
  const slotOrder = new Map(data.board.slotOrder.map((id, i) => [id, i]))
  const extraGroups = labelGroupsOf(data).filter((g) => g.id !== NAME_LABEL_GROUP_ID)

  const head: Cell[] = ['슬롯', '카테고리', '이름', '설명', '태그', '진행도(%)', '완료', '데드라인', '표시', ...extraGroups.map((g) => g.name)]
  const nodes = [...data.nodes].sort(
    (a, b) => slotOrder.get(a.slotId)! - slotOrder.get(b.slotId)! || laneOrder.get(a.laneId)! - laneOrder.get(b.laneId)!,
  )
  const body = nodes.map((n): Cell[] => [
    slotOrder.get(n.slotId)! + 1,
    lanes[laneOrder.get(n.laneId)!]?.name ?? '',
    n.name,
    n.description ?? '',
    n.tags.join(', '),
    n.progress,
    isCompleted(n) ? '완료' : '',
    formatDate(n.deadline),
    n.visible ? '' : '숨김',
    ...extraGroups.map((g) => n.labels?.[g.id] ?? ''),
  ])
  return [head, ...body]
}

function sheetXml(rows: Cell[][]): string {
  const xmlRows = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${columnName(c)}${r + 1}`
      if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`
      if (value === '') return ''
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
    })
    return `<row r="${r + 1}">${cells.join('')}</row>`
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows.join('')}</sheetData></worksheet>`
}

export function boardToXlsx(data: BoardData): Blob {
  const sheetName = escapeXml(data.board.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Board')
  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': sheetXml(boardRows(data)),
  }
  const encoder = new TextEncoder()
  const zip = zipStore(Object.entries(files).map(([name, text]) => ({ name, data: encoder.encode(text) })))
  return new Blob([zip.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
