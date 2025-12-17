![Banner](images/banner.png)

# Ekşi Sözlük AI Analiz

Ekşi Sözlük başlıklarını yapay zeka ile analiz eden tarayıcı eklentisi.

**Desteklenen Tarayıcılar:** Chrome, Firefox, Edge, Brave

## Özellikler

- 🤖 Gemini AI ile özet ve blog yazısı oluşturma
- ✏️ Özel prompt
- 📥 Entry'leri JSON olarak indirme
- 🎯 Ekşi Sözlük'ün çeşitli sayfalarında doğru entry'leri toplama

## Kurulum

### Chrome / Edge / Brave

**Önerilen Yöntem (Chrome Web Store):**

1. [Chrome Web Store](https://chromewebstore.google.com/detail/ek%C5%9Fi-s%C3%B6zl%C3%BCk-ai-analiz/fjlkfppkffdjpcaegojbeeojjleohlpa)'dan eklentiyi yükleyin
2. [Google AI Studio](https://aistudio.google.com/app/api-keys)'dan API key alın
3. Eklenti ayarlarına API key'i girin

> **Alternatif (Geliştirici Kurulumu):** [GitHub Releases](https://github.com/erenseymen/eksi-ai-analiz/releases) sayfasından en son sürümün **chrome** zip dosyasını indirip `chrome://extensions` (Edge için `edge://extensions`) sayfasından geliştirici modu ile yükleyebilirsiniz.

### Firefox

1. [Firefox Add-ons](https://addons.mozilla.org/tr/firefox/addon/eksi-ai-analiz/) sayfasından eklentiyi yükleyin
2. [Google AI Studio](https://aistudio.google.com/app/api-keys)'dan API key alın
3. Eklenti ayarlarına API key'i girin

> **Alternatif (Geliştirici Kurulumu):** [GitHub Releases](https://github.com/erenseymen/eksi-ai-analiz/releases) sayfasından **firefox** zip dosyasını indirip `about:debugging#/runtime/this-firefox` sayfasından geçici olarak yükleyebilirsiniz.

## Kullanım

1. Ekşi Sözlük başlığına gidin
2. "Entry'leri Analiz Et" butonuna tıklayın
3. Özet, Blog veya Özel Prompt seçin

## Entry Toplama Davranışı

Eklenti, farklı URL tiplerine göre entry'leri toplar:

### Başlık Sayfası (`/baslik-adi--id`)

| URL Formatı | Açıklama | Toplanan Entry'ler |
|-------------|----------|-------------------|
| `/baslik--123` | Standart başlık | Tüm sayfalar, ilk entry'den son entry'ye |
| `/baslik--123?p=5` | Belirli sayfa | 5. sayfadan itibaren son sayfaya kadar |
| `/baslik--123?focusto=456` | Odaklanmış entry | Entry #456'dan itibaren son entry'ye kadar |
| `/baslik--123?day=2025-01-15` | Günlük filtre | O güne ait tüm entry'ler |
| `/baslik--123?a=nice` | Şükela | "Güzel" olarak işaretlenmiş entry'ler |
| `/baslik--123?a=dailynice` | Günün en beğenilenleri | O günün en beğenilen entry'leri |
| `/baslik--123?a=popular` | Gündem | Gündemdeki entry'ler |
| `/baslik--123?a=find&keywords=...` | Başlık içi arama | Aranan kelimeyi içeren entry'ler |

> **Not:** Filtreler birleştirilebilir. Örn: `?a=nice&day=2025-01-15`

### Entry Sayfası (`/entry/id`)

Tek entry sayfasında sadece o entry analiz edilir.

## Geliştirici Notları

### Paket Oluşturma

```bash
# Her iki tarayıcı için paket oluştur
./package.sh

# Sadece Chrome paketi
./package.sh chrome

# Sadece Firefox paketi
./package.sh firefox
```

### Proje Yapısı

```
├── manifest.json           # Chrome/Edge/Brave manifest (MV3)
├── manifest.firefox.json   # Firefox manifest (MV2)
├── generate-icons.sh       # İkon oluşturma scripti
├── package.sh             # Paketleme scripti
├── src/
│   ├── analysis-history.js # Geçmiş ve depolama yönetimi
│   ├── api.js             # Gemini API servisi
│   ├── constants.js       # Sabitler ve yapılandırma
│   ├── content.js         # Ana içerik scripti (Entry point)
│   ├── history.html       # Geçmiş sayfası HTML
│   ├── history.js         # Geçmiş sayfası JS
│   ├── markdown.js        # Markdown işleyicisi
│   ├── model-select.html  # Model seçim popup HTML
│   ├── model-select.js    # Model seçim popup JS
│   ├── options.html       # Ayarlar sayfası HTML
│   ├── options.js         # Ayarlar sayfası JS
│   ├── page-detector.js   # Sayfa tipi tespiti
│   ├── prompts.js         # Prompt şablonları
│   ├── scraper.js         # Sayfa veri kazıyıcısı
│   ├── settings.js        # Ayar yönetimi
│   ├── stats.js           # İstatistik ve kullanım takibi
│   ├── styles.css         # UI stilleri
│   ├── ui.js              # Arayüz ve etkileşim mantığı
│   └── utils.js           # Yardımcı fonksiyonlar
├── icons/                 # Eklenti ikonları
├── images/                # Promosyon görselleri
└── docs/                  # Dökümanlar
```

## Gizlilik

Bu eklenti kullanıcı verilerini toplamaz. API anahtarı ve ayarlar yalnızca tarayıcınızda saklanır. Detaylar için [Gizlilik Politikası](docs/PRIVACY_POLICY.md)'na bakın.

## Lisans

MIT
