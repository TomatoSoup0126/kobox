/**
 * 在 Kobo 商店頁的每本書封面右下角插入「加入 KoBox」按鈕。
 *
 * 搜尋頁與首頁是兩種不同的卡片元件，但共用兩個穩定的 hook：
 *   - [data-testid="<productId>-pricing"]  價格區塊，testid 前綴就是 productId
 *   - [data-testid="book-cover-container"] 封面容器（position: relative）
 *
 * 因此不必為每種頁面各寫一套 selector：從價格區塊往上找到最近、且只包含
 * 一個價格區塊的卡片容器即可。書名連結的 testid 兩頁不同，用一組 selector 涵蓋。
 *
 * 書籍詳細頁則是舊版 server-rendered 的頁面（跟願望清單頁同一套），沒有上述任何
 * testid，另外用 readDetailPageBook() 處理。
 *
 * 注意這些頁面是 Next.js SPA，翻頁與篩選都是 client-side re-render，
 * 所以要靠 MutationObserver 持續補注入。
 */
import { parseKoboPrice, salePriceElement, salePriceText } from '../shared/koboPrice.js'

const MARK_ATTR = 'data-kobox-injected'
const STYLE_ID = 'kobox-inject-style'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TITLE_SELECTOR = 'a[data-testid="title"], a[data-testid="carousel-card-title"]'
// 首頁的大型主打卡片沒有 title testid，退而找指向書籍頁的連結。
const TITLE_FALLBACK_SELECTOR = 'a[href*="/ebook/"], a[href*="/audiobook/"]'
const PRICING_SELECTOR = '[data-testid$="-pricing"]'

/**
 * 活動頁（/p/…）的 selector。
 *
 * 這類頁面走的是舊版 server-rendered 模板，一個 data-testid 都沒有，所以
 * PRICING_SELECTOR 那條路徑掃不到任何東西，整頁都不會長出按鈕。
 *
 * productId 只在卡片最外層的 data-product-id 上。網址 slug 不能用：它是
 * crossRevisionId 的 base64url，解出來是另一個 UUID，用它當 key 會和願望清單
 * 來的同一本書重複。
 *
 * 封面容器的 class 同一頁裡就有兩種寫法（image-coner 與 image-container），
 * 只有 .image-actions 是共通的，所以錨點用它。
 */
const CAMPAIGN = {
  card: '.item.book',
  productId: '[data-product-id]',
  cover: '.image-actions',
  title: 'h2.title.product-field',
  price: '.book-detail-line.price .price-value'
}

/**
 * 圖示家族：統一用「收納盒」表達 KoBox，盒身內的符號表示狀態。
 * 盒蓋 + 盒身的輪廓在 14px 下仍可辨識，比單純一個加號更能表達「收進盒子裡」。
 */
const BOX = '<rect x="3" y="4" width="18" height="4.4" rx="1.2"/><path d="M5 8.4v10.4a1.2 1.2 0 0 0 1.2 1.2h11.6a1.2 1.2 0 0 0 1.2-1.2V8.4"/>'
const glyph = (inner) =>
  `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`

const ICONS = {
  idle: glyph(`${BOX}<path d="M12 11.4v5.2M9.4 14h5.2"/>`),
  added: glyph(`${BOX}<path d="M9.2 14.2l2.2 2.2 4-4.2"/>`),
  failed: glyph(`${BOX}<path d="M12 11.6v3.4M12 17.4v.3"/>`),
  adding: glyph('<path d="M12 3.4a8.6 8.6 0 1 1-8.6 8.6"/>')
}

const STRINGS = {
  zh: {
    add: '加入 KoBox',
    added: '已在 KoBox（可在外掛中移除）',
    adding: '加入中',
    failed: '加入失敗，點一下重試',
    reload: '擴充功能已更新，請重新整理此頁',
    invalid: '這本書的資料不完整，無法加入',
    tooMany: 'KoBox 的書籍數量已達上限',
    untrusted: '無法加入，請重新整理此頁'
  },
  en: {
    add: 'Add to KoBox',
    added: 'In KoBox (remove it from the extension)',
    adding: 'Adding',
    failed: 'Failed — click to retry',
    reload: 'Extension was updated, please reload this page',
    invalid: "This book's data is incomplete",
    tooMany: 'KoBox has reached its book limit',
    untrusted: 'Cannot add — please reload this page'
  }
}
const t = STRINGS[document.documentElement.lang?.toLowerCase().startsWith('zh') ? 'zh' : 'en']

// storage 裡已有的 productId，用來決定按鈕要顯示「加入」還是「已在 KoBox」。
const knownIds = new Set()
// 按鈕 → 點擊動作。事件在 document 的 capture 階段就被攔下，來不及走到按鈕自己的
// listener，所以動作存在這裡由攔截器呼叫。
const buttonActions = new WeakMap()

function injectStyle () {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .kobox-add-btn {
      /* 這是注入到 Kobo 頁面裡的元素，站方的全域 button 樣式會滲進來 —— 詳細頁的
         min-height: 35px 就蓋過了我們的 height，把按鈕拉成橢圓。把可能影響尺寸與
         外觀的屬性一併明確歸零，避免各頁面樣式不一致。 */
      box-sizing: border-box;
      min-width: 0; min-height: 0; max-width: none; max-height: none;
      margin: 0; padding: 0; float: none; text-indent: 0;
      font: inherit; letter-spacing: normal; text-transform: none;
      -webkit-appearance: none; appearance: none;

      position: absolute; bottom: 6px; right: 6px; z-index: 5;
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; line-height: 0;
      border: none; border-radius: 50%;
      background: #bf0000; color: #fff; cursor: pointer;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      transition: background 0.15s, transform 0.15s;
    }
    .kobox-add-btn svg { display: block; }
    /* 視覺維持 26px，但把可點範圍撐到約 40px。不做到 44px 是刻意的 ——
       按鈕壓在封面上，範圍再大會吃掉太多封面本身的點擊區。 */
    .kobox-add-btn::before {
      content: ''; position: absolute; inset: -7px; border-radius: 50%;
    }
    .kobox-add-btn:hover:not(:disabled) { background: #8f0000; transform: scale(1.08); }
    .kobox-add-btn:disabled { cursor: default; }
    .kobox-add-btn[data-state="added"] { background: #495057; }
    .kobox-add-btn[data-state="adding"] { background: #6c757d; }
    .kobox-add-btn[data-state="failed"] { background: #dc3545; }
    .kobox-add-btn[data-state="adding"] svg { animation: kobox-spin 0.7s linear infinite; }
    @keyframes kobox-spin { to { transform: rotate(360deg); } }
  `
  document.head.appendChild(style)
}

/** 從價格區塊往上找卡片容器：包含封面、且只含一個價格區塊的最近祖先。 */
function findCardRoot (pricingEl) {
  let node = pricingEl.parentElement
  for (let i = 0; i < 10 && node; i += 1) {
    if (node.querySelectorAll(PRICING_SELECTOR).length > 1) return null
    if (node.querySelector('[data-testid="book-cover-container"]')) return node
    node = node.parentElement
  }
  return null
}

/**
 * 書籍詳細頁的 selector。
 *
 * productId 必須取 gizmo config 的 productId —— 網址 slug 編的是 crossRevisionId，
 * 兩者不同，用錯會和搜尋頁／願望清單來的同一本書重複。
 *
 * 價格必須取 .active-price（「您的價格」／「目前是」），特價時它只含售價；
 * 整個 .pricing-figures 是「15% 折扣 曾經是 NT$267 TWD 目前是 NT$227 TWD」，
 * 直接解析會得到 15。
 */
const DETAIL = {
  actions: '.item-detail-actions[data-kobo-gizmo-config]',
  cover: '.main-product-image .image-actions.image-container',
  price: '.active-price'
}

function readDetailPageBook () {
  const actions = document.querySelector(DETAIL.actions)
  if (!actions) return null

  let productId = null
  try {
    productId = JSON.parse(actions.getAttribute('data-kobo-gizmo-config'))?.productId
  } catch {
    return null
  }
  if (!productId || !UUID_RE.test(productId)) return null

  const cover = document.querySelector(DETAIL.cover)
  const titleEl = document.querySelector('h1')
  const priceEl = document.querySelector(DETAIL.price)
  if (!cover || !titleEl || !priceEl) return null

  const title = (titleEl.textContent || '').trim().replace(/\s+/g, ' ')
  const price = parseKoboPrice(salePriceText(priceEl))
  if (!title || price === null) return null

  const canonical = document.querySelector('link[rel="canonical"]')?.href
  const url = canonical || `${window.location.origin}${window.location.pathname}`

  return { productId, title, price, url, cover }
}

function readBookFromCard (pricingEl) {
  const productId = pricingEl.getAttribute('data-testid').replace(/-pricing$/, '')
  if (!UUID_RE.test(productId)) return null

  const card = findCardRoot(pricingEl)
  if (!card) return null

  const cover = card.querySelector('[data-testid="book-cover-container"]')
  const titleEl = card.querySelector(TITLE_SELECTOR) || card.querySelector(TITLE_FALLBACK_SELECTOR)
  if (!cover || !titleEl) return null

  const title = (titleEl.textContent || '').trim().replace(/\s+/g, ' ')
  // 沒有價格的書（免費、Kobo Plus 專屬、無售價）不提供匯入。
  // 特價時必須取到售價而非原價：有 testid 就直接指到售價節點，
  // 沒有的話由 salePriceText 排除刪除線的原價。
  const price = parseKoboPrice(salePriceText(salePriceElement(pricingEl)))
  if (!title || price === null) return null

  let url = ''
  try {
    url = new URL(titleEl.getAttribute('href') || titleEl.href, window.location.origin).href
  } catch {
    url = ''
  }

  return { productId, title, price, url, cover }
}

/**
 * 活動頁的卡片。價格在頁面上，所以不必額外打網路請求，但 productId 只有外層
 * 容器知道，讀不到就放棄這張卡而不是退回用 slug。
 */
function readBookFromCampaignCard (card) {
  const productId = card.closest(CAMPAIGN.productId)?.getAttribute('data-product-id')
  if (!productId || !UUID_RE.test(productId)) return null

  const cover = card.querySelector(CAMPAIGN.cover)
  const titleEl = card.querySelector(CAMPAIGN.title)
  const priceEl = card.querySelector(CAMPAIGN.price)
  if (!cover || !titleEl || !priceEl) return null

  const title = (titleEl.textContent || '').trim().replace(/\s+/g, ' ')
  // 這頁目前沒有特價卡片，但仍走 salePriceText：真出現刪除線原價時才不會抓錯。
  const price = parseKoboPrice(salePriceText(priceEl))
  if (!title || price === null) return null

  let url = ''
  try {
    const href = card.querySelector('a[href*="/ebook/"], a[href*="/audiobook/"]')?.getAttribute('href')
    url = href ? new URL(href, window.location.origin).href : ''
  } catch {
    url = ''
  }

  return { productId, title, price, url, cover }
}

// 把 background/runtime 的錯誤碼轉成使用者看得懂、且說得出下一步的說法。
function failureLabel (error) {
  const message = error?.message || String(error || '')
  if (/Extension context invalidated|receiving end does not exist/i.test(message)) return t.reload
  if (message === 'untrusted_sender') return t.untrusted
  if (message === 'too_many') return t.tooMany
  if (message === 'invalid_books') return t.invalid
  return t.failed
}

function setState (button, state, failureText) {
  const label = state === 'added' ? t.added
    : state === 'adding' ? t.adding
    : state === 'failed' ? (failureText || t.failed)
    : t.add

  button.dataset.state = state
  // 失敗後保持可點，使用者才有辦法重試。
  button.disabled = state === 'added' || state === 'adding'
  button.innerHTML = ICONS[state] || ICONS.idle
  // icon-only 按鈕，文字說明只能靠 aria-label 與 tooltip 提供。
  button.setAttribute('aria-label', label)
  button.setAttribute('title', label)
}

async function addBook (button, book) {
  setState(button, 'adding')
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'addBooksFromPage',
      books: [{ productId: book.productId, title: book.title, price: book.price, url: book.url }]
    })

    if (!response?.ok) throw new Error(response?.error || 'add_failed')

    knownIds.add(book.productId)
    syncAllButtons()
  } catch (error) {
    // 擴充功能重載後 chrome.runtime 會失效並同步拋錯，這裡一併接住。
    console.warn('[KoBox] 加入失敗:', error)
    setState(button, 'failed', failureLabel(error))
    // 停留久一點，讓 tooltip 有機會被看到。
    setTimeout(() => {
      if (button.dataset.state === 'failed') setState(button, 'idle')
    }, 4000)
  }
}

/**
 * 在 document 的 capture 階段攔下落在按鈕上的指標事件。
 *
 * 卡片元件可能在 capture 階段、或在 pointerdown/mousedown 就觸發導覽，
 * 那些都發生在按鈕自己的 click listener 之前，光在按鈕上 stopPropagation 攔不住。
 * document capture 是整個傳播路徑的第一站，從這裡切斷最保險。
 */
const GUARDED_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'auxclick']

function guardButtonEvents () {
  for (const type of GUARDED_EVENTS) {
    document.addEventListener(type, (event) => {
      const target = event.target
      const button = target instanceof Element ? target.closest('.kobox-add-btn') : null
      if (!button) return

      event.preventDefault()
      event.stopImmediatePropagation()

      if (type === 'click' && !button.disabled) {
        buttonActions.get(button)?.()
      }
    }, true)
  }
}

function collectBooks () {
  const books = []

  for (const pricingEl of document.querySelectorAll(PRICING_SELECTOR)) {
    const book = readBookFromCard(pricingEl)
    if (book) books.push(book)
  }

  for (const card of document.querySelectorAll(CAMPAIGN.card)) {
    const book = readBookFromCampaignCard(card)
    if (book) books.push(book)
  }

  const detail = readDetailPageBook()
  if (detail) books.push(detail)

  return books
}

function injectButtons () {
  for (const book of collectBooks()) {
    if (book.cover.querySelector(`[${MARK_ATTR}="${book.productId}"]`)) continue

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'kobox-add-btn'
    button.setAttribute(MARK_ATTR, book.productId)
    setState(button, knownIds.has(book.productId) ? 'added' : 'idle')

    buttonActions.set(button, () => addBook(button, book))
    book.cover.appendChild(button)
  }
}

/** storage 變動或成功加入後，把所有同 productId 的按鈕一起更新（搜尋頁一本書有兩張卡片）。 */
function syncAllButtons () {
  for (const button of document.querySelectorAll(`[${MARK_ATTR}]`)) {
    const productId = button.getAttribute(MARK_ATTR)
    if (knownIds.has(productId)) {
      setState(button, 'added')
    } else if (button.dataset.state === 'added') {
      setState(button, 'idle')
    }
  }
}

async function loadKnownIds () {
  try {
    const { koboBooks } = await chrome.storage.local.get(['koboBooks'])
    const list = Array.isArray(koboBooks) ? koboBooks
      : (koboBooks && typeof koboBooks === 'object' ? Object.values(koboBooks) : [])

    knownIds.clear()
    for (const book of list) {
      const id = book?.productId || book?.id
      if (id) knownIds.add(String(id))
    }
  } catch (error) {
    console.warn('[KoBox] 讀取已存書籍失敗:', error)
  }
}

function start () {
  injectStyle()
  guardButtonEvents()
  injectButtons()

  // Next.js 的 client-side 導覽不會觸發 load，靠 observer 補注入。
  let pending = null
  const observer = new MutationObserver(() => {
    if (pending) return
    pending = setTimeout(() => {
      pending = null
      injectButtons()
      syncAllButtons()
    }, 250)
  })
  observer.observe(document.body, { childList: true, subtree: true })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.koboBooks) return
    loadKnownIds().then(syncAllButtons)
  })
}

loadKnownIds().then(() => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
})
