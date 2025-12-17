/**
 * @fileoverview Ekşi Sözlük AI Analiz - Prompt Sabitleri
 * 
 * Bu dosya eklentinin tüm prompt'larını içerir:
 * - SYSTEM_PROMPT: Gemini API'ye gönderilen sistem promptu
 * - DEFAULT_PROMPTS: Varsayılan analiz butonları ve promptları
 * - TEST_PROMPTS: Model availability kontrolü için test prompt'ları
 * - getRandomTestPrompt: Rastgele test prompt'u seçici
 * 
 * Bu dosya manifest.json'da constants.js'den önce yüklenir.
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
- Açıklayıcı metin, entry'nin içeriğinden anlamlı bir kesit veya özetleyici bir ifade olmalıdır
- "bu entry", "bkz", "link" gibi genel ifadeler yerine, içeriği tanımlayan metinler kullan`;

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
- Spekülasyondan kaçın, yalnızca entry'lerdeki bilgileri kullan
- Entry'lerden bol bol alıntı yap

## Çıktı Kuralları:
1. Yanıtın EN BAŞINDA, aşağıdaki şablona birebir uyarak bir TL;DR bölümü oluştur.
2. Yanıtın geri kalanı bu bölümden sonra gelmelidir.
3. Yanıtın sadece özet metni olsun, giriş/çıkış konuşmaları ("İşte özetiniz" vb.) içermesin.
4. Yanıtın compact olsun.

## TL;DR Şablonu:
> **TL;DR:** [Buraya entry'lerin ana fikrini özetleyen 2-3 cümlelik metin gelecek]`
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
- Her alıntıda yazar, tarih ve link bilgilerini mutlaka ekle
- Yanıtın compact olsun.`
    },
    {
        name: "Şiir",
        prompt: `Şiir yaz`
    }
];

// =============================================================================
// TEST PROMPT'LARI
// =============================================================================

/**
 * Model availability kontrolü için kullanılan eğlenceli test prompt'ları.
 * Her prompt eklentiyi tanıtır ve eğlenceli bir soru/istek içerir.
 * 
 * @constant {Array<string>}
 */
const TEST_PROMPTS = [
    `Merhaba! Ben Ekşi Sözlük AI Analiz tarayıcı eklentisiyim. Ekşi Sözlük entry'lerini toplayıp Gemini AI ile analiz ediyorum. Kullanıcılar için özet, blog yazısı ve özel prompt'larla analiz yapabiliyorum. Şimdi bir test yapıyorum - bana kısa bir şaka yapabilir misin?`,

    `Selam! Ekşi Sözlük AI Analiz eklentisiyim. Ekşi Sözlük başlıklarındaki entry'leri toplayıp Gemini AI ile analiz ederek özet ve blog yazıları oluşturuyorum. Ayrıca kullanıcılar özel prompt'lar da yazabiliyor. Test için buradayım - bana 3 emoji ile bir hikaye anlatabilir misin?`,

    `Hey! Ben bir tarayıcı eklentisiyim ve Ekşi Sözlük entry'lerini yapay zeka ile analiz ediyorum. Gemini AI kullanarak entry'lerden özet, blog yazısı ve daha fazlasını oluşturuyorum. Şu anda model kontrolü yapıyorum - en sevdiğin programlama dilini ve nedenini kısaca söyleyebilir misin?`,

    `Merhaba Gemini! Ekşi Sözlük AI Analiz eklentisiyim. Ekşi Sözlük'teki entry'leri toplayıp seninle analiz ediyorum. Kullanıcılar için özet, blog ve özel prompt desteği sunuyorum. Test için buradayım - bana kısa bir haiku yazabilir misin? (5-7-5 hece)`,

    `Selam! Ben Ekşi Sözlük entry'lerini analiz eden bir tarayıcı eklentisiyim. Gemini AI ile çalışarak entry'lerden özet ve blog yazıları oluşturuyorum. Özel prompt desteğim de var. Şimdi bir test yapıyorum - bana bir tarayıcı eklentisi hakkında kısa bir şiir yazabilir misin?`,

    `Hey Gemini! Ekşi Sözlük AI Analiz eklentisiyim. Ekşi Sözlük başlıklarındaki entry'leri toplayıp seninle analiz ediyorum. Özet, blog ve özel prompt'lar ile kullanıcılara yardımcı oluyorum. Test için buradayım - bana yapay zeka hakkında komik bir one-liner söyleyebilir misin?`,

    `Merhaba! Ben Ekşi Sözlük entry'lerini analiz eden bir tarayıcı eklentisiyim. Gemini AI kullanarak entry'lerden özet, blog yazısı ve daha fazlasını oluşturuyorum. Kullanıcılar özel prompt'lar da yazabiliyor. Şu anda model kontrolü yapıyorum - bana "eklenti" kelimesiyle ilgili kısa bir kelime oyunu yapabilir misin?`,

    `Selam Gemini! Ekşi Sözlük AI Analiz eklentisiyim. Ekşi Sözlük'teki entry'leri toplayıp seninle analiz ediyorum. Özet, blog ve özel prompt desteği sunuyorum. Test için buradayım - bana bir AI asistanı ve bir tarayıcı eklentisinin sohbetini kısa bir diyalog olarak yazabilir misin?`
];

/**
 * Rastgele bir test prompt'u seçer.
 * 
 * @returns {string} Rastgele seçilmiş test prompt'u
 */
const getRandomTestPrompt = () => {
    return TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
};
