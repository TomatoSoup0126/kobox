<template>
  <div class="popup-container">
    <header class="header">
      <h1 class="title">📚 KOBO Slash</h1>
      <p class="subtitle">找出最佳結帳組合</p>
    </header>

    <main class="main-content">
      <!-- 狀態顯示 -->
      <div class="status-section">
        <div v-if="!isOnWishlist" class="warning">
          ⚠️ 請先開啟 KOBO 願望清單頁面
        </div>
        <div v-else-if="books.length === 0" class="info">
          ℹ️ 點擊下方按鈕匯入書籍資料
        </div>
        <div v-else class="success">
          ✅ 已匯入 {{ books.length }} 本書籍
        </div>
      </div>

      <!-- 匯入按鈕 -->
      <div class="import-section">
        <button 
          @click="importBooks" 
          :disabled="!isOnWishlist || isLoading"
          class="import-btn"
        >
          <span v-if="isLoading">匯入中...</span>
          <span v-else>🔄 匯入書籍資料</span>
        </button>
      </div>

      <!-- 書籍列表 -->
      <div v-if="books.length > 0" class="books-section">
        <h3>書籍清單</h3>
        <div class="books-list">
          <div v-for="book in books" :key="book.id" class="book-item">
            <div class="book-info">
              <div class="book-title">{{ book.title }}</div>
              <div class="book-price">NT$ {{ book.price }}</div>
            </div>
            <input 
              type="checkbox" 
              v-model="book.selected"
              class="book-checkbox"
            >
          </div>
        </div>
      </div>

      <!-- 價格設定 -->
      <div v-if="books.length > 0" class="price-section">
        <label for="target-price" class="price-label">
          目標最低合計價格
        </label>
        <input 
          type="number" 
          id="target-price"
          v-model.number="targetPrice"
          placeholder="例如: 1000"
          class="price-input"
        >
      </div>

      <!-- 計算按鈕 -->
      <div v-if="books.length > 0" class="calculate-section">
        <button 
          @click="findCombinations"
          :disabled="!targetPrice || isCalculating"
          class="calculate-btn"
        >
          <span v-if="isCalculating">計算中...</span>
          <span v-else>🔍 找出組合</span>
        </button>
      </div>

      <!-- 結果顯示 -->
      <div v-if="combinations.length > 0" class="results-section">
        <h3>推薦組合</h3>
        <div class="combinations-list">
          <div 
            v-for="(combo, index) in combinations" 
            :key="index"
            class="combination-item"
          >
            <div class="combo-header">
              <span class="combo-title">組合 {{ index + 1 }}</span>
              <span class="combo-total">NT$ {{ combo.total }}</span>
            </div>
            <div class="combo-books">
              <div 
                v-for="book in combo.books" 
                :key="book.id"
                class="combo-book"
              >
                {{ book.title }} - NT$ {{ book.price }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="hasSearched && combinations.length === 0" class="no-results">
        😕 找不到符合條件的組合，請調整目標價格
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'PopupApp',
  setup() {
    const isOnWishlist = ref(false)
    const books = ref([])
    const targetPrice = ref(null)
    const combinations = ref([])
    const isLoading = ref(false)
    const isCalculating = ref(false)
    const hasSearched = ref(false)

    // 檢查是否在願望清單頁面
    const checkCurrentPage = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        isOnWishlist.value = tab.url && tab.url.includes('kobo.com') && tab.url.includes('wishlist')
      } catch (error) {
        console.error('檢查頁面失敗:', error)
      }
    }

    // 匯入書籍資料
    const importBooks = async () => {
      if (!isOnWishlist.value) return
      
      isLoading.value = true
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        
        // 向 content script 發送訊息
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractBooks' })
        
        if (response && response.books) {
          books.value = response.books.map((book, index) => ({
            id: index,
            title: book.title,
            price: book.price,
            selected: true
          }))
        }
      } catch (error) {
        console.error('匯入書籍失敗:', error)
        alert('匯入失敗，請確認您在 KOBO 願望清單頁面')
      } finally {
        isLoading.value = false
      }
    }

    // 找出組合的演算法
    const findCombinations = () => {
      if (!targetPrice.value) return
      
      isCalculating.value = true
      hasSearched.value = true
      combinations.value = []

      const selectedBooks = books.value.filter(book => book.selected)
      const target = targetPrice.value

      // 使用動態規劃找出所有可能的組合
      const findAllCombinations = (bookList, targetAmount) => {
        const results = []
        
        // 遞迴函數來生成組合
        const generateCombinations = (index, currentCombo, currentTotal) => {
          if (currentTotal >= targetAmount) {
            results.push({
              books: [...currentCombo],
              total: currentTotal
            })
            return
          }
          
          if (index >= bookList.length) return
          
          // 包含當前書籍
          generateCombinations(
            index + 1, 
            [...currentCombo, bookList[index]], 
            currentTotal + bookList[index].price
          )
          
          // 不包含當前書籍
          generateCombinations(index + 1, currentCombo, currentTotal)
        }
        
        generateCombinations(0, [], 0)
        
        // 排序並限制結果數量
        return results
          .filter(combo => combo.total >= targetAmount)
          .sort((a, b) => a.total - b.total)
          .slice(0, 10) // 最多顯示10個組合
      }

      setTimeout(() => {
        combinations.value = findAllCombinations(selectedBooks, target)
        isCalculating.value = false
      }, 100)
    }

    onMounted(() => {
      checkCurrentPage()
    })

    return {
      isOnWishlist,
      books,
      targetPrice,
      combinations,
      isLoading,
      isCalculating,
      hasSearched,
      importBooks,
      findCombinations
    }
  }
}
</script>

<style scoped>
.popup-container {
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  min-height: 100vh;
  box-sizing: border-box;
}

.header {
  text-align: center;
  margin-bottom: 20px;
}

.title {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-section {
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
}

.warning {
  background: rgba(255, 193, 7, 0.2);
  border: 1px solid rgba(255, 193, 7, 0.5);
}

.info {
  background: rgba(13, 202, 240, 0.2);
  border: 1px solid rgba(13, 202, 240, 0.5);
}

.success {
  background: rgba(25, 135, 84, 0.2);
  border: 1px solid rgba(25, 135, 84, 0.5);
}

.import-btn, .calculate-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.import-btn:hover:not(:disabled), 
.calculate-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.import-btn:disabled, 
.calculate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.books-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
}

.books-list {
  max-height: 150px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px;
}

.book-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.book-item:last-child {
  border-bottom: none;
}

.book-info {
  flex: 1;
}

.book-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 2px;
}

.book-price {
  font-size: 12px;
  opacity: 0.8;
}

.book-checkbox {
  margin-left: 8px;
}

.price-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.price-label {
  font-size: 14px;
  font-weight: 500;
}

.price-input {
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
}

.price-input::placeholder {
  color: #666;
}

.results-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
}

.combinations-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.combination-item {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
}

.combo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.combo-title {
  font-weight: 500;
  font-size: 14px;
}

.combo-total {
  font-weight: 600;
  font-size: 14px;
  color: #90EE90;
}

.combo-books {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.combo-book {
  font-size: 12px;
  opacity: 0.9;
  padding-left: 8px;
  border-left: 2px solid rgba(255, 255, 255, 0.3);
}

.no-results {
  text-align: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
}
</style>
