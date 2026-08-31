import { encodePayload } from './codec.js'
import { MAX_SHARE_BOOKS, SHARE_PAGE_ORIGIN } from './config.js'
import { packBooks, validateBooks } from './sharePayload.js'

export async function createShareUrl (books) {
  const { ok, books: cleaned, error } = validateBooks(books, { max: MAX_SHARE_BOOKS })
  if (!ok) {
    throw new Error(error || 'invalid_books')
  }

  const encoded = await encodePayload(packBooks(cleaned))
  return `${SHARE_PAGE_ORIGIN}/#${encoded}`
}
