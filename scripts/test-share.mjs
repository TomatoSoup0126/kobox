import { encodePayload, decodePayload } from '../src/shared/codec.js'
import {
  buildWishlistJson,
  mergeImportedBooks,
  packBooks,
  parseWishlistJson,
  unpackBooks,
  validateBooks
} from '../src/shared/sharePayload.js'
import { createShareUrl } from '../src/shared/shareUrl.js'
import { MAX_IMPORT_BOOKS, MAX_SHARE_BOOKS, SHARE_PAGE_ORIGIN } from '../src/shared/config.js'

function assert (condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const sample = [
  { productId: 'book-1', title: '測試書一', price: 199, url: 'https://www.kobo.com/tw/zh/ebook/one' },
  { productId: 'book-2', title: '測試書二', price: 299, url: 'https://evil.example/nope' }
]

const validated = validateBooks(sample)
assert(validated.ok, 'sample should validate')
assert(validated.books[1].url === '', 'non-kobo urls should be stripped')

// 從常數推導，調整上限時測試不必跟著改數字。
const overShareLimit = Array.from({ length: MAX_SHARE_BOOKS + 1 }, (_, i) => ({
  productId: `id-${i}`,
  title: `title-${i}`,
  price: 100 + i
}))
assert(
  validateBooks(overShareLimit, { max: MAX_SHARE_BOOKS }).error === 'too_many',
  'share max should reject one book over the limit'
)
assert(
  validateBooks(overShareLimit.slice(0, MAX_SHARE_BOOKS), { max: MAX_SHARE_BOOKS }).ok,
  'share max should accept exactly the limit'
)
assert(validateBooks(overShareLimit, { max: MAX_IMPORT_BOOKS }).ok, 'import limit is separate from the share limit')
assert(validateBooks(overShareLimit).ok, 'json import has no share limit')

const tooManyToImport = Array.from({ length: MAX_IMPORT_BOOKS + 1 }, (_, i) => ({
  productId: `bulk-${i}`,
  title: `bulk-${i}`,
  price: 100
}))
assert(
  validateBooks(tooManyToImport, { max: MAX_IMPORT_BOOKS }).error === 'too_many',
  'import limit should reject an oversized payload'
)

const packed = packBooks(validated.books)
const encoded = await encodePayload(packed)
const decoded = unpackBooks(await decodePayload(encoded))
assert(decoded.length === 2, 'roundtrip should keep both books')
assert(decoded[0].title === '測試書一', 'title should survive compression')

const json = buildWishlistJson(validated.books)
const parsed = parseWishlistJson(JSON.stringify(json))
assert(parsed.length === 2, 'json export/import should roundtrip')

const existing = [{
  id: 'book-1',
  productId: 'book-1',
  title: '舊書名',
  price: 150,
  selected: false,
  pinned: true,
  url: ''
}]
const merged = mergeImportedBooks(existing, parsed)
assert(merged.added === 1, 'new book should be added')
assert(merged.updated === 1, 'existing book should be updated')
assert(merged.books[0].pinned === true, 'pin state should be kept')
assert(merged.books[0].selected === false, 'selection should be kept')
assert(merged.books[0].title === '測試書一', 'title should update')
assert(merged.books[1].selected === true, 'new book should start selected')

const shareUrl = await createShareUrl(validated.books)
// 在 Node 裡沒有 import.meta.env，createShareUrl 會落回正式站台。
// dev build 指向 localhost 的那條分支由 vite 的 MODE 決定，只能靠建置產物驗證。
assert(shareUrl.startsWith(`${SHARE_PAGE_ORIGIN}/#`), 'share url should fall back to the production origin')

console.log('share payload tests passed')
