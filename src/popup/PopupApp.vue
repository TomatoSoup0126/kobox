<template>
  <div class="popup-container">
    <Header />

    <main class="main-content">
      <!-- 左側：控制面板 -->
      <ControlPanel
        :is-on-wishlist="isOnWishlist"
        :books="books"
        :target-price="targetPrice"
        :is-loading="isLoading"
        :is-calculating="isCalculating"
        @import-books="importBooks"
        @find-combinations="handleFindCombinations"
        @update-target-price="updateTargetPrice"
      />

      <!-- 右側：頁籤區域 -->
      <div class="tab-container">
        <!-- 頁籤標題 -->
        <div class="tab-header">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'books' }"
            @click="switchTab('books')"
          >
            📚 {{ $t('tabs.books') }}
            <span v-if="books.length > 0" class="tab-badge">{{ selectedCount }}/{{ books.length }}</span>
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'results' }"
            @click="switchTab('results')"
          >
            🎯 {{ $t('tabs.results') }}
            <span v-if="combinations.length > 0" class="tab-badge tab-badge-success">{{ combinations.length }}</span>
          </button>
        </div>

        <!-- 頁籤內容 -->
        <div class="tab-content">
          <BooksList
            v-show="activeTab === 'books'"
            :books="books"
            @delete-book="deleteBook"
            @update-book-selection="updateBookSelection"
            @update-book-pinned="updateBookPinned"
            @clear-all-data="clearAllData"
            @unpin-all="unpinAllBooks"
            @unselect-all="unselectAllBooks"
            @select-all="selectAllBooks"
          />

          <CombinationResults
            v-show="activeTab === 'results'"
            :combinations="combinations"
            :has-searched="hasSearched"
            :is-calculating="isCalculating"
            :calculation-progress="calculationProgress"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
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
  pinned: boolean
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
const activeTab: Ref<'books' | 'results'> = ref('books')

const selectedCount = computed(() => {
  return books.value.filter(book => book.selected).length
})

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
          selected: true,
          pinned: false
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

const updateBookPinned = async (updatedBook: Book): Promise<void> => {
  const book = books.value.find(b => b.id === updatedBook.id)
  if (book) {
    book.pinned = updatedBook.pinned
    
    await clearStaleResults()
    
    await saveBooksToStorage()
  }
  if (hasSearched.value && targetPrice.value) {
    findCombinations()
  }
}

const switchTab = async (tab: 'books' | 'results'): Promise<void> => {
  activeTab.value = tab
  await chrome.storage.local.set({ koboActiveTab: tab })
}

const handleFindCombinations = (): void => {
  // 先設定計算中狀態，避免切換分頁時閃爍
  isCalculating.value = true
  // 點擊找出組合後自動切換到組合結果頁籤
  switchTab('results')
  findCombinations()
}

const findCombinations = async (): Promise<void> => {
  if (!targetPrice.value) return
  
  isCalculating.value = true
  hasSearched.value = true
  combinations.value = []
  calculationProgress.value = 0
  
  // 重新計算時清除滾動位置
  await chrome.storage.local.remove(['koboResultsScrollTop'])

  // 釘選的書籍一定要出現在組合中，不論是否被選取
  const pinnedBooks: Book[] = books.value.filter(book => book.pinned)
  // 選取但未釘選的書籍，作為候選書籍
  const selectedBooks: Book[] = books.value.filter(book => book.selected && !book.pinned)
  const target: number = targetPrice.value

  // 將響應式物件轉換為純 JavaScript 物件以避免 DataCloneError
  const plainPinnedBooks = pinnedBooks.map(book => ({
    id: book.id,
    productId: book.productId,
    title: book.title,
    price: book.price,
    selected: book.selected,
    pinned: book.pinned
  }))

  const plainSelectedBooks = selectedBooks.map(book => ({
    id: book.id,
    productId: book.productId,
    title: book.title,
    price: book.price,
    selected: book.selected,
    pinned: book.pinned
  }))

  chrome.runtime.sendMessage({
    action: 'findCombinations',
    data: {
      books: plainSelectedBooks,
      pinnedBooks: plainPinnedBooks,
      targetPrice: target
    }
  }).then(response => {
    if (response.error) {
      console.error('計算請求錯誤:', response.error)
      isCalculating.value = false
      calculationProgress.value = 0
    }
  }).catch(error => {
    console.error('發送計算請求失敗:', error)
    isCalculating.value = false
    calculationProgress.value = 0
  })
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
      'koboLastCalculated',
      'koboActiveTab'
    ])
    
    // 載入上次使用的分頁
    if (result.koboActiveTab && (result.koboActiveTab === 'books' || result.koboActiveTab === 'results')) {
      activeTab.value = result.koboActiveTab
    }
    
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
        // 確保舊資料也有 pinned 欄位
        books.value = loadedBooks.map((book: any) => ({
          ...book,
          pinned: book.pinned ?? false
        }))
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
      'koboLastCalculated',
      'koboActiveTab',
      'koboResultsScrollTop'
    ])
    books.value = []
    targetPrice.value = null
    combinations.value = []
    hasSearched.value = false
    activeTab.value = 'books'
  } catch (error) {
  }
}

const unpinAllBooks = async (): Promise<void> => {
  books.value.forEach(book => {
    book.pinned = false
  })
  await clearStaleResults()
  await saveBooksToStorage()
  if (hasSearched.value && targetPrice.value) {
    findCombinations()
  }
}

const unselectAllBooks = async (): Promise<void> => {
  books.value.forEach(book => {
    book.selected = false
  })
  await clearStaleResults()
  await saveBooksToStorage()
  if (hasSearched.value && targetPrice.value) {
    findCombinations()
  }
}

const selectAllBooks = async (): Promise<void> => {
  books.value.forEach(book => {
    book.selected = true
  })
  await clearStaleResults()
  await saveBooksToStorage()
  if (hasSearched.value && targetPrice.value) {
    findCombinations()
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

const handleBackgroundMessage = (message: any) => {
  switch (message.type) {
    case 'calculation_progress':
      calculationProgress.value = message.progress
      break
      
    case 'calculation_complete':
      combinations.value = message.combinations || []
      calculationProgress.value = 100
      
      saveBooksToStorage().catch(saveError => {
        console.error('儲存結果時發生錯誤:', saveError)
      })
      
      setTimeout(() => {
        isCalculating.value = false
        calculationProgress.value = 0
      }, 1000)
      break
      
    case 'calculation_error':
      console.error('Background 計算錯誤:', message.error)
      isCalculating.value = false
      calculationProgress.value = 0
      break
  }
}

onMounted((): void => {
  testChromeStorage()
  checkCurrentPage()
  loadBooksFromStorage()
  
  chrome.runtime.onMessage.addListener(handleBackgroundMessage)
})

onUnmounted(() => {
  if (chrome.runtime.onMessage.hasListener(handleBackgroundMessage)) {
    chrome.runtime.onMessage.removeListener(handleBackgroundMessage)
  }
})
</script>

<style scoped>
.popup-container {
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #212529;
  height: 600px;
  width: 800px;
  box-sizing: border-box;
  overflow: hidden;
}

.main-content {
  display: flex;
  gap: 16px;
  height: calc(600px - 80px);
}

.tab-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  overflow: hidden;
}

.tab-header {
  display: flex;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  color: #495057;
  background: #e9ecef;
}

.tab-btn.active {
  color: #bf0000;
  background: #ffffff;
  border-bottom-color: #bf0000;
}

.tab-badge {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  background: #e9ecef;
  color: #6c757d;
}

.tab-btn.active .tab-badge {
  background: #ffeaea;
  color: #bf0000;
}

.tab-badge-success {
  background: #d4edda;
  color: #155724;
}

.tab-btn.active .tab-badge-success {
  background: #c3e6cb;
  color: #155724;
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
