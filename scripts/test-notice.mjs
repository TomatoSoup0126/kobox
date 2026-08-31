/**
 * importNotice 的測試。純函式，不需要 chrome API mock。
 */
import {
  IMPORT_SOURCES,
  accumulateNotice,
  noticeBadgeText,
  noticeSourceKey,
  noticeTotals
} from '../src/shared/importNotice.js'

function assert (condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

// --- 累計：連續加入不可只留下最後一次 ---
let notice = accumulateNotice(null, IMPORT_SOURCES.PAGE, { added: 1, updated: 0 })
notice = accumulateNotice(notice, IMPORT_SOURCES.PAGE, { added: 1, updated: 0 })
notice = accumulateNotice(notice, IMPORT_SOURCES.PAGE, { added: 1, updated: 0 })
assert(noticeTotals(notice).added === 3, `連續三次加入應累計為 3，得到 ${noticeTotals(notice).added}`)
assert(noticeBadgeText(notice) === '3', `badge 應為 3，得到 ${noticeBadgeText(notice)}`)
assert(noticeSourceKey(notice) === 'page', '單一來源應回報該來源')

// --- 混合來源 ---
const mixed = accumulateNotice(notice, IMPORT_SOURCES.SHARE, { added: 5, updated: 2 })
assert(noticeSourceKey(mixed) === 'mixed', '兩種來源應回報 mixed')
assert(noticeTotals(mixed).added === 8 && noticeTotals(mixed).updated === 2, '混合來源計數應正確累加')

// --- 全部是更新時，badge 不可被清空 ---
const allUpdates = accumulateNotice(null, IMPORT_SOURCES.SHARE, { added: 0, updated: 4 })
assert(noticeBadgeText(allUpdates) === '4', `全更新的 badge 應為 4，得到 "${noticeBadgeText(allUpdates)}"`)
const afterUpdateOnly = accumulateNotice(
  accumulateNotice(null, IMPORT_SOURCES.PAGE, { added: 2, updated: 0 }),
  IMPORT_SOURCES.PAGE,
  { added: 0, updated: 1 }
)
assert(afterUpdateOnly.added === 2, '全更新的匯入不可把先前的新增數歸零')
assert(noticeBadgeText(afterUpdateOnly) === '3', 'badge 應累計新增與更新')

// --- 上限 ---
const huge = accumulateNotice(null, IMPORT_SOURCES.SHARE, { added: 120, updated: 30 })
assert(noticeBadgeText(huge) === '99+', `超過 99 應顯示 99+，得到 ${noticeBadgeText(huge)}`)

// --- 空提示 ---
assert(noticeBadgeText(null) === '', '沒有提示時 badge 應為空字串')
assert(noticeBadgeText({ v: 2, added: 0, updated: 0, sources: {} }) === '', '零異動的 badge 應為空字串')

// --- 舊格式遷移：計數保留，來源歸為 mixed ---
const legacy = { added: 7, updated: 3, at: 1700000000000 }
assert(noticeTotals(legacy).added === 7, '舊格式的計數應被保留')
assert(noticeSourceKey(legacy) === 'mixed', '舊格式沒有來源，應回報 mixed')
const upgraded = accumulateNotice(legacy, IMPORT_SOURCES.PAGE, { added: 1, updated: 0 })
assert(upgraded.v === 2 && upgraded.added === 8, '舊格式應能被累加並升版')

// --- 不認識的來源不可長出任意 key ---
const bogus = accumulateNotice(null, 'evil-source', { added: 1, updated: 0 })
assert(Object.keys(bogus.sources).length === 0, '未知來源不可寫進 sources')
assert(bogus.added === 1, '未知來源的計數仍應計入總數')
assert(noticeSourceKey(bogus) === 'mixed', '未知來源應回報 mixed')

// --- 髒資料不可讓計數變成 NaN ---
const dirty = accumulateNotice({ added: 'x', updated: null, v: 2, sources: 'nope' }, IMPORT_SOURCES.PAGE, { added: 2 })
assert(dirty.added === 2 && dirty.updated === 0, '非數值的既有計數應視為 0')

console.log('import notice tests passed')
