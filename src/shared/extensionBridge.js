import { MESSAGE_CHANNEL } from './config.js'

// content script 的回覆型別。因為 window.postMessage 也會回送給發送端自己，
// 必須用型別區分回覆與自己送出的 request，否則 Promise 會被自己的 request resolve。
const RESPONSE_TYPES = new Set(['pong', 'importResult', 'ownedResult'])

function sendToExtension (message, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()

    const onMessage = (event) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || data.channel !== MESSAGE_CHANNEL) return
      if (!RESPONSE_TYPES.has(data.type)) return
      if (data.requestId !== requestId) return
      cleanup()
      resolve(data)
    }

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
    }

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('timeout'))
    }, timeoutMs)

    window.addEventListener('message', onMessage)
    window.postMessage({
      channel: MESSAGE_CHANNEL,
      requestId,
      ...message
    }, '*')
  })
}

export async function detectExtension () {
  const delays = [0, 250, 700, 1400]

  for (const delay of delays) {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    try {
      const result = await sendToExtension({ type: 'ping' }, 400)
      if (result?.type === 'pong') return true
    } catch {
      // content script may still be injecting
    }
  }

  return false
}

/**
 * 問擴充功能：這批 productId 裡哪些已經在使用者的清單中。
 *
 * 只送 id、只收回交集，不取得書名或價格 —— 分享頁只需要「有沒有」的答案。
 * 傳的是純字串陣列，不會有 Vue 的 reactive proxy 造成 DataCloneError。
 */
export async function checkOwnedBooks (productIds) {
  const payload = productIds.map((id) => String(id))
  const result = await sendToExtension({ type: 'checkOwned', productIds: payload }, 1500)
  if (!result?.ok) {
    throw new Error(result?.error || 'check_owned_failed')
  }
  return Array.isArray(result.ownedIds) ? result.ownedIds : []
}

export async function importBooksToExtension (books) {
  // postMessage 走 structured clone，無法複製 Vue 的 reactive proxy（會拋 DataCloneError），
  // 而且 background 也用不到 selected/pinned 這些 UI 狀態，只挑需要的欄位轉成純物件。
  const payload = books.map((book) => ({
    productId: book.productId || book.id,
    title: book.title,
    price: book.price,
    url: book.url || ''
  }))

  const result = await sendToExtension({ type: 'import', books: payload }, 8000)
  if (!result?.ok) {
    throw new Error(result?.error || 'import_failed')
  }
  return result
}
