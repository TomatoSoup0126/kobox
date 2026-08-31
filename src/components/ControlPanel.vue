<template>
  <div class="control-panel column column-1">
    <!-- 步驟一：匯入書籍 -->
    <div class="section">
      <h3 class="section-title"><span class="step-number">1</span>{{ $t('control.step1') }}</h3>
      <div class="import-hint">
        <Icon name="bulb" :size="14" />
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
        :title="isOnWishlist ? $t('control.importWishlist') : $t('control.importDisabledHint')"
        class="import-btn"
      >
        <span v-if="isLoading">{{ $t('control.importing') }}</span>
        <span v-else>{{ $t('control.importWishlist') }}</span>
      </button>
      <p class="store-hint">
        <Icon name="box" :size="14" />
        <span>{{ $t('control.storeHint') }}</span>
      </p>

      <!-- JSON 匯入與匯出成對放在一起：使用者找到其中一個，就會在旁邊找另一個。 -->
      <div class="json-actions">
        <button type="button" class="link-btn" :title="$t('json.importTitle')" @click="handleImportJsonClick">
          <Icon name="upload" :size="13" />
          {{ $t('json.import') }}
        </button>
        <button
          v-if="books.length > 0"
          type="button"
          class="link-btn"
          :title="$t('json.exportTitle')"
          @click="handleExportJson"
        >
          <Icon name="download" :size="13" />
          {{ $t('json.export') }}
        </button>
        <input
          ref="jsonFileInput"
          type="file"
          accept="application/json,.json"
          class="hidden-file-input"
          @change="handleJsonFileChange"
        >
      </div>
    </div>

    <div v-if="books.length > 0" class="section">
      <h3 class="section-title"><span class="step-number">2</span>{{ $t('control.step2') }}</h3>
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
        <span v-else><Icon name="search" :size="14" /> {{ $t('control.findCombinations') }}</span>
      </button>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, watch, type Ref } from 'vue'
import Icon from './Icon.vue'

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
  (e: 'import-json', file: File): void
  (e: 'export-json'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localTargetPrice: Ref<number | null> = ref(props.targetPrice)

watch(() => props.targetPrice, (newValue) => {
  localTargetPrice.value = newValue
})

const jsonFileInput = ref<HTMLInputElement | null>(null)

const handleImportBooks = (): void => {
  emit('import-books')
}

const handleImportJsonClick = (): void => {
  jsonFileInput.value?.click()
}

const handleJsonFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('import-json', file)
  }
  // 清掉才能重複選同一個檔案
  input.value = ''
}

const handleExportJson = (): void => {
  emit('export-json')
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
  gap: 12px;
  min-height: 0;
  /* 通知橫幅出現時左欄會變矮，讓它捲動而不是把卡片壓扁。
     平常兩張卡片就塞得進 popup，捲軸只在橫幅出現時才會冒出來。 */
  overflow-y: auto;
}

.control-panel::-webkit-scrollbar {
  width: 6px;
}

.control-panel::-webkit-scrollbar-track {
  background: #f8f9fa;
  border-radius: 3px;
}

.control-panel::-webkit-scrollbar-thumb {
  background: #ced4da;
  border-radius: 3px;
}

.control-panel::-webkit-scrollbar-thumb:hover {
  background: #adb5bd;
}

.section {
  background: #ffffff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* 不可壓縮：被 flex 擠到比內容矮時，內容會溢出白卡並被下一張卡的白底蓋住。 */
  flex-shrink: 0;
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

.json-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e9ecef;
}

/* 做成文字連結而非按鈕：這是次要的檔案操作，不該與主要動作競爭視覺權重。 */
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  padding: 0;
  color: #6c757d;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.link-btn:hover {
  color: #bf0000;
  text-decoration: underline;
}

.hidden-file-input {
  display: none;
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
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #e7f3ff;
  border: 1px solid #b8daff;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #004085;
  line-height: 1.4;
}

/* 商店頁按鈕是新的加入途徑，不在這裡說明的話使用者不會知道它存在。 */
.store-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #6c757d;
}

/* flex-start 對齊的是行框頂端，不是第一行文字的視覺中線，圖示因此偏高。
   往下推 (行高 - 圖示高度) / 2：提示框是 1.4 × 14px 對 14px，這裡是 1.45 × 12px 對 14px。 */
.import-hint .icon {
  margin-top: 3px;
}

.store-hint .icon {
  margin-top: 2px;
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
