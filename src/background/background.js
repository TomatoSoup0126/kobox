/**
 * Background Service Worker for KoBox Extension
 * 處理書籍組合計算邏輯
 */

class CombinationFinder {
  constructor() {
    this.maxResults = 5;
  }

  /**
   * 使用動態規劃找到最佳的書籍組合
   * @param {Array} books - 書籍陣列
   * @param {number} targetPrice - 目標價格
   * @returns {Array} 最佳組合陣列
   */
  findOptimalCombinations(books, targetPrice) {
    const n = books.length;
    if (n === 0 || targetPrice <= 0) return [];

    // 使用 Map 來儲存每個價格對應的最佳組合
    // key: 價格, value: { books: [], total: number }
    const dp = new Map();
    dp.set(0, { books: [], total: 0 });

    let processedItems = 0;
    const totalOperations = n * targetPrice;

    // 動態規劃：對每本書進行處理
    for (let i = 0; i < n; i++) {
      const book = books[i];
      const newEntries = new Map();

      // 遍歷當前所有可能的組合
      for (const [currentPrice, combination] of dp.entries()) {
        const newPrice = currentPrice + book.price;
        
        // 只考慮不超過目標價格太多的組合（允許一些彈性）
        if (newPrice <= targetPrice * 1.5) {
          // 如果這個價格還沒有組合，或者當前組合的書籍數量更少
          if (!dp.has(newPrice) || 
              (!newEntries.has(newPrice) && combination.books.length + 1 < dp.get(newPrice).books.length)) {
            newEntries.set(newPrice, {
              books: [...combination.books, book],
              total: newPrice
            });
          }
        }

        processedItems++;
        // 定期發送進度更新
        if (processedItems % 1000 === 0) {
          const progress = Math.min(95, (processedItems / totalOperations) * 100);
          // 發送進度更新到 popup
          chrome.runtime.sendMessage({
            type: 'calculation_progress',
            progress: Math.round(progress)
          }).catch(() => {
            // Popup 可能已關閉，忽略錯誤
          });
        }
      }

      // 將新的組合加入到 dp 中
      for (const [price, combination] of newEntries.entries()) {
        dp.set(price, combination);
      }

      // 限制 dp 的大小以避免記憶體問題
      if (dp.size > 50000) {
        const sortedEntries = Array.from(dp.entries())
          .sort((a, b) => {
            const diffA = Math.abs(a[0] - targetPrice);
            const diffB = Math.abs(b[0] - targetPrice);
            return diffA - diffB;
          });
        
        dp.clear();
        sortedEntries.slice(0, 25000).forEach(([price, combination]) => {
          dp.set(price, combination);
        });
      }
    }

    // 選擇最佳組合
    return this.selectBestCombinations(dp, targetPrice);
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
  if (request.action === 'findCombinations') {
    if (isCalculating) {
      sendResponse({ error: '計算正在進行中，請稍候' });
      return;
    }

    const { books, targetPrice } = request.data;
    
    if (!books || !targetPrice) {
      sendResponse({ error: '缺少必要的參數' });
      return;
    }

    isCalculating = true;
    
    // 異步執行計算
    setTimeout(async () => {
      try {
        const combinations = finder.findOptimalCombinations(books, targetPrice);
        
        // 發送完成消息
        chrome.runtime.sendMessage({
          type: 'calculation_complete',
          combinations: combinations,
          progress: 100
        }).catch(() => {
          // Popup 可能已關閉，忽略錯誤
        });
        
      } catch (error) {
        console.error('計算錯誤:', error);
        
        // 發送錯誤消息
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
    
    // 立即回應表示開始處理
    sendResponse({ success: true, message: '開始計算' });
    return true; // 保持消息通道開放
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('KoBox worker 已安裝');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('KoBox worker 已啟動');
});
