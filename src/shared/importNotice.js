/**
 * 匯入提示（popup 橫幅 + 工具列 badge）的純邏輯。
 *
 * 提示的生命週期是「從上次開啟 popup 到現在」：background 每次匯入都累加，
 * popup 開啟時讀取並清除。因此連續加入多本書時計數會累計，而不是只留下
 * 最後一次的結果。
 *
 * 這個模組只被 background 與 popup 使用，不會被 content script 引用——
 * 後者若引用會讓 rollup 拆出共用 chunk，使 content script 變成 ES module
 * 而靜默失效（vite.config.js 有建置斷言擋這件事）。
 */

export const IMPORT_SOURCES = {
  PAGE: 'page',
  SHARE: 'share'
}

const NOTICE_VERSION = 2
const KNOWN_SOURCES = new Set(Object.values(IMPORT_SOURCES))

function toCount (value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * 讀取既有的提示。舊格式（{ added, updated, at }，沒有 v）保留計數，
 * 來源留空 —— noticeSourceKey 會因此回報 'mixed'，用中性文案呈現。
 */
function normalize (prev) {
  if (!prev || typeof prev !== 'object') {
    return { added: 0, updated: 0, sources: {} }
  }

  const sources = {}
  if (prev.v === NOTICE_VERSION && prev.sources && typeof prev.sources === 'object') {
    for (const [key, value] of Object.entries(prev.sources)) {
      if (!KNOWN_SOURCES.has(key)) continue
      sources[key] = { added: toCount(value?.added), updated: toCount(value?.updated) }
    }
  }

  return { added: toCount(prev.added), updated: toCount(prev.updated), sources }
}

/**
 * 把一次匯入的結果累加進既有提示。
 *
 * source 必須由 background 已驗證的 action 名稱推導，不可取自訊息內容 ——
 * 訊息是網頁可控的，否則惡意頁面能把自己的寫入偽裝成來自 Kobo 商店頁。
 * 不認識的來源一律折進 mixed，避免物件被灌入任意 key。
 */
export function accumulateNotice (prev, source, result, now = Date.now()) {
  const base = normalize(prev)
  const added = toCount(result?.added)
  const updated = toCount(result?.updated)

  const sources = { ...base.sources }
  if (KNOWN_SOURCES.has(source)) {
    const bucket = sources[source] || { added: 0, updated: 0 }
    sources[source] = { added: bucket.added + added, updated: bucket.updated + updated }
  }

  return {
    v: NOTICE_VERSION,
    at: now,
    added: base.added + added,
    updated: base.updated + updated,
    sources
  }
}

export function noticeTotals (notice) {
  const { added, updated } = normalize(notice)
  return { added, updated, touched: added + updated }
}

/**
 * badge 顯示「異動過的書」而非「新增的書」。
 * 若只算新增，一次全是更新的匯入會把 badge 設成空字串，抹掉前一次留下的提示。
 */
export function noticeBadgeText (notice) {
  const { touched } = noticeTotals(notice)
  if (touched <= 0) return ''
  return touched > 99 ? '99+' : String(touched)
}

/** 決定 popup 要用哪一組文案：單一來源用該來源的說法，多來源或未知則用中性說法。 */
export function noticeSourceKey (notice) {
  const { sources } = normalize(notice)
  const contributing = Object.entries(sources)
    .filter(([, value]) => value.added + value.updated > 0)
    .map(([key]) => key)

  return contributing.length === 1 ? contributing[0] : 'mixed'
}
