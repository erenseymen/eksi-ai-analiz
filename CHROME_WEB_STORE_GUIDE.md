# Chrome Web Store Yayınlama Rehberi

Bu rehber, Ekşi Sözlük AI Analiz eklentisini Chrome Web Store'a yayınlamak için gereken adımları içerir.

## Ön Hazırlık

### 1. Gerekli Dosyalar Kontrolü

✅ **Tamamlanması Gerekenler:**
- [x] `manifest.json` - Manifest V3 formatında
- [x] İkonlar (16x16, 48x48, 128x128) - Mevcut
- [ ] Gizlilik Politikası - Oluşturuldu (`PRIVACY_POLICY.md`)
- [ ] Store listing için ekran görüntüleri (1280x800 veya 640x400)
- [ ] Promosyon görseli (440x280) - Opsiyonel ama önerilir
- [ ] Küçük promosyon görseli (920x680) - Opsiyonel ama önerilir

### 2. Manifest.json Kontrolü

Manifest dosyanız Chrome Web Store gereksinimlerini karşılıyor:
- ✅ Manifest V3
- ✅ İsim, versiyon, açıklama mevcut
- ✅ İkonlar tanımlı
- ✅ Permissions ve host_permissions tanımlı

**Önerilen İyileştirmeler:**
- `homepage_url` eklenebilir (GitHub repository linki)
- `author` alanı eklenebilir

## Adım 1: Chrome Web Store Developer Dashboard'a Erişim

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) adresine gidin
2. Google hesabınızla giriş yapın
3. **$5 tek seferlik kayıt ücreti** ödemeniz gerekecek (henüz ödemediyseniz)

## Adım 2: Yeni Eklenti Oluşturma

1. Dashboard'da **"Yeni öğe"** (New Item) butonuna tıklayın
2. ZIP dosyanızı yükleyin (aşağıdaki "Paketleme" bölümüne bakın)
3. Eklenti yüklendikten sonra store listing bilgilerini doldurun

## Adım 3: Store Listing Bilgileri

### Zorunlu Alanlar:

#### 1. **Dil ve Bölge**
- **Varsayılan Dil:** Türkçe (tr)
- **Bölgeler:** Türkiye (veya "Tüm bölgeler")

#### 2. **Açıklama**
```
Özellikler:
🤖 Gemini AI ile özet ve blog yazısı oluşturma
✏️ Özel prompt
📥 Entry'leri JSON olarak indirme
🎯 Ekşi Sözlük'ün çeşitli sayfalarında doğru entry'leri toplar.

ℹ️ Google AI Studio'dan ücretsiz API anahtarı gerektirir.
```

#### 3. **Kategori**
- **Birincil Kategori:** Productivity (Üretkenlik) veya Social & Communication (Sosyal ve İletişim)

#### 4. **Görseller**
- **Ekran Görüntüleri:** En az 1, en fazla 5 adet
  - Boyut: 1280x800 veya 640x400 piksel
  - Format: PNG veya JPEG
  - İçerik: Eklentinin kullanımını gösteren ekran görüntüleri

**Önerilen Ekran Görüntüleri:**
1. Ana sayfa üzerinde "Entry'leri Analiz Et" butonu
2. Model seçim popup'ı
3. Analiz sonuçları (özet/blog)
4. Ayarlar sayfası

#### 5. **Gizlilik Politikası**
- Gizlilik politikası URL'si gerekli
- GitHub Pages, Netlify, Vercel veya benzeri bir serviste yayınlayın
- Veya `PRIVACY_POLICY.md` dosyasını bir web sayfasına dönüştürün

**Hızlı Çözüm:**
- GitHub repository'nizde `PRIVACY_POLICY.md` dosyasını oluşturun
- GitHub'ın raw URL'sini kullanın: `https://raw.githubusercontent.com/[USERNAME]/[REPO]/master/PRIVACY_POLICY.md`
- Veya GitHub Pages ile bir web sayfası oluşturun

#### 6. **Küçük Promosyon Görseli** (Opsiyonel ama önerilir)
- Boyut: 440x280 piksel
- Format: PNG veya JPEG

#### 7. **Büyük Promosyon Görseli** (Opsiyonel ama önerilir)
- Boyut: 920x680 piksel
- Format: PNG veya JPEG

## Adım 4: Gizlilik ve Güvenlik

### Veri Kullanımı Bildirimi

Chrome Web Store, eklentinizin veri kullanımını soracak. Aşağıdaki bilgileri kullanın:

**Kullanıcı verileri topluyor musunuz?**
- ✅ Evet

**Hangi verileri topluyorsunuz?**
- ✅ Kullanıcı tarafından sağlanan içerik (API anahtarları, özel prompt'lar)
- ✅ Web sayfası içeriği (Ekşi Sözlük entry'leri - yalnızca kullanıcı isteği üzerine)

**Verileri nasıl kullanıyorsunuz?**
- ✅ İşlevselliği sağlamak için (AI analizi)

**Verileri üçüncü taraflarla paylaşıyor musunuz?**
- ✅ Evet (Google Gemini API - kullanıcının kendi API anahtarı ile)

**Verileri nerede işliyorsunuz?**
- ✅ Kullanıcının cihazında (yerel olarak)

### İnceleme Sürecinde Sorulacak Sorular

Chrome Web Store inceleme sürecinde aşağıdaki sorular sorulacaktır. Bu sorulara verilecek cevaplar:

#### 1. Single Purpose Description
**Question:** An extension must have a single purpose that is narrow and easy-to-understand.

**Answer:**
```
This extension is designed to collect entries from Ekşi Sözlük topics and analyze, summarize, and create blog posts using Google Gemini AI.
```

#### 2. Storage Permission Justification
**Question:** Why does your extension need the "storage" permission?

**Answer:**
```
The extension requires the "storage" permission to save user settings:
- Google Gemini API key (provided by the user, stored unencrypted in chrome.storage.sync)
- Selected AI model preference (gemini-2.5-pro, gemini-2.5-flash, etc.)
- User-created custom prompt templates

This data is essential for the extension's core functionality and is used to personalize the user experience. The API key is obtained by the user from their own Google account and is only used for Gemini API calls.
```

#### 3. Host Permission Justification
**Question:** Why does your extension need host permissions?

**Answer:**
```
The extension uses two host permissions:

1. "https://eksisozluk.com/*"
   - Required to collect entries from Ekşi Sözlük topic pages
   - When the user clicks the "Analyze Entries" button, the extension scrapes entries from the page
   - Uses the fetch API to retrieve entry content, author information, and dates
   - Without this permission, the extension cannot perform its core function

2. "https://generativelanguage.googleapis.com/*"
   - Required to send requests to the Google Gemini AI API
   - Used to analyze, summarize, and create blog posts from entries using the user-provided API key
   - Without this permission, the AI analysis feature will not work

Both permissions are essential for the extension's core functionality and are not used for any other purpose.
```

#### 4. Remote Code Usage
**Question:** Are you using remote code? If yes, provide justification.

**Answer:**
```
No, the extension does not use remote code. All JavaScript code is contained within the extension package and loaded from the Chrome Web Store. The extension:

- Does not download or execute JavaScript code from remote servers
- Does not use eval() or similar dynamic code execution functions
- Does not inject scripts from remote sources

The extension only:
- Sends HTTP requests to the Google Gemini API (data transmission/reception)
- Retrieves data from Ekşi Sözlük pages (using the fetch API)

These API calls are not remote code execution, but only data exchange. All business logic and code is contained locally within the extension package.
```

## Adım 5: Paketleme

### ZIP Dosyası Oluşturma

Eklentiyi yayınlamak için bir ZIP dosyası oluşturmanız gerekir. ZIP dosyası şu dosyaları içermelidir:

```
eksi-ai-analiz.zip
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── background.js
    ├── content.js
    ├── model-select.html
    ├── model-select.js
    ├── options.html
    ├── options.js
    └── styles.css
```

**ÖNEMLİ:** ZIP dosyasına şunları EKLEMEYİN:
- ❌ `.git/` klasörü
- ❌ `README.md`, `PRIVACY_POLICY.md`, `CHROME_WEB_STORE_GUIDE.md` gibi dokümantasyon dosyaları
- ❌ `.gitignore`
- ❌ Test dosyaları
- ❌ Geliştirme araçları

### ZIP Oluşturma Komutu

Terminal'de şu komutu çalıştırın:

```bash
# Proje dizininde
zip -r eksi-ai-analiz.zip manifest.json icons/ src/ -x "*.git*" "*.md" "*.DS_Store"
```

Veya `package.sh` scriptini kullanın (aşağıda oluşturulacak).

## Adım 6: İnceleme Süreci

1. Tüm bilgileri doldurduktan sonra **"Değişiklikleri Kaydet"** butonuna tıklayın
2. **"İncelemeye Gönder"** butonuna tıklayın
3. İnceleme süreci genellikle **1-3 iş günü** sürer
4. İnceleme sonucu e-posta ile bildirilir

### İnceleme Reddedilirse

- Reddetme nedenini okuyun
- Gerekli düzeltmeleri yapın
- Yeni bir versiyon yükleyin ve tekrar gönderin

## Adım 7: Yayınlama Sonrası

1. Eklenti yayınlandıktan sonra kullanıcılar Chrome Web Store'dan yükleyebilir
2. Güncellemeler için yeni bir versiyon numarası ile ZIP yükleyin
3. Kullanıcı geri bildirimlerini takip edin

## Yararlı Linkler

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/devguide/)
- [Privacy Policy Requirements](https://developer.chrome.com/docs/webstore/user-data/)

## Sorun Giderme

### Yaygın Hatalar:

1. **"Manifest dosyası geçersiz"**
   - Manifest.json'u JSON validator ile kontrol edin
   - Tüm gerekli alanların dolu olduğundan emin olun

2. **"Gizlilik politikası gerekli"**
   - Gizlilik politikası URL'sinin erişilebilir olduğundan emin olun
   - URL'nin HTTPS ile başladığından emin olun

3. **"Ekran görüntüleri gerekli"**
   - En az 1 ekran görüntüsü yükleyin
   - Boyutların doğru olduğundan emin olun (1280x800 veya 640x400)

## Notlar

- İlk yayınlama ücretsizdir, ancak developer hesabı için $5 kayıt ücreti vardır
- Eklenti yayınlandıktan sonra güncellemeler ücretsizdir
- Chrome Web Store, eklentilerinizi otomatik olarak güncellemez - manuel olarak yeni versiyon yüklemeniz gerekir

