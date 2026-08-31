import { MESSAGE_CHANNEL } from './config.js'

function sendToExtension (message, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()

    const onMessage = (event) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || data.channel !== MESSAGE_CHANNEL) return
      if (data.requestId !== requestId) return
      cleanup()
      resolve(data)
    }

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
    }

    window.addEventListener('message', onMessage)
    window.postMessage({
      channel: MESSAGE_CHANNEL,
      requestId,
      ...message
    }, '*')

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('timeout'))
    }, timeoutMs)
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

export async function importBooksToExtension (books) {
  const result = await sendToExtension({ type: 'import', books }, 8000)
  if (!result?.ok) {
    throw new Error(result?.error || 'import_failed')
  }
  return result
}
