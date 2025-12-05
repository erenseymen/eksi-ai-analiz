![Banner](images/banner.png)

# Ekşi Sözlük AI Analiz

Ekşi Sözlük başlıklarını yapay zeka ile analiz eden tarayıcı eklentisi.

**Desteklenen Tarayıcılar:** Chrome, Firefox, Edge, Brave

## Özellikler

- 🤖 Gemini AI ile özet ve blog yazısı oluşturma
- 📥 Entry'leri JSON olarak indirme  
- ✏️ Özel prompt desteği

## Kurulum

### Chrome / Edge / Brave

1. [GitHub Releases](https://github.com/erenseymen/eksi-ai-analiz/releases) sayfasından en son sürümün **chrome** zip dosyasını indirin
2. Zip dosyasını bir klasöre çıkarın
3. Tarayıcıda `chrome://extensions` (Edge için `edge://extensions`) sayfasına gidin
4. Sağ üstteki "Geliştirici Modu"nu açın
5. "Paketlenmemiş öğe yükle" butonuna tıklayın ve çıkardığınız klasörü seçin
6. [Google AI Studio](https://aistudio.google.com/app/api-keys)'dan API key alın
7. Eklenti ayarlarına API key'i girin

### Firefox

1. [GitHub Releases](https://github.com/erenseymen/eksi-ai-analiz/releases) sayfasından en son sürümün **firefox** zip dosyasını indirin
2. Firefox'ta `about:debugging#/runtime/this-firefox` sayfasına gidin
3. "Geçici Eklenti Yükle" butonuna tıklayın
4. İndirdiğiniz zip dosyasını seçin
5. [Google AI Studio](https://aistudio.google.com/app/api-keys)'dan API key alın
6. Eklenti ayarlarına API key'i girin

> **Not:** Geçici eklentiler Firefox kapatıldığında kaldırılır. Kalıcı kurulum için eklentinin Firefox Add-ons'ta yayınlanmasını bekleyin.

## Kullanım

1. Ekşi Sözlük başlığına gidin
2. "Entry'leri Analiz Et" butonuna tıklayın
3. Özet, Blog veya Özel Prompt seçin

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
├── src/
│   ├── content.js         # Ana içerik scripti (entry analiz, UI)
│   ├── constants.js       # Sabitler, promptlar ve model listesi
│   ├── options.html       # Ayarlar sayfası HTML
│   ├── options.js         # Ayarlar sayfası JS
│   ├── model-select.html  # Model seçim popup HTML
│   ├── model-select.js    # Model seçim popup JS
│   └── styles.css         # Stiller
├── icons/                 # Eklenti ikonları (16, 48, 128px)
└── images/               # Promosyon görselleri
```

## Gizlilik

Bu eklenti kullanıcı verilerini toplamaz. API anahtarı ve ayarlar yalnızca tarayıcınızda saklanır. Detaylar için [Gizlilik Politikası](PRIVACY_POLICY.md)'na bakın.

## Lisans

MIT
