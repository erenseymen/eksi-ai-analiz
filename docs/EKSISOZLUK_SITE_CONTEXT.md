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

## Sayfa Yapıları ve Seçiciler (Selectors)

Eklenti geliştirme sürecinde kullanılan temel DOM seçicileri ve sayfa yapıları:

### Başlık Sayfası (`topic-page`)
- **URL**: `/baslik-adi--id`
- **Başlık**: `h1` veya `#topic h1`
- **Entry Listesi**: `#entry-item-list > li`
- **Entry İçeriği**: `.content` (HTML formatında, kısaltılmış URL'ler içerebilir)
- **Yazar**: `.entry-author` veya `a[href^="/biri/"]`
- **Tarih/Link**: `.entry-date` veya `a[href^="/entry/"]`
- **Sayfalama**: `.pager` elementi, `data-pagecount` ve `data-currentpage` attribute'ları

### Gündem Sayfası (`gundem-page`)
- **URL**: `/basliklar/gundem`
- **Navigasyon Başlığı**: `nav h2`
- **Başlık Linkleri**: `nav ul li a[href*="?a=popular"]` (Başlık adı ve popülerlik parametresi içerir)
- **Karakteristik**: Sol sidebar'daki popüler başlıkların listelendiği sayfa.

### DEBE Sayfası (`debe-page`)
- **URL**: `/debe`
- **Navigasyon Başlığı**: `nav h2`
- **Entry Linkleri**: `nav ul li a[href*="?debe=true"]`
- **Karakteristik**: Dünün en beğenilen entry'lerinin (Dünün En Beğenilen Entry'leri) listesi.

### Yazar Profil Sayfası (`author-page`)
- **URL**: `/biri/yazar-adi`
- **Yazar Adı**: `main h1`
- **Entry'ler Linki**: `a[href*="/son-entryleri?nick="]` (Yazarın tüm entry'lerine giden link)

## Eklenti Geliştirme İçin Önemli Notlar

### Selector'lar ve DOM Yapısı
- Entry içeriği çıkarılırken `.content` içindeki `<br>` etiketleri yeni satıra (`\n`) dönüştürülmelidir.
- Ekşi Sözlük uzun URL'leri link metninde `...` ile kısaltır; gerçek URL `href` attribute'undan alınmalıdır.
- "Gizli bakınız"lar (`*` işaretli linkler) `title` attribute'unda asıl referansı barındırır.

### Navigasyon ve Scraping
- Sayfalama `?p=N` parametresi ile yönetilir.
- `focusto=ID` parametresi, belirli bir entry'nin bulunduğu sayfaya odaklanmayı sağlar.
- Çok sayfalı başlıklarda her sayfa `fetch` edilerek entry'ler birleştirilir.

### Özel Durumlar
- **Uzun Entry'ler**: Bazı sayfalarda entry'ler "devamını okuyayım" butonu ile gizlenmiş olabilir, tam metin için entry'nin kendi sayfasına gidilmesi gerekebilir.
- **Tema Tespiti**: `document.body` üzerindeki arka plan rengi analiz edilerek Karanlık/Aydınlık mod tespiti yapılır.
- **Rate Limiting**: Çok fazla sayfayı ardarda fetch etmek `429 Too Many Requests` hatasına yol açabilir, exponential backoff kullanılmalıdır.

