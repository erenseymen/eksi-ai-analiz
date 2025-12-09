/**
 * @fileoverview Ekşi Sözlük AI Analiz - Sabit Değerler, Yapılandırma ve API Yardımcı Fonksiyonları
 * 
 * Bu dosya eklentinin sabit değerlerini ve ortak API fonksiyonlarını içerir:
 * - MODELS: Desteklenen Gemini model listesi
 * - escapeHtml: XSS koruması için yardımcı fonksiyon
 * - checkModelAvailability: Model availability ve quota kontrolü için ortak fonksiyon
 * 
 * Prompt tanımları için bkz: prompts.js
 * 
 * Bu dosya manifest.json'da prompts.js'den sonra, content.js, options.js ve 
 * model-select.js'den önce yüklenir.
 */

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
 * - apiVersion: Kullanılacak API versiyonu (v1 veya v1beta)
 * 
 * @constant {Array<{id: string, name: string, description: string, cost: string, contextWindow: number, responseTime: string, isFree: boolean, apiVersion: string}>}
 */
const MODELS = [
    {
        id: 'gemini-3-pro-preview',
        name: '⭐ Gemini 3 Pro Preview',
        description: 'Yeni nesil model, gelişmiş muhakeme yeteneği',
        cost: '💰 Ücretli (Free tier\'da kullanılamaz)',
        contextWindow: 1048576,
        responseTime: '~30-40 saniye',
        isFree: false,
        apiVersion: 'v1beta'
    },
    {
        id: 'gemini-2.5-pro',
        name: '⭐ Gemini 2.5 Pro',
        description: 'Güçlü muhakeme yeteneği',
        cost: '💰 Ücretli (Free tier\'da kullanılamaz)',
        contextWindow: 1048576,
        responseTime: '~30 saniye',
        isFree: false,
        apiVersion: 'v1'
    },
    {
        id: 'gemini-2.5-flash',
        name: '⚡ Gemini 2.5 Flash',
        description: 'Muhakeme yeteneği olan en iyi ücretsiz seçenek',
        cost: '✅ Ücretsiz',
        contextWindow: 1048576,
        responseTime: '~20 saniye',
        isFree: true,
        apiVersion: 'v1'
    },
    {
        id: 'gemini-2.5-flash-lite',
        name: '⚡ Gemini 2.5 Flash-Lite',
        description: 'Maksimum hız, basit görevler için',
        cost: '✅ Ücretsiz (En hızlı)',
        contextWindow: 1048576,
        responseTime: '~10 saniye',
        isFree: true,
        apiVersion: 'v1'
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

// =============================================================================
// API YARDIMCI FONKSİYONLARI
// =============================================================================

/**
 * Model availability ve quota durumunu kontrol eder.
 * 
 * Önce model listesinden kontrol eder, sonra eğlenceli bir test isteği yaparak
 * quota durumunu kontrol eder. Başarılı cevap gelirse cevabı da döndürür.
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} modelId - Kontrol edilecek model ID'si
 * @param {boolean} [checkQuota=true] - Quota kontrolü yapılsın mı (opsiyonel)
 * @returns {Promise<{available: boolean, quotaExceeded?: boolean, error?: string, response?: string}>} Model availability durumu ve test cevabı
 * 
 * @example
 * const result = await checkModelAvailability('AIza...', 'gemini-2.5-pro');
 * if (result.available && !result.quotaExceeded) {
 *     console.log('Model kullanılabilir');
 *     if (result.response) {
 *         console.log('Test cevabı:', result.response);
 *     }
 * }
 */
const checkModelAvailability = async (apiKey, modelId, checkQuota = true) => {
    if (!apiKey || !apiKey.trim()) {
        return { available: false, error: 'API Key bulunamadı' };
    }

    try {
        // Model bazlı API versiyonu belirleme (constants.js'den al)
        const model = MODELS.find(m => m.id === modelId);
        const apiVersion = model?.apiVersion || 'v1';

        // Model listesinden kontrol et
        const modelsUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`;
        const modelsResponse = await fetch(modelsUrl);

        if (!modelsResponse.ok) {
            const errorData = await modelsResponse.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || 'Model listesi alınamadı';
            return { available: false, error: errorMsg };
        }

        const modelsData = await modelsResponse.json();
        const modelExists = modelsData.models?.some(m => {
            // Model adı formatı: "models/gemini-2.5-pro" veya "gemini-2.5-pro"
            const modelName = m.name.replace('models/', '');
            return modelName === modelId;
        });

        if (!modelExists) {
            return { available: false, error: 'Model bulunamadı veya erişilemiyor' };
        }

        // Model mevcut, quota kontrolü yap
        if (checkQuota) {
            try {
                // Eğlenceli bir test isteği yaparak quota durumunu kontrol et
                // Sistem prompt'u da gönderiliyor (normal API çağrılarıyla aynı)
                const testPrompt = getRandomTestPrompt();
                const testUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:generateContent?key=${apiKey}`;
                
                // Request body oluştur - sistem prompt'u da ekle
                let requestBody;
                
                if (apiVersion === 'v1beta') {
                    // v1beta: systemInstruction alanını kullan
                    requestBody = {
                        systemInstruction: {
                            parts: [{ text: SYSTEM_PROMPT }]
                        },
                        contents: [{
                            parts: [{ text: testPrompt }]
                        }]
                    };
                } else {
                    // v1: system instruction'ı prompt'un başına ekle
                    const combinedPrompt = `${SYSTEM_PROMPT}\n\n${testPrompt}`;
                    requestBody = {
                        contents: [{
                            parts: [{ text: combinedPrompt }]
                        }]
                    };
                }
                
                const testResponse = await fetch(testUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (testResponse.ok) {
                    // Quota yeterli, cevabı al
                    const testData = await testResponse.json();
                    const responseText = testData.candidates?.[0]?.content?.parts?.[0]?.text || '';

                    return {
                        available: true,
                        quotaExceeded: false,
                        response: responseText.trim()
                    };
                } else {
                    const errorData = await testResponse.json().catch(() => ({}));
                    const errorMsg = errorData.error?.message || 'Test isteği başarısız';

                    // Quota/rate limit hatalarını kontrol et
                    if (errorMsg.includes('quota') || errorMsg.includes('Quota exceeded') ||
                        errorMsg.includes('rate limit') || errorMsg.includes('Rate limit') ||
                        errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
                        return { available: true, quotaExceeded: true, error: 'Quota limiti aşıldı' };
                    }

                    // Diğer hatalar
                    return { available: true, quotaExceeded: false, error: errorMsg };
                }
            } catch (testError) {
                // Test isteği hatası, ancak model mevcut
                return { available: true, quotaExceeded: false, error: testError.message };
            }
        }

        // Quota kontrolü yapılmadı, sadece model mevcut
        return { available: true, quotaExceeded: false };
    } catch (error) {
        return { available: false, error: error.message };
    }
};
