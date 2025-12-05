# Firefox Add-ons Yayınlama Rehberi

Bu rehber, Ekşi Sözlük AI Analiz eklentisini Firefox Add-ons'a (addons.mozilla.org) yayınlamak için adım adım talimatları içerir.

## Ön Hazırlık

### 1. Firefox Developer Hub Hesabı

1. [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)'a gidin
2. Firefox hesabınızla giriş yapın veya yeni hesap oluşturun
3. Geliştirici sözleşmesini kabul edin

### 2. Paket Oluşturma

Terminal'de proje dizininde şu komutu çalıştırın:

```bash
./package.sh firefox
```

Bu komut `eksi-ai-analiz-v{VERSION}-firefox.zip` dosyasını oluşturacaktır.

## Add-on Gönderimi

### Adım 1: Yeni Add-on Başlatma

1. [Submit a New Add-on](https://addons.mozilla.org/developers/addon/submit/distribution) sayfasına gidin
2. **"On this site"** seçeneğini seçin (AMO'da dağıtım için)
3. **"Continue"** butonuna tıklayın

### Adım 2: Dosya Yükleme

1. Oluşturduğunuz `eksi-ai-analiz-v{VERSION}-firefox.zip` dosyasını yükleyin
2. Kaynak kod (source code) istenmesi durumunda:
   - Bu eklenti obfuscate edilmemiş, doğrudan okunabilir kod içeriyor
   - Kaynak kod yüklemek zorunda değilsiniz
   - İsterseniz GitHub repo linkini paylaşabilirsiniz
3. **"Continue"** butonuna tıklayın

### Adım 3: Add-on Detayları

#### Temel Bilgiler
| Alan | Değer |
|------|-------|
| **Name** | Ekşi Sözlük AI Analiz |
| **Add-on URL** | `eksi-ai-analiz` |
| **Summary (Özet)** | Ekşi Sözlük başlıklarını analiz eden, özetleyen ve blog yazısı hazırlayan yapay zeka asistanı. |
| **Categories** | Productivity, Tools |

#### Açıklama (Description)

```
Ekşi Sözlük AI Analiz, Ekşi Sözlük başlıklarını Google Gemini AI kullanarak analiz etmenizi sağlayan bir Firefox eklentisidir.

## Özellikler

🔍 **Otomatik Entry Toplama**: Başlıktaki tüm entry'leri otomatik olarak toplar
📊 **AI Destekli Analiz**: Google Gemini AI ile içerik analizi yapar
📝 **Özet Çıkarma**: Entry'lerden kapsamlı özetler oluşturur
✍️ **Blog Yazısı**: Entry'lere dayalı blog yazısı hazırlar
💾 **JSON Dışa Aktarma**: Entry'leri JSON formatında indirir
🎨 **Karanlık Tema Desteği**: Ekşi Sözlük'ün karanlık temasıyla uyumlu

## Nasıl Kullanılır

1. Ekşi Sözlük'te bir başlık sayfasına gidin
2. "Entry'leri Analiz Et" butonuna tıklayın
3. Analiz tamamlandığında istediğiniz işlemi seçin

## Gereksinimler

- Google Gemini API anahtarı gereklidir (ücretsiz)
- API anahtarını eklenti ayarlarından ekleyebilirsiniz

## Gizlilik

Bu eklenti yalnızca eksisozluk.com sitesinde çalışır ve toplanan veriler sadece AI analizi için Google'ın Gemini API'sine gönderilir. Hiçbir veri başka bir yerde saklanmaz veya paylaşılmaz.

Kaynak kodu açıktır: https://github.com/erenseymen/eksi-ai-analiz
```

#### Etiketler (Tags)
- eksisozluk
- ai
- gemini
- analysis
- summary
- turkish

### Adım 4: Medya Dosyaları

#### İkon
- 128x128 PNG formatında ikon yükleyin
- Mevcut: `icons/icon128.png`

#### Ekran Görüntüleri
- En az 1 ekran görüntüsü gerekli
- Önerilen boyut: 1280x800 veya benzeri
- Mevcut: `images/screenshot_640x400.png`

### Adım 5: Teknik Bilgiler

#### İzinler Açıklaması

Firefox, kullanıcılara gösterilen izin açıklamalarını otomatik oluşturur. Ama inceleme sürecinde sorulursa:

| İzin | Açıklama |
|------|----------|
| `storage` | Kullanıcı ayarlarını (API key, tercihler) kaydetmek için |
| `https://eksisozluk.com/*` | Entry'leri okumak ve analiz butonunu eklemek için |
| `https://generativelanguage.googleapis.com/*` | Gemini AI API'sine istek göndermek için |

### Adım 6: Gönderim

1. Tüm bilgileri kontrol edin
2. **"Submit Version"** butonuna tıklayın

## İnceleme Süreci

### Beklenen Süre
- İlk inceleme: 1-5 iş günü (genellikle daha hızlı)
- Güncelleme incelemeleri: Genellikle 24 saat içinde

### İnceleme Kriterleri

Firefox eklenti incelemesi şunlara bakar:
1. **Güvenlik**: Zararlı kod içermiyor mu?
2. **Gizlilik**: Kullanıcı verilerini doğru işliyor mu?
3. **İşlevsellik**: Açıklandığı gibi çalışıyor mu?
4. **Kullanıcı Deneyimi**: Kullanıcıyı yanıltmıyor mu?

### Olası Red Nedenleri ve Çözümleri

| Sorun | Çözüm |
|-------|-------|
| Eksik gizlilik politikası | Repo'daki PRIVACY_POLICY.md linkini ekleyin |
| API key güvenliği endişesi | Key'in yalnızca kullanıcının cihazında saklandığını açıklayın |
| Host permissions | Neden bu sitelere erişim gerektiğini açıklayın |

## Güncelleme Yayınlama

### 1. Versiyon Numarasını Güncelleyin
Her iki manifest dosyasında:
- `manifest.json`
- `manifest.firefox.json`

### 2. Yeni Paket Oluşturun
```bash
./package.sh firefox
```

### 3. Güncelleme Yükleyin
1. [My Add-ons](https://addons.mozilla.org/developers/addons) sayfasına gidin
2. "Ekşi Sözlük AI Analiz" eklentisine tıklayın
3. **"Upload New Version"** butonuna tıklayın
4. Yeni ZIP dosyasını yükleyin
5. Değişiklik notları (changelog) ekleyin

## Faydalı Linkler

- [Firefox Extension Workshop](https://extensionworkshop.com/)
- [Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- [Manifest v3 Migration](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)
- [Add-on Developer Hub](https://addons.mozilla.org/developers/)
- [AMO Review Criteria](https://extensionworkshop.com/documentation/publish/add-on-policies/)

## Sorun Giderme

### İnceleme Reddedildi

1. Red nedenini dikkatlice okuyun
2. Gerekli düzeltmeleri yapın
3. Yeni versiyon yükleyin
4. İnceleme notlarına yanıt yazın

### API İzni Sorunu

Firefox bazen harici API erişimi için ek açıklama isteyebilir. Bu durumda:
- Gemini API'nin ne için kullanıldığını açıklayın
- Kullanıcı verilerinin nasıl işlendiğini belirtin

### Manifest Uyumluluk Sorunu

Firefox MV3 desteği Chrome'dan biraz farklı olabilir. Sorun yaşarsanız:
- `browser_specific_settings` alanını kontrol edin
- Minimum Firefox sürümünü güncelleyin

## Destek

Herhangi bir sorun için:
- GitHub Issues: https://github.com/erenseymen/eksi-ai-analiz/issues
- Firefox Add-ons Forumu: https://discourse.mozilla.org/c/add-ons/

