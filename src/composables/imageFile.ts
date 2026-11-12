// 첨부 사진을 작은 정사각형 썸네일(data URL)로 줄인다.
// 노드 표시는 원형 아이콘 크기면 충분하고, 원본을 그대로 넣으면 IndexedDB와 undo 기록이 금방 커진다.

const THUMB_SIZE = 192
const MAX_FILE_BYTES = 20 * 1024 * 1024

export async function fileToThumbnail(file: File, size = THUMB_SIZE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 첨부할 수 있습니다.')
  if (file.size > MAX_FILE_BYTES) throw new Error('20MB 이하의 이미지만 첨부할 수 있습니다.')

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
      el.src = url
    })
    // 가운데를 기준으로 정사각형으로 잘라 넣는다 (cover)
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('이미지를 처리할 수 없습니다.')
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
    // 투명 배경이 있는 PNG는 투명을 유지하고, 나머지는 용량이 작은 JPEG로 저장한다.
    return file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}
