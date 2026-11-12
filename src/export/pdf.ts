// JPEG 그림 한 장을 한 쪽짜리 PDF로 감싼다 (그래프 PDF 내보내기용).

/**
 * @param jpeg   JPEG 파일 바이트
 * @param pixelW 그림의 가로 픽셀 수
 * @param pixelH 그림의 세로 픽셀 수
 * @param pageW  쪽 가로 크기(pt). 세로는 비율에 맞춘다.
 */
export function jpegToPdf(jpeg: Uint8Array, pixelW: number, pixelH: number, pageW: number): Blob {
  const pageH = Math.round(((pageW * pixelH) / pixelW) * 100) / 100
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`
  const encoder = new TextEncoder()

  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length
    push(`${id} 0 obj\n${body}\n`)
    if (stream) {
      push('stream\n')
      push(stream)
      push('\nendstream\n')
    }
    push('endobj\n')
  }

  push('%PDF-1.4\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  )
  object(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${pixelW} /Height ${pixelH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg,
  )
  object(5, `<< /Length ${content.length} >>`, encoder.encode(content))

  const xref = length
  push(`xref\n0 6\n0000000000 65535 f \n`)
  for (let id = 1; id <= 5; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' })
}
