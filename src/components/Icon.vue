<template>
  <svg
    class="icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="paths[name]"
  />
</template>

<script setup lang="ts">
/**
 * popup 的圖示集。24×24 stroke 風格，與商店頁注入按鈕看起來是同一套語言。
 *
 * 路徑資料刻意不與 src/content/kobo-inject.js 共用模組：共用會讓 rollup
 * 把它拆成獨立 chunk，content script 就變成 ES module 而靜默失效
 * （vite.config.js 有建置斷言擋這件事）。兩邊各留一份是有意的重複。
 */
withDefaults(defineProps<{ name: keyof typeof paths, size?: number | string }>(), {
  size: 16
})

const paths = {
  books: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5zM9 4h5.5A1.5 1.5 0 0 1 16 5.5v13A1.5 1.5 0 0 1 14.5 20H9"/><path d="M17.4 5.9l2.2.6a1.2 1.2 0 0 1 .8 1.5l-3 11"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>',
  pin: '<path d="M9 3.5h6l-.8 5.2 3 2.6v2H6.8v-2l3-2.6z"/><path d="M12 13.3V20"/>',
  close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  checkboxChecked: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.4 12.2l2.4 2.4 4.8-5"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 1 2.4 5.5"/><path d="M4 7.6v4.2h4.2"/>',
  share: '<circle cx="17.5" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="M8.8 10.8l6.4-3.5M8.8 13.2l6.4 3.5"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.4 15.4L20 20"/>',
  bulb: '<path d="M9.2 16.4a5.6 5.6 0 1 1 5.6 0v1.4H9.2z"/><path d="M10 20.4h4"/>',
  empty: '<circle cx="12" cy="12" r="8.4"/><path d="M8.9 15.2a4 4 0 0 1 6.2 0"/><path d="M9.4 9.6v.4M14.6 9.6v.4"/>',
  download: '<path d="M12 4v10.4"/><path d="M8 11.2l4 4 4-4"/><path d="M4.5 17v1.8a1.2 1.2 0 0 0 1.2 1.2h12.6a1.2 1.2 0 0 0 1.2-1.2V17"/>',
  upload: '<path d="M12 19.6V9.2"/><path d="M8 12.4l4-4 4 4"/><path d="M4.5 17v1.8a1.2 1.2 0 0 0 1.2 1.2h12.6a1.2 1.2 0 0 0 1.2-1.2V17"/>',
  box: '<rect x="3" y="4" width="18" height="4.4" rx="1.2"/><path d="M5 8.4v10.4a1.2 1.2 0 0 0 1.2 1.2h11.6a1.2 1.2 0 0 0 1.2-1.2V8.4"/><path d="M12 11.4v5.2M9.4 14h5.2"/>'
} as const
</script>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: -0.15em;
  flex-shrink: 0;
}
</style>
