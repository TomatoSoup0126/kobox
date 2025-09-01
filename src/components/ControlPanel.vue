<template>
  <div class="control-panel column column-1">
    <!-- 第一區：說明、匯入、價格設定 -->
    <div class="section">
      <h3 class="section-title"><span class="step-number">1</span>{{ $t('control.step1') }}</h3>
      <div class="import-hint">
        <i18n-t keypath="control.hintMessage" tag="span">
          <template #link>
            <a href="https://www.kobo.com/account/wishlist" target="_blank" class="kobo-link">
              {{ $t('control.wishlistLink') }}
            </a>
          </template>
        </i18n-t>
      </div>
      <button 
        @click="handleImportBooks" 
        :disabled="!isOnWishlist || isLoading"
        class="import-btn"
      >
        <span v-if="isLoading">{{ $t('control.importing') }}</span>
        <span v-else>{{ $t('control.importWishlist') }}</span>
      </button>
    </div>

    <div v-if="books.length > 0" class="section">
      <h3 class="section-title"><span class="step-number">2</span>{{ $t('control.step3') }}</h3>
      <label for="target-price" class="price-label">
        {{ $t('control.targetPrice') }}
      </label>
      <input 
        type="number" 
        id="target-price"
        v-model.number="localTargetPrice"
        @input="updateTargetPrice"
        :placeholder="$t('control.enterAmount')"
        class="price-input"
      >
      <button 
        @click="handleFindCombinations"
        :disabled="!localTargetPrice || isCalculating"
        class="calculate-btn"
      >
        <span v-if="isCalculating">{{ $t('control.calculating') }}</span>
        <span v-else>🔍 {{ $t('control.findCombinations') }}</span>
      </button>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, watch, type Ref } from 'vue'

interface Book {
  id: number
  title: string
  price: number
  selected: boolean
}

interface Props {
  isOnWishlist: boolean
  books: Book[]
  targetPrice: number | null
  isLoading: boolean
  isCalculating: boolean
}

interface Emits {
  (e: 'import-books'): void
  (e: 'find-combinations'): void
  (e: 'update-target-price', value: number | null): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localTargetPrice: Ref<number | null> = ref(props.targetPrice)

watch(() => props.targetPrice, (newValue) => {
  localTargetPrice.value = newValue
})

const handleImportBooks = (): void => {
  emit('import-books')
}

const handleFindCombinations = (): void => {
  emit('find-combinations')
}

const updateTargetPrice = (): void => {
  emit('update-target-price', localTargetPrice.value)
}
</script>

<style scoped>
.control-panel {
  flex: 0 0 250px;
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
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #212529;
  display: flex;
  align-items: center;
}

.status-section {
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
}

.warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
}

.info {
  background: #d1ecf1;
  border: 1px solid #0dcaf0;
  color: #055160;
}

.success {
  background: #d4edda;
  border: 1px solid #198754;
  color: #0f5132;
}

.import-btn, .calculate-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #6c757d;
  color: white;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.import-btn:hover:not(:disabled), 
.calculate-btn:hover:not(:disabled) {
  background: #5a6268;
}

.import-btn:disabled, 
.calculate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}



.price-label {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
}

.price-input {
  padding: 10px;
  margin-bottom: 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 16px;
  background: #ffffff;
  color: #212529;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.price-input:focus {
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.price-input::placeholder {
  color: #666;
}

.import-hint {
  background: #e7f3ff;
  border: 1px solid #b8daff;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #004085;
  line-height: 1.4;
}

.kobo-link {
  color: #0056b3;
  text-decoration: none;
  font-weight: 500;
}

.kobo-link:hover {
  color: #003d82;
  text-decoration: underline;
}

.step-number {
  background: #bf0000;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  margin-right: 8px;
  flex-shrink: 0;
}


</style>
