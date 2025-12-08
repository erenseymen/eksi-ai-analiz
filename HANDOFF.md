# Ekşi Sözlük AI Analiz - Handoff Document

> **Last Updated:** 2025-12-08T05:12:00+03:00  
> **Last Commit:** `70bc8d8` - feat: analiz geçmişi özelliği ekle

---

## Project Overview

**Name:** Ekşi Sözlük AI Analiz  
**Type:** Browser Extension (Chrome, Firefox, Edge, Brave)  
**Purpose:** Scrapes entries from Ekşi Sözlük, analyzes them using Gemini AI API, renders Markdown responses.

### Key Files

| File | Purpose |
|------|---------|
| `src/content.js` | Main content script (~3500 lines) - UI, scraping, API calls, modals |
| `src/constants.js` | Gemini models array, `escapeHtml`, `checkModelAvailability` |
| `src/prompts.js` | `SYSTEM_PROMPT`, `DEFAULT_PROMPTS`, `TEST_PROMPTS` |
| `src/options.js` | Settings page logic (API key, model selection, prompt management) |
| `src/options.html` | Settings page HTML |
| `src/styles.css` | All CSS (~1200 lines) with light/dark theme support |
| `manifest.json` | Chrome/Edge manifest (MV3) |
| `manifest.firefox.json` | Firefox manifest |

---

## Completed Work (This Session)

### Bug Fixes ✅
1. **console.error removal** - Removed 18 statements from production code
2. **Memory leak fix** - Added `MAX_CACHE_SIZE=50` with FIFO eviction in `responseCache`
3. **Retry logic** - `retryWithBackoff()` with exponential backoff (1s, 2s, 4s)
4. **Markdown error boundary** - `parseMarkdown()` wrapped in try-catch
5. **Auto-dismiss** - Already implemented in options.js

### Features Implemented ✅
1. **Streaming Responses** (`cad4f91`)
   - `callGeminiApiStreaming()` using SSE
   - Progressive markdown rendering
   - Pulsing cursor animation during streaming
   
2. **Character/Token Counter** (`126fe8d`)
   - `estimateTokens()` - ~4 chars = 1 token for Turkish
   - `formatTokenCount()` - 38.5K, 1.2M format
   - Shows usage % with warning colors (>80% yellow, >95% red)
   
3. **History/Saved Analyses** (`70bc8d8`)
   - `saveToHistory()`, `getHistory()`, `clearHistory()`
   - Stored in `chrome.storage.local` (max 50 entries)
   - History modal with view/copy/delete actions

---

## Remaining Features (Priority Order)

### 4. Compare Multiple Prompts
**Description:** Run 2-3 prompts in parallel and show results side-by-side.  
**Suggested Implementation:**
- Add "Karşılaştır" button that opens a modal to select prompts
- Use `Promise.all()` to run prompts concurrently
- Display results in a grid/tab layout
- Note: There's already a `showCompareResultsModal()` function for quota modal - could be adapted

### 5. Prompt Templates Library
**Description:** Pre-made prompt templates users can import/add.  
**Suggested Implementation:**
- Add templates section in options.html
- Template categories: "En Komik Entry'ler", "Kronolojik Özet", etc.
- Import/export JSON functionality

### 6. Usage Statistics
**Description:** Show API usage stats in popup/settings.  
**Suggested Implementation:**
- Track: total API calls, token estimates, cached responses
- Store in `chrome.storage.local`
- Display in settings page or popup

### 7. Multi-language Support
**Description:** Add English UI option.  
**Suggested Implementation:**
- Create `locales/` folder with `tr.json`, `en.json`
- Use Chrome's `chrome.i18n` API or simple object lookup
- Add language selector in settings

### 8. Entry Filtering UI (USER: "en son yap")
**Description:** Filter entries before analysis.  
**Suggested Implementation:**
- Date range picker
- Author include/exclude list
- Minimum favori count
- Keyword search

---

## Deferred Code Quality Items

1. **Extract magic numbers** - 500ms delay, etc. to named constants
2. **Fix duplicate loading UI code** - Create `createLoadingUI()` function
3. **Split content.js** - Into modules: scraper.js, api.js, ui.js, markdown.js

---

## Important Code Patterns

### Theme Detection
```javascript
const detectTheme = () => {
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    // Parse RGB and check if dark...
};
```

### Modal Pattern
```javascript
const openXxxModal = async () => {
    const overlay = document.createElement('div');
    overlay.className = 'eksi-ai-modal-overlay';
    if (detectTheme()) overlay.classList.add('eksi-ai-dark');
    // ... build modal HTML
    document.body.appendChild(overlay);
    // Add escape key handler, close handlers
};
```

### Cache Pattern
```javascript
const addToCache = (key, value) => {
    if (responseCache.size >= MAX_CACHE_SIZE) {
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
    }
    responseCache.set(key, value);
};
```

### Streaming API Pattern
```javascript
const response = await fetch(url + ':streamGenerateContent?alt=sse&key=...');
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Parse SSE events: "data: {...json...}"
}
```

---

## User Preferences

- **Language:** Comments should be in Turkish
- **Commits:** Separate commits for each feature/fix
- **Testing:** User will do manual testing (no automation needed)
- **Features NOT wanted:**
  - Export to PDF
  - Keyboard shortcuts (except existing ones)
  - Entry bookmarking
  - Dark/Light theme toggle (auto-detect is fine)
  - Audio summary (TTS)

---

## API Key

Gemini API Key (for testing): `AIzaSyDYWmWwcXX0aOp-iq0QKky3nZdN6lxbr1c`

---

## Git Status

```
Latest commits:
70bc8d8 feat: analiz geçmişi özelliği ekle
126fe8d feat: karakter/token sayacı ekle
cad4f91 feat: streaming yanıt desteği ekle
db1584f fix: markdown parse hatalarında güvenli geri dönüş
fb52d47 feat: ağ hataları için yeniden deneme mantığı ekle
7f76db4 fix: önbellek boyut limiti ekle (bellek sızıntısı düzeltmesi)
3f7c656 refactor: console.error ifadelerini kaldır
d81bf34 refactor: İngilizce yorumları Türkçeye çevir
```

All changes are pushed to `origin/master`.

---

## Test URL

`https://eksisozluk.com/python--109286?p=55`

---

## Quick Start for Next Agent

1. Clone repo and review `src/content.js` structure
2. Check `task.md` in artifacts for current checklist
3. Continue with "Compare Multiple Prompts" feature
4. Remember: Turkish comments, separate commits, user does manual testing
