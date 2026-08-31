/**
 * 開發期間暫時把本機分享頁的 origin 加進 manifest.json 的 content script。
 *
 * committed 的 manifest.json 只保留正式站台，避免正式版帶著用不到的 localhost
 * 設定上架（安裝時會多出 host 權限提示）。background 那側另有 import.meta.env.MODE
 * 把關，就算 content script 被注入，production build 也不會信任本機來源。
 *
 * 用法：
 *   node scripts/dev-manifest.mjs on
 *   node scripts/dev-manifest.mjs off
 *   node scripts/dev-manifest.mjs run -- <command> [args...]   # 跑完自動還原
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEV_SHARE_PORTS, SHARE_PAGE_ORIGIN } from '../src/shared/config.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = path.join(ROOT, 'manifest.json')
const BRIDGE_SCRIPT = 'dist/share-bridge.js'
const SHARE_ORIGIN_MATCH = `${SHARE_PAGE_ORIGIN}/*`

const DEV_MATCHES = DEV_SHARE_PORTS.flatMap((port) => [
  `http://localhost:${port}/*`,
  `http://127.0.0.1:${port}/*`
])

// 只改寫 bridge 那個 content script 的 matches 陣列，其餘位元組原封不動，
// 避免整份 manifest 被重新序列化而產生無關的 formatting diff。
const MATCHES_BLOCK = /([ \t]*)"matches"\s*:\s*\[([^\]]*)\]/g

function setDevMatches (enabled) {
  const text = fs.readFileSync(MANIFEST, 'utf8')

  let replaced = false
  const next = text.replace(MATCHES_BLOCK, (whole, indent, body) => {
    if (replaced || !body.includes(SHARE_ORIGIN_MATCH)) return whole

    const entries = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    const kept = entries.filter((match) => !DEV_MATCHES.includes(match))
    const finalEntries = enabled ? [...kept, ...DEV_MATCHES] : kept
    const itemIndent = `${indent}  `
    const lines = finalEntries.map((match) => `${itemIndent}"${match}"`).join(',\n')

    replaced = true
    return `${indent}"matches": [\n${lines}\n${indent}]`
  })

  if (!replaced) {
    throw new Error(`manifest.json 找不到注入 ${BRIDGE_SCRIPT} 的 content script`)
  }

  JSON.parse(next) // 確保產出的仍是合法 JSON
  fs.writeFileSync(MANIFEST, next)
  return text
}

const [mode, ...rest] = process.argv.slice(2)

if (mode === 'on' || mode === 'off') {
  setDevMatches(mode === 'on')
  console.log(`manifest.json: 本機分享頁注入已${mode === 'on' ? '開啟' : '關閉'}`)
} else if (mode === 'run') {
  const argv = rest[0] === '--' ? rest.slice(1) : rest
  const [command, ...args] = argv
  if (!command) {
    console.error('用法: node scripts/dev-manifest.mjs run -- <command> [args...]')
    process.exit(1)
  }

  // 保存原始內容，不論子行程怎麼結束都寫回原樣。
  const original = setDevMatches(true)

  // Chrome 在「載入擴充功能的當下」就把 content script 註冊快照起來，之後改
  // manifest.json 不會生效。所以本機分享頁一定要在注入後才重新載入擴充功能。
  console.log([
    '',
    '  ┌──────────────────────────────────────────────────────────┐',
    '  │  manifest.json 已加入本機分享頁的注入設定                 │',
    '  │                                                          │',
    '  │  請到 chrome://extensions 重新載入 KoBox，                │',
    '  │  否則分享頁會偵測不到擴充功能。                           │',
    '  └──────────────────────────────────────────────────────────┘',
    ''
  ].join('\n'))
  let restored = false
  const restore = () => {
    if (restored) return
    restored = true
    fs.writeFileSync(MANIFEST, original)
  }

  const child = spawn(command, args, { stdio: 'inherit', shell: false, cwd: ROOT })

  process.on('exit', restore)
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      child.kill(signal)
    })
  }

  child.on('exit', (code, signal) => {
    restore()
    process.exit(signal ? 1 : (code ?? 0))
  })
  child.on('error', (error) => {
    restore()
    console.error(error.message)
    process.exit(1)
  })
} else {
  console.error('用法: node scripts/dev-manifest.mjs <on|off|run -- <command>>')
  process.exit(1)
}
