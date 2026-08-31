/**
 * 解析 Kobo 商店頁的價格字串。
 *
 * 搜尋頁與首頁的價格帶小數與後綴，例如：
 *   "NT$322.00"
 *   "NT$1,280.00"
 *   "NT$300.00 將於 2026年8月31日 提供"      (預購)
 *   "NT$226.00 或透過 Kobo Plus 免費享用"
 *
 * 願望清單頁用的 content.js parsePrice 會把小數點和後續數字一起吃掉
 * （"NT$300.00 將於 2026年8月31日 提供" → 300002026831），所以這裡只取
 * 第一個看起來像金額的數字。
 *
 * 沒有價格、免費、或解析不出正數時回傳 null —— 呼叫端據此略過該本書。
 */
export function parseKoboPrice (text) {
  if (!text || typeof text !== 'string') return null

  const match = text.match(/(\d[\d,]*)(?:\.(\d{1,2}))?/)
  if (!match) return null

  const value = parseFloat(`${match[1].replace(/,/g, '')}.${match[2] || '0'}`)
  if (!Number.isFinite(value) || value <= 0) return null

  return Math.round(value)
}

const TEXT_NODE = 3
const ELEMENT_NODE = 1

/**
 * 判斷一個元素是否為刪除線的原價。
 *
 * 不能只比對 class 名稱：Kobo 不同頁面的元件用不同寫法，有些是 Tailwind 的
 * line-through，有些是樣式表裡的雜湊 class（例如詳細頁的「更多作品」輪播），
 * 後者用 class 比對會漏掉而抓成原價。computed style 不管用哪種寫法都攔得到。
 *
 * text-decoration-line 不是繼承屬性，子元素的 computed 值會是 none，
 * 所以命中時要跳過整個子樹，而不是只跳過該元素。
 */
function isStruckThrough (element) {
  if (element.tagName === 'S' || element.tagName === 'DEL') return true

  const className = typeof element.className === 'string' ? element.className : ''
  if (className.includes('line-through')) return true

  try {
    return getComputedStyle(element).textDecorationLine.includes('line-through')
  } catch {
    return false
  }
}

/**
 * 從價格區塊挑出「實際售價」的節點。
 *
 * Kobo 的新版元件把原價與售價各自標了 testid：
 *   <productId>-pricing-price-was-price   原價（畫成刪除線）
 *   <productId>-pricing-price-value       售價
 * 有 testid 就直接用，比從刪除線樣式反推可靠。搜尋頁的元件沒有這組 testid，
 * 才退回整塊價格區、由 salePriceText 排除刪除線的原價。
 */
export function salePriceElement (pricingEl) {
  if (!pricingEl?.querySelector) return pricingEl
  return pricingEl.querySelector('[data-testid$="-pricing-price-value"]') || pricingEl
}

/**
 * 取出價格區塊中「實際售價」的文字。
 *
 * 特價時 Kobo 會把原價以刪除線排在特價前面（"Old Price:NT$267.00 TWD價格NT$227.00 TWD"），
 * 直接解析整段會抓到原價。
 *
 * 必須走訪原始節點而非複製品：computed style 在脫離文件的節點上取不到。
 */
export function salePriceText (element, isStruck = isStruckThrough) {
  if (!element) return ''

  let text = ''
  const walk = (node) => {
    if (node.nodeType === TEXT_NODE) {
      text += node.nodeValue || ''
      return
    }
    if (node.nodeType !== ELEMENT_NODE) return
    if (isStruck(node)) return

    for (const child of node.childNodes || []) walk(child)
  }

  for (const child of element.childNodes || []) walk(child)
  return text
}
