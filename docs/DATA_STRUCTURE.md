# Veri Yapısı Dokümantasyonu

Ekşi Sözlük AI Analiz eklentisinde kullanılan ve kaydedilen tüm verilerin yapısı.

## Genel Bakış

- **`chrome.storage.sync`**: Tüm cihazlarda senkronize (kullanıcı ayarları)
- **`chrome.storage.local`**: Sadece mevcut cihazda (scrape edilen entry'ler, analiz geçmişi, istatistikler)

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

---

## Chrome Storage Local (Yerel Veriler)

### 1. `scrapedData`
**Tip:** `Array<ScrapeRecord | MultiSourceScrapeRecord>` | **Varsayılan:** `[]`  
**Açıklama:** Scrape edilen entry'ler ve analizler. Tek kaynak (single source) ve çoklu kaynak (multi-source) kayıtları birlikte tutulur.

**Yapı - Tek Kaynak (Single Source):**
```typescript
interface ScrapeRecord {
    id: string;                    // "scrape-1704067200000"
    sourceEntriesHash: string;     // Tüm entry objesinden SHA-256 hash (unique identifier)
    topicId: string;               // "12345"
    topicTitle: string;
    topicUrl: string;
    scrapedAt: string;             // ISO 8601
    entryCount: number;
    sourceEntries: Array<Entry>;
    wasStopped: boolean;
    analyses: Array<Analysis>;
}
```

**Yapı - Çoklu Kaynak (Multi-Source):**
```typescript
interface MultiSourceScrapeRecord {
    id: string;                    // "multi-analysis-1704067200000"
    sourceEntriesHash: string;     // Tüm sourceScrapes hash'lerinin birleşimi (unique identifier)
    scrapedAt: string;             // ISO 8601 (ilk oluşturulma zamanı)
    lastUpdated?: string;          // ISO 8601 (son analiz ekleme zamanı)
    sourceScrapes: Array<{
        scrapeId: string;          // Kaynak scrape ID'si
        sourceEntriesHash: string; // Kaynak scrape'in hash'i (unique identifier)
        topicTitle: string;
        topicUrl: string;
        topicId: string;
        entryCount: number;
    }>;
    analyses: Array<Analysis>;
    // sourceEntries yok - referans bazlı
    // topicId, topicTitle, topicUrl yok - çoklu kaynak olduğu için
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
- **Hash Sistemi:** 
  - SHA-256 hash algoritması kullanılır
  - Tüm entry objesi hash'lenir: `id`, `author`, `date`, `content`, `referenced_entries`
  - Entry'ler ID'ye göre sıralanarak deterministik hash üretilir
  - Referenced entries'ler de hash'e dahil edilir (nested yapı)
  - Aynı entry içeriğine sahip sourceEntries'ler aynı hash'i üretir
  - Aynı hash'li yeni scrape'ler mevcut kaydı günceller
  - Hash formatı: `sha256-{64 karakter hex string}` veya `empty` (boş array için)
- **Tek Kaynak vs Çoklu Kaynak:** 
  - Tek kaynak kayıtları: `sourceEntries` array'i var, `sourceScrapes` yok
  - Çoklu kaynak kayıtları: `sourceScrapes` array'i var, `sourceEntries` yok (referans bazlı)
  - Çoklu kaynak kayıtlarında `topicId`, `topicTitle`, `topicUrl` yok (birden fazla kaynak olduğu için)
- **Analizler:** Her analiz `analyses` array'ine eklenir. Farklı prompt'larla yapılan analizler ayrı kayıtlar.
- **Referanslar:** `(bkz: #entry_id)` formatındaki referanslar otomatik yüklenir.
- **Çoklu Kaynak Unique Identifier:** Çoklu kaynak kayıtlarında `sourceScrapes` içindeki `sourceEntriesHash`'ler sıralanıp birleştirilerek unique identifier oluşturulur.
- **Temizleme:** `historyRetentionDays`'e göre otomatik (0 = sınırsız).

**Kaynak:** `src/analysis-history.js`, `src/history.js`

### 2. `historyRetentionDays`
**Tip:** `number` | **Varsayılan:** `30` (gün)  
**Açıklama:** Analiz geçmişi saklama süresi.  
**Değerler:** `0` = sınırsız, `1-365` = gün cinsinden  
**Kaynak:** `src/analysis-history.js`, `src/history.js`

### 3. `eksi_ai_usage_stats`
**Tip:** `Object`  
**Yapı:**
```typescript
interface UsageStats {
    totals: {
        apiCalls: number;      // Toplam API çağrı sayısı
        totalTokens: number;   // Toplam token sayısı
        cacheHits: number;     // Cache'den gösterilen analiz sayısı
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
**Notlar:** 
- History max 100 kayıt (FIFO)
- İlk kullanımda sync'ten local'e migration yapılır (eski versiyonlardan kalan veri varsa)
- Sadece mevcut cihazda saklanır, senkronize edilmez
**Kaynak:** `src/stats.js`

---

## Veri İlişkileri

```
ScrapeRecord (Tek Kaynak)
├── sourceEntries (Entry[])
│   └── referenced_entries (Entry[])
└── analyses (Analysis[])
    ├── prompt (string)
    ├── response (string)
    └── modelId (string)

MultiSourceScrapeRecord (Çoklu Kaynak)
├── sourceScrapes (SourceScrape[])
│   ├── scrapeId (string) → ScrapeRecord.id
│   └── sourceEntriesHash (string) → ScrapeRecord.sourceEntriesHash
└── analyses (Analysis[])
    ├── prompt (string)
    ├── response (string)
    └── modelId (string)
```

---

## Veri Akışı

**Entry Scraping:**
1. Kullanıcı "Analiz Et" → `scraper.js` → Entry'ler toplanır
2. `analysis-history.js` → `saveToHistory({ scrapeOnly: true })`
3. `chrome.storage.local` → `scrapedData` güncellenir

**Analiz Yapma (Tek Scrape):**
1. Prompt seçimi → `api.js` → Gemini API isteği
2. `analysis-history.js` → `saveToHistory({ scrapeOnly: false, response: ... })`
3. `chrome.storage.local` → `scrapedData[].analyses[]` güncellenir
4. `stats.js` → `recordApiCall()` → `chrome.storage.local` güncellenir

**Çoklu Scrape Analizi:**
1. Geçmiş sayfasında birden fazla scrape seçilir
2. "Yeniden Analiz Et" → `history.js` → `runReanalysis()`
3. Gemini API isteği yapılır (birleştirilmiş entry'ler ile)
4. `history.js` → `saveToHistoryFromPage({ sourceScrapes: [...] })`
5. `chrome.storage.local` → `scrapedData[]` güncellenir (çoklu kaynak kaydı olarak, entry'ler kopyalanmaz, sadece referanslar)
6. `stats.js` → `recordApiCall()` → `chrome.storage.local` güncellenir

**Ayarları Kaydetme:**
1. Ayarlar değişikliği → `options.js` → `saveOptions()`
2. `chrome.storage.sync` → `geminiApiKey`, `selectedModel`, `prompts`, `theme` güncellenir

---

## Veri Boyutları ve Limitler

- **Sync Storage:** ~100 KB (tüm cihazlarda senkronize)
- **Local Storage:** Sınırsız (`unlimitedStorage` izni ile)
- **Stats History:** Max 100 kayıt (FIFO)
- **History Retention:** Varsayılan 30 gün (kullanıcı ayarlanabilir)

**Optimizasyon:**
- Preview alanları: `promptPreview` (100 karakter), `responsePreview` (200 karakter)
- Hash sistemi: SHA-256 ile tüm entry objesine hash yapılır, aynı entry içeriğine sahip setler için tek kayıt
- Referans bazlı çoklu kaynak: Entry'ler kopyalanmaz, sadece scrape referansları tutulur (`sourceScrapes` array'i)
- Otomatik temizleme: `historyRetentionDays`'e göre
- Sıralama: Analizler en yeniden en eskiye doğru sıralanır (timestamp'e göre)
- Birleştirilmiş yapı: Tek ve çoklu kaynak kayıtları aynı `scrapedData` array'inde tutulur

---

## Migration ve Uyumluluk

**Stats Migration:** İlk kullanımda `eksi_ai_usage_stats` sync→local taşınır (`src/stats.js - migrateStatsFromSync()`). Eski versiyonlardan kalan sync storage'daki veriler local'e taşınır. Local'de veri varsa migration yapılmaz.

**MultiScrapeAnalyses Migration:** Eski `multiScrapeAnalyses` verileri otomatik olarak `scrapedData`'ya taşınır (`src/history.js - migrateMultiScrapeAnalyses()`). Migration sayfa yüklendiğinde otomatik çalışır.

**Varsayılan Değerler:** Tüm storage key'leri için varsayılan değerler tanımlı. Key yoksa varsayılan kullanılır.

---

## Güvenlik ve Gizlilik

**Hassas Veriler:**
- `geminiApiKey`: Sync storage'da saklanır, sadece eklenti içinde kullanılır

**Veri Kapsamı:**
- **Sync:** Kullanıcı tercihleri (API key, model seçimi, prompt'lar, tema)
- **Local:** Scrape edilen entry'ler, analiz sonuçları, istatistikler (cihaz bazlı)

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
// history hem ScrapeRecord (tek kaynak) hem de MultiSourceScrapeRecord (çoklu kaynak) içerir
const recent = history.slice(0, 10);
// Tek kaynak kayıtları
const singleSource = history.filter(item => !item.sourceScrapes || item.sourceScrapes.length === 0);
// Çoklu kaynak kayıtları
const multiSource = history.filter(item => item.sourceScrapes && item.sourceScrapes.length > 0);
```

**Çoklu Scrape Analizi:**
```javascript
// Geçmiş sayfasında birden fazla scrape seçilip "Yeniden Analiz Et" yapıldığında
const selectedScrapes = [scrape1, scrape2, scrape3];
await saveToHistoryFromPage({
    prompt: "Bu başlıkları karşılaştır",
    response: "...",
    modelId: "gemini-2.5-flash",
    responseTime: 1500,
    sourceScrapes: selectedScrapes.map(s => ({
        scrapeId: s.id,
        sourceEntriesHash: s.sourceEntriesHash,
        topicTitle: s.topicTitle,
        topicUrl: s.topicUrl,
        topicId: s.topicId,
        entryCount: s.entryCount
    }))
});
// scrapedData storage'ına çoklu kaynak kaydı olarak kaydedilir
```

---

## Sorun Giderme

**Veri Kaybı:**
- Sync Storage: Chrome hesabına giriş kontrolü
- Local Storage: Eklenti izinleri kontrolü
- Retention Days: Geçmiş saklama süresi (0 = sınırsız)

**Quota Exceeded:**
- Local Storage: Eski analiz geçmişini veya istatistik geçmişini temizle
- Sync Storage: Ayarlar çok büyükse (nadir durum)
- Retention Days: Saklama süresini azalt

**Migration Sorunları:**
- Local storage'dan `eksi_ai_usage_stats` kontrolü
- Sync storage'da eski veri varsa (migration öncesi versiyonlardan) kontrol edilir ve local'e taşınır
- Gerekirse manuel taşıma

---

**Son Güncelleme:** 2025-12-10 | **Versiyon:** 2.2.0
