<template>
  <div class="page">
    <header class="header">
      <div class="brand">
        <img :src="logoUrl" alt="KoBox" class="logo">
        <span class="brand-name">KoBox</span>
      </div>
      <select v-model="currentLocale" class="language-select" @change="changeLanguage">
        <option value="zh-TW">繁體中文</option>
        <option value="en-US">English</option>
      </select>
    </header>

    <main class="main">
      <section v-if="view === 'landing'" class="card landing">
        <h1>{{ $t('sharePage.landingTitle') }}</h1>
        <p class="subtitle">{{ $t('sharePage.landingSubtitle') }}</p>
        <a :href="storeUrl" class="primary-btn" target="_blank" rel="noopener noreferrer">
          {{ $t('sharePage.install') }}
        </a>
        <a :href="githubUrl" class="ghost-link" target="_blank" rel="noopener noreferrer">GitHub</a>
      </section>

      <section v-else-if="view === 'loading'" class="card status">
        {{ $t('sharePage.loading') }}
      </section>

      <section v-else-if="view === 'error'" class="card status">
        <p>{{ $t('sharePage.invalidLink') }}</p>
        <button class="secondary-btn" type="button" @click="goHome">
          {{ $t('sharePage.backHome') }}
        </button>
      </section>

      <section v-else class="list-layout">
        <div class="card intro">
          <h1>{{ $t('sharePage.sharedList') }}</h1>
          <p class="meta">
            {{ $t('sharePage.bookCount', { n: books.length }) }}
            · ${{ listTotal }}
          </p>
          <p v-if="ownedChecked && ownedCount > 0" class="meta owned-meta">
            {{ $t('sharePage.ownedCount', { n: ownedCount }) }}
          </p>
          <p class="hint">{{ $t('sharePage.priceNote') }}</p>
        </div>

        <div class="card books-card">
          <div
            v-for="book in books"
            :key="book.productId"
            class="book-row"
            :class="{ 'is-owned': book.owned }"
          >
            <input
              v-model="book.selected"
              class="book-checkbox"
              type="checkbox"
            >
            <a
              :href="bookHref(book)"
              class="book-title"
              target="_blank"
              rel="noopener noreferrer"
              :title="book.title"
            >
              {{ book.title }}
            </a>
            <span v-if="book.owned" class="owned-tag">{{ $t('sharePage.owned') }}</span>
            <span class="book-price">${{ book.price }}</span>
          </div>
        </div>
      </section>
    </main>

    <footer v-if="view === 'list'" class="footer">
      <div class="footer-row">
        <button class="text-btn" type="button" @click="toggleSelectAll">
          {{ allSelected ? $t('sharePage.unselectAll') : $t('sharePage.selectAll') }}
        </button>
        <span class="footer-summary">
          {{ $t('sharePage.selectedSummary', { n: selectedBooks.length, price: selectedTotal }) }}
        </span>
      </div>

      <template v-if="installed">
        <button
          class="primary-btn"
          type="button"
          :disabled="selectedBooks.length === 0 || importing"
          @click="importSelected"
        >
          {{ importing ? $t('sharePage.importing') : $t('sharePage.import') }}
        </button>
        <p v-if="allOwned && !importMessage" class="hint">{{ $t('sharePage.allOwned') }}</p>
        <p v-if="importMessage" class="success">{{ importMessage }}</p>
        <p v-if="importMessage" class="hint">{{ $t('sharePage.openExtension') }}</p>
        <p v-if="importError" class="error">{{ importError }}</p>
      </template>

      <template v-else>
        <a :href="storeUrl" class="primary-btn" target="_blank" rel="noopener noreferrer">
          {{ $t('sharePage.install') }}
        </a>
        <p class="hint">{{ $t('sharePage.needInstallHint') }}</p>
      </template>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { saveLocale } from '../i18n/index.js'
import logoUrl from '../icons/kobox_logo.png'
import { decodePayload } from '../shared/codec.js'
import { CHROME_STORE_URL, GITHUB_URL } from '../shared/config.js'
import { checkOwnedBooks, detectExtension, importBooksToExtension } from '../shared/extensionBridge.js'
import { bookHref, unpackBooks } from '../shared/sharePayload.js'

const { locale, t } = useI18n()
const currentLocale = computed({
  get: () => locale.value,
  set: (value) => {
    locale.value = value
  }
})

const view = ref('loading')
const books = ref([])
const installed = ref(false)
const importing = ref(false)
const importMessage = ref('')
const importError = ref('')
const ownedChecked = ref(false)
const storeUrl = CHROME_STORE_URL
const githubUrl = GITHUB_URL

const selectedBooks = computed(() => books.value.filter((book) => book.selected))
const allSelected = computed(() => books.value.length > 0 && selectedBooks.value.length === books.value.length)
const listTotal = computed(() => books.value.reduce((sum, book) => sum + book.price, 0))
const selectedTotal = computed(() => selectedBooks.value.reduce((sum, book) => sum + book.price, 0))
const ownedCount = computed(() => books.value.filter((book) => book.owned).length)
const allOwned = computed(() => books.value.length > 0 && ownedCount.value === books.value.length)

const changeLanguage = () => {
  saveLocale(currentLocale.value)
}

const goHome = () => {
  history.replaceState(null, '', `${location.pathname}${location.search}`)
  view.value = 'landing'
  books.value = []
}

const toggleSelectAll = () => {
  const next = !allSelected.value
  books.value.forEach((book) => {
    book.selected = next
  })
}

// hashchange 會在 checkOwnedBooks 還在飛的時候換掉整份 books，
// 用序號丟棄過期回應，避免把「已擁有」標到另一份清單上。
let loadSeq = 0

const loadFromHash = async () => {
  const seq = ++loadSeq
  importMessage.value = ''
  importError.value = ''
  ownedChecked.value = false
  const encoded = location.hash.replace(/^#/, '').trim()

  if (!encoded) {
    view.value = 'landing'
    books.value = []
    return
  }

  view.value = 'loading'
  try {
    const payload = await decodePayload(encoded)
    const unpacked = unpackBooks(payload)
    if (seq !== loadSeq) return
    books.value = unpacked.map((book) => ({ ...book, selected: true, owned: false }))
    view.value = 'list'
  } catch (error) {
    // 先前這裡完全吞掉錯誤，連結解不開時查不出是網址被截斷、payload 損壞
    // 還是解壓失敗。
    console.error('[KoBox] 無法解析分享連結:', error, '長度:', encoded.length)
    view.value = 'error'
    books.value = []
  }
}

/**
 * 標示哪些書已經在使用者的 KoBox 裡。純屬輔助資訊：擴充功能沒安裝、逾時、
 * 或回報失敗都靜默略過，不顯示錯誤也不擋住匯入。
 */
const refreshOwned = async () => {
  const seq = loadSeq
  const ids = books.value.map((book) => book.productId)
  if (ids.length === 0) return

  try {
    const ownedIds = await checkOwnedBooks(ids)
    if (seq !== loadSeq) return

    const owned = new Set(ownedIds)
    books.value.forEach((book) => {
      if (!owned.has(book.productId)) return
      book.owned = true
      // 這個功能的意義是「只匯入我還沒有的」，所以已擁有的預設不勾選。
      book.selected = false
    })
    ownedChecked.value = true
  } catch (error) {
    console.warn('[KoBox] 無法確認已擁有的書:', error)
  }
}

const importSelected = async () => {
  if (selectedBooks.value.length === 0) return

  importing.value = true
  importMessage.value = ''
  importError.value = ''

  try {
    const result = await importBooksToExtension(selectedBooks.value)
    importMessage.value = t('sharePage.imported', {
      added: result.added ?? 0,
      updated: result.updated ?? 0
    })
    refreshOwned()
  } catch (error) {
    console.error('[KoBox] 匯入失敗:', error)
    importError.value = t('sharePage.importFailed')
  } finally {
    importing.value = false
  }
}

// hashchange 換了書單後要重新標示；偵測不到擴充功能就不用問。
const handleHashChange = async () => {
  await loadFromHash()
  if (installed.value) refreshOwned()
}

onMounted(async () => {
  window.addEventListener('hashchange', handleHashChange)
  await loadFromHash()
  // 必須等 detectExtension 成功後才問 —— 在那之前 content script 可能還沒注入，
  // 請求一定會逾時（detectExtension 本身就是為此重試四次）。
  installed.value = await detectExtension()
  if (installed.value) refreshOwned()
})

onUnmounted(() => {
  window.removeEventListener('hashchange', handleHashChange)
})
</script>

<style>
html, body, #app {
  margin: 0;
  min-height: 100%;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #212529;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 16px 120px;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  width: 32px;
  height: 32px;
}

.brand-name {
  font-size: 20px;
  font-weight: 600;
  color: #bf0000;
}

.language-select {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #fff;
  color: #495057;
}

.card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 20px;
}

.landing, .status {
  text-align: center;
}

.landing h1, .intro h1 {
  margin: 0 0 8px;
  font-size: 24px;
  color: #bf0000;
}

.subtitle, .meta, .hint {
  color: #6c757d;
  line-height: 1.5;
}

.list-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.book-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f1f3f5;
}

.book-row:last-child {
  border-bottom: none;
}

.book-checkbox {
  flex-shrink: 0;
}

.book-title {
  flex: 1;
  min-width: 0;
  color: #212529;
  text-decoration: none;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-title:hover {
  color: #bf0000;
  text-decoration: underline;
}

.owned-tag {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 1;
  padding: 3px 8px;
  border-radius: 999px;
  background: #f1f3f5;
  color: #6c757d;
}

/* 弱化而非停用：checkbox 保持可用與正常對比，使用者仍可刻意重新勾選。 */
.is-owned .book-title {
  color: #868e96;
}

.owned-meta {
  color: #868e96;
}

.book-price {
  flex-shrink: 0;
  font-weight: 600;
  color: #495057;
}

.footer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  background: #fff;
  border-top: 1px solid #e9ecef;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(720px, 100%);
  box-sizing: border-box;
}

.footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.footer-summary {
  font-size: 13px;
  color: #495057;
  font-weight: 500;
}

.primary-btn, .secondary-btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #bf0000;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  box-sizing: border-box;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: #6c757d;
  margin-top: 12px;
}

.text-btn {
  border: none;
  background: none;
  color: #bf0000;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.ghost-link {
  display: inline-block;
  margin-top: 12px;
  color: #6c757d;
}

.success {
  margin: 0;
  color: #198754;
  font-size: 13px;
}

.error {
  margin: 0;
  color: #dc3545;
  font-size: 13px;
}

.hint {
  margin: 0;
  font-size: 13px;
}
</style>
