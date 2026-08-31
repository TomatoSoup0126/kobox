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

  if (data.type === 'import') {
    chrome.runtime.sendMessage(
      { action: 'importSharedBooks', books: data.books },
      (response) => {
        const runtimeError = chrome.runtime.lastError
        window.postMessage({
          channel: CHANNEL,
          type: 'importResult',
          requestId: data.requestId,
          ok: !runtimeError && Boolean(response?.ok),
          added: response?.added ?? 0,
          updated: response?.updated ?? 0,
          error: runtimeError?.message || response?.error
        }, '*')
      }
    )
  }
})

window.postMessage({
  channel: CHANNEL,
  type: 'ready'
}, '*')
