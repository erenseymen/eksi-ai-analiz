/**
 * @fileoverview Ekşi Sözlük AI Analiz - Yardımcı Fonksiyonlar
 * 
 * Bu dosya genel amaçlı yardımcı fonksiyonları içerir:
 * - Önbellek yönetimi
 * - Yeniden deneme (retry) stratejileri
 * - Token hesaplama
 * - Dosya adı temizleme
 * 
 * Bağımlılıklar: Yok (ilk yüklenen modül)
 */

// =============================================================================
// GLOBAL DURUM DEĞİŞKENLERİ
// =============================================================================

/** @type {Array<Object>} Toplanan tüm entry'lerin listesi */
let allEntries = [];

/** @type {string} Mevcut başlığın adı */
let topicTitle = "";

/** @type {string} Mevcut başlığın ID'si */
let topicId = "";

/** @type {boolean} Entry toplama işleminin durdurulup durdurulmayacağını belirten bayrak */
let shouldStopScraping = false;

/** @type {string|null} Son kullanılan özel prompt (önbellek için) */
let lastCustomPrompt = null;

// =============================================================================
// ÖNBELLEK YÖNETİMİ
// =============================================================================

/** @type {Map<string, Object>} Gemini yanıtları için önbellek (anahtar: prompt, değer: yanıt) */
let responseCache = new Map();

/** @type {number} Önbellekteki maksimum yanıt sayısı (bellek sızıntısını önlemek için) */
const MAX_CACHE_SIZE = 50;

/**
 * Önbelleğe güvenli bir şekilde yanıt ekler.
 * 
 * Maksimum boyut aşılırsa en eski girişi siler (FIFO).
 * 
 * @param {string} key - Önbellek anahtarı (genellikle prompt)
 * @param {Object} value - Önbellek değeri (yanıt, model bilgisi vb.)
 */
const addToCache = (key, value) => {
    // Maksimum boyut aşıldıysa en eski girişi sil
    if (responseCache.size >= MAX_CACHE_SIZE) {
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
    }
    responseCache.set(key, value);
};

// =============================================================================
// YENİDEN DENEME STRATEJİSİ
// =============================================================================

/** @type {number} Maksimum yeniden deneme sayısı (ağ hataları için) */
const MAX_RETRIES = 3;

/**
 * Geçici ağ hataları için yeniden deneme yapar.
 * 
 * Exponential backoff stratejisi kullanır (1s, 2s, 4s).
 * Abort hataları ve quota hataları yeniden denenmez.
 * 
 * @param {Function} fn - Çalıştırılacak async fonksiyon
 * @param {number} [retries=MAX_RETRIES] - Maksimum deneme sayısı
 * @returns {Promise<*>} Fonksiyonun sonucu
 * @throws {Error} Tüm denemeler başarısız olursa
 */
const retryWithBackoff = async (fn, retries = MAX_RETRIES) => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            // Abort hataları yeniden denenmez
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                throw err;
            }
            // Quota hataları yeniden denenmez
            if (err.message?.includes('quota') || err.message?.includes('429')) {
                throw err;
            }
            // Son deneme ise hatayı fırlat
            if (attempt === retries - 1) {
                throw err;
            }
            // Exponential backoff ile bekle (1s, 2s, 4s)
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
    }
};

// =============================================================================
// TOKEN HESAPLAMA
// =============================================================================

/**
 * Entry verilerinden tahmini token sayısını hesaplar.
 * 
 * Gemini tokenizer yaklaşık olarak:
 * - Türkçe için ~4 karakter = 1 token
 * - JSON yapısı ve metadata için ek ~20% overhead
 * 
 * @param {Array} entries - Entry listesi
 * @returns {{charCount: number, tokenEstimate: number}} Karakter ve tahmini token sayısı
 */
const estimateTokens = (entries) => {
    const entriesJson = JSON.stringify(entries);
    const charCount = entriesJson.length;
    // Türkçe için yaklaşık 4 karakter = 1 token, JSON overhead için %20 ekle
    const tokenEstimate = Math.ceil(charCount / 4 * 1.2);
    return { charCount, tokenEstimate };
};

/**
 * Token sayısını okunabilir formatta döndürür.
 * 
 * @param {number} tokens - Token sayısı
 * @returns {string} Formatlanmış string (örn: "38.5K")
 */
const formatTokenCount = (tokens) => {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
};

// =============================================================================
// DOSYA İŞLEMLERİ
// =============================================================================

/**
 * Dosya adını geçerli karakterlerle temizler.
 * 
 * Windows ve diğer işletim sistemlerinde geçersiz olan karakterleri
 * alt çizgi ile değiştirir.
 * 
 * @param {string} name - Temizlenecek dosya adı
 * @returns {string} Güvenli dosya adı
 */
const sanitizeFilename = (name) => {
    if (!name) return '';
    return name
        .replace(/[\\/:*?"<>|]/g, '_')  // Windows'ta geçersiz karakterleri değiştir
        .replace(/_+/g, '_')            // Ardışık alt çizgileri teke indir
        .replace(/^\s+|\s+$/g, '')      // Baş ve sondaki boşlukları temizle
        .replace(/^_+|_+$/g, '');       // Baş ve sondaki alt çizgileri temizle
};

// =============================================================================
// HASH FONKSİYONLARI
// =============================================================================

/**
 * sourceEntries array'inden unique hash oluşturur.
 * 
 * Tüm entry objesini (id, author, date, content, referenced_entries) SHA-256 ile hash'ler.
 * Entry'ler ID'ye göre sıralanarak deterministik hash üretilir.
 * Aynı entry içeriğine sahip sourceEntries'ler aynı hash'i üretir.
 * 
 * @param {Array} sourceEntries - Entry array'i
 * @returns {Promise<string>} SHA-256 hash string (hex formatında)
 */
const createSourceEntriesHash = async (sourceEntries) => {
    if (!sourceEntries || sourceEntries.length === 0) {
        return 'empty';
    }

    // Entry'leri ID'ye göre sırala (deterministik sıralama için)
    const sortedEntries = [...sourceEntries]
        .filter(entry => entry && entry.id) // null/undefined ve id kontrolü
        .sort((a, b) => {
            // ID'leri string olarak karşılaştır
            const idA = String(a.id);
            const idB = String(b.id);
            return idA.localeCompare(idB);
        });

    if (sortedEntries.length === 0) {
        return 'empty';
    }

    // Her entry'yi normalize et ve serialize et
    // Tüm alanları dahil et: id, author, date, content, referenced_entries
    const serializedEntries = sortedEntries.map(entry => {
        const normalizedEntry = {
            id: entry.id || '',
            author: entry.author || '',
            date: entry.date || '',
            content: entry.content || '',
            referenced_entries: entry.referenced_entries || []
        };
        // Referenced entries'leri de normalize et
        if (normalizedEntry.referenced_entries && normalizedEntry.referenced_entries.length > 0) {
            normalizedEntry.referenced_entries = normalizedEntry.referenced_entries
                .map(refEntry => ({
                    id: refEntry.id || '',
                    author: refEntry.author || '',
                    date: refEntry.date || '',
                    content: refEntry.content || ''
                }))
                .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        }
        return normalizedEntry;
    });

    // JSON string'e çevir (deterministik için space olmadan)
    const jsonString = JSON.stringify(serializedEntries);

    // SHA-256 hash hesapla
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(jsonString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        
        // ArrayBuffer'ı hex string'e çevir
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return `sha256-${hashHex}`;
    } catch (error) {
        console.error('SHA-256 hash hesaplama hatası:', error);
        // Fallback: basit hash (eski yöntem)
        let hash = 0;
        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `fallback-${Math.abs(hash).toString(36)}`;
    }
};
