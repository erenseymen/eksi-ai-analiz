/**
 * @fileoverview Ekşi Sözlük AI Analiz - Gemini API Entegrasyonu
 * 
 * Bu dosya Gemini API ile iletişimi yönetir:
 * - Senkron ve streaming API çağrıları
 * - Model bazlı API versiyonu seçimi
 * - Quota kontrolü ve model bulma
 * 
 * Bağımlılıklar:
 * - constants.js (MODELS, checkModelAvailability)
 * - prompts.js (SYSTEM_PROMPT)
 * - utils.js (retryWithBackoff)
 */

// =============================================================================
// GEMİNİ API ENTEGRASYONu
// =============================================================================

/**
 * Gemini API'ye HTTP isteği yapar.
 * 
 * Model bazlı API versiyonu kullanır:
 * - Gemini 3 Pro Preview → v1beta
 * - Diğer modeller → v1
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} modelId - Kullanılacak model ID'si
 * @param {string} prompt - Gönderilecek tam prompt
 * @param {AbortSignal} signal - İstek iptal sinyali
 * @returns {Promise<string>} Model yanıtı
 * @throws {Error} API hatası durumunda
 */
const callGeminiApi = async (apiKey, modelId, prompt, signal) => {
    const startTime = performance.now();

    // Model bazlı API versiyonu belirleme (constants.js'den al)
    const model = MODELS.find(m => m.id === modelId);
    const apiVersion = model?.apiVersion || 'v1';
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:generateContent?key=${apiKey}`;

    try {
        // API versiyonuna göre payload yapısını belirle
        // v1beta: systemInstruction alanını destekler
        // v1: systemInstruction desteklemez, system instruction'ı prompt'un başına eklemeliyiz
        let requestBody;

        if (apiVersion === 'v1beta') {
            // v1beta: systemInstruction alanını kullan
            requestBody = {
                systemInstruction: {
                    parts: [{
                        text: SYSTEM_PROMPT
                    }]
                },
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            };
        } else {
            // v1: system instruction'ı prompt'un başına ekle
            const combinedPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
            requestBody = {
                contents: [{
                    parts: [{
                        text: combinedPrompt
                    }]
                }]
            };
        }

        const response = await retryWithBackoff(() => fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: signal
        }));

        if (response.ok) {
            const data = await response.json();
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            return { text: data.candidates[0].content.parts[0].text, responseTime };
        } else {
            const errorData = await response.json();
            // Get full error message including details
            const errorMsg = errorData.error?.message || 'API request failed';
            // Include error details if available
            const fullError = errorData.error?.details
                ? `${errorMsg}\n\n${JSON.stringify(errorData.error.details, null, 2)}`
                : errorMsg;
            throw new Error(fullError);
        }
    } catch (err) {
        throw new Error(err.message || 'Model bulunamadı. Lütfen model adını ve API versiyonunu kontrol edin.');
    }
};

/**
 * Gemini API'ye streaming HTTP isteği yapar.
 * 
 * SSE (Server-Sent Events) kullanarak yanıtı parça parça alır.
 * Her parça geldiğinde callback fonksiyonunu çağırır.
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} modelId - Kullanılacak model ID'si
 * @param {string} prompt - Gönderilecek tam prompt
 * @param {AbortSignal} signal - İstek iptal sinyali
 * @param {Function} onChunk - Her parça geldiğinde çağrılacak callback (chunk, fullText) => void
 * @returns {Promise<{text: string, responseTime: number}>} Tam yanıt ve süre
 * @throws {Error} API hatası durumunda
 */
const callGeminiApiStreaming = async (apiKey, modelId, prompt, signal, onChunk) => {
    const startTime = performance.now();

    // Model bazlı API versiyonu belirleme
    const model = MODELS.find(m => m.id === modelId);
    const apiVersion = model?.apiVersion || 'v1';
    // streamGenerateContent endpoint'i + SSE formatı için alt=sse
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;

    try {
        // Request body oluştur
        let requestBody;

        if (apiVersion === 'v1beta') {
            requestBody = {
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                contents: [{
                    parts: [{ text: prompt }]
                }]
            };
        } else {
            const combinedPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
            requestBody = {
                contents: [{
                    parts: [{ text: combinedPrompt }]
                }]
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = errorData.error?.message || 'API request failed';
            const fullError = errorData.error?.details
                ? `${errorMsg}\n\n${JSON.stringify(errorData.error.details, null, 2)}`
                : errorMsg;
            throw new Error(fullError);
        }

        // SSE stream'ini oku
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Gelen veriyi buffer'a ekle
            buffer += decoder.decode(value, { stream: true });

            // SSE event'lerini parse et
            // Her event "data: " ile başlar ve "\n\n" ile biter
            const lines = buffer.split('\n');
            buffer = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Son satır tamamlanmamış olabilir, buffer'a geri koy
                if (i === lines.length - 1 && !line.endsWith('\n')) {
                    buffer = line;
                    continue;
                }

                // "data: " ile başlayan satırları işle
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6).trim();

                    if (jsonStr && jsonStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(jsonStr);
                            // Gemini API yanıt formatı
                            const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                            if (chunk) {
                                fullText += chunk;
                                // Callback'i çağır
                                if (onChunk) {
                                    onChunk(chunk, fullText);
                                }
                            }
                        } catch (parseErr) {
                            // JSON parse hatası - muhtemelen eksik veri, devam et
                        }
                    }
                }
            }
        }

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        return { text: fullText, responseTime };
    } catch (err) {
        // Abort hatalarını yeniden fırlat
        if (err.name === 'AbortError') {
            throw err;
        }
        throw new Error(err.message || 'Streaming hatası oluştu.');
    }
};

/**
 * Tüm modelleri kontrol ederek quota'sı yeterli olan ilk modeli bulur.
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} [excludeModelId] - Kontrol edilmeyecek model ID'si (opsiyonel)
 * @returns {Promise<Object|null>} Uygun model objesi veya bulunamazsa null
 */
const findAvailableModel = async (apiKey, excludeModelId = null) => {
    // Tüm modelleri sırayla kontrol et (yüksekten düşüğe)
    for (const model of MODELS) {
        // Exclude edilen modeli atla
        if (excludeModelId && model.id === excludeModelId) {
            continue;
        }

        const availability = await checkModelAvailability(apiKey, model.id);

        // Model mevcut ve quota yeterli
        if (availability.available && !availability.quotaExceeded) {
            return model;
        }
    }

    return null; // Uygun model bulunamadı
};
