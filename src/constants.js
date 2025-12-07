/**
 * @fileoverview Ekşi Sözlük AI Analiz - Sabit Değerler ve Yapılandırma
 * 
 * Bu dosya eklentinin tüm sabit değerlerini içerir:
 * - SYSTEM_PROMPT: Gemini API'ye gönderilen sistem promptu
 * - DEFAULT_PROMPTS: Varsayılan analiz butonları ve promptları
 * - MODELS: Desteklenen Gemini model listesi
 * - escapeHtml: XSS koruması için yardımcı fonksiyon
 * 
 * Bu dosya manifest.json'da content.js, options.js ve model-select.js'den
 * önce yüklenir, böylece tüm sabitler bu dosyalarda kullanılabilir.
 */

// =============================================================================
// SİSTEM PROMPTU
// =============================================================================

/**
 * Gemini API'ye gönderilen sistem promptu.
 * Model davranışını, çıktı formatını ve entry referans stilini belirler.
 * 
 * @constant {string}
 */
const SYSTEM_PROMPT = `Sen Ekşi Sözlük entry'lerini analiz eden bir yapay zeka asistanısın.

## Veri Formatı
Sana verilen entry'ler JSON formatındadır. Her entry şu alanları içerir:
- id: Entry'nin benzersiz kimliği
- author: Entry'yi yazan insan (yazar)
- date: Entry'nin yazılma zamanı
- content: Entry içeriği
- referenced_entries: (varsa) Entry içinde referans verilen diğer entry'lerin içerikleri

## Markdown Entry Linkleri
Cevabında entry'lere referans verebilirsin (alıntı yapabilirsin). Link formatı:
- URL formatı: https://eksisozluk.com/entry/{entry_id}
- entry_id değerini JSON verisindeki "id" alanından al
- Markdown link formatı: [açıklayıcı metin](https://eksisozluk.com/entry/{entry_id})
- "açıklayıcı metin" cevabında yer alan bir metin olmalıdır. "açıklayıcı metin" entry'nin içeriği ile alakalı olmalıdır.
- Örnek: [bu entry](https://eksisozluk.com/entry/000000001)`;

// =============================================================================
// VARSAYILAN PROMPTLAR
// =============================================================================

/**
 * Varsayılan analiz butonları ve promptları.
 * Kullanıcı ayarlarında özelleştirilebilir, sıfırlandığında bu değerlere döner.
 * 
 * Her prompt objesi şu alanları içerir:
 * - name: Buton üzerinde görüntülenen metin
 * - prompt: Gemini API'ye gönderilen prompt metni
 * 
 * @constant {Array<{name: string, prompt: string}>}
 */
const DEFAULT_PROMPTS = [
    {
        name: "Özet",
        prompt: `Bu entry'leri analiz ederek kapsamlı bir özet hazırla.

## Görev:
- Ana konuları ve tartışma başlıklarını belirle
- Farklı görüşler ve fikir ayrılıklarını dengeli bir şekilde sun
- Mizahi, ironik veya dikkat çekici entry'leri vurgula
- Özgün ve derinlemesine görüşleri öne çıkar
- Entry'lerin kronolojik veya tematik akışını göz önünde bulundur

## Format ve Dil:
- Markdown formatında yaz (başlıklar, listeler, vurgular kullan)
- Bilgi verici, tarafsız ve profesyonel bir dil kullan
- Akıcı ve okunabilir bir metin oluştur
- Gereksiz spekülasyon veya çıkarımdan kaçın
- Entry'lerden bol bol alıntı yap

## Çıktı:
- Yanıtın sadece özet metni olsun, ek açıklama veya meta bilgi içermesin.`
    },
    {
        name: "Blog",
        prompt: `Bu entry'lere dayalı, kapsamlı ve okunabilir bir blog yazısı yaz.

## Görev
Entry'lerdeki farklı görüşleri, deneyimleri, mizahı ve eleştirileri sentezleyerek, konuyu derinlemesine ele alan bir blog yazısı oluştur.

## Yazı Üslubu ve Stil
- Akıcı, samimi ve erişilebilir bir dil kullan
- Analitik ve düşündürücü ol, ancak akademik bir üsluptan kaçın
- Farklı perspektifleri dengeli bir şekilde sun
- Gerektiğinde örnekler, anekdotlar ve ilginç detaylar ekle
- Spekülasyondan kaçın, yalnızca entry'lerdeki bilgileri kullan

## İçerik Yapısı
1. Giriş: Konuyu kısa bir özetle tanıt ve entry'lerden çıkan ana temaları belirt
2. Gelişme: Farklı bakış açılarını, görüşleri ve deneyimleri kategorize ederek sun
3. Sonuç: Genel gözlemler ve öne çıkan noktaları özetle

## Alıntı Formatı
Her alıntı şu formatta olsun:
> Entry içeriği
> - yazar - [tarih](https://eksisozluk.com/entry/entry_id)

**Not:** Entry içeriğini kısaltabilirsin.

## Çıktı Formatı
- Yanıt YALNIZCA blog yazısı olsun (Markdown formatında)
- Başlık, alt başlıklar ve paragrafları uygun şekilde formatla
- Entry'lerden bol bol alıntı yap, farklı görüşleri yansıt
- Her alıntıda yazar, tarih ve link bilgilerini mutlaka ekle`
    },
    {
        name: "Şiir",
        prompt: `Şiir yaz`
    }
];

// =============================================================================
// GEMİNİ MODEL LİSTESİ
// =============================================================================

/**
 * Desteklenen Gemini model listesi.
 * Model seçimi sayfasında ve API çağrılarında kullanılır.
 * 
 * Her model objesi şu alanları içerir:
 * - id: API'de kullanılan model tanımlayıcısı
 * - name: Kullanıcıya gösterilen model adı (emoji ile)
 * - description: Model hakkında kısa açıklama
 * - cost: Maliyet bilgisi (ücretsiz/ücretli)
 * - contextWindow: Maksimum token kapasitesi
 * - responseTime: Tahmini yanıt süresi
 * - isFree: Free tier'da kullanılabilirlik durumu
 * 
 * @constant {Array<{id: string, name: string, description: string, cost: string, contextWindow: number, responseTime: string, isFree: boolean}>}
 */
const MODELS = [
    {
        id: 'gemini-3-pro-preview',
        name: '💎 Gemini 3 Pro Preview (Ücretli)',
        description: 'En yeni nesil model. Üstün performans, gelişmiş muhakeme ve çoklu modalite desteği.',
        cost: '💰 Ücretli (Free tier\'da kullanılamaz)',
        contextWindow: 1048576,
        responseTime: '~30-40 saniye',
        isFree: false
    },
    {
        id: 'gemini-2.5-pro',
        name: '⭐ Gemini 2.5 Pro (Önerilen)',
        description: 'Güçlü muhakeme yeteneği ve geniş bağlam penceresi. Karmaşık görevler ve derinlemesine analiz için güçlü model.',
        cost: '✅ Ücretsiz (Rate limit dahilinde)',
        contextWindow: 1048576,
        responseTime: '~30 saniye',
        isFree: true
    },
    {
        id: 'gemini-2.5-flash',
        name: '⚡ Gemini 2.5 Flash',
        description: 'Hız ve verimlilik için en iyi seçenek. Çoğu görev için ideal.',
        cost: '✅ Ücretsiz (Rate limit dahilinde)',
        contextWindow: 1048576,
        responseTime: '~20 saniye',
        isFree: true
    },
    {
        id: 'gemini-2.5-flash-lite',
        name: '⚡ Gemini 2.5 Flash-Lite',
        description: 'Maksimum hız, basit görevler için.',
        cost: '✅ Ücretsiz (En düşük maliyet)',
        contextWindow: 1048576,
        responseTime: '~10 saniye',
        isFree: true
    }
];

// =============================================================================
// YARDIMCI FONKSİYONLAR
// =============================================================================

/**
 * HTML özel karakterlerini escape eder (XSS koruması).
 * 
 * Tarayıcı ortamında document.createElement kullanır (daha güvenli),
 * Node.js ortamında string replace kullanır.
 * 
 * @param {string} str - Escape edilecek metin
 * @returns {string} HTML-safe metin
 * 
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Döndürür: '&lt;script&gt;alert("xss")&lt;/script&gt;'
 */
const escapeHtml = (str) => {
    if (!str) return '';
    
    // Tarayıcı ortamında DOM API kullan (daha güvenli ve hızlı)
    if (typeof document !== 'undefined') {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    // Node.js veya diğer ortamlarda manuel escape
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
