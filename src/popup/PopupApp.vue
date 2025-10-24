<template>
  <div class="popup-container">
    <Header />

    <main class="main-content">
      <!-- 第一區：說明、匯入、價格設定 -->
      <ControlPanel
        :is-on-wishlist="isOnWishlist"
        :books="books"
        :target-price="targetPrice"
        :is-loading="isLoading"
        :is-calculating="isCalculating"
        @import-books="importBooks"
        @find-combinations="findCombinations"
        @update-target-price="updateTargetPrice"

      />

      <!-- 第二區：書籍清單 -->
      <BooksList
        :books="books"
        @delete-book="deleteBook"
        @update-book-selection="updateBookSelection"
        @clear-all-data="clearAllData"
      />

      <!-- 第三區：組合結果 -->
      <CombinationResults
        :combinations="combinations"
        :has-searched="hasSearched"
        :is-calculating="isCalculating"
        :calculation-progress="calculationProgress"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Header from '../components/Header.vue'
import ControlPanel from '../components/ControlPanel.vue'
import BooksList from '../components/BooksList.vue'
import CombinationResults from '../components/CombinationResults.vue'

interface Book {
  id: string
  productId: string
  title: string
  price: number
  selected: boolean
}

interface BookCombination {
  books: Book[]
  total: number
}

interface ExtractBooksResponse {
  books: Array<{
    title: string
    price: number
    productId: string
  }>
}

interface ChromeMessage {
  action: string
}

const { t } = useI18n()

const isOnWishlist: Ref<boolean> = ref(false)
const books: Ref<Book[]> = ref([])
const targetPrice: Ref<number | null> = ref(null)
const combinations: Ref<BookCombination[]> = ref([])
const isLoading: Ref<boolean> = ref(false)
const isCalculating: Ref<boolean> = ref(false)
const hasSearched: Ref<boolean> = ref(false)
const calculationProgress: Ref<number> = ref(0)

const checkCurrentPage = async (): Promise<void> => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    isOnWishlist.value = tab.url ? 
      tab.url.includes('kobo.com') && tab.url.includes('wishlist') : 
      false
  } catch (error) {
  }
}

const importBooks = async (): Promise<void> => {
  if (!isOnWishlist.value) return
  
  isLoading.value = true
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!tab.id) {
      throw new Error('無法取得目前分頁 ID')
    }
    
    const response = await chrome.tabs.sendMessage(
      tab.id, 
      { action: 'extractBooks' } as ChromeMessage
    ) as ExtractBooksResponse
    
    if (response && response.books) {
      response.books.forEach((book) => {
        if (!book.productId) {
          return
        }

        const existingIndex = books.value.findIndex(b => b.productId === book.productId)
        
        const bookData = {
          productId: book.productId,
          title: book.title,
          price: book.price,
          selected: true
        }

        if (existingIndex !== -1) {
          books.value[existingIndex] = {
            ...books.value[existingIndex],
            ...bookData
          }
        } else {
          books.value.push({
            id: book.productId,
            ...bookData
          })
        }
      })
      
      
      
      await saveBooksToStorage()
    } else {
    }
      } catch (error) {
    alert(t('messages.importFailed'))
  } finally {
    isLoading.value = false
  }
}

const deleteBook = async (bookId: number): Promise<void> => {
  books.value = books.value.filter(book => book.id !== bookId)
  
  await clearStaleResults()
  
  await saveBooksToStorage()
  
  if (hasSearched.value && targetPrice.value) {
    findCombinations()
  }
}

const updateTargetPrice = async (value: number | null): Promise<void> => {
  const oldTargetPrice = targetPrice.value
  targetPrice.value = value
  
  if (oldTargetPrice !== value && hasSearched.value) {
    combinations.value = []
    hasSearched.value = false
    await chrome.storage.local.remove(['koboCombinations', 'koboHasSearched', 'koboLastCalculated'])
  }
  
  await saveBooksToStorage()
}

const updateBookSelection = async (updatedBook: Book): Promise<void> => {
  const book = books.value.find(b => b.id === updatedBook.id)
  if (book) {
    book.selected = updatedBook.selected
    
    await clearStaleResults()
    
    await saveBooksToStorage()
  }
  if (hasSearched.value && targetPrice.value) {
    findCombinations()
  }
}

const findCombinations = (): void => {
  if (!targetPrice.value) return
  
  isCalculating.value = true
  hasSearched.value = true
  combinations.value = []
  calculationProgress.value = 0

  const selectedBooks: Book[] = books.value.filter(book => book.selected)
  const target: number = targetPrice.value

  // 內嵌 Worker 程式碼以避免 Chrome 擴充功能的檔案載入問題
  const workerCode = `
/**
 * Web Worker for finding book combinations using dynamic programming
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
          self.postMessage({
            type: 'progress',
            progress: Math.round(progress)
          });
        }
      }

      // 將新的組合加入到 dp 中
      for (const [price, combination] of newEntries.entries()) {
        dp.set(price, combination);
      }

      // 限制 dp 的大小以避免記憶體問題
      if (dp.size > 10000) {
        this.pruneDPTable(dp, targetPrice);
      }
    }

    // 找出最符合條件的組合
    return this.selectBestCombinations(dp, targetPrice);
  }

  /**
   * 修剪動態規劃表格以節省記憶體
   * @param {Map} dp - 動態規劃表格
   * @param {number} targetPrice - 目標價格
   */
  pruneDPTable(dp, targetPrice) {
    const entries = Array.from(dp.entries());
    
    // 按照與目標價格的接近程度排序
    entries.sort((a, b) => {
      const diffA = Math.abs(a[0] - targetPrice);
      const diffB = Math.abs(b[0] - targetPrice);
      if (diffA !== diffB) return diffA - diffB;
      return a[1].books.length - b[1].books.length; // 書籍數量少的優先
    });

    // 只保留前 5000 個最好的組合
    dp.clear();
    for (let i = 0; i < Math.min(5000, entries.length); i++) {
      dp.set(entries[i][0], entries[i][1]);
    }
  }

  /**
   * 從動態規劃結果中選擇最佳組合
   * @param {Map} dp - 動態規劃表格
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

// Worker 訊息處理
self.onmessage = function(e) {
  const { books, targetPrice } = e.data;
  
  try {
    const finder = new CombinationFinder();
    const combinations = finder.findOptimalCombinations(books, targetPrice);
    
    // 發送完成訊息
    self.postMessage({
      type: 'complete',
      combinations: combinations,
      progress: 100
    });
  } catch (error) {
    // 發送錯誤訊息
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
};
  `

  // 使用 Blob URL 創建 Worker
  const blob = new Blob([workerCode], { type: 'application/javascript' })
  const worker = new Worker(URL.createObjectURL(blob))
  
  worker.onmessage = async (e) => {
    const { type, combinations: workerCombinations, progress, error } = e.data
    
    switch (type) {
      case 'progress':
        calculationProgress.value = progress
        break
        
      case 'complete':
        combinations.value = workerCombinations || []
        calculationProgress.value = 100
        
        try {
          await saveBooksToStorage()
        } catch (saveError) {
          console.error('儲存結果時發生錯誤:', saveError)
        }
        
        // 延遲重置狀態
        setTimeout(() => {
          isCalculating.value = false
          calculationProgress.value = 0
        }, 1000)
        
        worker.terminate()
        URL.revokeObjectURL(blob)
        break
        
      case 'error':
        console.error('Worker 計算錯誤:', error)
        isCalculating.value = false
        calculationProgress.value = 0
        worker.terminate()
        URL.revokeObjectURL(blob)
        break
    }
  }
  
  worker.onerror = (error) => {
    console.error('Worker 錯誤:', error)
    isCalculating.value = false
    calculationProgress.value = 0
    worker.terminate()
    URL.revokeObjectURL(blob)
  }
  
  // 發送資料給 Worker
  setTimeout(() => {
    // 將響應式物件轉換為純 JavaScript 物件以避免 DataCloneError
    const plainBooks = selectedBooks.map(book => ({
      id: book.id,
      productId: book.productId,
      title: book.title,
      price: book.price,
      selected: book.selected
    }))
    
    worker.postMessage({
      books: plainBooks,
      targetPrice: target
    })
  }, 100)
}

const validateCombinationResults = (savedCombinations: BookCombination[]): boolean => {
  try {
    
    if (!savedCombinations || savedCombinations.length === 0) {
      return false
    }
    
    if (!books.value || books.value.length === 0) {
      return false
    }
    
    for (let i = 0; i < savedCombinations.length; i++) {
      const combination = savedCombinations[i]
      
      if (!combination) {
        return false
      }
      
      if (!combination.books) {
        return false
      }
      
      if (!Array.isArray(combination.books)) {
        return false
      }
      
      if (combination.books.length === 0) {
        return false
      }
      
      for (const savedBook of combination.books) {
        const currentBook = books.value.find(book => 
          book.id === savedBook.id && 
          book.title === savedBook.title && 
          book.price === savedBook.price
        )
        
        if (!currentBook) {
          return false
        }
      }
    }
    
    return true
  } catch (error) {
    return false
  }
}

const clearStaleResults = async (): Promise<void> => {
  if (hasSearched.value && combinations.value.length > 0) {
    const isValid = validateCombinationResults(combinations.value)
    if (!isValid) {
      combinations.value = []
      hasSearched.value = false
      await chrome.storage.local.remove(['koboCombinations', 'koboHasSearched', 'koboLastCalculated'])
    }
  }
}

const loadBooksFromStorage = async (): Promise<void> => {
  try {
    
    const result = await chrome.storage.local.get([
      'koboBooks', 
      'koboTargetPrice', 
      'koboCombinations', 
      'koboHasSearched',
      'koboLastCalculated'
    ])
    
    if (result.koboBooks) {
      let loadedBooks = []
      
      if (Array.isArray(result.koboBooks)) {
        loadedBooks = result.koboBooks
      } 
      else if (typeof result.koboBooks === 'object') {
        loadedBooks = Object.values(result.koboBooks).filter(book => 
          book && typeof book === 'object' && book.title && typeof book.price === 'number'
        )
      }
      
      if (loadedBooks.length > 0) {
        books.value = loadedBooks
      }
    } else {
    }
    
    if (result.koboTargetPrice && typeof result.koboTargetPrice === 'number') {
      targetPrice.value = result.koboTargetPrice
    } else {
    }
    
    if (result.koboCombinations && books.value.length > 0) {
      
      let fixedCombinations: BookCombination[] = []
      
      if (Array.isArray(result.koboCombinations)) {
        fixedCombinations = result.koboCombinations
      } else if (typeof result.koboCombinations === 'object') {
        fixedCombinations = Object.values(result.koboCombinations)
      }
      
      
      fixedCombinations = fixedCombinations.map((combo, index) => {
        
        let fixedBooks: Book[] = []
        
        if (Array.isArray(combo.books)) {
          fixedBooks = combo.books
        } else if (typeof combo.books === 'object' && combo.books !== null) {
          fixedBooks = Object.values(combo.books)
        }
        
        return {
          books: fixedBooks,
          total: combo.total
        }
      })
      
      
      const isResultValid = validateCombinationResults(fixedCombinations)
      
      if (isResultValid) {
        combinations.value = fixedCombinations
        
        if (result.koboHasSearched) {
          hasSearched.value = true
          

        }
      } else {
        combinations.value = []
        hasSearched.value = false
        await chrome.storage.local.remove(['koboCombinations', 'koboHasSearched', 'koboLastCalculated'])
      }
    } else if (result.koboCombinations && books.value.length === 0) {
    } else {
    }
    
  } catch (error) {
  }
}

const saveBooksToStorage = async (): Promise<void> => {
  try {
    
    const booksArray = JSON.parse(JSON.stringify(books.value))
    const combinationsArray = JSON.parse(JSON.stringify(combinations.value))
    
    
    await chrome.storage.local.set({
      koboBooks: booksArray,
      koboTargetPrice: targetPrice.value,
      koboCombinations: combinationsArray,
      koboHasSearched: hasSearched.value,
      koboLastCalculated: Date.now()
    })
    
    
    const verification = await chrome.storage.local.get([
      'koboBooks', 
      'koboTargetPrice', 
      'koboCombinations', 
      'koboHasSearched',
      'koboLastCalculated'
    ])
    
  } catch (error) {
  }
}

const clearAllData = async (): Promise<void> => {
  try {
    await chrome.storage.local.remove([
      'koboBooks', 
      'koboTargetPrice', 
      'koboCombinations', 
      'koboHasSearched',
      'koboLastCalculated'
    ])
    books.value = []
    targetPrice.value = null
    combinations.value = []
    hasSearched.value = false
  } catch (error) {
  }
}

const testChromeStorage = async (): Promise<void> => {
  try {
    
    await chrome.storage.local.set({ testKey: 'testValue' })
    
    const testResult = await chrome.storage.local.get(['testKey'])
    
    await chrome.storage.local.remove(['testKey'])
    
  } catch (error) {
    alert(t('messages.storageError'))
  }
}

onMounted((): void => {
  testChromeStorage()
  checkCurrentPage()
  loadBooksFromStorage()
})
</script>

<style scoped>
.popup-container {
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #212529;
  min-height: 100vh;
  width: 800px;
  box-sizing: border-box;
}



.main-content {
  display: flex;
  gap: 20px;
  height: calc(100vh - 120px);
}


</style>
