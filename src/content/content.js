class KoboWishlistExtractor {
  constructor() {
    this.setupMessageListener()
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'extractBooks') {
        this.extractBooksFromPage()
          .then(books => {
            sendResponse({ books: books })
          })
          .catch(error => {
            sendResponse({ books: [], error: error.message })
          })
        return true
      }
    })
  }

  async extractBooksFromPage() {
    try {
      await this.waitForPageLoad()
      
      const bookElements = document.querySelectorAll('.wishlist-item')
      

      if (bookElements.length === 0) {
        return []
      }

      const books = []
      
      for (let i = 0; i < bookElements.length; i++) {
        const element = bookElements[i]
        const book = this.extractBookInfo(element)
        
        if (book && book.title && book.price !== null) {
          books.push(book)
        }
      }

      return books
      
    } catch (error) {
      throw error
    }
  }

  waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 1000)
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 1000)
        })
      }
    })
  }



  extractBookInfo(element) {
    try {
      const book = {
        title: null,
        price: null,
        originalPrice: null,
        currency: 'TWD',
        productId: null
      }

      book.title = this.extractTitle(element)
      
      const priceInfo = this.extractPrice(element)
      book.price = priceInfo.price
      book.originalPrice = priceInfo.originalPrice
      book.currency = priceInfo.currency
      book.productId = this.extractProductId(element)
      return book
      
    } catch (error) {
      return null
    }
  }

  extractTitle(element) {
    const titleEl = element.querySelector('.heading-link')
    
    if (titleEl) {
      let title = titleEl.textContent || titleEl.innerText
      if (title) {
        title = title.trim().replace(/\s+/g, ' ')
        return title
      }
    }

    return null
  }

  extractPrice(element) {
    const result = {
      price: null,
      originalPrice: null,
      currency: 'TWD'
    }

    const salePriceEl = element.querySelector('.sale-price')
    const priceEl = element.querySelector('.price')
    
    if (salePriceEl) {
      const salePrice = this.parsePrice(salePriceEl.textContent || salePriceEl.innerText)
      if (salePrice !== null) {
        result.price = salePrice
        
        if (priceEl) {
          const originalPrice = this.parsePrice(priceEl.textContent || priceEl.innerText)
          if (originalPrice !== null && originalPrice > salePrice) {
            result.originalPrice = originalPrice
          }
        }
      }
    } else if (priceEl) {
      const price = this.parsePrice(priceEl.textContent || priceEl.innerText)
      if (price !== null) {
        result.price = price
      }
    }

    return result
  }

  parsePrice(priceText) {
    if (!priceText) return null
    
    const cleanText = priceText.replace(/[^\d,]/g, '')
    
    if (!cleanText) return null
    
    const price = parseInt(cleanText.replace(/,/g, ''), 10)
    
    return isNaN(price) ? null : price
  }

  extractProductId(element) {
    try {
      const trackInfo = element.getAttribute('data-track-info')
      
      if (!trackInfo) {
        return null
      }

      
      const decodedTrackInfo = trackInfo.replace(/&quot;/g, '"')
      const trackData = JSON.parse(decodedTrackInfo)
      
      if (trackData && trackData.productId) {
        return trackData.productId
      }

      return null
      
    } catch (error) {
      return null
    }
  }
}

const extractor = new KoboWishlistExtractor()

window.addEventListener('load', () => {
})
