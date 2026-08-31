import { JSON_FORMAT_VERSION, MAX_SHARE_BOOKS } from './config.js'

const MAX_TITLE_LENGTH = 300
const MAX_ID_LENGTH = 80

export function sanitizeBookUrl (url) {
  if (!url || typeof url !== 'string') return ''

  try {
    const parsed = new URL(url, 'https://www.kobo.com')
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    const host = parsed.hostname.replace(/^www\./, '')
    if (host !== 'kobo.com') return ''
    return parsed.href
  } catch {
    return ''
  }
}

export function koboSearchUrl (title) {
  return `https://www.kobo.com/tw/zh/search?query=${encodeURIComponent(title || '')}`
}

export function bookHref (book) {
  return sanitizeBookUrl(book?.url) || koboSearchUrl(book?.title || '')
}

export function packBooks (books) {
  return {
    v: JSON_FORMAT_VERSION,
    ts: Date.now(),
    b: books.map((book) => [
      book.productId || book.id,
      book.title,
      book.price,
      book.url || ''
    ])
  }
}

export function unpackBooks (payload) {
  if (!payload || payload.v !== JSON_FORMAT_VERSION || !Array.isArray(payload.b)) {
    throw new Error('invalid_payload')
  }

  if (payload.b.length > MAX_SHARE_BOOKS) {
    throw new Error('too_many')
  }

  const { ok, books, error } = validateBooks(
    payload.b.map(([productId, title, price, url]) => ({
      productId,
      title,
      price,
      url
    }))
  )

  if (!ok) {
    throw new Error(error || 'invalid_payload')
  }

  return books
}

export function validateBooks (books, { max = Infinity } = {}) {
  if (!Array.isArray(books) || books.length === 0 || books.length > max) {
    return { ok: false, error: books?.length > max ? 'too_many' : 'invalid_books' }
  }

  const cleaned = []
  const seen = new Set()

  for (const raw of books) {
    if (!raw || typeof raw !== 'object') continue

    const productId = String(raw.productId || raw.id || '').trim()
    const title = String(raw.title || '').trim()
    const price = Number(raw.price)

    if (!productId || productId.length > MAX_ID_LENGTH) continue
    if (!title || title.length > MAX_TITLE_LENGTH) continue
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) continue
    if (seen.has(productId)) continue

    seen.add(productId)
    cleaned.push({
      id: productId,
      productId,
      title,
      price: Math.round(price),
      url: sanitizeBookUrl(raw.url)
    })
  }

  if (cleaned.length === 0) {
    return { ok: false, error: 'invalid_books' }
  }

  return { ok: true, books: cleaned }
}

export function parseWishlistJson (raw) {
  let data = raw
  if (typeof raw === 'string') {
    data = JSON.parse(raw)
  }

  if (!data || typeof data !== 'object') {
    throw new Error('invalid_json')
  }

  const list = Array.isArray(data.books) ? data.books : (Array.isArray(data) ? data : null)
  if (!list) {
    throw new Error('invalid_json')
  }

  const { ok, books, error } = validateBooks(list)
  if (!ok) {
    throw new Error(error || 'invalid_json')
  }

  return books
}

export function buildWishlistJson (books) {
  return {
    v: JSON_FORMAT_VERSION,
    exportedAt: Date.now(),
    books: books.map((book) => ({
      productId: book.productId || book.id,
      title: book.title,
      price: book.price,
      url: sanitizeBookUrl(book.url)
    }))
  }
}

export function mergeImportedBooks (existing, incoming) {
  const next = (Array.isArray(existing) ? existing : []).map((book) => ({ ...book }))
  const byId = new Map(
    next
      .filter((book) => book && (book.productId || book.id))
      .map((book) => [String(book.productId || book.id), book])
  )

  let added = 0
  let updated = 0

  for (const book of incoming) {
    const prev = byId.get(book.productId)
    if (prev) {
      prev.title = book.title
      prev.price = book.price
      if (book.url) prev.url = book.url
      updated += 1
      continue
    }

    const created = {
      id: book.productId,
      productId: book.productId,
      title: book.title,
      price: book.price,
      url: book.url || '',
      selected: true,
      pinned: false
    }
    next.push(created)
    byId.set(book.productId, created)
    added += 1
  }

  return { books: next, added, updated }
}
