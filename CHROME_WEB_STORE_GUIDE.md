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
Ekşi Sözlük başlıklarını yapay zeka ile analiz eden, özetleyen ve blog yazısı hazırlayan Chrome eklentisi.

Özellikler:
🤖 Gemini AI ile özet ve blog yazısı oluşturma
📥 Entry'leri JSON olarak indirme
✏️ Özel prompt desteği
⚙️ Farklı AI modelleri arasında seçim yapma

Kullanım:
1. Ekşi Sözlük başlığına gidin
2. "Entry'leri Analiz Et" butonuna tıklayın
3. Özet, Blog veya özel prompt seçin

Not: Bu eklenti kendi Google Gemini API anahtarınızı kullanır. API anahtarı almak için Google AI Studio'yu ziyaret edin.
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

