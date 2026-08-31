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

const eleven = Array.from({ length: 11 }, (_, i) => ({
  productId: `id-${i}`,
  title: `title-${i}`,
  price: 100 + i
}))
assert(validateBooks(eleven, { max: 10 }).ok === false, 'share max of 10 should reject 11 books')
assert(validateBooks(eleven).ok, 'json import should allow more than 10 books')

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
assert(shareUrl.startsWith('https://kobox.netlify.app/#'), 'share url should use netlify hash')

console.log('share payload tests passed')
