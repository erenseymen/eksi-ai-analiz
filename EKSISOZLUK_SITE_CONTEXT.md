# Ekşi Sözlük Site Yapısı ve İçerik Analizi

## Genel Bilgiler
- **URL**: https://eksisozluk.com/
- **Başlık**: "ekşi sözlük - kutsal bilgi kaynağı"
- **Tür**: Kullanıcı tarafından oluşturulan içerik (UGC) platformu, sözlük formatı

## Ana Navigasyon Yapısı

### Üst Menü (Banner)
- **Logo**: "ekşi sözlük" linki (ana sayfaya götürür)
- **Arama Kutusu**: 
  - Placeholder: "başlık, #entry, @yazar"
  - "getir" butonu ile arama yapılır
  - Arama direkt başlık sayfasına yönlendirir
- **Giriş/Kayıt**: 
  - `/giris` - Giriş sayfası
  - `/kayit` - Kayıt sayfası

### Ana Navigasyon Linkleri
- **gündem**: `/basliklar/gundem` - Güncel popüler başlıklar
- **debe**: `/debe` - En beğenilen entry'ler
- **Kanallar**: 
  - `#spor`: `/basliklar/kanal/spor`
  - `#ilişkiler`: `/basliklar/kanal/iliskiler`
  - `#yaşam`: `/basliklar/kanal/yasam`
  - Daha fazla kanal için "kanallar" dropdown
- **Dış Linkler**:
  - "pena": YouTube kanalı
  - "ekşişeyler": https://eksiseyler.com

## Sayfa Yapıları

### Ana Sayfa (`/`)
- Sol sidebar: Gündem başlıkları listesi
  - Her başlık: başlık adı + entry sayısı
  - "daha da ..." linki ile sayfalama
- Ana içerik: Rastgele seçilmiş başlıklar ve entry'leri
  - Her başlık için birkaç entry gösterilir
  - Entry'ler kısaltılmış olabilir ("devamını okuyayım" linki)
- Sağ sidebar: Reklamlar, sosyal medya widget'ları

### Başlık Sayfası (`/baslik-adi--id`)
- **URL Formatı**: `/baslik-adi--id` (örn: `/yapay-zeka--42117`)
- **Başlık Başlığı**: H1 etiketi ile başlık adı
- **Şükela Filtresi**: 
  - Dropdown ile sayfa seçimi (1, 2, 3...)
  - Toplam sayfa sayısı gösterilir
- **Entry Listesi**:
  - Her entry bir `<li>` elementi
  - Entry içeriği (metin)
  - Entry metadata:
    - Yazar adı (link: `/biri/yazar-adi`)
    - Tarih (link: `/entry/entry-id`)
    - Yazar avatar (varsa)
  - Entry aksiyonları:
    - "share" - Paylaş
    - "diğer" - Diğer seçenekler
    - "şükela!" - Beğen
    - "çok kötü" - Beğenme
- **Sayfalama**: Alt kısımda sayfa navigasyonu

### Gündem Sayfası (`/basliklar/gundem`)
- Başlıklar listesi
- Her başlık için entry sayısı gösterilir
- Sayfalama: `?p=2` parametresi ile

### Arama
- Arama kutusuna yazılan terim direkt başlık sayfasına yönlendirir
- Eğer başlık bulunursa o başlığın sayfası açılır
- Arama sonuçları URL'de slug formatında: `/arama-terimi--id`

## Entry Yapısı

### Entry İçeriği
- Metin içeriği (HTML formatında)
- İç linkler: `(bkz: başlık adı)` formatında
- Entry linkleri: `/?q=baslik-adi` formatında
- Uzun entry'ler: "devamını okuyayım" butonu ile genişletilir

### Entry Metadata
- **Yazar**: `/biri/yazar-adi` linki
- **Tarih**: `/entry/entry-id` linki (tam entry sayfasına götürür)
- **Avatar**: Yazar profil resmi (varsa)
- **Oylama**: Şükela (beğen) / Çok kötü (beğenme) butonları

### Entry Aksiyonları
- Share (paylaş)
- Diğer (dropdown menü)
- Şükela! (beğen)
- Çok kötü (beğenme)

## URL Yapıları

### Başlık URL'leri
- Format: `/baslik-adi--id`
- Örnek: `/yapay-zeka--42117`
- Query parametreleri:
  - `?p=2` - Sayfa numarası
  - `?a=popular` - Popüler sıralama

### Entry URL'leri
- Format: `/entry/entry-id`
- Örnek: `/entry/165091532`

### Yazar Profil URL'leri
- Format: `/biri/yazar-adi`
- Örnek: `/biri/phi-fenomen`

### Kanal URL'leri
- Format: `/basliklar/kanal/kanal-adi`
- Örnek: `/basliklar/kanal/spor`

## Özel Özellikler

### Şükela Sistemi
- Entry'leri beğenme/beğenmeme sistemi
- Şükela filtresi ile en beğenilen entry'ler görüntülenebilir
- Sayfa bazlı filtreleme mevcut

### Debe
- En beğenilen entry'lerin listesi
- `/debe` sayfasında gösterilir

### Kanallar
- Konu bazlı başlık kategorileri
- Her kanal kendi sayfasına sahip
- Örnek kanallar: spor, ilişkiler, yaşam, siyaset, anket, vb.

### Ekşi Şeyler Entegrasyonu
- Bazı entry'lerde "ekşi şeyler'deki derlemeye git" linki
- https://eksiseyler.com adresine yönlendirir

## Reklam Yapısı
- Iframe içinde gösterilen reklamlar
- Sponsorlu içerikler "sponsorlu" etiketi ile işaretlenir
- Reklamlar sidebar ve içerik arasında yerleştirilir

## Footer
- İletişim, şeffaflık raporları, sözlük kuralları
- Reklam, kariyer, kullanım koşulları
- Gizlilik politikası, SSS, istatistikler
- Sosyal medya linkleri: Instagram, X (Twitter), Bluesky, Facebook

## Cookie/Gizlilik
- Cookie onay dialog'u mevcut
- "tümünü kabul et" / "tümünü reddet" seçenekleri
- Çerez politikası linki: `/entry/65310835`

## Teknik Detaylar

### HTML Yapısı
- Semantic HTML5 elementleri kullanılıyor
- `<main>`, `<nav>`, `<header>`, `<footer>` etiketleri
- Accessibility için ARIA ref'leri mevcut
- Responsive tasarım (iframe'ler mobil uyumlu)

### Entry Sayfalama
- Dropdown ile sayfa seçimi
- Toplam sayfa sayısı gösterilir
- "»" ile sonraki sayfaya geçiş
- URL'de `?p=2` parametresi ile sayfa değişimi

### Dinamik İçerik
- JavaScript ile dinamik yükleme
- Entry'ler "devamını okuyayım" ile genişletilebilir
- Sayfa navigasyonu AJAX ile çalışabilir

## Eklenti Geliştirme İçin Önemli Notlar

### Selector'lar
- Entry'ler: `list[ref=e216] > listitem` yapısında
- Başlık başlığı: `heading[level=1]` içinde
- Yazar linki: `/biri/yazar-adi` formatında
- Entry linki: `/entry/entry-id` formatında

### İçerik Çıkarma
- Entry metni: `generic[ref=e218]` veya benzeri içinde
- Yazar bilgisi: `link[href*="/biri/"]` ile bulunabilir
- Tarih: `link[href*="/entry/"]` ile bulunabilir

### Navigasyon
- Başlık linkleri: `link[href*="--"]` pattern'i ile bulunabilir
- Arama: Form submit ile çalışır
- Sayfalama: Query parametreleri ile (`?p=2`)

### Özel Durumlar
- Uzun entry'ler "devamını okuyayım" ile genişletilir
- Bazı entry'ler ekşi şeyler'e link içerir
- Reklamlar iframe içinde, bunlar filtrelenmeli
- Cookie dialog'u sayfa yüklendiğinde görünebilir

