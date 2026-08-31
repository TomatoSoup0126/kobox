<div align="center">
  <img src="src/icons/kobox_logo.png" alt="KoBox Logo" width="80" height="80">
</div>

# KoBox

> Chrome extension to find optimal checkout combinations from your Kobo wishlist

## ✨ Features

- **🔄 One-Click Import** - Import every book on your Kobo wishlist page at once
- **📦 Add While Browsing** - Add a single book straight from any Kobo page, no wishlist detour
- **🎯 Smart Calculation** - Find the cheapest combination that clears your target checkout price
- **📌 Pin Books** - Pin specific books to ensure they always appear in combinations
- **✅ Batch Operations** - Select all, unselect all, or unpin all books with one click
- **🔗 Share List** - Copy a link so others can view your list and import the titles they want
- **💾 JSON Backup** - Export or import the full book list as a JSON file

## 🚀 Quick Start

### Installation

- Visit [Chrome Web Store](https://chromewebstore.google.com/detail/kobox/ghlalaokkeodecoaelhjfmfcgknifkno?authuser=0&hl=zh-TW) to install the extension

### How to Use

1. **Go to Kobo Wishlist**
   - Login to [Kobo website](https://www.kobo.com)
   - Navigate to your wishlist page

2. **Import Your Wishlist**
   - Click the KoBox icon in the toolbar
   - Click **Import wishlist books**
   - The button only works while the wishlist page is open, since it reads the books off that page

3. **Add Single Books While Browsing (Optional)**
   - On the Kobo home, search or book pages, click the button on the bottom-right of a cover
   - The book goes straight into KoBox; open the popup when you want to see what accumulated

4. **Pin Must-Have Books (Optional)**
   - Click the pin button next to any book
   - Pinned books are included in every combination and highlighted in the list

5. **Set Target Price**
   - Enter the minimum amount your checkout has to clear
   - Example: 1000 means the combination totals at least NT$1000

6. **Find Best Combinations**
   - Click **Find combinations**
   - Browse the recommended combinations, cheapest first

7. **Share a List (Optional)**
   - Click **Share list**, pick all books or just the ticked ones, and copy the link
   - Recipients open [kobox-extension.netlify.app](https://kobox-extension.netlify.app), tick books, and import them into KoBox
   - People without the extension are directed to the Chrome Web Store
   - Book data lives in the URL hash and is not stored on a server
   - A link holds at most `MAX_SHARE_BOOKS` books (`src/shared/config.js`); past that, export JSON instead

8. **Export / Import JSON (Optional)**
   - Use **Export JSON** to back up the full list, however long it is
   - Use **Import JSON** on another browser or device; existing books are matched by `productId`

---

**Note**: This extension is for personal use only. Please comply with Kobo website terms of service. Wishlist data stays on your device. A share link encodes the selected books in the URL itself; nothing is uploaded to a KoBox server.

### Deploy the share page (Netlify)

1. Import this GitHub repository in [Netlify](https://www.netlify.com/)
2. The included `netlify.toml` already sets `npm run build:site` and the `dist-site` publish directory
3. Set the site name to `kobox-extension` so the public URL is `https://kobox-extension.netlify.app` (or update `src/shared/config.js` if you use another name)
4. After the first deploy, share links copied from the extension will open that site

### Development

- `npm run dev` - build the extension into `dist/` in watch mode, then load the project root as an unpacked extension
- `npm run dev:site` - serve the share page on `localhost:5174`; it temporarily adds that origin to `manifest.json` and restores it on exit
- `npm run manifest:clean` - undo that manifest patch if the dev server was killed before it could
- `npm test` - run the share payload, bridge, price and notice tests


<a href="https://www.buymeacoffee.com/tomatosoup" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee"  width="217" height="60">
</a>
