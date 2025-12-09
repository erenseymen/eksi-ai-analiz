# Veri Yapısı Dokümantasyonu

Ekşi Sözlük AI Analiz eklentisinde kullanılan ve kaydedilen tüm verilerin yapısı.

## Genel Bakış

- **`chrome.storage.sync`**: Tüm cihazlarda senkronize (kullanıcı ayarları, istatistikler)
- **`chrome.storage.local`**: Sadece mevcut cihazda (scrape edilen entry'ler, analiz geçmişi)

---

## Chrome Storage Sync (Senkronize Veriler)

### 1. `geminiApiKey`
**Tip:** `string` | **Varsayılan:** `''`  
**Açıklama:** Google Gemini API anahtarı.  
**Kaynak:** `src/settings.js`, `src/options.js`

### 2. `selectedModel`
**Tip:** `string` | **Varsayılan:** `'gemini-2.5-flash'`  
**Açıklama:** Seçili Gemini model ID'si.  
**Değerler:** `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3-pro-preview` (beta, ücretli)  
**Kaynak:** `src/settings.js`, `src/options.js`, `src/model-select.js`

### 3. `prompts`
**Tip:** `Array<{name: string, prompt: string}>` | **Varsayılan:** `DEFAULT_PROMPTS`  
**Açıklama:** Özelleştirilmiş analiz prompt butonları.  
**Kaynak:** `src/settings.js`, `src/options.js`, `src/prompts.js`

### 4. `theme`
**Tip:** `string` | **Varsayılan:** `'auto'`  
**Değerler:** `'auto'`, `'light'`, `'dark'`  
**Kaynak:** `src/options.js`

### 5. `optionsActiveTab`
**Tip:** `string` | **Varsayılan:** `'api'`  
**Değerler:** `'api'`, `'prompts'`, `'models'`, `'stats'`  
**Kaynak:** `src/options.js`

### 6. `eksi_ai_usage_stats`
**Tip:** `Object`  
**Yapı:**
```typescript
interface UsageStats {
    totals: {
        apiCalls: number;      // Toplam API çağrı sayısı
        totalTokens: number;   // Toplam token sayısı
        cacheHits: number;     // Cache'den gelen sonuç sayısı
    };
    history: Array<{
        timestamp: number;      // Unix timestamp (ms)
        modelId: string;
        tokenEstimate: number;
        responseTime: number;   // ms
        fromCache: boolean;
        topicTitle: string;
    }>;
}
```
**Notlar:** History max 100 kayıt (FIFO), ilk kullanımda local→sync migration yapılır.  
**Kaynak:** `src/stats.js`

---

## Chrome Storage Local (Yerel Veriler)

### 1. `scrapedData`
**Tip:** `Array<ScrapeRecord>` | **Varsayılan:** `[]`  
**Açıklama:** Scrape edilen entry'ler ve analizler. Her unique entry seti için bir kayıt.

**Yapı:**
```typescript
interface ScrapeRecord {
    id: string;                    // "scrape-1704067200000"
    sourceEntriesHash: string;     // Entry ID'lerinden hash (unique identifier)
    topicId: string;               // "12345"
    topicTitle: string;
    topicUrl: string;
    scrapedAt: string;             // ISO 8601
    entryCount: number;
    sourceEntries: Array<Entry>;
    wasStopped: boolean;
    analyses: Array<Analysis>;
}

interface Entry {
    id: string;                    // "123456"
    author: string;
    date: string;
    content: string;               // Temizlenmiş, tam URL'lerle
    referenced_entries?: Array<Entry>;  // (bkz: #entry_id) referansları
}

interface Analysis {
    id: string;                    // "analysis-1704067200000"
    timestamp: string;             // ISO 8601
    prompt: string;                // Tam prompt
    promptPreview: string;         // İlk 100 karakter
    response: string;              // Tam yanıt
    responsePreview: string;       // İlk 200 karakter
    modelId: string;
    responseTime: number;          // ms
}
```

**Önemli Notlar:**
- **Hash Sistemi:** Aynı entry seti için tek kayıt. Aynı hash'li yeni scrape'ler mevcut kaydı günceller.
- **Analizler:** Her analiz `analyses` array'ine eklenir. Farklı prompt'larla yapılan analizler ayrı kayıtlar.
- **Referanslar:** `(bkz: #entry_id)` formatındaki referanslar otomatik yüklenir.
- **Temizleme:** `historyRetentionDays`'e göre otomatik (0 = sınırsız).

**Kaynak:** `src/analysis-history.js`, `src/history.js`

### 2. `historyRetentionDays`
**Tip:** `number` | **Varsayılan:** `30` (gün)  
**Açıklama:** Analiz geçmişi saklama süresi.  
**Değerler:** `0` = sınırsız, `1-365` = gün cinsinden  
**Kaynak:** `src/analysis-history.js`, `src/history.js`

---

## Veri İlişkileri

```
ScrapeRecord
├── sourceEntries (Entry[])
│   └── referenced_entries (Entry[])
└── analyses (Analysis[])
    ├── prompt (string)
    ├── response (string)
    └── modelId (string)
```

**Flat History View (UI için):**
```typescript
interface FlatHistoryItem {
    id: string;                    // Scrape ID veya Analysis ID
    timestamp: string;             // scrapedAt veya analysis.timestamp
    topicTitle: string;
    topicId: string;
    topicUrl: string;
    entryCount: number;
    sourceEntries: Array<Entry>;
    scrapeOnly: boolean;           // true = sadece scrape
    wasStopped: boolean;
    prompt: string;                // Analysis varsa dolu
    promptPreview: string;
    response: string;              // Analysis varsa dolu
    responsePreview: string;
    modelId: string;
    responseTime: number;
}
```

---

## Veri Akışı

**Entry Scraping:**
1. Kullanıcı "Analiz Et" → `scraper.js` → Entry'ler toplanır
2. `analysis-history.js` → `saveToHistory({ scrapeOnly: true })`
3. `chrome.storage.local` → `scrapedData` güncellenir

**Analiz Yapma:**
1. Prompt seçimi → `api.js` → Gemini API isteği
2. `analysis-history.js` → `saveToHistory({ scrapeOnly: false, response: ... })`
3. `chrome.storage.local` → `scrapedData[].analyses[]` güncellenir
4. `stats.js` → `recordApiCall()` → `chrome.storage.sync` güncellenir

**Ayarları Kaydetme:**
1. Ayarlar değişikliği → `options.js` → `saveOptions()`
2. `chrome.storage.sync` → `geminiApiKey`, `selectedModel`, `prompts`, `theme` güncellenir

---

## Veri Boyutları ve Limitler

- **Sync Storage:** ~100 KB (tüm cihazlarda senkronize)
- **Local Storage:** ~10 MB (cihaz bazlı)
- **Stats History:** Max 100 kayıt (FIFO)
- **History Retention:** Varsayılan 30 gün (kullanıcı ayarlanabilir)

**Optimizasyon:**
- Preview alanları: `promptPreview` (100 karakter), `responsePreview` (200 karakter)
- Hash sistemi: Aynı entry setleri için tek kayıt
- Otomatik temizleme: `historyRetentionDays`'e göre

---

## Migration ve Uyumluluk

**Stats Migration:** İlk kullanımda `eksi_ai_usage_stats` local→sync taşınır (`src/stats.js - migrateStatsToSync()`). Sync'te veri varsa migration yapılmaz.

**Varsayılan Değerler:** Tüm storage key'leri için varsayılan değerler tanımlı. Key yoksa varsayılan kullanılır.

---

## Güvenlik ve Gizlilik

**Hassas Veriler:**
- `geminiApiKey`: Sync storage'da saklanır, sadece eklenti içinde kullanılır

**Veri Kapsamı:**
- **Sync:** Kullanıcı tercihleri, istatistikler (API key)
- **Local:** Scrape edilen entry'ler, analiz sonuçları (cihaz bazlı)

**Temizleme:** Kullanıcılar history sayfasından geçmişi, ayarlar sayfasından istatistikleri ve API anahtarını temizleyebilir.

---

## Kaynak Dosyalar

| Veri | Kaynak Dosyalar |
|------|----------------|
| `geminiApiKey`, `selectedModel`, `prompts`, `theme`, `optionsActiveTab` | `src/settings.js`, `src/options.js`, `src/model-select.js` |
| `eksi_ai_usage_stats` | `src/stats.js` |
| `scrapedData`, `historyRetentionDays` | `src/analysis-history.js`, `src/history.js` |
| Entry yapısı | `src/scraper.js` |
| Prompt yapısı | `src/prompts.js` |

---

## Örnek Kullanım

**Yeni Analiz:**
```javascript
const entries = await scrapeEntries();
await saveToHistory({ scrapeOnly: true, topicTitle: "yapay zeka", topicId: "12345", entryCount: entries.length, sourceEntries: entries });
const response = await callGeminiAPI(prompt, entries);
await saveToHistory({ scrapeOnly: false, topicTitle: "yapay zeka", topicId: "12345", entryCount: entries.length, sourceEntries: entries, prompt, response: response.text, modelId: "gemini-2.5-flash", responseTime: response.time });
await recordApiCall({ modelId: "gemini-2.5-flash", tokenEstimate: response.tokens, responseTime: response.time, fromCache: false, topicTitle: "yapay zeka" });
```

**Geçmişi Görüntüleme:**
```javascript
const history = await getHistory();
const recent = history.slice(0, 10);
const withAnalysis = history.filter(item => !item.scrapeOnly);
```

---

## Sorun Giderme

**Veri Kaybı:**
- Sync Storage: Chrome hesabına giriş kontrolü
- Local Storage: Eklenti izinleri kontrolü
- Retention Days: Geçmiş saklama süresi (0 = sınırsız)

**Quota Exceeded:**
- Local Storage: Eski analiz geçmişini temizle
- Sync Storage: İstatistik geçmişini temizle
- Retention Days: Saklama süresini azalt

**Migration Sorunları:**
- Local storage'dan `eksi_ai_usage_stats` kontrolü
- Sync storage'da aynı key kontrolü
- Gerekirse manuel taşıma

---

**Son Güncelleme:** 2024-01-01 | **Versiyon:** 1.0.0
