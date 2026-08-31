const CHANNEL = 'kobox-share'

window.addEventListener('message', (event) => {
  if (event.source !== window) return

  const data = event.data
  if (!data || data.channel !== CHANNEL) return

  if (data.type === 'ping') {
    window.postMessage({
      channel: CHANNEL,
      type: 'pong',
      requestId: data.requestId
    }, '*')
    return
  }

  if (data.type === 'checkOwned') {
    const postOwned = (result) => {
      window.postMessage({
        channel: CHANNEL,
        type: 'ownedResult',
        requestId: data.requestId,
        ownedIds: [],
        ...result
      }, '*')
    }

    try {
      chrome.runtime.sendMessage(
        { action: 'checkOwnedBooks', productIds: data.productIds },
        (response) => {
          const runtimeError = chrome.runtime.lastError
          postOwned({
            ok: !runtimeError && Boolean(response?.ok),
            ownedIds: response?.ownedIds ?? [],
            error: runtimeError?.message || response?.error
          })
        }
      )
    } catch (error) {
      postOwned({ ok: false, error: error?.message || 'extension_context_invalidated' })
    }
    return
  }

  if (data.type === 'import') {
    const postResult = (result) => {
      window.postMessage({
        channel: CHANNEL,
        type: 'importResult',
        requestId: data.requestId,
        added: 0,
        updated: 0,
        ...result
      }, '*')
    }

    try {
      chrome.runtime.sendMessage(
        { action: 'importSharedBooks', books: data.books },
        (response) => {
          const runtimeError = chrome.runtime.lastError
          postResult({
            ok: !runtimeError && Boolean(response?.ok),
            added: response?.added ?? 0,
            updated: response?.updated ?? 0,
            error: runtimeError?.message || response?.error
          })
        }
      )
    } catch (error) {
      // 擴充功能在此分頁開著時被 reload/更新，chrome.runtime 會失效並同步拋錯。
      // 立刻回報失敗，避免頁面卡在 importing 直到 timeout。
      postResult({ ok: false, error: error?.message || 'extension_context_invalidated' })
    }
  }
})

window.postMessage({
  channel: CHANNEL,
  type: 'ready'
}, '*')
