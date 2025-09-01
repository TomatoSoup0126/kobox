<template>
  <div class="books-list-container column column-2">
    <!-- 第二區：書籍清單 -->
    <div class="section">
      <div class="header-row">
        <div class="section-title-container">
          <h3 class="section-title">📚 {{ $t('books.title') }}</h3>
          <div v-if="books.length > 0" class="book-counts">
            ({{ selectedCount }} / {{ books.length }})
          </div>
        </div>
        <button 
          v-if="books.length > 0"
          @click="handleClearAllData"
          class="clear-btn"
          :title="$t('books.clearAll')"
        >
          ↻
        </button>
      </div>
      <div v-if="books.length > 0" class="books-list">
        <div v-for="book in books" :key="book.id" class="book-item">
          <input 
            type="checkbox" 
            v-model="book.selected"
            @change="updateBookSelection(book)"
            class="book-checkbox"
          >
          <div class="book-info">
            <div class="book-title">{{ book.title }}</div>
            <div class="book-price">${{ book.price }}</div>
          </div>
          <button 
            @click="handleDeleteBook(book.id)"
            class="delete-btn"
            :title="$t('books.deleteBook')"
          >
            ×
          </button>
        </div>
      </div>
      <div v-else class="empty-state">
        {{ $t('books.noBooks') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Book {
  id: number
  title: string
  price: number
  selected: boolean
}

interface Props {
  books: Book[]
}

interface Emits {
  (e: 'delete-book', bookId: number): void
  (e: 'update-book-selection', book: Book): void
  (e: 'clear-all-data'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedCount = computed(() => {
  return props.books.filter(book => book.selected).length
})

const handleDeleteBook = (bookId: number): void => {
  emit('delete-book', bookId)
}

const updateBookSelection = (book: Book): void => {
  emit('update-book-selection', book)
}

const handleClearAllData = (): void => {
  if (confirm('確定要清除所有書籍資料嗎？此操作無法復原。')) {
    emit('clear-all-data')
  }
}
</script>

<style scoped>
.books-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.section {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.section-title-container {
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #212529;
  flex: 1;
}

.book-counts {
  font-size: 14px;
  color: #6c757d;
  font-weight: 500;
  margin-left: auto;
  margin-right: 8px;
}

.books-list {
  flex: 1;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 8px;
  min-height: 0;
  border: 1px solid #e9ecef;
}

.books-list::-webkit-scrollbar {
  width: 6px;
}

.books-list::-webkit-scrollbar-track {
  background: #f8f9fa;
  border-radius: 3px;
}

.books-list::-webkit-scrollbar-thumb {
  background: #ced4da;
  border-radius: 3px;
}

.books-list::-webkit-scrollbar-thumb:hover {
  background: #adb5bd;
}

.book-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-bottom: 1px solid #e9ecef;
  transition: background-color 0.15s ease-in-out;
}

.book-item:hover {
  background-color: #ffffff;
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
  color: #212529;
}

.book-price {
  font-size: 12px;
  color: #6c757d;
}

.book-checkbox {
  margin: 0;
  flex-shrink: 0;
}

.delete-btn {
  background: none;
  border: none;
  color: #ff6b6b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
  opacity: 0.7;
  flex-shrink: 0;
  line-height: 1;
}

.delete-btn:hover {
  background: rgba(255, 107, 107, 0.2);
  opacity: 1;
  transform: scale(1.1);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
  font-size: 14px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px dashed #dee2e6;
}

.clear-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 16px;
  transition: all 0.2s;
  opacity: 0.7;
  flex-shrink: 0;
  line-height: 1;
}

.clear-btn:hover {
  background: rgba(220, 53, 69, 0.2);
  opacity: 1;
  transform: scale(1.1);
}
</style>
