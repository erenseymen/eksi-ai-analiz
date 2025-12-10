# options.html User Feedback Analizi

## User Feedback Elementleri ve Trigger'ları

| # | Element ID/Selector | Feedback Tipi | Mesaj İçeriği | Trigger Fonksiyonu/Event | Satır (HTML) | Satır (JS) | Otomatik Gizlenme |
|---|---------------------|---------------|---------------|-------------------------|--------------|------------|-------------------|
| 1 | `#saveBtnStatus` | Loading | "API Key doğrulanıyor..." | `saveOptions()` - API key doğrulama başlangıcı | 2115 | 173-175 | - |
| 2 | `#saveBtnStatus` | Error | API key hata mesajı (örn: "API Key geçersiz") | `saveOptions()` - API key doğrulama hatası | 2115 | 184-191 | 5 saniye |
| 3 | `#saveBtnStatus` | Success | "Ayarlar kaydedildi." | `saveOptions()` - Başarılı kaydetme | 2115 | 216-223 | 3 saniye |
| 4 | `#saveBtnStatus` | Success | "Model \"{modelName}\" seçildi ve ayarlar kaydedildi." | `useModelInSettings()` - Model seçimi | 2115 | 1422-1429 | 3 saniye |
| 5 | `#apiKey` (input) | Visual (class) | `valid` class - Yeşil kenarlık | `validateApiKey()` - Başarılı doğrulama | 2118 | 117-118 | - |
| 6 | `#apiKey` (input) | Visual (class) | `invalid` class - Kırmızı kenarlık | `validateApiKey()` - Hata durumu | 2118 | 104-105, 129-130 | - |
| 7 | `#apiKeyError` | Error | Hata mesajı (gizli, kullanılmıyor) | `validateApiKey()` - Hata durumu | 2120 | 82-83, 108-109, 120-121, 133-134 | - |
| 8 | `#modelSelectionStatus` | Success | "Model \"{modelName}\" seçildi ve kaydedildi." | `populateModelSelect()` - Model kartı tıklama | 2143 | 441-448 | 2 saniye |
| 9 | `#modelInfo` | Info | Model bilgisi (isim, açıklama, maliyet, yanıt süresi, bağlam penceresi) | `useModelInSettings()` - Model seçimi | 2144 | 1392-1401 | - |
| 10 | `#allModelsStatus` | Info | Tüm modellerin API durumu container'ı | `updateAllModelsStatus()` - Model durum kontrolü | 2146-2148 | 519-537 | - |
| 11 | `#modelsStatusList` | Info/Error | Her model için durum (✅ Kullanılabilir, ⚠️ Quota aşıldı, ❌ Kullanılamıyor) | `updateAllModelsStatus()` - Model kontrolü | 2148 | 540-726 | - |
| 12 | `#status` | Success | "Buton silindi ve ayarlar kaydedildi." | `removePrompt()` - Prompt silme | 2234 | 1651-1656 | 3 saniye |
| 13 | `#status` | Success | "Butonlar varsayılan değerlere sıfırlandı ve ayarlar kaydedildi." | `resetPrompts()` - Prompt sıfırlama | 2234 | 1684-1689 | 3 saniye |
| 14 | `#status` | Success | "Tema kaydedildi." | `setupThemeSelector()` - Tema değişimi | 2234 | 1711-1718 | 2 saniye |
| 15 | `#status` | Success | "İstatistikler sıfırlandı." | `setupClearStatsButton()` - İstatistik sıfırlama | 2234 | 2063-2068 | 3 saniye |
| 16 | `#modalStatusSummary` | Loading | "⏳ Kontrol ediliyor..." | `compareModelsWithStreaming()` - Model karşılaştırma başlangıcı | 2243 | 1152 | - |
| 17 | `#modalStatusSummary` | Success | "✅ {count} model başarıyla test edildi" | `compareModelsWithStreaming()` - Başarılı testler | 2243 | 1263, 1369 | - |
| 18 | `#modalStatusSummary` | Mixed | "✅ {successCount} başarılı, ❌ {errorCount} hata" | `compareModelsWithStreaming()` - Karma sonuçlar | 2243 | 1265, 1371 | - |
| 19 | `#copySystemPromptBtn` | Success | "✓ Kopyalandı" (buton metni) | `copySystemPrompt()` - Başarılı kopyalama | 2167 | 1852-1857 | 2 saniye |
| 20 | `#copySystemPromptBtn` | Error | "✗ Hata" (buton metni) | `copySystemPrompt()` - Kopyalama hatası | 2167 | 1859-1864 | 2 saniye |
| 21 | `.model-comparison-status` | Loading | "⏳ Kontrol ediliyor..." | `compareModelsWithStreaming()` - Model test başlangıcı | - | 561 | - |
| 22 | `.model-comparison-status` | Success | "✅ Kullanılabilir" | `compareModelsWithStreaming()` - Başarılı test | - | 610 | - |
| 23 | `.model-comparison-status` | Error | "❌ Kullanılamıyor" | `compareModelsWithStreaming()` - Test hatası | - | 707 | - |
| 24 | `.model-comparison-response` | Error | Formatlanmış hata mesajı (quota, rate limit, vb.) | `compareModelsWithStreaming()` - API hatası | - | 1344 | - |
| 25 | `#statsTotalCalls` | Info | Toplam API çağrı sayısı | `loadAndDisplayStats()` - Sayfa yükleme | 2181 | 2011 | - |
| 26 | `#statsTotalTokens` | Info | Toplam token sayısı (formatlanmış) | `loadAndDisplayStats()` - Sayfa yükleme | 2185 | 2012 | - |
| 27 | `#statsCacheHits` | Info | Toplam cache hit sayısı | `loadAndDisplayStats()` - Sayfa yükleme | 2189 | 2013 | - |
| 28 | `#stats24hCalls` | Info | Son 24 saat API çağrı sayısı | `loadAndDisplayStats()` - Sayfa yükleme | 2197 | 2016 | - |
| 29 | `#stats24hCache` | Info | Son 24 saat cache hit sayısı | `loadAndDisplayStats()` - Sayfa yükleme | 2198 | 2017 | - |
| 30 | `#stats24hTokens` | Info | Son 24 saat token sayısı (formatlanmış) | `loadAndDisplayStats()` - Sayfa yükleme | 2199 | 2018 | - |
| 31 | `#statsModelUsage` | Info | Model kullanım istatistikleri (span'ler) | `loadAndDisplayStats()` - Sayfa yükleme | 2205 | 2023-2028 | - |
| 32 | `#statsHistoryBody` | Info | Son 10 API çağrısı tablosu | `loadAndDisplayStats()` - Sayfa yükleme | 2223 | 2034-2044 | - |

## Trigger Event'leri

| Event | Element | Fonksiyon | Açıklama |
|-------|---------|-----------|----------|
| `click` | `#saveBtn` | `saveOptions()` | Kaydet butonuna tıklama |
| `keydown` (Enter) | `#apiKey` | `saveOptions()` | API key input'unda Enter tuşu |
| `blur` | `#apiKey` | `validateApiKey()` | API key input'undan çıkış |
| `click` | `.model-select-card` | `selectModel()` (populateModelSelect içinde) | Model kartına tıklama |
| `click` | `.use-model-btn` | `useModelInSettings()` | "Bu modeli kullan" butonuna tıklama |
| `click` | `#addBtn` | `addPrompt()` | Yeni buton ekleme |
| `click` | `.delete-btn` | `removePrompt()` | Prompt silme butonu |
| `click` | `#resetBtn` | `resetPrompts()` | Prompt sıfırlama butonu |
| `change` | `#themeSelect` | `setupThemeSelector()` | Tema seçimi değişimi |
| `click` | `#copySystemPromptBtn` | `copySystemPrompt()` | Sistem promptu kopyalama |
| `click` | `.model-select-card-comparison` | `compareModelsWithStreaming()` | Modelleri karşılaştır kartı |
| `click` | `#customPromptBtn` | `showCustomPromptInput()` | Özel prompt butonu |
| `click` | `#clearStatsBtn` | `setupClearStatsButton()` | İstatistik sıfırlama |

## Feedback Kategorileri

### 1. Başarı Mesajları (Success)
- `#saveBtnStatus` - Ayarlar kaydedildi
- `#saveBtnStatus` - Model seçildi
- `#modelSelectionStatus` - Model seçildi
- `#status` - Buton silindi/sıfırlandı/tema kaydedildi/istatistikler sıfırlandı
- `#modalStatusSummary` - Model testleri başarılı
- `#copySystemPromptBtn` - Kopyalama başarılı

### 2. Hata Mesajları (Error)
- `#saveBtnStatus` - API key doğrulama hatası
- `#apiKey` (input) - Geçersiz API key (görsel)
- `#modalStatusSummary` - Model test hataları
- `#copySystemPromptBtn` - Kopyalama hatası
- `.model-comparison-response` - API hata mesajları

### 3. Bilgilendirme Mesajları (Info)
- `#modelInfo` - Model detayları
- `#allModelsStatus` - Tüm modellerin durumu
- `#modelsStatusList` - Model durum listesi
- İstatistik elementleri (statsTotalCalls, statsTotalTokens, vb.)

### 4. Yükleme Durumları (Loading)
- `#saveBtnStatus` - API key doğrulanıyor
- `#modalStatusSummary` - Kontrol ediliyor
- `.model-comparison-status` - Model test ediliyor

## Otomatik Gizlenme Süreleri

| Element | Süre | Durum |
|---------|------|-------|
| `#saveBtnStatus` (error) | 5 saniye | Hata mesajı |
| `#saveBtnStatus` (success) | 3 saniye | Başarı mesajı |
| `#modelSelectionStatus` | 2 saniye | Model seçimi |
| `#status` | 2-3 saniye | Genel mesajlar |
| `#copySystemPromptBtn` | 2 saniye | Kopyalama feedback'i |

## Notlar

1. `#apiKeyError` elementi HTML'de tanımlı ancak JavaScript'te kullanılmıyor (her zaman `display: none`).
2. Tüm feedback'ler `options.js` dosyasında yönetiliyor.
3. Modal içindeki feedback'ler (`#modalStatusSummary`) dinamik olarak güncelleniyor.
4. İstatistik feedback'leri sayfa yüklendiğinde otomatik olarak `loadAndDisplayStats()` ile dolduruluyor.
5. Model durum feedback'leri (`#allModelsStatus`) sadece API key girildiğinde ve manuel kontrol edildiğinde gösteriliyor.

