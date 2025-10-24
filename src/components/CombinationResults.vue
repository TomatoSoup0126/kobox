<template>
  <div class="combination-results-container column column-3">
    <!-- 第三區：組合結果 -->
    <div class="section">
      <h3 class="section-title">🎯 {{ $t('results.title') }}</h3>
      
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
      <div v-else-if="combinations.length > 0" class="combinations-list">
        <div 
          v-for="(combo, index) in combinations" 
          :key="index"
          class="combination-item fade-in"
          :style="{ animationDelay: `${index * 0.1}s` }"
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
            >
              {{ book.title }} - $ {{ book.price }}
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
  </div>
</template>

<script setup lang="ts">
interface Book {
  id: number
  title: string
  price: number
  selected: boolean
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

defineProps<Props>()
</script>

<style scoped>
.combination-results-container {
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

.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #212529;
}

.combinations-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
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
}

.combo-books {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.combo-book {
  font-size: 12px;
  color: #6c757d;
  padding-left: 8px;
  border-left: 2px solid #6c757d;
}

.no-results {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 14px;
  color: #6c757d;
  border: 1px solid #e9ecef;
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

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
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


.fade-in {
  animation: fadeInUp 0.6s ease-out both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
