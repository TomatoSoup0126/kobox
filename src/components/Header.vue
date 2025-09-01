  <template>
  <header class="header">
    <div class="header-left">
      <div class="title-container">
        <img :src="iconUrl" alt="KoBox Icon" class="app-icon">
        <h1 class="title">{{ $t('app.title') }}</h1>
      </div>
    </div>
    <div class="header-right">
      <div class="language-selector">
        <select 
          v-model="currentLocale" 
          @change="changeLanguage"
          class="language-select"
        >
          <option value="zh-TW">繁體中文</option>
          <option value="en-US">English</option>
        </select>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { saveLocale } from '../i18n/index.js'
import iconUrl from '../icons/icon-32.png'

const { locale } = useI18n()

const currentLocale = computed({
  get: () => locale.value,
  set: (value) => {
    locale.value = value
  }
})

const changeLanguage = () => {
  saveLocale(currentLocale.value)
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 4px;
}

.header-left {
  display: flex;
  flex-direction: column;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #bf0000;
  background: #bf0000;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  color: #6c757d;
  font-style: italic;
  opacity: 0.8;
  letter-spacing: 0.5px;
}

.language-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.language-label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.language-select {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: white;
  color: #495057;
  cursor: pointer;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.language-select:hover {
  border-color: #adb5bd;
}

.language-select:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>
