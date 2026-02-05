<template>
  <div class="combination-results-container">
    <!-- 載入狀態 -->
    <div v-if="isCalculating" class="loading-container">
      <div class="loading-text">
        <div class="loading-title">🔍 {{ $t('results.searching') }}</div>
        <div class="loading-percentage">
          {{ calculationProgress }}%
        </div>
      </div>
      
      <!-- 進度條 -->
      <div class="progress-bar-container">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: `${calculationProgress}%` }"
          ></div>
        </div>
      </div>
    </div>
    
    <!-- 組合結果 -->
    <div 
      v-else-if="combinations.length > 0" 
      ref="listRef"
      class="combinations-list"
      @scroll="handleScroll"
    >
      <div 
        v-for="(combo, index) in combinations" 
        :key="index"
        class="combination-item"
      >
        <div class="combo-header">
          <span class="combo-title">{{ $t('results.combination') }} {{ index + 1 }}</span>
          <span class="combo-total">$ {{ combo.total }}</span>
        </div>
        <div class="combo-books">
          <div 
            v-for="book in combo.books" 
            :key="book.id"
            class="combo-book"
            :class="{ 'combo-book-pinned': book.pinned }"
          >
            <span v-if="book.pinned" class="pin-icon">📌</span>
            <span class="combo-book-title" :title="book.title">{{ book.title }}</span>
            <span class="combo-book-price">$ {{ book.price }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 無結果 -->
    <div v-else-if="hasSearched && combinations.length === 0" class="no-results">
      😕 {{ $t('results.noResults') }}
    </div>
    
    <!-- 初始狀態 -->
    <div v-else class="empty-state">
      {{ $t('results.setPrice') }}
      <div>「{{ $t('control.findCombinations') }}」</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

interface Book {
  id: number
  title: string
  price: number
  selected: boolean
  pinned?: boolean
}

interface BookCombination {
  books: Book[]
  total: number
}

interface Props {
  combinations: BookCombination[]
  hasSearched: boolean
  isCalculating: boolean
  calculationProgress: number
}

const props = defineProps<Props>()

const listRef = ref<HTMLElement | null>(null)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

// 儲存滾動位置（使用 debounce 避免頻繁寫入）
const handleScroll = (): void => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  scrollTimeout = setTimeout(() => {
    if (listRef.value) {
      chrome.storage.local.set({ 
        koboResultsScrollTop: listRef.value.scrollTop 
      })
    }
  }, 150)
}

// 恢復滾動位置
const restoreScrollPosition = async (): Promise<void> => {
  const result = await chrome.storage.local.get(['koboResultsScrollTop'])
  if (result.koboResultsScrollTop && listRef.value) {
    listRef.value.scrollTop = result.koboResultsScrollTop
  }
}

// 當組合結果載入後恢復滾動位置
watch(() => props.combinations, async (newCombinations) => {
  if (newCombinations.length > 0) {
    await nextTick()
    restoreScrollPosition()
  }
}, { immediate: true })

onMounted(() => {
  if (props.combinations.length > 0) {
    nextTick(() => restoreScrollPosition())
  }
})
</script>

<style scoped>
.combination-results-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.combinations-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 12px;
}

.combinations-list::-webkit-scrollbar {
  width: 6px;
}

.combinations-list::-webkit-scrollbar-track {
  background: #f8f9fa;
  border-radius: 3px;
}

.combinations-list::-webkit-scrollbar-thumb {
  background: #ced4da;
  border-radius: 3px;
}

.combinations-list::-webkit-scrollbar-thumb:hover {
  background: #adb5bd;
}

.combination-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e9ecef;
  transition: box-shadow 0.15s ease-in-out;
}

.combination-item:hover {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
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
  color: #212529;
}

.combo-total {
  font-weight: 600;
  font-size: 14px;
  color: #198754;
  text-align: right;
  min-width: 60px;
  margin-right: 8px;
}

.combo-books {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.combo-book {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #495057;
  padding: 4px 8px;
  border-left: 2px solid #dee2e6;
  background: transparent;
  border-radius: 0 4px 4px 0;
}

.combo-book-pinned {
  background: #fff8e6;
  border-left-color: #e67e22;
}

.pin-icon {
  font-size: 11px;
  flex-shrink: 0;
}

.combo-book-title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.combo-book-price {
  flex-shrink: 0;
  font-weight: 500;
  color: #6c757d;
  text-align: right;
  min-width: 60px;
}

.no-results {
  text-align: center;
  padding: 40px 20px;
  font-size: 14px;
  color: #6c757d;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
  font-size: 14px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  flex: 1;
}


.loading-text {
  text-align: center;
  color: #495057;
}

.loading-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  animation: pulse 2s ease-in-out infinite;
}

.loading-progress {
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 4px;
  min-height: 16px;
}

.loading-percentage {
  font-size: 14px;
  font-weight: 500;
  color: #495057;
  margin-top: 4px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes glow {
  0%, 100% { 
    text-shadow: 0 0 5px #198754;
    transform: scale(1);
  }
  50% { 
    text-shadow: 0 0 15px #198754, 0 0 25px #198754;
    transform: scale(1.05);
  }
}

.progress-bar-container {
  width: 100%;
  margin: 20px 0;
  padding: 0 20px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #198754, #28a745, #20c997);
  background-size: 200% 100%;
  border-radius: 4px;
  transition: width 0.3s ease-in-out;
  animation: progressShine 2s ease-in-out infinite;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: progressGlow 1.5s ease-in-out infinite;
}

@keyframes progressShine {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes progressGlow {
  0%, 100% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(100%);
  }
}
</style>
