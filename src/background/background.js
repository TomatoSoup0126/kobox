/**
 * Background Service Worker for KoBox Extension
 * 處理書籍組合計算邏輯
 */

import { mergeImportedBooks, validateBooks } from '../shared/sharePayload.js'
import { SHARE_PAGE_ORIGIN } from '../shared/config.js'

function isTrustedShareSender (sender) {
  const url = sender?.url || sender?.origin || ''
  try {
    const parsed = new URL(url)
    if (parsed.origin === SHARE_PAGE_ORIGIN) return true
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return ['5174', '4173', '8888'].includes(parsed.port)
    }
  } catch {
    return false
  }
  return false
}

async function handleImportSharedBooks (rawBooks) {
  const { ok, books, error } = validateBooks(rawBooks)
  if (!ok) {
    return { ok: false, error }
  }

  const result = await chrome.storage.local.get(['koboBooks'])
  let existing = []
  if (Array.isArray(result.koboBooks)) {
    existing = result.koboBooks
  } else if (result.koboBooks && typeof result.koboBooks === 'object') {
    existing = Object.values(result.koboBooks)
  }

  const merged = mergeImportedBooks(existing, books)
  await chrome.storage.local.set({
    koboBooks: JSON.parse(JSON.stringify(merged.books)),
    koboImportNotice: {
      added: merged.added,
      updated: merged.updated,
      at: Date.now()
    }
  })

  const badge = merged.added > 0 ? String(Math.min(merged.added, 99)) : ''
  await chrome.action.setBadgeText({ text: badge })
  await chrome.action.setBadgeBackgroundColor({ color: '#bf0000' })

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
  if (request.action === 'importSharedBooks') {
    if (!isTrustedShareSender(sender)) {
      sendResponse({ ok: false, error: 'untrusted_sender' })
      return
    }

    handleImportSharedBooks(request.books)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: error.message })
      })
    return true
  }

  if (request.action === 'findCombinations') {
    if (isCalculating) {
      sendResponse({ error: '計算正在進行中，請稍候' });
      return;
    }

    const { books, pinnedBooks = [], targetPrice } = request.data;
    
    if (!targetPrice) {
      sendResponse({ error: '缺少必要的參數' });
      return;
    }

    // 如果沒有候選書籍也沒有釘選書籍，返回錯誤
    if ((!books || books.length === 0) && pinnedBooks.length === 0) {
      sendResponse({ error: '缺少書籍資料' });
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

chrome.runtime.onInstalled.addListener(() => {
  console.log('KoBox worker 已安裝');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('KoBox worker 已啟動');
});
