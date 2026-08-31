/**
 * Background Service Worker for KoBox Extension
 * 處理書籍組合計算邏輯
 */

import { mergeImportedBooks, validateBooks } from '../shared/sharePayload.js'
import { SHARE_PAGE_ORIGIN, MAX_IMPORT_BOOKS, MAX_SHARE_BOOKS, DEV_SHARE_PORTS } from '../shared/config.js'
import {
  IMPORT_SOURCES,
  accumulateNotice,
  noticeBadgeText
} from '../shared/importNotice.js'

// 本機分享頁只在 development build 信任，避免正式版被使用者本機其他服務寫入資料。
function isTrustedShareSender (sender) {
  const url = sender?.url || sender?.origin || ''
  try {
    const parsed = new URL(url)
    if (parsed.origin === SHARE_PAGE_ORIGIN) return true
    // 用 MODE 而非 DEV：vite build 預設把 NODE_ENV 設為 production，
    // DEV 是從 NODE_ENV 推導的，即使 --mode development 也會是 false。
    if (import.meta.env.MODE === 'development' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return DEV_SHARE_PORTS.includes(parsed.port)
    }
  } catch {
    return false
  }
  return false
}

// 商店頁的 content script 走另一套信任模型：來源必須是真的分頁、且在 kobo.com。
// 不併進 isTrustedShareSender，避免把分享頁的 origin 白名單放寬。
function isKoboPageSender (sender) {
  if (!sender?.tab) return false
  try {
    const parsed = new URL(sender.url || sender.tab.url || '')
    return parsed.protocol === 'https:' && parsed.hostname === 'www.kobo.com'
  } catch {
    return false
  }
}

// 匯入是 read-modify-write（get → await → set）。商店頁按鈕一次點擊送一則訊息，
// 快速連點或多個分頁同時加入會讓後寫入的覆蓋先寫入的，實際弄丟書籍。
// MV3 的訊息處理都在 service worker 單一事件迴圈上，promise 鏈就是真正的互斥鎖。
let writeQueue = Promise.resolve()

function enqueueWrite (task) {
  const run = writeQueue.then(task, task) // 前一個失敗不可卡住整條鏈
  writeQueue = run.catch(() => {})
  return run
}

async function readStoredBooks () {
  const result = await chrome.storage.local.get(['koboBooks'])
  if (Array.isArray(result.koboBooks)) return result.koboBooks
  if (result.koboBooks && typeof result.koboBooks === 'object') return Object.values(result.koboBooks)
  return []
}

async function applyBadge (notice) {
  // 書籍已寫入 storage，badge 只是視覺提示；失敗不該讓呼叫端以為匯入失敗而重試。
  try {
    await chrome.action.setBadgeText({ text: noticeBadgeText(notice) })
    await chrome.action.setBadgeBackgroundColor({ color: '#bf0000' })
  } catch (badgeError) {
    console.warn('設定 badge 失敗:', badgeError)
  }
}

/**
 * 回報這批 productId 裡哪些已經在清單中。
 *
 * 只回「請求的 id 與已存 id 的交集」—— 不回書名、價格、總數，也不回
 * 使用者沒問的 id。分享頁最多只能一次確認 MAX_SHARE_BOOKS 個它本來就
 * 持有的 id，這是這個功能所需的最小揭露。
 */
async function handleCheckOwnedBooks (rawIds) {
  if (!Array.isArray(rawIds) || rawIds.length > MAX_SHARE_BOOKS) {
    return { ok: false, error: 'invalid_request' }
  }

  const requested = new Set()
  for (const raw of rawIds) {
    const id = String(raw || '').trim()
    if (id && id.length <= 80) requested.add(id)
  }

  const stored = await readStoredBooks()
  const ownedIds = []
  for (const book of stored) {
    const id = String(book?.productId || book?.id || '')
    if (id && requested.has(id)) ownedIds.push(id)
  }

  return { ok: true, ownedIds }
}

async function handleImportSharedBooks (rawBooks, source) {
  // rawBooks 直接來自網頁的 postMessage，必須設上限，否則可被塞爆 storage 配額。
  const { ok, books, error } = validateBooks(rawBooks, { max: MAX_IMPORT_BOOKS })
  if (!ok) {
    return { ok: false, error }
  }

  const existing = await readStoredBooks()
  const stored = await chrome.storage.local.get(['koboImportNotice'])
  const merged = mergeImportedBooks(existing, books)
  // 提示的生命週期是「到下次開啟 popup 為止」，所以累加而非覆寫，
  // 否則連續加入多本書時只會看到最後一次的計數。
  const notice = accumulateNotice(stored.koboImportNotice, source, merged)

  await chrome.storage.local.set({
    koboBooks: JSON.parse(JSON.stringify(merged.books)),
    koboImportNotice: notice
  })

  await applyBadge(notice)

  return {
    ok: true,
    added: merged.added,
    updated: merged.updated,
    total: merged.books.length
  }
}

class CombinationFinder {
  constructor() {
    this.maxResults = 10;
  }

  /**
   * 使用動態規劃找到最佳的書籍組合
   * @param {Array} books - 候選書籍陣列（未釘選的）
   * @param {number} targetPrice - 目標價格
   * @param {Array} pinnedBooks - 釘選的書籍陣列（一定要出現在組合中）
   * @returns {Array} 最佳組合陣列
   */
  findOptimalCombinations(books, targetPrice, pinnedBooks = []) {
    // 計算釘選書籍的基礎價格
    const pinnedTotal = pinnedBooks.reduce((sum, book) => sum + book.price, 0);
    
    // 計算剩餘預算
    const remainingBudget = targetPrice - pinnedTotal;
    
    // 如果釘選書籍已經超過目標價格，直接返回只包含釘選書籍的組合
    if (remainingBudget <= 0 || books.length === 0) {
      if (pinnedBooks.length === 0) return [];
      return [{
        books: [...pinnedBooks],
        total: pinnedTotal
      }];
    }

    const n = books.length;

    // 使用 Map 來儲存每個價格對應的最佳組合
    // key: 價格, value: { books: [], total: number }
    const dp = new Map();
    dp.set(0, { books: [], total: 0 });

    let processedBooks = 0;
    let lastReportedProgress = 0;

    // 動態規劃：對每本書進行處理
    for (let i = 0; i < n; i++) {
      const book = books[i];
      const newEntries = new Map();

      // 遍歷當前所有可能的組合
      for (const [currentPrice, combination] of dp.entries()) {
        const newPrice = currentPrice + book.price;
        
        // 只考慮不超過剩餘預算太多的組合（允許一些彈性）
        if (newPrice <= remainingBudget * 1.5) {
          // 如果這個價格還沒有組合，或者當前組合的書籍數量更少
          if (!dp.has(newPrice) || 
              (!newEntries.has(newPrice) && combination.books.length + 1 < dp.get(newPrice).books.length)) {
            newEntries.set(newPrice, {
              books: [...combination.books, book],
              total: newPrice
            });
          }
        }
      }

      // 將新的組合加入到 dp 中
      for (const [price, combination] of newEntries.entries()) {
        dp.set(price, combination);
      }
      
      processedBooks++;
      
      const currentProgress = Math.min(95, (processedBooks / n) * 100);
      const roundedProgress = Math.round(currentProgress);
      
      if (roundedProgress > lastReportedProgress) {
        lastReportedProgress = roundedProgress;
        
        chrome.runtime.sendMessage({
          type: 'calculation_progress',
          progress: roundedProgress
        }).catch(() => {
        });
      }

      // 限制 dp 的大小以避免記憶體問題
      if (dp.size > 50000) {
        const sortedEntries = Array.from(dp.entries())
          .sort((a, b) => {
            const diffA = Math.abs(a[0] - remainingBudget);
            const diffB = Math.abs(b[0] - remainingBudget);
            return diffA - diffB;
          });
        
        dp.clear();
        sortedEntries.slice(0, 25000).forEach(([price, combination]) => {
          dp.set(price, combination);
        });
      }
    }

    // 選擇最佳組合，並將釘選書籍加入每個組合
    const bestCombinations = this.selectBestCombinations(dp, remainingBudget);
    
    // 將釘選書籍加入每個組合
    return bestCombinations.map(combination => ({
      books: [...pinnedBooks, ...combination.books],
      total: pinnedTotal + combination.total
    }));
  }

  /**
   * 從動態規劃結果中選擇最佳組合
   * @param {Map} dp - 動態規劃結果
   * @param {number} targetPrice - 目標價格
   * @returns {Array} 最佳組合陣列
   */
  selectBestCombinations(dp, targetPrice) {
    const validCombinations = [];

    // 收集所有達到或超過目標價格的組合
    for (const [price, combination] of dp.entries()) {
      if (price >= targetPrice) {
        validCombinations.push(combination);
      }
    }

    // 如果沒有達到目標價格的組合，選擇最接近的
    if (validCombinations.length === 0) {
      let closestPrice = 0;
      let closestCombination = null;

      for (const [price, combination] of dp.entries()) {
        if (price > closestPrice) {
          closestPrice = price;
          closestCombination = combination;
        }
      }

      if (closestCombination) {
        validCombinations.push(closestCombination);
      }
    }

    // 排序：優先選擇價格接近目標且書籍數量少的組合
    validCombinations.sort((a, b) => {
      const diffA = Math.abs(a.total - targetPrice);
      const diffB = Math.abs(b.total - targetPrice);
      
      // 如果都達到目標價格，選擇價格較低的
      if (a.total >= targetPrice && b.total >= targetPrice) {
        if (a.total !== b.total) return a.total - b.total;
        return a.books.length - b.books.length;
      }
      
      // 否則選擇更接近目標價格的
      if (diffA !== diffB) return diffA - diffB;
      return a.books.length - b.books.length;
    });

    // 返回前 maxResults 個結果
    return validCombinations.slice(0, this.maxResults);
  }
}

// 全域變數
let isCalculating = false;
const finder = new CombinationFinder();

// 監聽來自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 來源由已通過驗證的 action 推導，不可取自 request —— 訊息內容是網頁可控的，
  // 否則惡意頁面能把自己的寫入偽裝成來自 Kobo 商店頁。
  if (request.action === 'importSharedBooks') {
    if (!isTrustedShareSender(sender)) {
      sendResponse({ ok: false, error: 'untrusted_sender' })
      return
    }

    enqueueWrite(() => handleImportSharedBooks(request.books, IMPORT_SOURCES.SHARE))
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: error.message })
      })
    return true
  }

  if (request.action === 'addBooksFromPage') {
    if (!isKoboPageSender(sender)) {
      sendResponse({ ok: false, error: 'untrusted_sender' })
      return
    }

    enqueueWrite(() => handleImportSharedBooks(request.books, IMPORT_SOURCES.PAGE))
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: error.message })
      })
    return true
  }

  // 唯讀操作，不必進寫入佇列。沿用分享頁的 origin 白名單，不放寬 isKoboPageSender。
  if (request.action === 'checkOwnedBooks') {
    if (!isTrustedShareSender(sender)) {
      sendResponse({ ok: false, error: 'untrusted_sender' })
      return
    }

    handleCheckOwnedBooks(request.productIds)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: error.message })
      })
    return true
  }

  // popup 讀取提示後由 background 統一清除，才不會被 in-flight 的匯入寫入蓋回去。
  if (request.action === 'clearImportNotice') {
    if (sender.tab || sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false, error: 'untrusted_sender' })
      return
    }

    enqueueWrite(async () => {
      await chrome.storage.local.remove(['koboImportNotice'])
      await applyBadge(null)
      return { ok: true }
    })
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: error.message })
      })
    return true
  }

  if (request.action === 'findCombinations') {
    if (isCalculating) {
      sendResponse({ error: 'calc_busy' });
      return;
    }

    const { books, pinnedBooks = [], targetPrice } = request.data;
    
    if (!targetPrice) {
      sendResponse({ error: 'calc_missing_price' });
      return;
    }

    // 如果沒有候選書籍也沒有釘選書籍，返回錯誤
    if ((!books || books.length === 0) && pinnedBooks.length === 0) {
      sendResponse({ error: 'calc_missing_books' });
      return;
    }

    isCalculating = true;
    setTimeout(async () => {
      try {
        const combinations = finder.findOptimalCombinations(books || [], targetPrice, pinnedBooks);
        
        // 發送完成消息
        chrome.runtime.sendMessage({
          type: 'calculation_complete',
          combinations: combinations,
          progress: 100
        }).catch(() => {
        });
        
      } catch (error) {
        console.error('計算錯誤:', error);
        
        chrome.runtime.sendMessage({
          type: 'calculation_error',
          error: error.message
        }).catch(() => {
          // Popup 可能已關閉，忽略錯誤
        });
      } finally {
        isCalculating = false;
      }
    }, 10);
    
    sendResponse({ success: true, message: '開始計算' });
    return true;
  }
});

// badge 不跨瀏覽器重啟，koboImportNotice 會 —— 重啟後補回來，兩者才不會不同調。
async function restoreBadge () {
  try {
    const { koboImportNotice } = await chrome.storage.local.get(['koboImportNotice'])
    if (koboImportNotice) await applyBadge(koboImportNotice)
  } catch (error) {
    console.warn('還原 badge 失敗:', error)
  }
}

chrome.runtime.onInstalled.addListener(restoreBadge);
chrome.runtime.onStartup.addListener(restoreBadge);
