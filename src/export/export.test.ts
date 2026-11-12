import { describe, expect, it } from 'vitest'
import { addLabelGroup, setNodeLabel, updateNode } from '../domain'
import { build } from '../domain/testUtils'
import { jpegToPdf } from './pdf'
import { boardRows, boardToXlsx } from './xlsx'
import { crc32, zipStore } from './zip'

const text = (s: string) => new TextEncoder().encode(s)

describe('내보내기', () => {
  it('crc32는 표준 검사값과 같다', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926)
  })

  it('zip: 파일 수와 중앙 디렉터리 위치가 끝 레코드에 맞게 기록된다', () => {
    const zip = zipStore([
      { name: 'a.txt', data: text('hello') },
      { name: '폴더/b.txt', data: text('안녕') },
    ])
    const view = new DataView(zip.buffer)
    const end = zip.length - 22
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(2)
    const dirOffset = view.getUint32(end + 16, true)
    expect(view.getUint32(dirOffset, true)).toBe(0x02014b50)
    expect(dirOffset + view.getUint32(end + 12, true)).toBe(end)
  })

  it('엑셀 표: 슬롯·카테고리 순으로 한 작업이 한 행, 추가 라벨 그룹은 열로 붙는다', () => {
    let d = build(['A', 'B'], [['a', 'b'], ['c', null]])
    d = updateNode(d, 'b', { progress: 100, tags: ['x', 'y'] }).data
    const group = addLabelGroup(d)
    d = setNodeLabel(group.data, 'c', group.id!, '메모').data
    const rows = boardRows(d)
    expect(rows[0]).toEqual(['슬롯', '카테고리', '이름', '설명', '태그', '진행도(%)', '완료', '데드라인', '표시', '라벨 2'])
    expect(rows.slice(1).map((r) => [r[0], r[1], r[2]])).toEqual([
      [1, 'A', 'a'],
      [1, 'B', 'b'],
      [2, 'A', 'c'],
    ])
    expect(rows[2].slice(4, 7)).toEqual(['x, y', 100, '완료'])
    expect(rows[3][9]).toBe('메모')
  })

  it('xlsx 파일은 zip이고 시트에 글자가 XML로 안전하게 들어간다', async () => {
    let d = build(['A'], [['a']])
    d = updateNode(d, 'a', { name: 'x < y & "z"' }).data
    const bytes = new Uint8Array(await boardToXlsx(d).arrayBuffer())
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    const body = new TextDecoder().decode(bytes)
    expect(body).toContain('xl/worksheets/sheet1.xml')
    expect(body).toContain('x &lt; y &amp; &quot;z&quot;')
  })

  it('pdf: 교차 참조표의 위치가 실제 객체 위치와 맞는다', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const pdf = new TextDecoder('latin1').decode(await jpegToPdf(jpeg, 200, 100, 150).arrayBuffer())
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('/MediaBox [0 0 150 75]')
    const xref = Number(pdf.match(/startxref\n(\d+)/)![1])
    expect(pdf.slice(xref, xref + 4)).toBe('xref')
    const offsets = [...pdf.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]))
    expect(offsets.map((o) => pdf.slice(o, o + 7))).toEqual(['1 0 obj', '2 0 obj', '3 0 obj', '4 0 obj', '5 0 obj'])
  })
})
