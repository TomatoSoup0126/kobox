// KOBO Slash Content Script
// 負責從 KOBO 願望清單頁面擷取書籍資料

class KoboWishlistExtractor {
  constructor() {
    this.books = []
    this.setupMessageListener()
  }

  // 設定訊息監聽器
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'extractBooks') {
        this.extractBooksFromPage()
          .then(books => {
            sendResponse({ books: books })
          })
          .catch(error => {
            console.error('擷取書籍失敗:', error)
            sendResponse({ books: [], error: error.message })
          })
        return true // 保持訊息通道開放以進行非同步回應
      }
    })
  }

  // 從頁面擷取書籍資料
  async extractBooksFromPage() {
    try {
      // 等待頁面載入完成
      await this.waitForPageLoad()
      
      // 嘗試多種選擇器來適應不同的 KOBO 頁面佈局
      const bookSelectors = [
        // 主要的書籍項目選擇器
        '.item-detail, .wishlist-item, .product-item',
        // 備用選擇器
        '[data-testid="wishlist-item"], .book-item, .product-card'
      ]

      let bookElements = []
      
      for (const selector of bookSelectors) {
        bookElements = document.querySelectorAll(selector)
        if (bookElements.length > 0) {
          console.log(`使用選擇器找到 ${bookElements.length} 個書籍元素:`, selector)
          break
        }
      }

      if (bookElements.length === 0) {
        // 如果沒有找到書籍，嘗試通用方法
        bookElements = this.findBooksWithGenericMethod()
      }

      const books = []
      
      for (let i = 0; i < bookElements.length; i++) {
        const element = bookElements[i]
        const book = this.extractBookInfo(element)
        
        if (book && book.title && book.price !== null) {
          books.push(book)
        }
      }

      console.log(`成功擷取 ${books.length} 本書籍:`, books)
      return books
      
    } catch (error) {
      console.error('擷取書籍過程中發生錯誤:', error)
      throw error
    }
  }

  // 等待頁面載入完成
  waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        // 額外等待一點時間確保動態內容載入
        setTimeout(resolve, 1000)
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 1000)
        })
      }
    })
  }

  // 通用方法尋找書籍
  findBooksWithGenericMethod() {
    // 尋找包含價格和標題的元素
    const priceElements = document.querySelectorAll('[class*="price"], [data-testid*="price"], .currency')
    const possibleBookElements = []

    priceElements.forEach(priceEl => {
      // 向上尋找可能的書籍容器
      let container = priceEl.closest('[class*="item"], [class*="product"], [class*="book"], [class*="card"]')
      if (!container) {
        container = priceEl.parentElement
        // 向上搜尋最多3層
        for (let i = 0; i < 3 && container; i++) {
          if (container.querySelector('[class*="title"], h1, h2, h3, h4, a[href*="book"]')) {
            break
          }
          container = container.parentElement
        }
      }
      
      if (container && !possibleBookElements.includes(container)) {
        possibleBookElements.push(container)
      }
    })

    console.log('通用方法找到的可能書籍元素:', possibleBookElements.length)
    return possibleBookElements
  }

  // 從單個元素擷取書籍資訊
  extractBookInfo(element) {
    try {
      const book = {
        title: null,
        price: null,
        originalPrice: null,
        currency: 'TWD'
      }

      // 擷取標題
      book.title = this.extractTitle(element)
      
      // 擷取價格
      const priceInfo = this.extractPrice(element)
      book.price = priceInfo.price
      book.originalPrice = priceInfo.originalPrice
      book.currency = priceInfo.currency

      return book
      
    } catch (error) {
      console.error('擷取書籍資訊失敗:', error)
      return null
    }
  }

  // 擷取書籍標題
  extractTitle(element) {
    const titleSelectors = [
      // 常見的標題選擇器
      '.title, .book-title, .product-title, .item-title',
      'h1, h2, h3, h4',
      '[data-testid*="title"]',
      'a[href*="book"]',
      '.product-name, .book-name'
    ]

    for (const selector of titleSelectors) {
      const titleEl = element.querySelector(selector)
      if (titleEl) {
        let title = titleEl.textContent || titleEl.innerText
        if (title) {
          // 清理標題文字
          title = title.trim().replace(/\s+/g, ' ')
          if (title.length > 5) { // 確保不是太短的文字
            return title
          }
        }
      }
    }

    // 備用方法：尋找最長的文字節點
    const textNodes = this.getTextNodes(element)
    let longestText = ''
    
    textNodes.forEach(node => {
      const text = node.textContent.trim()
      if (text.length > longestText.length && text.length > 10 && !text.includes('NT$') && !text.includes('$')) {
        longestText = text
      }
    })

    return longestText || null
  }

  // 擷取價格
  extractPrice(element) {
    const result = {
      price: null,
      originalPrice: null,
      currency: 'TWD'
    }

    // 價格選擇器
    const priceSelectors = [
      '.price, .current-price, .sale-price',
      '[class*="price"]',
      '[data-testid*="price"]',
      '.currency, .amount'
    ]

    const priceElements = []
    
    // 收集所有可能的價格元素
    priceSelectors.forEach(selector => {
      const elements = element.querySelectorAll(selector)
      elements.forEach(el => {
        if (!priceElements.includes(el)) {
          priceElements.push(el)
        }
      })
    })

    // 如果沒找到，使用正則表達式搜尋
    if (priceElements.length === 0) {
      const allText = element.textContent || element.innerText
      const priceMatches = allText.match(/NT\$\s*[\d,]+|\$\s*[\d,]+|[\d,]+\s*元/g)
      
      if (priceMatches) {
        priceMatches.forEach(match => {
          const price = this.parsePrice(match)
          if (price !== null) {
            if (result.price === null || price < result.price) {
              result.originalPrice = result.price
              result.price = price
            }
          }
        })
      }
    } else {
      // 處理找到的價格元素
      priceElements.forEach(priceEl => {
        const priceText = priceEl.textContent || priceEl.innerText
        const price = this.parsePrice(priceText)
        
        if (price !== null) {
          // 判斷是否為折扣價（通常較小的價格是折扣價）
          if (result.price === null || price < result.price) {
            result.originalPrice = result.price
            result.price = price
          } else if (result.originalPrice === null || price > result.originalPrice) {
            result.originalPrice = price
          }
        }
      })
    }

    return result
  }

  // 解析價格文字
  parsePrice(priceText) {
    if (!priceText) return null
    
    // 移除非數字字符，保留數字和逗號
    const cleanText = priceText.replace(/[^\d,]/g, '')
    
    if (!cleanText) return null
    
    // 移除逗號並轉換為數字
    const price = parseInt(cleanText.replace(/,/g, ''), 10)
    
    return isNaN(price) ? null : price
  }

  // 獲取元素中的所有文字節點
  getTextNodes(element) {
    const textNodes = []
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        }
      }
    )

    let node
    while (node = walker.nextNode()) {
      textNodes.push(node)
    }

    return textNodes
  }
}

// 初始化擷取器
console.log('KOBO Slash Content Script 已載入')
const extractor = new KoboWishlistExtractor()

// 頁面載入完成後進行一次自動檢測
window.addEventListener('load', () => {
  console.log('頁面載入完成，KOBO Slash 準備就緒')
})
