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

  const findAllCombinationsAsync = async (bookList: Book[], targetAmount: number): Promise<BookCombination[]> => {
    if (bookList.length > 25) {
      return await findCombinationsForLargeSet(bookList, targetAmount)
    }
    
    return await findCombinationsStandard(bookList, targetAmount)
  }

  const findCombinationsStandard = async (bookList: Book[], targetAmount: number): Promise<BookCombination[]> => {
    const maxHeapSize = 5
    const bestCombinations: BookCombination[] = []
    
    let processedCombinations = 0
    let lastProgressUpdate = Date.now()
    let lastYieldTime = Date.now()
    
    const suffixSums: number[] = new Array(bookList.length + 1).fill(0)
    for (let i = bookList.length - 1; i >= 0; i--) {
      suffixSums[i] = suffixSums[i + 1] + bookList[i].price
    }
    
    
    const insertCombination = (combo: BookCombination): void => {
      if (combo.total < targetAmount) return
      
      
      let insertIndex = bestCombinations.length
      for (let i = 0; i < bestCombinations.length; i++) {
        if (combo.total < bestCombinations[i].total) {
          insertIndex = i
          break
        }
      }
      
      bestCombinations.splice(insertIndex, 0, combo)
      
      
      if (bestCombinations.length > maxHeapSize) {
        bestCombinations.pop()
      }
    }
    
    const updateProgress = async (): Promise<void> => {
      processedCombinations++
      const now = Date.now()
      
      if (now - lastProgressUpdate > 50) {
        const estimatedProgress = Math.min(95, (processedCombinations / (bookList.length * 1000)) * 100)
        calculationProgress.value = Math.round(estimatedProgress)
        lastProgressUpdate = now
      }
      
      if (now - lastYieldTime > 10) {
        await new Promise(resolve => setTimeout(resolve, 0))
        lastYieldTime = Date.now()
      }
    }
    
    const generateCombinations = async (
      index: number, 
      currentCombo: Book[], 
      currentTotal: number
    ): Promise<void> => {
      await updateProgress()
      
      if (bestCombinations.length === maxHeapSize && 
          currentTotal > bestCombinations[maxHeapSize - 1].total) {
        return
      }
      
      if (currentTotal >= targetAmount) {
        insertCombination({
          books: currentCombo.slice(),
          total: currentTotal
        })
        return
      }
      
      if (index >= bookList.length) return
      
      const currentBook = bookList[index]
      
      if (currentTotal + suffixSums[index] < targetAmount) {
        return
      }
      
      currentCombo.push(currentBook)
      await generateCombinations(
        index + 1, 
        currentCombo, 
        currentTotal + currentBook.price
      )
      currentCombo.pop()
      
      await generateCombinations(index + 1, currentCombo, currentTotal)
    }
    
    await generateCombinations(0, [], 0)
    
    return bestCombinations
  }

  const findCombinationsForLargeSet = async (bookList: Book[], targetAmount: number): Promise<BookCombination[]> => {
    
    const sortedBooks = [...bookList].sort((a, b) => b.price - a.price)
    const results: BookCombination[] = []
    const maxResults = 5
    

    
    for (let startIndex = 0; startIndex < sortedBooks.length && results.length < maxResults; startIndex++) {
      let currentCombo: Book[] = []
      let currentTotal = 0
      
      for (let i = startIndex; i < sortedBooks.length; i++) {
        
        const book = sortedBooks[i]
        if (currentTotal + book.price >= targetAmount) {
          currentCombo.push(book)
          currentTotal += book.price
          
          const duplicate = results.find(r => r.total === currentTotal)
          if (!duplicate) {
            results.push({
              books: [...currentCombo],
              total: currentTotal
            })
          }
          break
        } else {
          currentCombo.push(book)
          currentTotal += book.price
        }
      }
    }
    
    return results.sort((a, b) => a.total - b.total).slice(0, maxResults)
  }

  setTimeout(async () => {
    try {
      combinations.value = await findAllCombinationsAsync(selectedBooks, target)
      calculationProgress.value = 100
      
      await saveBooksToStorage()
      
    } catch (error) {
    } finally {
      setTimeout(() => {
        isCalculating.value = false
        calculationProgress.value = 0
      }, 1000)
    }
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
