<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>{{ $t('share.title') }}</h3>
        <button class="close-btn" type="button" :title="$t('share.close')" @click="emit('close')">×</button>
      </div>

      <div class="scope">
        <label class="scope-option">
          <input v-model="scope" type="radio" value="selected">
          {{ $t('share.selected', { n: selectedBooks.length }) }}
        </label>
        <label class="scope-option">
          <input v-model="scope" type="radio" value="all">
          {{ $t('share.all', { n: books.length }) }}
        </label>
      </div>

      <p v-if="targetBooks.length === 0" class="warning">{{ $t('share.emptySelection') }}</p>
      <p v-else-if="tooManyForUrl" class="warning">{{ $t('share.tooMany', { max: maxShareBooks }) }}</p>

      <label class="url-label">{{ $t('share.linkLabel') }}</label>
      <div class="url-row">
        <input :value="shareUrl" class="url-input" type="text" readonly>
        <button
          class="copy-btn"
          type="button"
          :disabled="!canShareUrl || copying"
          @click="copyLink"
        >
          {{ copied ? $t('share.copied') : $t('share.copy') }}
        </button>
      </div>
      <p v-if="urlError" class="error">{{ urlError }}</p>
      <p class="hint">{{ $t('share.privacyNote') }}</p>

      <div class="actions">
        <button class="secondary-btn" type="button" :disabled="targetBooks.length === 0" @click="downloadJson">
          {{ $t('share.downloadJson') }}
        </button>
        <button class="secondary-btn" type="button" :disabled="!canShareUrl" @click="preview">
          {{ $t('share.preview') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAX_SHARE_BOOKS } from '../shared/config.js'
import { buildWishlistJson } from '../shared/sharePayload.js'
import { createShareUrl } from '../shared/shareUrl.js'

const props = defineProps({
  books: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close'])
const { t } = useI18n()

const scope = ref(props.books.some((book) => book.selected) ? 'selected' : 'all')
const shareUrl = ref('')
const copied = ref(false)
const copying = ref(false)
const urlError = ref('')
const maxShareBooks = MAX_SHARE_BOOKS

const selectedBooks = computed(() => props.books.filter((book) => book.selected))
const targetBooks = computed(() => scope.value === 'selected' ? selectedBooks.value : props.books)
const tooManyForUrl = computed(() => targetBooks.value.length > MAX_SHARE_BOOKS)
const canShareUrl = computed(() => targetBooks.value.length > 0 && !tooManyForUrl.value && Boolean(shareUrl.value))

const refreshShareUrl = async () => {
  copied.value = false
  urlError.value = ''
  shareUrl.value = ''

  if (targetBooks.value.length === 0 || tooManyForUrl.value) return

  try {
    shareUrl.value = await createShareUrl(targetBooks.value)
  } catch {
    urlError.value = t('share.generateError')
  }
}

const copyLink = async () => {
  if (!canShareUrl.value) return
  copying.value = true
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
  } catch {
    urlError.value = t('share.copyError')
  } finally {
    copying.value = false
  }
}

const preview = () => {
  if (!canShareUrl.value) return
  window.open(shareUrl.value, '_blank', 'noopener,noreferrer')
}

const downloadJson = () => {
  if (targetBooks.value.length === 0) return
  const payload = buildWishlistJson(targetBooks.value)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `kobox-wishlist-${date}.json`
  link.click()
  URL.revokeObjectURL(url)
}

watch(targetBooks, refreshShareUrl, { immediate: true, deep: true })
</script>

<style scoped>
.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(33, 37, 41, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  padding: 16px;
}

.modal {
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  padding: 16px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  border: none;
  background: none;
  font-size: 22px;
  line-height: 1;
  color: #6c757d;
  cursor: pointer;
}

.scope {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.scope-option {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.url-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.url-row {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 12px;
  background: #f8f9fa;
}

.copy-btn, .secondary-btn {
  border: 1px solid #bf0000;
  background: #bf0000;
  color: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.copy-btn:disabled, .secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.secondary-btn {
  background: #fff;
  color: #bf0000;
  flex: 1;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.hint, .warning, .error {
  font-size: 12px;
  line-height: 1.4;
  margin: 8px 0 0;
}

.hint {
  color: #6c757d;
}

.warning {
  color: #856404;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 8px 10px;
}

.error {
  color: #dc3545;
}
</style>
