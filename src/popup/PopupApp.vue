<template>
  <div class="popup-container">
    <Header />

    <div v-if="notice" class="notice-banner" :class="`notice-${notice.tone}`" role="status">
      <span class="notice-text">{{ notice.text }}</span>
      <div v-if="notice.actions" class="notice-actions">
        <button
          v-for="action in notice.actions"
          :key="action.label"
          type="button"
          class="notice-action"
          :class="{ 'notice-action-primary': action.primary }"
          @click="runNoticeAction(action)"
        >{{ action.label }}</button>
      </div>
      <button type="button" class="banner-close" :title="$t('messages.close')" @click="dismissNotice">
        <Icon name="close" :size="14" />
      </button>
    </div>

    <main class="main-content">
      <ControlPanel
        :is-on-wishlist="isOnWishlist"
        :books="books"
        :target-price="targetPrice"
        :is-loading="isLoading"
        :is-calculating="isCalculating"
        @import-books="importBooks"
        @find-combinations="handleFindCombinations"
        @update-target-price="updateTargetPrice"
        @import-json="importBooksJson"
        @export-json="exportBooksJson"
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
            <Icon name="books" />
            {{ $t('tabs.books') }}
            <span v-if="books.length > 0" class="tab-badge">{{ selectedCount }}/{{ books.length }}</span>
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'results' }"
            @click="switchTab('results')"
          >
            <Icon name="target" />
            {{ $t('tabs.results') }}
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
            @clear-all-data="requestClearAll"
            @unpin-all="unpinAllBooks"
            @unselect-all="unselectAllBooks"
            @select-all="selectAllBooks"
            @share-books="showShareModal = true"
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

    <ShareModal
      v-if="showShareModal"
      :books="books"
      @close="showShareModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Header from '../components/Header.vue'
import ControlPanel from '../components/ControlPanel.vue'
import BooksList from '../components/BooksList.vue'
import CombinationResults from '../components/CombinationResults.vue'
import ShareModal from '../components/ShareModal.vue'
import Icon from '../components/Icon.vue'
import { buildWishlistJson, mergeImportedBooks, parseWishlistJson } from '../shared/sharePayload.js'
import { downloadJsonFile, wishlistFilename } from '../shared/downloadJson.js'
import { noticeSourceKey, noticeTotals } from '../shared/importNotice.js'

interface Book {
  id: string
  productId: string
  title: string
  price: number
  selected: boolean
  pinned: boolean
  url?: string
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
    url?: string
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
const showShareModal: Ref<boolean> = ref(false)
interface NoticeAction {
  label: string
  handler: () => void
  primary?: boolean
}

interface Notice {
  text: string
  tone: 'success' | 'error'
  actions?: NoticeAction[]
}

// 單一橫幅取代先前的綠色提示 + 三個 alert() + 一個 confirm()，
// 讓所有回饋都出現在同一個位置，也避免原生對話框把 popup 關掉。
const notice: Ref<Notice | null> = ref(null)
let noticeTimer: ReturnType<typeof setTimeout> | null = null
// 刪除單本書時暫存的復原資料。確認疲勞會讓使用者盲目點掉確認框，
// 所以單本刪除用復原、清除全部才用確認。
let pendingUndo: { book: Book, index: number } | null = null

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
          pinned: false,
          url: book.url || ''
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
    showError('messages.importFailed')
  } finally {
    isLoading.value = false
  }
}

const deleteBook = async (bookId: number): Promise<void> => {
  const index = books.value.findIndex(book => book.id === bookId)
  if (index === -1) return

  const [removed] = books.value.splice(index, 1)
  pendingUndo = { book: removed, index }

  await clearStaleResults()
  await saveBooksToStorage()

  showNotice(
    t('messages.deleted', { title: removed.title }),
    'success',
    [{ label: t('messages.undo'), handler: undoDelete, primary: true }],
    6000
  )

  if (hasSearched.value && targetPrice.value) {
    findCombinations()
  }
}

const undoDelete = async (): Promise<void> => {
  if (!pendingUndo) return
  const { book, index } = pendingUndo
  pendingUndo = null

  // 插回原本的位置，而不是接到清單尾端。
  books.value.splice(Math.min(index, books.value.length), 0, book)
  await clearStaleResults()
  await saveBooksToStorage()

  if (hasSearched.value && targetPrice.value) {
    findCombinations()
  }
}

// 破壞性且量大，用確認而非復原。改走橫幅是為了不再有硬編中文的原生對話框。
const requestClearAll = (): void => {
  showNotice(t('messages.clearAllConfirm'), 'error', [
    { label: t('messages.confirm'), handler: clearAllData, primary: true },
    { label: t('messages.cancel'), handler: dismissNotice }
  ])
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
    url: book.url ?? '',
    selected: book.selected,
    pinned: book.pinned
  }))

  const plainSelectedBooks = selectedBooks.map(book => ({
    id: book.id,
    productId: book.productId,
    title: book.title,
    price: book.price,
    url: book.url ?? '',
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
      showError(calcErrorKey(response.error))
      isCalculating.value = false
      calculationProgress.value = 0
    }
  }).catch(error => {
    console.error('發送計算請求失敗:', error)
    showError('messages.calcFailed')
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
      'koboActiveTab',
      'koboImportNotice'
    ])
    
    // 載入上次使用的分頁
    if (result.koboActiveTab && (result.koboActiveTab === 'books' || result.koboActiveTab === 'results')) {
      activeTab.value = result.koboActiveTab
    }

    if (result.koboImportNotice && typeof result.koboImportNotice === 'object') {
      showNotice(renderStoredNotice(result.koboImportNotice), 'success')
      // 清除失敗不該中斷下面的書籍載入，否則清單會顯示成空的。
      await clearStoredNotice()
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
          pinned: book.pinned ?? false,
          url: book.url ?? ''
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

const exportBooksJson = (): void => {
  if (books.value.length === 0) return
  downloadJsonFile(buildWishlistJson(books.value), wishlistFilename())
}

const importBooksJson = async (file: File): Promise<void> => {
  try {
    const text = await file.text()
    const incoming = parseWishlistJson(text)
    const merged = mergeImportedBooks(books.value, incoming)
    books.value = merged.books
    await clearStaleResults()
    await saveBooksToStorage()
    showNotice(t('messages.jsonImported', {
      added: merged.added,
      updated: merged.updated
    }), 'success')
    activeTab.value = 'books'
  } catch {
    showError('messages.jsonImportFailed')
  }
}

// 提示的來源決定文案：單一來源用該來源的說法，多來源或舊格式用中性說法。
const renderStoredNotice = (notice: unknown): string => {
  const { added, updated } = noticeTotals(notice)
  const key = noticeSourceKey(notice)
  const messageKey = key === 'share' ? 'messages.importNoticeShare'
    : key === 'page' ? 'messages.importNoticePage'
    : 'messages.importNoticeMixed'
  return t(messageKey, { added, updated })
}

// 清除交給 background，才不會被 in-flight 的匯入寫入蓋回去。
const clearStoredNotice = async (): Promise<void> => {
  try {
    await chrome.runtime.sendMessage({ action: 'clearImportNotice' })
  } catch (error) {
    console.warn('清除匯入提示失敗:', error)
  }
}

const dismissNotice = (): void => {
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }
  notice.value = null
}

const showNotice = (
  text: string,
  tone: Notice['tone'] = 'success',
  actions?: NoticeAction[],
  autoDismissMs?: number
): void => {
  dismissNotice()
  notice.value = { text, tone, actions }
  if (autoDismissMs) {
    noticeTimer = setTimeout(() => {
      noticeTimer = null
      notice.value = null
      pendingUndo = null
    }, autoDismissMs)
  }
}

const runNoticeAction = (action: NoticeAction): void => {
  dismissNotice()
  action.handler()
}

const showError = (messageKey: string): void => showNotice(t(messageKey), 'error')

// background 只回錯誤碼，文案在這裡對應，使用者才不會看到寫死的中文。
const calcErrorKey = (code: unknown): string => {
  switch (code) {
    case 'calc_busy': return 'messages.calcBusy'
    case 'calc_missing_price': return 'messages.calcMissingPrice'
    case 'calc_missing_books': return 'messages.calcMissingBooks'
    default: return 'messages.calcFailed'
  }
}

const testChromeStorage = async (): Promise<void> => {
  try {
    
    await chrome.storage.local.set({ testKey: 'testValue' })
    
    const testResult = await chrome.storage.local.get(['testKey'])
    
    await chrome.storage.local.remove(['testKey'])
    
  } catch (error) {
    showError('messages.storageError')
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
      // 先前只進 console，UI 只是默默把 spinner 收掉，使用者不知道發生什麼事。
      showError(calcErrorKey(message.error))
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
  position: relative;
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #212529;
  height: 600px;
  width: 800px;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 高度必須是彈性的：先前寫死 calc(600px - 80px)，假設了「沒有橫幅」，
   橫幅一出現就把內容推超過容器高度而被裁掉，捲不到最底。
   min-height: 0 是必要的，否則 flex item 不會縮到小於內容高度。 */
.main-content {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
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

.notice-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  border: 1px solid;
}

.notice-text {
  flex: 1;
  min-width: 0;
}

.notice-success {
  background: #d4edda;
  border-color: #c3e6cb;
  color: #155724;
}

.notice-error {
  background: #f8d7da;
  border-color: #f5c6cb;
  color: #721c24;
}

.notice-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.notice-action {
  border: 1px solid currentColor;
  background: none;
  color: inherit;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.notice-action-primary {
  font-weight: 600;
}

.notice-action:hover {
  background: rgba(0, 0, 0, 0.06);
}

.banner-close {
  border: none;
  background: none;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  flex-shrink: 0;
}
</style>
