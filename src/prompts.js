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
        prompt: `Bu entry'leri analiz ederek kapsamlı ve compact bir özet hazırla.

## Görev:

- Ana konuları ve tartışma başlıklarını belirle.
- Farklı görüşler ve fikir ayrılıklarını dengeli bir şekilde sun.
- Mizahi, ironik veya dikkat çekici entry'leri vurgula.
- Özgün ve derinlemesine görüşleri öne çıkar.
- Entry'lerin kronolojik veya tematik akışını göz önünde bulundur.
- Entry'lerden bol bol alıntı yap.

## Format ve Dil Kuralları:

- Markdown Yapısı: Başlıklar (iki veya üç hashtag kullanarak), listeler ve kalın yazılar kullan.
- Dil: Bilgi verici ve tarafsız bir üslup benimse.
- Kısıtlamalar: Giriş veya çıkış cümleleri (örneğin: İşte hazırladığım özet gibi) asla ekleme. Doğrudan özetle başla.
- Compact Yapı: Metni gereksiz uzatmalardan kaçınarak bilgiyi yoğun bir şekilde sun.

## Çıktı Yapısı (KESİN KURAL):

Yanıtın mutlaka büyüktür işareti ile başlayan bir blokla (Markdown blockquote formatı) başlamalıdır. Başka hiçbir başlangıç formatı kabul edilemez.

Örnek Başlangıç Şablonu:

> **TL;DR:** [Buraya entrylerin ana noktalarını birkaç cümleyle özetleyen metin gelecek.]

(Yukarıdaki TL;DR bloğundan sonra bir satır boşluk bırak ve ana özet metnine geç.)`
    },
    {
        name: "Blog",
        prompt: `Bu entry'lere dayalı, kapsamlı ve compact bir blog yazısı yaz.

## Görev
Entry'lerdeki farklı görüşleri, deneyimleri, mizahı ve eleştirileri sentezleyerek, konuyu derinlemesine ele alan bir blog yazısı oluştur.

## Yazı Üslubu ve Stil
- Akıcı, samimi ve erişilebilir bir dil kullan
- Analitik ve düşündürücü ol, ancak akademik bir üsluptan kaçın
- Farklı perspektifleri dengeli bir şekilde sun
- Gerektiğinde örnekler, anekdotlar ve ilginç detaylar ekle
- Spekülasyondan kaçın, yalnızca entry'lerdeki bilgileri kullan
- Compact Yapı: Metni gereksiz uzatmalardan kaçınarak bilgiyi yoğun bir şekilde sun.

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
        name: "Tartışmalı",
        prompt: `Bu entry'lerdeki tartışmalı ve karşıt görüşleri analiz et.

## Görev:
- Entry'lerdeki farklı bakış açılarını ve fikir ayrılıklarını tespit et
- Karşıt görüşleri dengeli bir şekilde sun
- Hangi konularda uzlaşı, hangi konularda ayrışma olduğunu belirt
- Eleştiri ve savunma argümanlarını kategorize et

## Çıktı Formatı:
1. **Temel Tartışma Noktaları**: Ana anlaşmazlık konuları
2. **Karşıt Görüşler Tablosu**: Farklı tarafların argümanları
3. **Ortak Zemin**: Üzerinde anlaşılan noktalar
4. **Sonuç**: Genel değerlendirme

Entry'lerden bol bol alıntı yap ve kaynak göster.`
    },
    {
        name: "Mizah",
        prompt: `Bu entry'lerdeki en komik, ironik ve esprili içerikleri derle.

## Görev:
- En güldürücü ve zekice yazılmış entry'leri seç
- İronileri ve ince espriyapanları vurgula
- Sözcük oyunlarını ve kelime şakalarını belirt
- Komik anekdot ve hikayeleri özetle

## Çıktı Formatı:
Her komik entry için:
- Entry'nin komik kısmını alıntıla
- Neden komik olduğunu kısaca açıkla
- Yazar ve link bilgisini ekle

En iyiden başlayarak sırala. Minimum 5, maksimum 15 entry seç.`
    },
    {
        name: "Bilgi",
        prompt: `Bu entry'lerdeki bilgilendirici ve faydalı içerikleri çıkar.

## Görev:
- Somut bilgi, tavsiye ve deneyim paylaşımlarını tespit et
- Pratik önerileri ve nasıl yapılır bilgilerini derle
- Kaynak ve referansları listele
- Uzman görüşlerini ve profesyonel tavsiyeleri vurgula

## Çıktı Formatı:
1. **Temel Bilgiler**: Konuyla ilgili faktlar
2. **Pratik Tavsiyeler**: Uygulanabilir öneriler
3. **Deneyim Paylaşımları**: Gerçek yaşam deneyimleri
4. **Kaynaklar**: Referans verilen linkler ve kaynaklar

Entry'lerden alıntılarla destekle.`
    },
    {
        name: "Duygu Analizi",
        prompt: `Bu entry'lerin duygusal tonunu analiz et.

## Görev:
- Her entry'nin duygusal tonunu belirle (pozitif/negatif/nötr)
- Genel duygu dağılımını yüzdelik olarak hesapla
- En pozitif ve en negatif entry'leri vurgula
- Zaman içinde duygu değişimini analiz et (tarihlere göre)

## Çıktı Formatı:
1. **Duygu Dağılımı**:
   - 😊 Pozitif: %X
   - 😐 Nötr: %Y
   - 😞 Negatif: %Z

2. **En Pozitif Entry'ler**: (Top 3, alıntılarla)
3. **En Negatif Entry'ler**: (Top 3, alıntılarla)
4. **Zamana Göre Trend**: Duygu değişimi analizi
5. **Öne Çıkan Duygular**: Öfke, hayal kırıklığı, umut, heyecan vb.

Sonuçları görselleştirmek için emoji ve semboller kullan.`
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
