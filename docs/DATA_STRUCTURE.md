# Veri Yapısı Dokümantasyonu

Bu dokümantasyon, Ekşi Sözlük AI Analiz eklentisinde kullanılan ve kaydedilen tüm verilerin yapısını açıklar.

## Genel Bakış

Eklenti verileri iki farklı Chrome Storage API'si kullanarak saklanır:

- **`chrome.storage.sync`**: Tüm cihazlarda senkronize edilen veriler (kullanıcı ayarları, istatistikler)
- **`chrome.storage.local`**: Sadece mevcut cihazda saklanan veriler (scrape edilen entry'ler, analiz geçmişi)

---

## Chrome Storage Sync (Senkronize Veriler)

Bu veriler kullanıcının Chrome hesabına bağlıdır ve tüm cihazlarda senkronize edilir.

### 1. `geminiApiKey`

**Tip:** `string`  
**Varsayılan:** `''` (boş string)  
**Açıklama:** Google Gemini API anahtarı. Kullanıcı tarafından ayarlar sayfasından girilir.

**Kullanım:**
```javascript
chrome.storage.sync.get(['geminiApiKey'], (items) => {
    const apiKey = items.geminiApiKey || '';
});
```

**Kaynak:** `src/settings.js`, `src/options.js`

---

### 2. `selectedModel`

**Tip:** `string`  
**Varsayılan:** `'gemini-2.5-flash'`  
**Açıklama:** Kullanıcının seçtiği Gemini model ID'si. Desteklenen modeller:
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`
- `gemini-3-pro-preview` (beta, ücretli)

**Kullanım:**
```javascript
chrome.storage.sync.get({
    selectedModel: 'gemini-2.5-flash'
}, (items) => {
    const model = items.selectedModel;
});
```

**Kaynak:** `src/settings.js`, `src/options.js`, `src/model-select.js`

---

### 3. `prompts`

**Tip:** `Array<{name: string, prompt: string}>`  
**Varsayılan:** `DEFAULT_PROMPTS` (src/prompts.js'den)  
**Açıklama:** Kullanıcının özelleştirdiği analiz prompt butonları. Her öğe bir buton ve prompt çiftini temsil eder.

**Yapı:**
```typescript
interface Prompt {
    name: string;    // Buton üzerinde görüntülenen metin
    prompt: string;  // Gemini API'ye gönderilen prompt metni
}
```

**Örnek:**
```json
[
    {
        "name": "Özet",
        "prompt": "Bu entry'leri analiz ederek kapsamlı bir özet hazırla..."
    },
    {
        "name": "Blog",
        "prompt": "Bu entry'lere dayalı, kapsamlı ve okunabilir bir blog yazısı yaz..."
    }
]
```

**Kullanım:**
```javascript
chrome.storage.sync.get({
    prompts: DEFAULT_PROMPTS
}, (items) => {
    const prompts = items.prompts || DEFAULT_PROMPTS;
});
```

**Kaynak:** `src/settings.js`, `src/options.js`, `src/prompts.js`

---

### 4. `theme`

**Tip:** `string`  
**Varsayılan:** `'auto'`  
**Olası Değerler:**
- `'auto'`: Sistem temasını takip eder
- `'light'`: Açık tema
- `'dark'`: Koyu tema

**Açıklama:** Ayarlar sayfasının tema tercihi.

**Kullanım:**
```javascript
chrome.storage.sync.get({
    theme: 'auto'
}, (items) => {
    const theme = items.theme || 'auto';
});
```

**Kaynak:** `src/options.js`

---

### 5. `optionsActiveTab`

**Tip:** `string`  
**Varsayılan:** `'api'`  
**Açıklama:** Ayarlar sayfasında son açık kalan tab ID'si. Sayfa yeniden yüklendiğinde bu tab otomatik olarak açılır.

**Olası Değerler:**
- `'api'`: API Ayarları tab'ı
- `'prompts'`: Prompt'lar tab'ı
- `'models'`: Modeller tab'ı
- `'stats'`: İstatistikler tab'ı

**Kullanım:**
```javascript
chrome.storage.sync.get('optionsActiveTab', (result) => {
    const activeTab = result.optionsActiveTab || 'api';
});
```

**Kaynak:** `src/options.js`

---

### 6. `eksi_ai_usage_stats`

**Tip:** `Object`  
**Varsayılan:** Aşağıdaki yapı  
**Açıklama:** API çağrıları, token kullanımı ve cache istatistikleri.

**Yapı:**
```typescript
interface UsageStats {
    totals: {
        apiCalls: number;      // Toplam API çağrı sayısı
        totalTokens: number;   // Toplam kullanılan token sayısı
        cacheHits: number;     // Cache'den gelen sonuç sayısı
    };
    history: Array<{
        timestamp: number;           // Unix timestamp (ms)
        modelId: string;             // Kullanılan model ID'si
        tokenEstimate: number;       // Tahmini token sayısı
        responseTime: number;        // Yanıt süresi (ms)
        fromCache: boolean;          // Cache'den mi geldi
        topicTitle: string;          // Analiz edilen başlık adı
    }>;
}
```

**Örnek:**
```json
{
    "totals": {
        "apiCalls": 42,
        "totalTokens": 125000,
        "cacheHits": 8
    },
    "history": [
        {
            "timestamp": 1704067200000,
            "modelId": "gemini-2.5-flash",
            "tokenEstimate": 3000,
            "responseTime": 2500,
            "fromCache": false,
            "topicTitle": "yapay zeka"
        }
    ]
}
```

**Notlar:**
- History en fazla 100 kayıt tutar (MAX_STATS_HISTORY = 100)
- Eski kayıtlar otomatik olarak silinir (FIFO)
- İlk kullanımda local storage'dan sync storage'a migration yapılır

**Kullanım:**
```javascript
const stats = await getUsageStats();
// veya
chrome.storage.sync.get('eksi_ai_usage_stats', (result) => {
    const stats = result.eksi_ai_usage_stats || {
        totals: { apiCalls: 0, totalTokens: 0, cacheHits: 0 },
        history: []
    };
});
```

**Kaynak:** `src/stats.js`

---

## Chrome Storage Local (Yerel Veriler)

Bu veriler sadece mevcut cihazda saklanır ve senkronize edilmez.

### 1. `scrapedData`

**Tip:** `Array<ScrapeRecord>`  
**Varsayılan:** `[]` (boş array)  
**Açıklama:** Scrape edilen entry'ler ve bu entry'lere yapılan analizler. Her unique entry seti için bir kayıt tutulur.

**Yapı:**
```typescript
interface ScrapeRecord {
    id: string;                    // Unique kayıt ID'si (örn: "scrape-1704067200000")
    sourceEntriesHash: string;     // Entry'lerden oluşturulan hash (unique identifier)
    topicId: string;               // Başlık ID'si (URL'den çıkarılır, örn: "12345")
    topicTitle: string;            // Başlık adı
    topicUrl: string;              // Başlık URL'si (tam URL)
    scrapedAt: string;             // ISO 8601 timestamp (örn: "2024-01-01T12:00:00.000Z")
    entryCount: number;            // Toplanan entry sayısı
    sourceEntries: Array<Entry>;   // Scrape edilen entry'ler
    wasStopped: boolean;           // İşlem yarıda kesildi mi
    analyses: Array<Analysis>;     // Bu entry'lere yapılan analizler
}

interface Entry {
    id: string;                    // Entry ID'si (örn: "123456")
    author: string;                // Entry yazarı
    date: string;                  // Entry tarihi (görüntülenen format)
    content: string;               // Entry içeriği (temizlenmiş, tam URL'lerle)
    referenced_entries?: Array<Entry>;  // Entry içinde referans verilen diğer entry'ler
}

interface Analysis {
    id: string;                    // Unique analiz ID'si (örn: "analysis-1704067200000")
    timestamp: string;             // ISO 8601 timestamp
    prompt: string;                // Kullanılan prompt metni (tam)
    promptPreview: string;         // Prompt önizlemesi (ilk 100 karakter)
    response: string;              // AI yanıtı (tam)
    responsePreview: string;       // Yanıt önizlemesi (ilk 200 karakter)
    modelId: string;               // Kullanılan model ID'si
    responseTime: number;          // Yanıt süresi (ms)
}
```

**Örnek:**
```json
[
    {
        "id": "scrape-1704067200000",
        "sourceEntriesHash": "hashabc123",
        "topicId": "12345",
        "topicTitle": "yapay zeka",
        "topicUrl": "https://eksisozluk.com/yapay-zeka--12345",
        "scrapedAt": "2024-01-01T12:00:00.000Z",
        "entryCount": 50,
        "wasStopped": false,
        "sourceEntries": [
            {
                "id": "123456",
                "author": "kullanici1",
                "date": "01.01.2024 12:00",
                "content": "Entry içeriği burada...",
                "referenced_entries": [
                    {
                        "id": "789012",
                        "author": "kullanici2",
                        "date": "31.12.2023 10:00",
                        "content": "Referans edilen entry içeriği..."
                    }
                ]
            }
        ],
        "analyses": [
            {
                "id": "analysis-1704067300000",
                "timestamp": "2024-01-01T12:01:40.000Z",
                "prompt": "Bu entry'leri analiz ederek kapsamlı bir özet hazırla...",
                "promptPreview": "Bu entry'leri analiz ederek kapsamlı bir özet hazırla...",
                "response": "Bu başlıkta yapay zeka konusu ele alınmış...",
                "responsePreview": "Bu başlıkta yapay zeka konusu ele alınmış...",
                "modelId": "gemini-2.5-flash",
                "responseTime": 2500
            }
        ]
    }
]
```

**Önemli Notlar:**

1. **Unique Hash Sistemi:**
   - Aynı entry seti için tek bir scrape kaydı tutulur
   - `sourceEntriesHash`, entry ID'lerinden oluşturulan bir hash'tir
   - Aynı hash'e sahip yeni scrape'ler mevcut kaydı günceller (scrapedAt, entryCount, vb.)

2. **Analiz Kayıtları:**
   - Her analiz, ilgili scrape kaydının `analyses` array'ine eklenir
   - Aynı entry'lere farklı prompt'larla yapılan analizler ayrı kayıtlar olarak saklanır

3. **Referans Entry'ler:**
   - Entry içinde `(bkz: #entry_id)` formatında referanslar varsa, bu entry'ler otomatik olarak yüklenir
   - `referenced_entries` array'inde tam entry objeleri saklanır

4. **Temizleme:**
   - `historyRetentionDays` ayarına göre eski kayıtlar otomatik temizlenir
   - 0 değeri sınırsız saklama anlamına gelir

**Kullanım:**
```javascript
chrome.storage.local.get({ scrapedData: [] }, (result) => {
    const scrapedData = result.scrapedData;
});
```

**Kaynak:** `src/analysis-history.js`, `src/history.js`

---

### 2. `historyRetentionDays`

**Tip:** `number`  
**Varsayılan:** `30` (gün)  
**Açıklama:** Analiz geçmişinin saklama süresi. Bu süreden eski kayıtlar otomatik olarak temizlenir.

**Özel Değerler:**
- `0`: Sınırsız saklama (temizleme yapılmaz)
- `1-365`: Gün cinsinden saklama süresi

**Kullanım:**
```javascript
chrome.storage.local.get({ 
    historyRetentionDays: 30 
}, (result) => {
    const retentionDays = result.historyRetentionDays;
});
```

**Kaynak:** `src/analysis-history.js`, `src/history.js`

---

## Veri İlişkileri

### Scrape ve Analiz İlişkisi

```
ScrapeRecord
├── sourceEntries (Entry[])
│   └── referenced_entries (Entry[])
└── analyses (Analysis[])
    ├── prompt (string)
    ├── response (string)
    └── modelId (string)
```

- Bir `ScrapeRecord`, bir veya daha fazla `Entry` içerir
- Her `Entry`, sıfır veya daha fazla `referenced_entries` içerebilir
- Bir `ScrapeRecord`, sıfır veya daha fazla `Analysis` içerebilir
- Her `Analysis`, bir `prompt` ve `response` içerir

### Flat History View

UI'da gösterim için `scrapedData` flat bir yapıya dönüştürülür:

```typescript
interface FlatHistoryItem {
    id: string;                    // Scrape ID veya Analysis ID
    timestamp: string;             // scrapedAt veya analysis.timestamp
    topicTitle: string;
    topicId: string;
    topicUrl: string;
    entryCount: number;
    sourceEntries: Array<Entry>;
    scrapeOnly: boolean;           // true = sadece scrape, false = analiz var
    wasStopped: boolean;
    prompt: string;                // Analysis varsa dolu, yoksa boş
    promptPreview: string;
    response: string;              // Analysis varsa dolu, yoksa boş
    responsePreview: string;
    modelId: string;               // Analysis varsa dolu, yoksa boş
    responseTime: number;          // Analysis varsa dolu, yoksa 0
}
```

---

## Veri Akışı

### 1. Entry Scraping

```
1. Kullanıcı "Analiz Et" butonuna tıklar
2. scraper.js → Entry'ler toplanır
3. analysis-history.js → saveToHistory({ scrapeOnly: true })
4. chrome.storage.local → scrapedData güncellenir
```

### 2. Analiz Yapma

```
1. Kullanıcı bir prompt seçer
2. api.js → Gemini API'ye istek gönderilir
3. analysis-history.js → saveToHistory({ scrapeOnly: false, response: ... })
4. chrome.storage.local → scrapedData[].analyses[] güncellenir
5. stats.js → recordApiCall() → chrome.storage.sync güncellenir
```

### 3. Ayarları Kaydetme

```
1. Kullanıcı ayarlar sayfasında değişiklik yapar
2. options.js → saveOptions()
3. chrome.storage.sync → geminiApiKey, selectedModel, prompts, theme güncellenir
```

---

## Veri Boyutları ve Limitler

### Chrome Storage Limitleri

- **Sync Storage:** ~100 KB (tüm cihazlarda senkronize)
- **Local Storage:** ~10 MB (cihaz bazlı)

### Eklenti İçi Limitler

- **Stats History:** En fazla 100 kayıt (MAX_STATS_HISTORY)
- **History Retention:** Varsayılan 30 gün (kullanıcı tarafından değiştirilebilir)

### Veri Optimizasyonu

1. **Preview Alanları:**
   - `promptPreview`: İlk 100 karakter
   - `responsePreview`: İlk 200 karakter
   - UI'da tam metin gösterilirken bu alanlar hızlı önizleme için kullanılır

2. **Hash Sistemi:**
   - Aynı entry setleri için tek kayıt tutulur
   - Gereksiz veri tekrarı önlenir

3. **Otomatik Temizleme:**
   - Eski kayıtlar `historyRetentionDays`'e göre otomatik silinir
   - Stats history FIFO mantığıyla yönetilir

---

## Migration ve Uyumluluk

### Stats Migration

İlk kullanımda `eksi_ai_usage_stats` local storage'dan sync storage'a taşınır:

```javascript
// src/stats.js - migrateStatsToSync()
// 1. Sync'te veri varsa migration yapılmaz
// 2. Local'de veri varsa sync'e taşınır
// 3. Local'deki veri silinir
```

### Varsayılan Değerler

Tüm storage key'leri için varsayılan değerler tanımlanmıştır. Eğer bir key mevcut değilse, varsayılan değer kullanılır:

```javascript
chrome.storage.sync.get({
    geminiApiKey: '',
    selectedModel: 'gemini-2.5-flash',
    prompts: DEFAULT_PROMPTS,
    theme: 'auto'
}, (items) => {
    // items her zaman dolu değerler içerir
});
```

---

## Güvenlik ve Gizlilik

### Hassas Veriler

- **`geminiApiKey`**: Kullanıcının Google Gemini API anahtarı
  - Sync storage'da saklanır (Chrome hesabına bağlı)
  - Sadece eklenti içinde kullanılır, dışarıya gönderilmez

### Veri Kapsamı

- **Sync Storage:** Kullanıcı tercihleri ve istatistikler (hassas veri: API key)
- **Local Storage:** Scrape edilen entry'ler ve analiz sonuçları (cihaz bazlı)

### Veri Temizleme

Kullanıcılar şu verileri temizleyebilir:
- Tüm analiz geçmişi (history sayfasından)
- İstatistikler (ayarlar sayfasından)
- API anahtarı (ayarlar sayfasından silinebilir)

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

## Örnek Kullanım Senaryoları

### Senaryo 1: Yeni Analiz Yapma

```javascript
// 1. Entry'leri topla
const entries = await scrapeEntries();

// 2. Scrape'i kaydet
await saveToHistory({
    scrapeOnly: true,
    topicTitle: "yapay zeka",
    topicId: "12345",
    entryCount: entries.length,
    sourceEntries: entries
});

// 3. Analiz yap
const response = await callGeminiAPI(prompt, entries);

// 4. Analizi kaydet
await saveToHistory({
    scrapeOnly: false,
    topicTitle: "yapay zeka",
    topicId: "12345",
    entryCount: entries.length,
    sourceEntries: entries,
    prompt: prompt,
    response: response.text,
    modelId: "gemini-2.5-flash",
    responseTime: response.time
});

// 5. İstatistik kaydet
await recordApiCall({
    modelId: "gemini-2.5-flash",
    tokenEstimate: response.tokens,
    responseTime: response.time,
    fromCache: false,
    topicTitle: "yapay zeka"
});
```

### Senaryo 2: Geçmişi Görüntüleme

```javascript
// Flat history al
const history = await getHistory();

// En yeni 10 kayıt
const recent = history.slice(0, 10);

// Sadece analiz içeren kayıtlar
const withAnalysis = history.filter(item => !item.scrapeOnly);
```

### Senaryo 3: Ayarları Yükleme

```javascript
// Tüm ayarları al
const settings = await getSettings();

// API key kontrolü
if (!settings.geminiApiKey) {
    console.log("API key girilmemiş");
}

// Prompt'ları kullan
settings.prompts.forEach(prompt => {
    console.log(`${prompt.name}: ${prompt.prompt}`);
});
```

---

## Sorun Giderme

### Veri Kaybı

Eğer veriler görünmüyorsa:

1. **Sync Storage:** Chrome hesabına giriş yapıldığından emin olun
2. **Local Storage:** Eklenti izinlerini kontrol edin
3. **Retention Days:** Geçmiş saklama süresini kontrol edin (0 = sınırsız)

### Veri Boyutu Sorunları

Eğer "Quota exceeded" hatası alınıyorsa:

1. **Local Storage:** Eski analiz geçmişini temizleyin
2. **Sync Storage:** İstatistik geçmişini temizleyin
3. **Retention Days:** Saklama süresini azaltın

### Migration Sorunları

Stats migration sırasında sorun yaşanırsa:

1. Local storage'dan `eksi_ai_usage_stats` key'ini kontrol edin
2. Sync storage'da aynı key'in olup olmadığını kontrol edin
3. Gerekirse manuel olarak taşıyın

---

## Güncelleme Notları

### v1.0.0
- İlk veri yapısı dokümantasyonu
- Sync ve local storage ayrımı
- Stats migration desteği

---

**Son Güncelleme:** 2024-01-01  
**Dokümantasyon Versiyonu:** 1.0.0

