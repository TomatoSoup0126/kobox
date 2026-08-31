/**
 * parseKoboPrice 的測試。字串取自 Kobo 搜尋頁與首頁的實際 DOM。
 */
import { parseKoboPrice } from '../src/shared/koboPrice.js'

function assert (condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const cases = [
  ['NT$322.00', 322],
  ['NT$1,280.00', 1280],
  ['價格NT$227.00 TWD', 227],
  ['Old Price:NT$267.00 TWD價格NT$227.00 TWD', 267],
  // 預購：後面接的日期不可以被吃進金額（舊的 parsePrice 會算成 300002026831）
  ['NT$300.00 將於 2026年8月31日 提供', 300],
  ['NT$226.00 或透過 Kobo Plus 免費享用', 226],
  ['NT$80', 80],
  // 無價格 / 免費 → null，呼叫端據此不顯示按鈕
  ['免費', null],
  ['Free', null],
  ['NT$0.00', null],
  ['', null],
  [null, null],
  [undefined, null]
]

for (const [input, expected] of cases) {
  const actual = parseKoboPrice(input)
  assert(actual === expected, `parseKoboPrice(${JSON.stringify(input)}) = ${actual}, 預期 ${expected}`)
}

console.log('kobo price tests passed')

// --- salePriceText：特價時必須取到實際售價而非刪除線的原價 ---
const { salePriceElement, salePriceText } = await import('../src/shared/koboPrice.js')

// 最小的假 DOM：只需要 nodeType / nodeValue / childNodes / tagName / className。
const text = (value) => ({ nodeType: 3, nodeValue: value })
const el = (tagName, className, children) => ({
  nodeType: 1, tagName, className, childNodes: children
})

// 情境一：原價用 Tailwind 的 line-through class
const tailwind = el('DIV', 'flex', [
  el('SPAN', 'line-through', [text('NT$294.00 TWD')]),
  el('SPAN', 'text-title', [text('NT$250.00 TWD')])
])
assert(parseKoboPrice(salePriceText(tailwind)) === 250, '刪除線 class 的原價應被略過')

// 情境二：原價用 <s> 標籤
const sTag = el('DIV', '', [
  el('S', '', [text('NT$294.00')]),
  el('SPAN', '', [text('NT$250.00')])
])
assert(parseKoboPrice(salePriceText(sTag)) === 250, '<s> 包住的原價應被略過')

// 情境三：class 看不出來，只有樣式表把它畫成刪除線 —— 這是「更多作品」輪播的情況，
// 也是先前只比對 class 名稱時抓成原價的原因。
const hashedClass = el('DIV', '', [
  el('SPAN', 'sc-a1b2c3', [text('NT$294.00')]),
  el('SPAN', 'sc-d4e5f6', [text('NT$250.00')])
])
const struckByStyle = (node) => node.className === 'sc-a1b2c3'
assert(
  parseKoboPrice(salePriceText(hashedClass, struckByStyle)) === 250,
  '以 computed style 判定的原價也應被略過'
)
// 沒有這層判斷就會抓到原價，確認測試真的有鑑別力
assert(
  parseKoboPrice(salePriceText(hashedClass, () => false)) === 294,
  '若判定不到刪除線就會抓成原價（此為對照）'
)

// 情境四：整個子樹都要跳過，不是只跳過帶樣式的那個節點
const nested = el('DIV', '', [
  el('SPAN', 'line-through', [el('SPAN', '', [text('NT$999.00')])]),
  el('SPAN', '', [text('NT$120.00')])
])
assert(parseKoboPrice(salePriceText(nested)) === 120, '刪除線元素的子孫也應一併略過')

// 沒有特價時原樣取出
const plain = el('DIV', '', [text('NT$322.00')])
assert(parseKoboPrice(salePriceText(plain)) === 322, '沒有特價時應取到原本的價格')

assert(salePriceText(null) === '', 'salePriceText(null) 應回傳空字串')

// --- salePriceElement：優先用 Kobo 標好的售價 testid ---
// 以下結構取自 Kobo 詳細頁「更多作品」輪播的實際 DOM。class 是 styled-components
// 的雜湊值，沒有任何 line-through 字樣 —— 這正是先前抓成原價 294 的原因。
const withTestid = (() => {
  const was = el('SPAN', 'sc-c62388ee-2 gKZVbJ', [
    el('SPAN', 'sc-d256b8ea-0 jWwxuC', [text('Old Price:')]),
    text('NT$294.00')
  ])
  const value = el('SPAN', 'sc-c62388ee-1 bSBneC', [
    el('SPAN', 'sc-d256b8ea-0 jWwxuC', [text('Sale Price:')]),
    text('\u00a0NT$250.00')
  ])
  const byTestid = {
    '[data-testid$="-pricing-price-value"]': value
  }
  return {
    nodeType: 1,
    tagName: 'DIV',
    className: 'sc-c70f08a8-5 fwjeYl h-auto',
    childNodes: [el('P', 'sc-c62388ee-0 jsZeHP', [was, value])],
    querySelector: (sel) => byTestid[sel] || null
  }
})()

assert(
  parseKoboPrice(salePriceText(salePriceElement(withTestid))) === 250,
  '有 testid 時應取到售價 250，而不是原價 294'
)
// 對照：不挑售價節點就會抓到原價 —— 確認這條測試有鑑別力
assert(
  parseKoboPrice(salePriceText(withTestid)) === 294,
  '若不挑售價節點會抓成原價（此為對照）'
)

// 沒有 testid 的元件（搜尋頁）應原樣回傳整塊，交給 salePriceText 處理
const noTestid = { nodeType: 1, tagName: 'DIV', childNodes: [], querySelector: () => null }
assert(salePriceElement(noTestid) === noTestid, '沒有售價 testid 時應回傳原本的價格區塊')
assert(salePriceElement(null) === null, 'salePriceElement(null) 不應拋錯')

console.log('sale price tests passed')
