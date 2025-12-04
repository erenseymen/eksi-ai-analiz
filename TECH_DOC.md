# Ekşi Sözlük AI Analiz - Teknik Dokümantasyon

## Token Kapasite Hesaplaması

### Metodoloji

Gemini modellerinin kaç entry işleyebileceğini tahmin etmek için aşağıdaki metodoloji kullanılmıştır:

#### 1. Veri Toplama
- **Tarih:** 4 Aralık 2025
- **Kaynak:** eksisozluk.com
- **Örneklem:** 10 farklı başlık
- **Toplam Entry:** 100 entry (her başlıktan ilk 10 entry)

#### 2. Analiz Sonuçları
- **Toplam Karakter:** 32,830 karakter
- **Ortalama Entry Uzunluğu:** 328.3 karakter/entry

#### 3. Token Hesaplama Formülü

```javascript
const AVG_CHAR_PER_ENTRY = 328;
const CHARS_PER_TOKEN = 4; // Yaklaşık değer (GPT tokenizer standardı)
const TOKENS_PER_ENTRY = Math.ceil(AVG_CHAR_PER_ENTRY / CHARS_PER_TOKEN) + 20;
// +20: JSON metadata overhead (id, author, date, content fields)
```

**Sonuç:** Her entry yaklaşık **102 token** kullanır.

#### 4. Model Kapasiteleri

| Model | Context Window | Tahmini Kapasite |
|-------|----------------|------------------|
| Gemini 2.5 Flash | 1,000,000 token | ~9,800 entry |
| Gemini 3.0 Pro | 1,000,000 token | ~9,800 entry |
| Gemini 2.5 Pro | 2,000,000 token | ~19,600 entry |
| Gemini 2.5 Flash-Lite | 1,000,000 token | ~9,800 entry |

**Hesaplama:**
```
Kapasite = Math.floor(contextWindow / TOKENS_PER_ENTRY)
```

### Varsayımlar ve Kısıtlamalar

1. **Karakter-Token Oranı:** 1 token ≈ 4 karakter (İngilizce için standart, Türkçe için biraz farklı olabilir)
2. **Metadata Overhead:** Her entry için +20 token (JSON yapısı için)
3. **Prompt Overhead:** Kullanıcının prompt'u ve sistem mesajları için ek token kullanımı hesaba katılmamıştır
4. **Gerçek Kullanım:** Gerçek token kullanımı entry içeriğine göre değişebilir (özel karakterler, emoji, link vb.)

### Öneriler

- **Güvenli Kullanım:** Hesaplanan kapasitenin %80'i kadar entry işlemek önerilir
- **Büyük Başlıklar:** Çok sayfalı başlıklar için kullanıcıya uyarı gösterilebilir
- **Model Seçimi:** 
  - Hızlı analizler için: Gemini 2.5 Flash
  - Büyük başlıklar için: Gemini 2.5 Pro (2M token)
  - Derinlemesine analiz için: Gemini 3.0 Pro

### Gelecek İyileştirmeler

1. Gerçek token sayımı için Gemini tokenizer kullanımı
2. Farklı başlık kategorilerinde entry uzunluğu analizi
3. Dinamik kapasite uyarıları (scraping sırasında)
4. Kullanıcıya kalan token bilgisi gösterimi
