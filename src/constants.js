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
- Entry'lerden kısa ve anlamlı alıntılar ekle (tırnak işareti ile)

## Link Formatı:
- Entry'lere referans verirken Markdown link formatı kullan: [link metni](https://eksisozluk.com/entry/entry_id)
- JSON'daki entry_id değerini kullanarak link oluştur
- Link metni entry'nin anahtar kelimesini veya bağlama uygun bir ifadeyi içersin

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
> - yazarın_adı - [tarih](https://eksisozluk.com/entry/entry_id)

Notlar:
- yazarın_adı, tarih ve entry_id değerlerini JSON verisinden al
- Tarih tıklanabilir link olsun

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

// Helper function to escape HTML (prevents XSS)
const escapeHtml = (str) => {
    if (!str) return '';
    // Browser environment check - if document is available use it, otherwise simple replace
    if (typeof document !== 'undefined') {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
