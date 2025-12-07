# Chrome Web Store Yayınlama Kontrol Listesi

## ✅ Hazır Olanlar

- [x] Manifest.json (Manifest V3 formatında)
- [x] Tüm gerekli ikonlar (16x16, 48x48, 128x128)
- [x] Gizlilik Politikası (`PRIVACY_POLICY.md`)
- [x] ZIP paketi oluşturuldu (`eksi-ai-analiz.zip`)

## ⚠️ Yapılması Gerekenler

### 1. Gizlilik Politikası Yayınlama
- [ ] Gizlilik politikasını bir web sayfasına yayınlayın
  - Seçenek 1: GitHub Pages
  - Seçenek 2: GitHub Raw URL (geçici çözüm)
  - Seçenek 3: Netlify, Vercel veya benzeri servis
- [ ] URL'yi not edin (Chrome Web Store'da kullanılacak)

### 2. Store Listing Görselleri
- [ ] **Ekran Görüntüleri** (zorunlu - en az 1 adet)
  - Boyut: 1280x800 veya 640x400 piksel
  - Format: PNG veya JPEG
  - İçerik önerileri:
    1. Ekşi Sözlük başlığında "Entry'leri Analiz Et" butonu
    2. Model seçim popup'ı
    3. Analiz sonuçları (özet/blog)
    4. Ayarlar sayfası

- [ ] **Küçük Promosyon Görseli** (opsiyonel ama önerilir)
  - Boyut: 440x280 piksel
  - Format: PNG veya JPEG

- [ ] **Büyük Promosyon Görseli** (opsiyonel ama önerilir)
  - Boyut: 920x680 piksel
  - Format: PNG veya JPEG

### 3. Chrome Web Store Developer Hesabı
- [ ] [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)'a giriş yapın
- [ ] $5 kayıt ücretini ödeyin (henüz ödemediyseniz)

### 4. Store Listing Bilgileri
- [ ] **Açıklama** (Türkçe)
- [ ] **Kategori** seçimi (Productivity veya Social & Communication)
- [ ] **Dil ve Bölge** ayarları
- [ ] **Gizlilik Politikası URL**'si

### 5. Veri Kullanımı Bildirimi
- [ ] Kullanıcı verileri topluyor musunuz? → **Evet**
- [ ] Hangi verileri topluyorsunuz?
  - ✅ Kullanıcı tarafından sağlanan içerik
  - ✅ Web sayfası içeriği
- [ ] Verileri nasıl kullanıyorsunuz? → **İşlevselliği sağlamak için**
- [ ] Verileri üçüncü taraflarla paylaşıyor musunuz? → **Evet (Google Gemini API)**
- [ ] Verileri nerede işliyorsunuz? → **Kullanıcının cihazında**

### 6. Yayınlama
- [ ] ZIP dosyasını yükleyin (`eksi-ai-analiz.zip`)
- [ ] Tüm store listing bilgilerini doldurun
- [ ] "İncelemeye Gönder" butonuna tıklayın
- [ ] İnceleme sonucunu bekleyin (1-3 iş günü)

## 📝 Hızlı Başvuru

### Store Listing Açıklaması (Kopyala-Yapıştır)

```
Özellikler:
🤖 Gemini AI ile özet ve blog yazısı oluşturma
✏️ Özel prompt
📥 Entry'leri JSON olarak indirme
🎯 Ekşi Sözlük'ün çeşitli sayfalarında doğru entry'leri toplama

ℹ️ Google AI Studio'dan ücretsiz API anahtarı gerektirir.
```

### Gizlilik Politikası URL (Geçici Çözüm)

GitHub repository'nizde `PRIVACY_POLICY.md` dosyası varsa, raw URL'yi kullanabilirsiniz:

```
https://raw.githubusercontent.com/[KULLANICI_ADI]/[REPO_ADI]/master/PRIVACY_POLICY.md
```

**Not:** Chrome Web Store, raw GitHub URL'lerini kabul eder, ancak daha profesyonel görünmesi için GitHub Pages kullanmanız önerilir.

## 🔗 Yararlı Linkler

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Google AI Studio (API Key)](https://aistudio.google.com/app/api-keys)

## ⚡ Hızlı Komutlar

### Yeni ZIP Paketi Oluşturma
```bash
./package.sh
```

### ZIP İçeriğini Kontrol Etme
```bash
unzip -l eksi-ai-analiz.zip
```

