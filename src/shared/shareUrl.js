import { encodePayload } from './codec.js'
import { DEV_SHARE_PORTS, MAX_SHARE_BOOKS, SHARE_PAGE_ORIGIN } from './config.js'
import { packBooks, validateBooks } from './sharePayload.js'

/**
 * development build 指向本機分享頁，否則預覽與複製出來的連結都會連到正式站台，
 * 開發時得手動改網域才測得到。
 *
 * import.meta.env 只有在 vite 建置時才存在；這個模組也被 Node 的測試 import，
 * 所以用 optional chaining 讓它在沒有 env 時安全地落回正式站台。
 */
function sharePageOrigin () {
  // 用 DEV_SHARE_PORTS[0]（vite dev server 的 5174）。若改用 npm run preview:site
  // 的 4173，連結仍會指向 5174 —— 那條路徑很少用來測分享，不值得再加設定。
  return import.meta.env?.MODE === 'development'
    ? `http://localhost:${DEV_SHARE_PORTS[0]}`
    : SHARE_PAGE_ORIGIN
}

export async function createShareUrl (books) {
  const { ok, books: cleaned, error } = validateBooks(books, { max: MAX_SHARE_BOOKS })
  if (!ok) {
    throw new Error(error || 'invalid_books')
  }

  const encoded = await encodePayload(packBooks(cleaned))
  return `${sharePageOrigin()}/#${encoded}`
}
