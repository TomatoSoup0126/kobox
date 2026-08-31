/**
 * 觸發瀏覽器下載一份 JSON 檔案。
 *
 * revokeObjectURL 必須延後到下一個 task，否則 Chrome 在較大的 blob 上
 * 可能在解析 URL 前就被撤銷，產生 0 byte 或 "Failed - Network error" 的下載。
 */
export function downloadJsonFile (payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function wishlistFilename (date = new Date()) {
  return `kobox-wishlist-${date.toISOString().slice(0, 10)}.json`
}
