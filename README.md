# Ekşi Sözlük AI Analiz

Ekşi Sözlük başlıklarını analiz eden, özetleyen ve blog yazısı hazırlayan yapay zeka asistanı.

## Özellikler

- 📥 **Entry Toplama**: Başlıktaki tüm entry'leri otomatik toplar
- 💾 **JSON İndirme**: Toplanan verileri JSON formatında indirir
- 🤖 **AI Özeti**: Gemini AI ile akıllı özet oluşturur
- 📝 **Blog Yazısı**: Entry'lerden blog yazısı hazırlar
- ✏️ **Özel Prompt**: Kendi AI promptunuzu yazabilirsiniz
- 🛑 **Durdurma**: İşlemi istediğiniz zaman durdurabilirsiniz

## Kurulum

### 1. Eklentiyi Chrome'a Yükleme

1. Bu repoyu indirin veya klonlayın:
   ```bash
   git clone https://github.com/KULLANICIADI/eksi-ai-analiz.git
   ```

2. Chrome'da `chrome://extensions/` adresine gidin

3. Sağ üstteki "Geliştirici Modu"nu etkinleştirin

4. "Paketlenmemiş öğe yükle" butonuna tıklayın

5. `eksi-ai-analiz` klasörünü seçin

### 2. Gemini API Key Alma

1. [Google AI Studio](https://aistudio.google.com/app/apikey) sayfasına gidin
2. "Create API Key" butonuna tıklayın
3. API anahtarınızı kopyalayın
4. Eklenti ayarlarına gidin (sağ üst köşedeki eklenti ikonuna tıklayın)
5. API anahtarınızı yapıştırın ve kaydedin

## Kullanım

1. Herhangi bir Ekşi Sözlük başlığına gidin (örn: https://eksisozluk.com/galatasaray)

2. Başlık altında "Entry'leri Analiz Et" butonuna tıklayın

3. Entry'ler toplanırken bekleyin (istediğiniz zaman "Durdur" butonu ile durdurabilirsiniz)

4. İşlemler tamamlandığında şu seçenekler görünür:
   - **JSON İndir**: Toplanan entry'leri JSON dosyası olarak indirir
   - **Özet**: Gemini AI ile özet oluşturur
   - **Blog**: Entry'lerden blog yazısı hazırlar
   - **Özel Prompt**: Kendi promptunuzu yazabilirsiniz

## Teknik Detaylar

### Kullanılan Teknolojiler
- Chrome Extension Manifest V3
- Google Gemini 2.5 Flash API
- Vanilla JavaScript

### Dosya Yapısı
```
eksi-ai-analiz/
├── manifest.json          # Extension ayarları
├── src/
│   ├── content.js         # Ana işlevsellik
│   ├── styles.css         # Stil dosyası
│   ├── options.html       # Ayarlar sayfası
│   └── options.js         # Ayarlar mantığı
├── icons/                 # Eklenti ikonları
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Önemli Notlar

- **Hız Sınırlaması**: Sunucuya nazik olmak için sayfa geçişlerinde 500ms bekleme süresi var
- **Veri Güvenliği**: API anahtarınız Chrome'un senkronize depolama alanında saklanır
- **Durdurma**: İşlem sırasında istediğiniz zaman durdurabilirsiniz
- **Gemini Model**: `gemini-2.5-flash` modeli kullanılır (hızlı ve verimli)

## Sıkça Sorulan Sorular

### Gemini API ücretsiz mi?
Evet, Gemini API'nin ücretsiz bir kotası var. Detaylar için [Google AI Studio](https://aistudio.google.com/) sayfasına bakın.

### API anahtarım güvende mi?
API anahtarınız sadece sizin bilgisayarınızda, Chrome'un senkronize depolama alanında saklanır. Hiçbir yere gönderilmez.

### Tüm entry'leri toplamak ne kadar sürer?
Başlığın sayfa sayısına bağlı. Ortalama her sayfa için ~500ms bekleme var. 10 sayfalık bir başlık yaklaşık 5-7 saniye sürer.

### Eklenti neden Ekşi Sözlük'te çalışmıyor?
- Eklentinin kurulu ve etkin olduğundan emin olun
- Sayfayı yenileyin (F5)
- Chrome'u yeniden başlatın

### Gemini'den hata alıyorum
- API anahtarınızın doğru olduğundan emin olun
- Gemini API kotanızı kontrol edin
- İnternet bağlantınızı kontrol edin

## Sorumluluk Reddi

Bu proje kişisel kullanım içindir. Ekşi Teknoloji ile bağlantımız yoktur. 

## Lisans

MIT License
