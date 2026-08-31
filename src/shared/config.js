export const SHARE_PAGE_ORIGIN = 'https://kobox-extension.netlify.app'
export const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/kobox/ghlalaokkeodecoaelhjfmfcgknifkno'
export const GITHUB_URL = 'https://github.com/TomatoSoup0126/kobox'
export const MESSAGE_CHANNEL = 'kobox-share'
// URL 分享的上限：壓縮後的 payload 必須塞得進網址列。
export const MAX_SHARE_BOOKS = 20
// 匯入的上限：與分享無關，純粹避免惡意頁面送進超大陣列撐爆 storage 配額。
export const MAX_IMPORT_BOOKS = 2000
export const JSON_FORMAT_VERSION = 1
// 本機分享頁的 port（vite.share.config.js 的 server/preview port）。
// background 只在 development build 信任這些來源，manifest 的注入設定則由
// scripts/dev-manifest.mjs 在開發期間暫時加上。
export const DEV_SHARE_PORTS = ['5174', '4173']
