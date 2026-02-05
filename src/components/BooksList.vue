<template>
  <div class="books-list-container">
    <!-- 工具列 -->
    <div class="toolbar" v-if="books.length > 0">
      <div class="toolbar-info">
        <span v-if="pinnedCount > 0" class="pinned-count">
          📌 {{ pinnedCount }} {{ $t('books.pinned') }}
        </span>
      </div>
      <div class="toolbar-actions">
        <button 
          v-if="pinnedCount > 0"
          @click="handleUnpinAll"
          class="toolbar-btn"
          :title="$t('books.unpinAll')"
        >
          📌 {{ $t('books.unpinAll') }}
        </button>
        <button 
          v-if="selectedCount === books.length"
          @click="handleUnselectAll"
          class="toolbar-btn select-toggle-btn"
          :title="$t('books.unselectAll')"
        >
          ☐ {{ $t('books.unselectAll') }}
        </button>
        <button 
          v-else
          @click="handleSelectAll"
          class="toolbar-btn select-toggle-btn"
          :title="$t('books.selectAll')"
        >
          ☑ {{ $t('books.selectAll') }}
        </button>
        <button 
          @click="handleClearAllData"
          class="clear-btn"
          :title="$t('books.clearAll')"
        >
          ↻ {{ $t('books.clearAll') }}
        </button>
      </div>
    </div>

    <!-- 書籍列表 -->
    <div v-if="books.length > 0" class="books-list">
      <div 
        v-for="book in books" 
        :key="book.id" 
        class="book-item"
        :class="{ 'book-item-pinned': book.pinned }"
      >
        <button
          @click="toggleBookPinned(book)"
          class="pin-btn"
          :class="{ 'pin-btn-active': book.pinned }"
          :title="book.pinned ? $t('books.unpin') : $t('books.pin')"
        >
          📌
        </button>
        <input 
          type="checkbox" 
          v-model="book.selected"
          @change="updateBookSelection(book)"
          class="book-checkbox"
        >
        <div class="book-info">
          <div class="book-title" :title="book.title">{{ book.title }}</div>
        </div>
        <div class="book-price">${{ book.price }}</div>
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
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Book {
  id: number
  title: string
  price: number
  selected: boolean
  pinned: boolean
}

interface Props {
  books: Book[]
}

interface Emits {
  (e: 'delete-book', bookId: number): void
  (e: 'update-book-selection', book: Book): void
  (e: 'update-book-pinned', book: Book): void
  (e: 'clear-all-data'): void
  (e: 'unpin-all'): void
  (e: 'unselect-all'): void
  (e: 'select-all'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedCount = computed(() => {
  return props.books.filter(book => book.selected).length
})

const pinnedCount = computed(() => {
  return props.books.filter(book => book.pinned).length
})

const handleDeleteBook = (bookId: number): void => {
  emit('delete-book', bookId)
}

const updateBookSelection = (book: Book): void => {
  emit('update-book-selection', book)
}

const toggleBookPinned = (book: Book): void => {
  emit('update-book-pinned', { ...book, pinned: !book.pinned })
}

const handleClearAllData = (): void => {
  if (confirm('確定要清除所有書籍資料嗎？此操作無法復原。')) {
    emit('clear-all-data')
  }
}

const handleUnpinAll = (): void => {
  emit('unpin-all')
}

const handleUnselectAll = (): void => {
  emit('unselect-all')
}

const handleSelectAll = (): void => {
  emit('select-all')
}
</script>

<style scoped>
.books-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
}

.toolbar-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pinned-count {
  color: #e67e22;
  font-weight: 600;
  font-size: 13px;
}

.books-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  min-height: 0;
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
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  background: #f8f9fa;
  transition: all 0.15s ease-in-out;
}

.book-item:hover {
  background-color: #e9ecef;
}

.book-item:last-child {
  margin-bottom: 0;
}

.book-item-pinned {
  background-color: #fff8e6;
  border-left: 3px solid #e67e22;
}

.book-item-pinned:hover {
  background-color: #fff3d1;
}

.book-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.book-title {
  font-size: 14px;
  font-weight: 500;
  color: #212529;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-price {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  flex-shrink: 0;
}

.pin-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.2s;
  opacity: 0.3;
  flex-shrink: 0;
  line-height: 1;
  filter: grayscale(100%);
}

.pin-btn:hover {
  opacity: 0.7;
  transform: scale(1.1);
  filter: grayscale(0%);
}

.pin-btn-active {
  opacity: 1;
  filter: grayscale(0%);
}

.pin-btn-active:hover {
  opacity: 0.8;
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
  padding: 60px 20px;
  color: #6c757d;
  font-size: 14px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-btn {
  background: none;
  border: 1px solid #6c757d;
  color: #6c757d;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s;
  flex-shrink: 0;
  white-space: nowrap;
}

.toolbar-btn:hover {
  background: #6c757d;
  color: white;
}

.select-toggle-btn {
  min-width: 80px;
  text-align: center;
  justify-content: center;
}

.clear-btn {
  background: none;
  border: 1px solid #dc3545;
  color: #dc3545;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.clear-btn:hover {
  background: #dc3545;
  color: white;
}
</style>
