/**
 * extensionBridge 的回歸測試。
 *
 * window.postMessage 會把訊息送回發送端自己的 listener，所以 sendToExtension
 * 必須用型別區分「自己送出的 request」與「content script 的回覆」，
 * 否則 Promise 會被自己的 request resolve，detectExtension 永遠回傳 false。
 */
function assert (condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

// 模擬瀏覽器的 window：postMessage 非同步派送給所有 listener（含發送端自己）。
function createFakeWindow () {
  const listeners = new Set()
  const win = {
    addEventListener: (type, fn) => { if (type === 'message') listeners.add(fn) },
    removeEventListener: (type, fn) => { if (type === 'message') listeners.delete(fn) },
    postMessage: (data) => {
      // 瀏覽器的 postMessage 會做 structured clone，Vue 的 reactive proxy 在這裡會拋
      // DataCloneError，所以測試也必須複製這個行為才抓得到。
      const cloned = structuredClone(data)
      setTimeout(() => {
        for (const fn of [...listeners]) fn({ source: win, data: cloned })
      }, 0)
    }
  }
  return win
}

// 模擬 src/content/share-bridge.js 的回覆行為。
function attachFakeBridge (win, { importResult } = {}) {
  win.addEventListener('message', (event) => {
    const data = event.data
    if (!data || data.channel !== 'kobox-share') return

    if (data.type === 'ping') {
      win.postMessage({ channel: 'kobox-share', type: 'pong', requestId: data.requestId })
    }

    if (data.type === 'checkOwned') {
      win.postMessage({
        channel: 'kobox-share',
        type: 'ownedResult',
        requestId: data.requestId,
        ok: true,
        ownedIds: (data.productIds || []).filter((id) => id.startsWith('owned-'))
      })
    }

    if (data.type === 'import') {
      win.postMessage({
        channel: 'kobox-share',
        type: 'importResult',
        requestId: data.requestId,
        added: 0,
        updated: 0,
        ...importResult
      })
    }
  })
}

globalThis.window = createFakeWindow()
const { checkOwnedBooks, detectExtension, importBooksToExtension } = await import('../src/shared/extensionBridge.js')

attachFakeBridge(globalThis.window, { importResult: { ok: true, added: 2, updated: 1 } })

assert(await detectExtension() === true, 'detectExtension should resolve on pong, not on its own echoed ping')

const result = await importBooksToExtension([{ productId: 'book-1', title: 't', price: 100 }])
assert(result.ok === true, 'import should resolve with the bridge reply')
assert(result.added === 2 && result.updated === 1, 'import counts should come from the bridge reply')

// Vue 的 reactive ref 會把陣列元素包成 Proxy，直接 postMessage 會拋 DataCloneError。
const reactiveish = [new Proxy(
  { id: 'book-2', title: '書名', price: 250, url: '', selected: true, pinned: false },
  {}
)]
const proxyResult = await importBooksToExtension(reactiveish)
assert(proxyResult.ok === true, 'import should survive Vue reactive proxies')

// checkOwned 只回交集。這條同時守住 RESPONSE_TYPES：少註冊 'ownedResult'
// 的話回覆會被過濾掉，這裡會逾時而不是拿到結果。
const owned = await checkOwnedBooks(['owned-1', 'missing-2', 'owned-3'])
assert(owned.length === 2, `應回傳 2 個已擁有的 id，得到 ${owned.length}`)
assert(owned.includes('owned-1') && owned.includes('owned-3'), '回傳的應是請求 id 的交集')

// 沒有 content script 時，自己送出的 request 不該被當成回覆。
globalThis.window = createFakeWindow()
const bare = await import(`../src/shared/extensionBridge.js?bare=${Date.now()}`)
let rejected = false
try {
  await bare.importBooksToExtension([{ productId: 'book-1', title: 't', price: 100 }])
} catch (error) {
  rejected = true
  assert(error.message === 'timeout', `expected timeout, got ${error.message}`)
}
assert(rejected, 'import should time out when no content script replies')

let ownedRejected = false
try {
  await bare.checkOwnedBooks(['book-1'])
} catch (error) {
  ownedRejected = true
  assert(error.message === 'timeout', `expected timeout, got ${error.message}`)
}
assert(ownedRejected, 'checkOwned should time out when no content script replies')

console.log('extension bridge tests passed')
