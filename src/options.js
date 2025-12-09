/**
 * @fileoverview Ekşi Sözlük AI Analiz - Ayarlar Sayfası
 * 
 * Bu dosya eklentinin ayarlar sayfası (options.html) için JavaScript kodunu içerir.
 * Kullanıcıların şu ayarları yapılandırmasına olanak sağlar:
 * - Gemini API anahtarı
 * - Model seçimi
 * - Özel prompt butonları (ekleme, düzenleme, silme)
 * 
 * Bağımlılıklar:
 * - constants.js (MODELS, DEFAULT_PROMPTS, escapeHtml)
 * - chrome.storage.sync API
 */

// =============================================================================
// GLOBAL DEĞİŞKENLER
// =============================================================================

/**
 * Kullanıcının özelleştirdiği prompt listesi.
 * DOM'dan güncellenir ve chrome.storage.sync'e kaydedilir.
 * @type {Array<{name: string, prompt: string}>}
 */
let prompts = [];

// =============================================================================
// DOM YARDIMCI FONKSİYONLARI
// =============================================================================

/**
 * DOM'daki prompt input alanlarından güncel prompt listesini oluşturur.
 * Her kaydetme işleminden önce çağrılarak DOM state'i ile prompts dizisini senkronize eder.
 */
const updatePromptsFromDOM = () => {
    const promptItems = document.querySelectorAll('.prompt-item');
    const newPrompts = [];

    promptItems.forEach(item => {
        const name = item.querySelector('.prompt-name').value;
        const prompt = item.querySelector('.prompt-text').value;
        // Sadece isim ve prompt dolu olan öğeleri kaydet
        if (name && prompt) {
            newPrompts.push({ name, prompt });
        }
    });

    prompts = newPrompts;
};

// =============================================================================
// API KEY DOĞRULAMA
// =============================================================================

/**
 * Gemini API anahtarını doğrular.
 * 
 * Google'ın models endpoint'ine test isteği yaparak anahtarın geçerli
 * olup olmadığını kontrol eder. Başarılı doğrulamada input alanına
 * görsel geri bildirim (yeşil/kırmızı kenarlık) ekler.
 * 
 * @param {string} apiKey - Doğrulanacak API anahtarı
 * @param {boolean} [updateInputStyle=true] - Input alanının stilini güncelleyip güncellemeyeceği
 * @returns {Promise<{valid: boolean, error?: string}>} Doğrulama sonucu
 * 
 * @example
 * const result = await validateApiKey('AIza...');
 * if (result.valid) {
 *     console.log('API anahtarı geçerli');
 * } else {
 *     console.error('Hata:', result.error);
 * }
 */
const validateApiKey = async (apiKey, updateInputStyle = true) => {
    const apiKeyInput = document.getElementById('apiKey');
    const apiKeyError = document.getElementById('apiKeyError');

    // Boş API Key geçerli kabul edilir
    if (!apiKey || apiKey.trim() === '') {
        if (updateInputStyle) {
            apiKeyInput.classList.remove('valid', 'invalid');
            if (apiKeyError) {
                apiKeyError.style.display = 'none';
                apiKeyError.textContent = '';
            }
        }
        return { valid: true };
    }

    try {
        // Google models API'sine test isteği
        const modelsUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
        const response = await fetch(modelsUrl);

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'API Key geçersiz';
            if (updateInputStyle) {
                apiKeyInput.classList.remove('valid');
                apiKeyInput.classList.add('invalid');
                if (apiKeyError) {
                    apiKeyError.textContent = `Hata: ${errorMessage}`;
                    apiKeyError.style.display = 'block';
                }
            }
            return { valid: false, error: errorMessage };
        }

        // Başarılı doğrulama
        if (updateInputStyle) {
            apiKeyInput.classList.remove('invalid');
            apiKeyInput.classList.add('valid');
            if (apiKeyError) {
                apiKeyError.style.display = 'none';
                apiKeyError.textContent = '';
            }
        }
        return { valid: true };
    } catch (error) {
        // Ağ veya beklenmeyen hatalar
        if (updateInputStyle) {
            apiKeyInput.classList.remove('valid');
            apiKeyInput.classList.add('invalid');
            if (apiKeyError) {
                apiKeyError.textContent = `Hata: API Key doğrulanırken bir hata oluştu: ${error.message}`;
                apiKeyError.style.display = 'block';
            }
        }
        return { valid: false, error: 'API Key doğrulanırken bir hata oluştu: ' + error.message };
    }
};

// =============================================================================
// AYARLARI KAYDETME VE GERİ YÜKLEME
// =============================================================================

/**
 * Tüm ayarları chrome.storage.sync'e kaydeder.
 * 
 * Kaydetmeden önce API anahtarını doğrular. Geçersiz anahtar durumunda
 * kullanıcıya hata mesajı gösterir ve kaydetme işlemini iptal eder.
 * 
 * Kaydedilen ayarlar:
 * - geminiApiKey: API anahtarı
 * - selectedModel: Seçili model ID'si
 * - prompts: Özelleştirilmiş prompt listesi
 */
const saveOptions = async () => {
    const apiKey = document.getElementById('apiKey').value;
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect.value;
    const status = document.getElementById('status');

    // Önceki API key'i al (karşılaştırma için)
    let previousApiKey = '';
    await new Promise((resolve) => {
        chrome.storage.sync.get(['geminiApiKey'], (items) => {
            previousApiKey = items.geminiApiKey || '';
            resolve();
        });
    });

    // Kaydetme öncesi API anahtarı doğrulaması
    status.textContent = 'API Key doğrulanıyor...';
    status.className = 'status';
    status.style.display = 'block';

    const validation = await validateApiKey(apiKey, true);

    if (!validation.valid) {
        // Hata mesajı zaten API key alanının altında gösteriliyor
        // Genel status alanını temizle
        status.textContent = '';
        status.className = 'status';
        status.style.display = 'none';
        return;
    }

    // DOM'dan güncel prompt listesini al
    updatePromptsFromDOM();

    // Tema seçimini al
    const themeSelect = document.getElementById('themeSelect');
    const selectedTheme = themeSelect ? themeSelect.value : 'auto';

    // API key değişti mi kontrol et
    const apiKeyChanged = apiKey !== previousApiKey;

    const settings = {
        geminiApiKey: apiKey,
        selectedModel: selectedModel,
        prompts: prompts,
        theme: selectedTheme
    };

    // Chrome storage'a kaydet
    chrome.storage.sync.set(settings, async () => {
        status.textContent = 'Ayarlar kaydedildi.';
        status.className = 'status success';
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
            status.style.display = 'none';
        }, 3000);

        // State tutarlılığı için listeyi yeniden render et
        renderPrompts();

        // Tema seçimini uygula
        applyTheme(selectedTheme);

        // API key değiştiyse tüm modellerin durumunu güncelleme - artık sadece buton ile yapılıyor
        // Model seçimine göre UI'daki butonları güncelle (eğer modeller kontrol edilmiyorsa)
        if (!isCheckingModels) {
            // Seçilen modelin satırını güncelle
            MODELS.forEach(m => {
                const rowId = `model-status-${m.id}`;
                const row = document.getElementById(rowId);
                if (row) {
                    const isSelected = m.id === selectedModel;
                    const useBtn = row.querySelector('.use-model-btn');
                    const selectedBtn = row.querySelector('.selected-model-btn');

                    // "Bu modeli kullan" → "Seçilen" dönüşümü
                    if (isSelected && useBtn) {
                        const newBtn = document.createElement('button');
                        newBtn.className = 'selected-model-btn';
                        newBtn.setAttribute('data-model-id', m.id);
                        newBtn.disabled = true;
                        newBtn.style.cssText = 'padding: 6px 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; font-size: 0.85em; font-weight: 500; cursor: not-allowed; opacity: 0.8;';
                        newBtn.textContent = 'Seçilen';
                        useBtn.replaceWith(newBtn);
                    }
                    // "Seçilen" → "Bu modeli kullan" dönüşümü
                    else if (!isSelected && selectedBtn) {
                        const modelId = selectedBtn.getAttribute('data-model-id');
                        const newBtn = document.createElement('button');
                        newBtn.className = 'use-model-btn';
                        newBtn.setAttribute('data-model-id', modelId);
                        newBtn.style.cssText = 'padding: 6px 12px; background-color: #81c14b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500; transition: background-color 0.2s ease;';
                        newBtn.textContent = 'Bu modeli kullan';

                        newBtn.onclick = async () => {
                            await useModelInSettings(modelId);
                        };

                        newBtn.onmouseenter = () => {
                            newBtn.style.backgroundColor = '#6da53e';
                        };
                        newBtn.onmouseleave = () => {
                            newBtn.style.backgroundColor = '#81c14b';
                        };

                        selectedBtn.replaceWith(newBtn);
                    }
                }
            });
        }

        setupRefreshButton();
    });
};

/**
 * Tema seçimini uygular.
 * 
 * @param {string} theme - 'auto', 'light', veya 'dark'
 */
const applyTheme = (theme) => {
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');

    if (theme === 'light') {
        body.classList.add('light-theme');
    } else if (theme === 'dark') {
        body.classList.add('dark-theme');
    }
    // 'auto' durumunda class eklenmez, sistem tercihi kullanılır
};

/**
 * Tema seçimini yükler ve uygular.
 */
const restoreTheme = async () => {
    chrome.storage.sync.get(
        {
            theme: 'auto'
        },
        (items) => {
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect) {
                themeSelect.value = items.theme || 'auto';
                applyTheme(items.theme || 'auto');
            }
        }
    );
};

/**
 * Kayıtlı ayarları chrome.storage.sync'den yükler ve UI'a uygular.
 * 
 * Sayfa yüklendiğinde çağrılır. Kaydedilmiş ayar yoksa varsayılan
 * değerleri kullanır. Mevcut API anahtarı varsa doğrulama yapar.
 */
const restoreOptions = async () => {
    chrome.storage.sync.get(
        {
            // Varsayılan değerler (kayıt yoksa kullanılır)
            geminiApiKey: '',
            selectedModel: 'gemini-2.5-pro',
            prompts: DEFAULT_PROMPTS,
            theme: 'auto'
        },
        async (items) => {
            // API anahtarını input'a yükle
            document.getElementById('apiKey').value = items.geminiApiKey;

            // Prompt listesini yükle (boşsa varsayılanları kullan)
            if (items.prompts && items.prompts.length > 0) {
                prompts = items.prompts;
            } else if (typeof DEFAULT_PROMPTS !== 'undefined' && DEFAULT_PROMPTS.length > 0) {
                prompts = DEFAULT_PROMPTS;
            } else {
                // DEFAULT_PROMPTS henüz yüklenmemişse, boş dizi kullan
                prompts = [];
            }

            // UI bileşenlerini doldur
            await populateModelSelect(items.selectedModel);
            renderPrompts();

            // Mevcut API anahtarını doğrula
            if (items.geminiApiKey) {
                await validateApiKey(items.geminiApiKey, true);
                // Tüm modellerin durumunu gösterme - artık sadece buton ile yapılıyor
            }

            // Yenile butonunu ayarla
            setupRefreshButton();
        }
    );
};

// =============================================================================
// MODEL SEÇİMİ
// =============================================================================


/**
 * Model seçim dropdown'ını MODELS listesiyle doldurur.
 * 
 * Seçim değiştiğinde model bilgilerini (açıklama, maliyet, yanıt süresi)
 * günceller. Sayfa yüklendiğinde kaydedilmiş modeli seçili olarak işaretler.
 * Model availability durumunu da gösterir.
 * 
 * @param {string} savedModelId - Önceden kaydedilmiş model ID'si
 */
const populateModelSelect = async (savedModelId) => {
    const select = document.getElementById('modelSelect');
    const infoDiv = document.getElementById('modelInfo');

    select.innerHTML = '';

    // Model option'larını oluştur
    MODELS.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        if (model.id === savedModelId) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    /**
     * Model bilgi alanını günceller.
     * Seçili modelin detaylarını info div'inde gösterir.
     * Model availability durumunu göstermez, sadece temel bilgileri gösterir.
     */
    const updateInfo = () => {
        const selectedId = select.value;
        const model = MODELS.find(m => m.id === selectedId);
        if (!model) return;

        infoDiv.innerHTML = `
            <strong>${model.name}</strong><br>
            ${model.description}<br>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc;">
                <small><strong>Maliyet:</strong> ${model.cost}</small><br>
                <small><strong>Yanıt Süresi:</strong> ${model.responseTime}</small><br>
                <small><strong>Bağlam Penceresi:</strong> ${new Intl.NumberFormat('tr-TR').format(model.contextWindow)} token (yaklaşık 10.000 entry)</small>
            </div>
        `;
    };

    // İlk yükleme
    updateInfo();

    // Seçim değişikliği dinleyicisi
    select.addEventListener('change', updateInfo);
};

/**
 * Tüm modellerin availability durumunu gösterir.
 * Her model için ayrı DOM elementi oluşturur ve sonuçlar hazır oldukça anında günceller.
 */
let isCheckingModels = false; // API kontrolünün devam edip etmediğini takip et

const updateAllModelsStatus = async () => {
    const statusDiv = document.getElementById('allModelsStatus');
    const statusList = document.getElementById('modelsStatusList');

    if (!statusDiv || !statusList) return;

    const apiKey = document.getElementById('apiKey').value;

    if (!apiKey || !apiKey.trim()) {
        statusDiv.style.display = 'none';
        return;
    }

    // Eğer kontrol zaten devam ediyorsa, yeni kontrol başlatma
    if (isCheckingModels) {
        return;
    }

    isCheckingModels = true;
    statusDiv.style.display = 'block';

    // Her model için ayrı bir DOM elementi oluştur (hepsi loading durumunda başlar)
    statusList.innerHTML = '';
    const modelSelect = document.getElementById('modelSelect');
    const selectedModelId = modelSelect ? modelSelect.value : null;

    MODELS.forEach((model) => {
        const modelRowId = `model-status-${model.id}`;
        const modelRow = document.createElement('div');
        modelRow.id = modelRowId;
        modelRow.style.cssText = 'padding: 8px; margin-bottom: 5px; border-left: 3px solid #999; background: #f5f5f5; display: flex; align-items: center; justify-content: space-between;';

        // Seçili model için loading durumunda bile "Seçilen" butonunu göster
        const isSelected = model.id === selectedModelId;
        const buttonHtml = isSelected
            ? `<button class="selected-model-btn" data-model-id="${model.id}" disabled style="padding: 6px 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; font-size: 0.85em; font-weight: 500; cursor: not-allowed; opacity: 0.8;">
                Seçilen
            </button>`
            : '';

        modelRow.innerHTML = `
            <div>
                <strong>${model.name}</strong><br>
                <small style="color: #666;">⏳ Kontrol ediliyor...</small>
            </div>
            ${buttonHtml}
        `;
        statusList.appendChild(modelRow);
    });

    // Her modeli kontrol et ve sonucu anında göster
    const checkModelAndUpdateUI = async (model) => {
        const modelRowId = `model-status-${model.id}`;
        const modelRow = document.getElementById(modelRowId);

        if (!modelRow) return;

        try {
            // Kontrol et
            const availability = await checkModelAvailability(apiKey, model.id);

            // Eğer kontrol iptal edildiyse (isCheckingModels false olduysa), güncelleme yapma
            if (!isCheckingModels) {
                return;
            }

            // Sonucu göster
            if (availability.available && !availability.quotaExceeded) {
                // Seçili modeli kontrol et
                const modelSelect = document.getElementById('modelSelect');
                const isSelected = modelSelect && modelSelect.value === model.id;

                // Kullanılabilir - buton ekle
                modelRow.style.cssText = 'padding: 8px; margin-bottom: 5px; border-left: 3px solid #5cb85c; background: #f5f5f5; display: flex; align-items: center; justify-content: space-between;';

                // Seçili model için "Seçilen" butonu, diğerleri için "Bu modeli kullan" butonu
                const buttonHtml = isSelected
                    ? `<button class="selected-model-btn" data-model-id="${model.id}" disabled style="padding: 6px 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; font-size: 0.85em; font-weight: 500; cursor: not-allowed; opacity: 0.8;">
                        Seçilen
                    </button>`
                    : `<button class="use-model-btn" data-model-id="${model.id}" style="padding: 6px 12px; background-color: #81c14b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500; transition: background-color 0.2s ease;">
                        Bu modeli kullan
                    </button>`;

                // Test cevabını göster (varsa) - tooltip ile tam cevabı göster
                const responseHtml = availability.response
                    ? `<br><small class="gemini-response-preview" style="color: #666; font-style: italic; display: block; margin-top: 4px; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; position: relative;" data-full-response="${escapeHtml(availability.response)}">💬 ${escapeHtml(availability.response)}</small>`
                    : '';

                modelRow.innerHTML = `
                    <div>
                        <strong>${model.name}</strong><br>
                        <small style="color: #5cb85c;"><strong>✅ Kullanılabilir</strong></small>
                        ${responseHtml}
                    </div>
                    ${buttonHtml}
                `;

                // Buton event listener ekle (sadece "Bu modeli kullan" butonu için)
                const useBtn = modelRow.querySelector('.use-model-btn');
                if (useBtn) {
                    useBtn.onclick = async () => {
                        await useModelInSettings(model.id);
                    };

                    // Hover efekti
                    useBtn.onmouseenter = () => {
                        useBtn.style.backgroundColor = '#6da53e';
                    };
                    useBtn.onmouseleave = () => {
                        useBtn.style.backgroundColor = '#81c14b';
                    };
                }

                // Gemini response tooltip event listener'ları ekle
                const responsePreview = modelRow.querySelector('.gemini-response-preview');
                if (responsePreview) {
                    let tooltipElement = null;

                    responsePreview.onmouseenter = (e) => {
                        const fullResponse = responsePreview.getAttribute('data-full-response');
                        if (!fullResponse) return;

                        // Tooltip element oluştur
                        tooltipElement = document.createElement('div');
                        tooltipElement.className = 'gemini-response-tooltip';
                        tooltipElement.style.cssText = `
                            position: fixed;
                            background: #2d2d2d;
                            color: #e0e0e0;
                            padding: 12px 15px;
                            border-radius: 8px;
                            font-size: 13px;
                            font-style: normal;
                            max-width: 500px;
                            max-height: 300px;
                            overflow-y: auto;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                            z-index: 10000;
                            line-height: 1.5;
                            border: 1px solid #444;
                        `;
                        tooltipElement.textContent = fullResponse;

                        document.body.appendChild(tooltipElement);

                        // Pozisyonu ayarla
                        const rect = responsePreview.getBoundingClientRect();
                        const tooltipRect = tooltipElement.getBoundingClientRect();

                        let left = rect.left;
                        let top = rect.bottom + 5;

                        // Ekran sınırlarını kontrol et
                        if (left + tooltipRect.width > window.innerWidth - 10) {
                            left = window.innerWidth - tooltipRect.width - 10;
                        }
                        if (top + tooltipRect.height > window.innerHeight - 10) {
                            top = rect.top - tooltipRect.height - 5;
                        }

                        tooltipElement.style.left = `${Math.max(10, left)}px`;
                        tooltipElement.style.top = `${top}px`;
                    };

                    responsePreview.onmouseleave = () => {
                        if (tooltipElement && tooltipElement.parentNode) {
                            tooltipElement.parentNode.removeChild(tooltipElement);
                            tooltipElement = null;
                        }
                    };
                }
            } else if (availability.quotaExceeded) {
                // Quota aşıldı
                modelRow.style.cssText = 'padding: 8px; margin-bottom: 5px; border-left: 3px solid #f0ad4e; background: #f5f5f5;';
                modelRow.innerHTML = `
                    <div>
                        <strong>${model.name}</strong><br>
                        <small style="color: #f0ad4e;"><strong>⚠️ Quota limiti aşıldı</strong>${availability.error ? ` - ${availability.error}` : ''}</small>
                    </div>
                `;
            } else {
                // Kullanılamıyor
                modelRow.style.cssText = 'padding: 8px; margin-bottom: 5px; border-left: 3px solid #d9534f; background: #f5f5f5;';
                modelRow.innerHTML = `
                    <div>
                        <strong>${model.name}</strong><br>
                        <small style="color: #d9534f;"><strong>❌ Kullanılamıyor</strong>${availability.error ? ` - ${escapeHtml(availability.error)}` : ''}</small>
                    </div>
                `;
            }
        } catch (error) {
            // Eğer kontrol iptal edildiyse, güncelleme yapma
            if (!isCheckingModels) {
                return;
            }

            // Hata durumu
            modelRow.style.cssText = 'padding: 8px; margin-bottom: 5px; border-left: 3px solid #d9534f; background: #f5f5f5;';
            modelRow.innerHTML = `
                <div>
                    <strong>${model.name}</strong><br>
                    <small style="color: #d9534f;"><strong>❌ Hata:</strong> ${escapeHtml(error.message)}</small>
                </div>
            `;
        }
    };

    // Tüm modelleri paralel olarak kontrol et
    const checkPromises = MODELS.map(model => checkModelAndUpdateUI(model));
    await Promise.all(checkPromises);

    // Kontrol tamamlandı
    isCheckingModels = false;
};

/**
 * Test için system prompt kullanmadan streaming API çağrısı yapar.
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} modelId - Kullanılacak model ID'si
 * @param {string} prompt - Gönderilecek prompt (system prompt olmadan)
 * @param {AbortSignal} signal - İstek iptal sinyali
 * @param {Function} onChunk - Her parça geldiğinde çağrılacak callback (chunk, fullText) => void
 * @returns {Promise<{text: string, responseTime: number}>} Tam yanıt ve süre
 */
const callGeminiApiStreamingForTest = async (apiKey, modelId, prompt, signal, onChunk) => {
    const startTime = performance.now();

    // Model bazlı API versiyonu belirleme
    const model = MODELS.find(m => m.id === modelId);
    const apiVersion = model?.apiVersion || 'v1';
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;

    try {
        // Test için system prompt kullanmıyoruz, sadece user prompt
        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

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

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (i === lines.length - 1 && !line.endsWith('\n')) {
                    buffer = line;
                    continue;
                }

                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6).trim();

                    if (jsonStr && jsonStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(jsonStr);
                            const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                            if (chunk) {
                                fullText += chunk;
                                if (onChunk) {
                                    onChunk(chunk, fullText);
                                }
                            }
                        } catch (parseErr) {
                            // JSON parse hatası - devam et
                        }
                    }
                }
            }
        }

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        return { text: fullText, responseTime };
    } catch (err) {
        if (err.name === 'AbortError') {
            throw err;
        }
        throw new Error(err.message || 'Streaming hatası oluştu.');
    }
};

/**
 * Hata mesajından hata tipini belirler (kota, rate limit, vb.)
 */
const getErrorType = (errorMessage) => {
    const msg = errorMessage.toLowerCase();
    if (msg.includes('quota') || msg.includes('quota exceeded')) {
        return 'quota';
    }
    if (msg.includes('rate limit') || msg.includes('429')) {
        return 'rate_limit';
    }
    if (msg.includes('permission') || msg.includes('403')) {
        return 'permission';
    }
    if (msg.includes('not found') || msg.includes('404')) {
        return 'not_found';
    }
    return 'unknown';
};

/**
 * Hata tipine göre kullanıcı dostu mesaj oluşturur
 */
const formatErrorMessage = (errorMessage, errorType) => {
    switch (errorType) {
        case 'quota':
            return '⚠️ Quota Limiti Aşıldı\n\nBu model için ücretsiz quota limiti aşılmış. Lütfen daha sonra tekrar deneyin veya farklı bir model kullanın.';
        case 'rate_limit':
            return '⏱️ Rate Limit Aşıldı\n\nÇok fazla istek gönderildi. Lütfen birkaç saniye bekleyip tekrar deneyin.';
        case 'permission':
            return '🔒 İzin Hatası\n\nAPI anahtarınız bu modeli kullanmak için yetkili değil.';
        case 'not_found':
            return '❓ Model Bulunamadı\n\nBu model mevcut değil veya erişilemiyor.';
        default:
            return `❌ Hata\n\n${errorMessage}`;
    }
};

/**
 * Streaming kullanarak tüm modelleri karşılaştırır.
 * Her model için aynı prompt'u gönderir ve yanıtları gerçek zamanlı yan yana gösterir.
 * Sonuçlar modal pencerede gösterilir. Hata alan modeller hata bilgileriyle birlikte gösterilir.
 */
const compareModelsWithStreaming = async () => {
    const modal = document.getElementById('modelComparisonModal');
    const modalBody = document.getElementById('modalBody');
    const modalStatusSummary = document.getElementById('modalStatusSummary');
    const testPromptInput = document.getElementById('modelTestPrompt');
    const apiKey = document.getElementById('apiKey').value;

    if (!modal || !modalBody) return;

    if (!apiKey || !apiKey.trim()) {
        alert('Lütfen API anahtarını girin.');
        return;
    }

    // Test prompt'unu al
    const testPrompt = testPromptInput ? testPromptInput.value.trim() : 'naber?\n\nbu yeni satırlı bir prompt';
    
    if (!testPrompt) {
        alert('Lütfen test promptu girin.');
        return;
    }

    // Eğer kontrol zaten devam ediyorsa, yeni kontrol başlatma
    if (isCheckingModels) {
        return;
    }

    isCheckingModels = true;
    
    // Modal'ı göster
    modal.classList.add('active');
    
    // Üç bölüm oluştur: başarılı modeller, seçilmeyen modeller ve hata alınan modeller
    modalBody.innerHTML = `
        <div class="models-comparison-section" id="successfulModelsSection">
            <div class="models-comparison-section-title success" id="successfulModelsTitle" style="display: none;">
                ✅ Başarılı Modeller
            </div>
            <div class="models-comparison-grid" id="modelsComparisonGrid"></div>
        </div>
        <div class="models-comparison-section" id="unselectedModelsSection">
            <div class="models-comparison-grid" id="unselectedModelsGrid"></div>
        </div>
        <div class="models-comparison-section" id="errorModelsSection">
            <div class="models-comparison-grid" id="errorModelsGrid"></div>
        </div>
    `;
    
    const successGridContainer = document.getElementById('modelsComparisonGrid');
    const unselectedGridContainer = document.getElementById('unselectedModelsGrid');
    const errorGridContainer = document.getElementById('errorModelsGrid');
    const successfulModelsTitle = document.getElementById('successfulModelsTitle');
    
    // Başlangıç durumu
    modalStatusSummary.textContent = '⏳ Kontrol ediliyor...';

    // Her model için bir kart oluştur (başlangıçta başarılı modeller bölümünde)
    const modelCards = {};
    
    /**
     * Model kartını doğru bölüme taşır
     * targetSection: 'success' (başarılı), 'unselected' (seçilmeyen), 'error' (hata)
     */
    const moveCardBetweenSections = (cardData, targetSection) => {
        const currentContainer = cardData.gridContainer;
        let targetContainer;
        
        switch (targetSection) {
            case 'success':
                targetContainer = successGridContainer;
                break;
            case 'unselected':
                targetContainer = unselectedGridContainer;
                break;
            case 'error':
                targetContainer = errorGridContainer;
                break;
            default:
                return;
        }
        
        if (currentContainer !== targetContainer) {
            currentContainer.removeChild(cardData.card);
            targetContainer.appendChild(cardData.card);
            cardData.gridContainer = targetContainer;
            
            // Başarılı modeller başlığını göster/gizle
            if (successfulModelsTitle) {
                const hasModels = successGridContainer.children.length > 0;
                successfulModelsTitle.style.display = hasModels ? 'block' : 'none';
            }
        }
    };
    
    MODELS.forEach((model) => {
        const cardId = `model-card-${model.id}`;
        const card = document.createElement('div');
        card.id = cardId;
        card.className = 'model-comparison-card';
        
        const statusDiv = document.createElement('div');
        statusDiv.className = 'model-comparison-status loading';
        statusDiv.textContent = '⏳ Başlatılıyor...';
        
        const responseDiv = document.createElement('div');
        responseDiv.className = 'model-comparison-response';
        
        const metaDiv = document.createElement('div');
        metaDiv.className = 'model-comparison-meta';
        metaDiv.textContent = 'Süre: - | Token: -';
        
        // Checkbox oluştur
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'model-comparison-checkbox';
        checkbox.checked = true; // Başlangıçta seçili
        checkbox.id = `checkbox-${model.id}`;
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'model-comparison-card-header';
        headerDiv.textContent = model.name;
        
        const h4 = document.createElement('h4');
        h4.appendChild(headerDiv);
        h4.appendChild(checkbox);
        
        card.appendChild(h4);
        card.appendChild(statusDiv);
        card.appendChild(responseDiv);
        card.appendChild(metaDiv);
        
        successGridContainer.appendChild(card);
        const cardData = {
            card,
            statusDiv,
            responseDiv,
            metaDiv,
            checkbox,
            startTime: null,
            fullText: '',
            hasError: false,
            isSelected: true,
            gridContainer: successGridContainer // Başlangıçta başarılı modeller grid'inde
        };
        modelCards[model.id] = cardData;
        
        // Checkbox değişikliği event listener
        checkbox.addEventListener('change', () => {
            // Hata varsa checkbox değişikliğini işleme (checkbox zaten gizli olacak)
            if (cardData.hasError) {
                return;
            }
            
            const isSelected = checkbox.checked;
            cardData.isSelected = isSelected;
            
            if (isSelected) {
                // Seçildi ve hata yok - başarılı modeller bölümüne taşı
                card.classList.remove('unselected');
                moveCardBetweenSections(cardData, 'success');
            } else {
                // Seçilmedi ve hata yok - seçilmeyen modeller bölümüne taşı
                card.classList.add('unselected');
                moveCardBetweenSections(cardData, 'unselected');
            }
            
            // Başlık satırını güncelle
            const selectedSuccessfulModels = Object.values(modelCards).filter(card => card.isSelected && !card.hasError);
            const selectedFailedModels = Object.values(modelCards).filter(card => card.isSelected && card.hasError);
            
            if (selectedFailedModels.length === 0) {
                modalStatusSummary.textContent = `✅ ${selectedSuccessfulModels.length} model başarıyla test edildi`;
            } else {
                modalStatusSummary.textContent = `✅ ${selectedSuccessfulModels.length} başarılı, ❌ ${selectedFailedModels.length} hata`;
            }
        });
    });
    
    // Başlangıçta başarılı modeller başlığını göster
    if (successfulModelsTitle && successGridContainer.children.length > 0) {
        successfulModelsTitle.style.display = 'block';
    }

    // Her model için streaming çağrısı yap (paralel)
    const abortController = new AbortController();
    const streamingPromises = MODELS.map(async (model) => {
        const cardData = modelCards[model.id];
        if (!cardData) return;

        try {
            cardData.statusDiv.className = 'model-comparison-status loading';
            cardData.statusDiv.textContent = '🔄 İstek gönderiliyor...';
            cardData.startTime = performance.now();

            // Streaming API çağrısı (test için system prompt kullanmıyoruz)
            await callGeminiApiStreamingForTest(
                apiKey,
                model.id,
                testPrompt,
                abortController.signal,
                (chunk, fullText) => {
                    // Her chunk geldiğinde UI'ı güncelle
                    if (!isCheckingModels) return; // İptal edildiyse güncelleme yapma
                    
                    cardData.fullText = fullText;
                    cardData.responseDiv.textContent = fullText;
                    cardData.statusDiv.className = 'model-comparison-status loading';
                    cardData.statusDiv.textContent = '📝 Yanıt alınıyor...';
                    
                    // Scroll to bottom
                    cardData.responseDiv.scrollTop = cardData.responseDiv.scrollHeight;
                }
            );

            // Streaming tamamlandı
            if (!isCheckingModels) return; // İptal edildiyse güncelleme yapma

            const endTime = performance.now();
            const responseTime = ((endTime - cardData.startTime) / 1000).toFixed(2);
            
            // Token tahmini (basit: karakter sayısı / 4)
            const estimatedTokens = Math.ceil(cardData.fullText.length / 4);
            
            cardData.statusDiv.className = 'model-comparison-status success';
            cardData.statusDiv.textContent = '';
            cardData.metaDiv.textContent = `Süre: ${responseTime}s | Tahmini Token: ~${estimatedTokens}`;
            
            // Başarılı durumda - seçiliyse başarılı modeller bölümüne, değilse seçilmeyen modeller bölümüne taşı
            if (cardData.isSelected) {
                moveCardBetweenSections(cardData, 'success');
            } else {
                moveCardBetweenSections(cardData, 'unselected');
            }
            
        } catch (error) {
            if (!isCheckingModels) return; // İptal edildiyse güncelleme yapma
            
            // Hata durumu - hata bilgilerini göster
            cardData.hasError = true;
            const errorType = getErrorType(error.message);
            const formattedError = formatErrorMessage(error.message, errorType);
            
            // Checkbox'ı gizle (hata alınan modellerde seçme butonu olmasın)
            cardData.checkbox.style.display = 'none';
            
            // Kartı hata alınan modeller bölümüne taşı (3. satır)
            moveCardBetweenSections(cardData, 'error');
            
            // Kartı hata stili ile işaretle
            cardData.card.classList.add('has-error');
            
            // Status ve response alanlarını güncelle
            cardData.statusDiv.className = 'model-comparison-status error';
            cardData.statusDiv.textContent = '';
            
            cardData.responseDiv.className = 'model-comparison-response error-message';
            cardData.responseDiv.textContent = formattedError;
            
            // Meta bilgisini güncelle
            if (cardData.startTime) {
                const endTime = performance.now();
                const responseTime = ((endTime - cardData.startTime) / 1000).toFixed(2);
                cardData.metaDiv.textContent = `Süre: ${responseTime}s | Durum: Hata`;
            } else {
                cardData.metaDiv.textContent = 'Süre: - | Durum: Hata';
            }
        }
    });

    // Tüm streaming çağrılarını bekle
    await Promise.all(streamingPromises);
    
    // Kontrol tamamlandı
    isCheckingModels = false;
    
    // Seçili modelleri say (karşılaştırmaya dahil olanlar)
    const selectedSuccessfulModels = Object.values(modelCards).filter(card => card.isSelected && !card.hasError);
    const selectedFailedModels = Object.values(modelCards).filter(card => card.isSelected && card.hasError);
    
    // Başlık satırını güncelle (sadece seçili modelleri say)
    if (selectedFailedModels.length === 0) {
        modalStatusSummary.textContent = `✅ ${selectedSuccessfulModels.length} model başarıyla test edildi`;
    } else {
        modalStatusSummary.textContent = `✅ ${selectedSuccessfulModels.length} başarılı, ❌ ${selectedFailedModels.length} hata`;
    }
};

/**
 * Yenile butonuna tıklandığında streaming ile modelleri karşılaştırır.
 */
const refreshAllModelsStatus = async () => {
    // Önceki kontrolü iptal et
    isCheckingModels = false;
    await compareModelsWithStreaming();
};

/**
 * Ayar sayfasında "Bu modeli kullan" butonuna tıklandığında çağrılır.
 * Seçilen modeli ayarlara kaydeder ve model seçim dropdown'ını günceller.
 * 
 * @param {string} modelId - Kullanılacak model ID'si
 */
const useModelInSettings = async (modelId) => {
    const apiKey = document.getElementById('apiKey').value;
    const modelSelect = document.getElementById('modelSelect');
    const status = document.getElementById('status');

    // Model seçimini güncelle
    modelSelect.value = modelId;

    // Model bilgisini güncelle
    const model = MODELS.find(m => m.id === modelId);
    if (model) {
        const infoDiv = document.getElementById('modelInfo');
        infoDiv.innerHTML = `
            <strong>${model.name}</strong><br>
            ${model.description}<br>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc;">
                <small><strong>Maliyet:</strong> ${model.cost}</small><br>
                <small><strong>Yanıt Süresi:</strong> ${model.responseTime}</small><br>
                <small><strong>Bağlam Penceresi:</strong> ${new Intl.NumberFormat('tr-TR').format(model.contextWindow)} token (yaklaşık 10.000 entry)</small>
            </div>
        `;
    }

    // DOM'dan güncel prompt listesini al
    updatePromptsFromDOM();

    const settings = {
        geminiApiKey: apiKey,
        selectedModel: modelId,
        prompts: prompts
    };

    // Chrome storage'a kaydet
    chrome.storage.sync.set(settings, () => {
        status.textContent = `Model "${model?.name || modelId}" seçildi ve ayarlar kaydedildi.`;
        status.className = 'status success';
        status.style.display = 'block';
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
            status.style.display = 'none';
        }, 3000);

        // Tüm modellerin durumunu yeniden kontrol etme - zaten devam eden kontrol varsa onu bozmamak için
        // Sadece seçilen modelin satırını güncelle (eğer kontrol tamamlandıysa)
        if (!isCheckingModels) {
            // Önce tüm modellerdeki "Seçilen" butonunu "Bu modeli kullan" butonuna dönüştür
            MODELS.forEach(m => {
                const rowId = `model-status-${m.id}`;
                const row = document.getElementById(rowId);
                if (row) {
                    const selectedBtn = row.querySelector('.selected-model-btn');
                    if (selectedBtn) {
                        // "Seçilen" butonunu "Bu modeli kullan" butonuna dönüştür
                        const modelId = selectedBtn.getAttribute('data-model-id');
                        const newBtn = document.createElement('button');
                        newBtn.className = 'use-model-btn';
                        newBtn.setAttribute('data-model-id', modelId);
                        newBtn.style.cssText = 'padding: 6px 12px; background-color: #81c14b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500; transition: background-color 0.2s ease;';
                        newBtn.textContent = 'Bu modeli kullan';

                        // Event listener ekle
                        newBtn.onclick = async () => {
                            await useModelInSettings(modelId);
                        };

                        // Hover efekti
                        newBtn.onmouseenter = () => {
                            newBtn.style.backgroundColor = '#6da53e';
                        };
                        newBtn.onmouseleave = () => {
                            newBtn.style.backgroundColor = '#81c14b';
                        };

                        selectedBtn.replaceWith(newBtn);
                    }
                }
            });

            // Sonra sadece seçilen modelde "Bu modeli kullan" butonunu "Seçilen" butonuna dönüştür
            const modelRowId = `model-status-${modelId}`;
            const modelRow = document.getElementById(modelRowId);
            if (modelRow) {
                const useBtn = modelRow.querySelector('.use-model-btn');
                if (useBtn) {
                    // "Bu modeli kullan" butonunu "Seçilen" butonuna dönüştür
                    const newBtn = document.createElement('button');
                    newBtn.className = 'selected-model-btn';
                    newBtn.setAttribute('data-model-id', modelId);
                    newBtn.disabled = true;
                    newBtn.style.cssText = 'padding: 6px 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; font-size: 0.85em; font-weight: 500; cursor: not-allowed; opacity: 0.8;';
                    newBtn.textContent = 'Seçilen';

                    useBtn.replaceWith(newBtn);
                }
            }
        }
    });
};

// =============================================================================
// PROMPT YÖNETİMİ
// =============================================================================

/**
 * Prompt listesini DOM'a render eder.
 * 
 * Her prompt için düzenlenebilir bir kart oluşturur:
 * - Buton adı input'u
 * - Prompt textarea'sı
 * - Kaydet ve Sil butonları
 */
const renderPrompts = () => {
    const list = document.getElementById('promptsList');
    if (!list) {
        return;
    }

    list.innerHTML = '';

    // prompts dizisi boşsa veya undefined ise, DEFAULT_PROMPTS'u kullan
    const promptsToRender = (prompts && prompts.length > 0)
        ? prompts
        : (typeof DEFAULT_PROMPTS !== 'undefined' && DEFAULT_PROMPTS.length > 0)
            ? DEFAULT_PROMPTS
            : [];

    promptsToRender.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'prompt-item';

        // Prompt kartı HTML'i (XSS koruması için escapeHtml kullanılıyor)
        div.innerHTML = `
            <label>Buton Adı</label>
            <input type="text" class="prompt-name" value="${escapeHtml(item.name)}" placeholder="Buton Adı">
            
            <label>Prompt</label>
            <textarea class="prompt-text" rows="4" placeholder="Prompt içeriği...">${escapeHtml(item.prompt)}</textarea>
            
            <div style="margin-top: 10px;">
                <button class="save-item-btn" style="margin-right: 5px;">Kaydet</button>
                <button class="delete-btn">Sil</button>
            </div>
        `;

        // Event listener'ları bağla
        div.querySelector('.save-item-btn').onclick = saveOptions;
        div.querySelector('.delete-btn').onclick = () => removePrompt(index);

        list.appendChild(div);
    });

    // prompts dizisini güncelle (eğer DEFAULT_PROMPTS kullanıldıysa)
    if ((!prompts || prompts.length === 0) && promptsToRender.length > 0 && typeof DEFAULT_PROMPTS !== 'undefined') {
        prompts = [...promptsToRender];
    }
};

/**
 * Yeni boş bir prompt ekler.
 * 
 * Mevcut DOM durumunu koruyarak listeye yeni bir prompt ekler
 * ve UI'ı günceller. Kaydetme işlemi ayrıca yapılmalıdır.
 */
const addPrompt = () => {
    // Eklemeden önce mevcut durumu yakala
    updatePromptsFromDOM();
    prompts.push({ name: "Yeni Buton", prompt: "" });
    renderPrompts();
};

/**
 * Belirtilen indeksteki promptu siler.
 * 
 * Kullanıcıdan onay alır, promptu listeden kaldırır ve
 * değişiklikleri otomatik olarak kaydeder.
 * 
 * @param {number} index - Silinecek promptun dizin numarası
 */
const removePrompt = (index) => {
    if (confirm('Bu butonu silmek istediğinize emin misiniz?')) {
        // Silmeden önce mevcut durumu yakala
        updatePromptsFromDOM();
        prompts.splice(index, 1);

        // Hemen kaydet
        const apiKey = document.getElementById('apiKey').value;
        const settings = {
            geminiApiKey: apiKey,
            prompts: prompts
        };

        chrome.storage.sync.set(settings, () => {
            renderPrompts();

            // Kullanıcıya geri bildirim ver
            const status = document.getElementById('status');
            status.textContent = 'Buton silindi ve ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);
        });
    }
};

/**
 * Tüm promptları fabrika varsayılanlarına sıfırlar.
 * 
 * Kullanıcıdan onay alır, DEFAULT_PROMPTS'u yükler ve
 * değişiklikleri otomatik olarak kaydeder. Bu işlem geri alınamaz.
 */
const resetPrompts = () => {
    if (confirm('Tüm butonları varsayılan değerlere sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
        // Deep copy ile varsayılanları yükle (referans sorunlarını önlemek için)
        prompts = JSON.parse(JSON.stringify(DEFAULT_PROMPTS));

        // Hemen kaydet
        const apiKey = document.getElementById('apiKey').value;
        const settings = {
            geminiApiKey: apiKey,
            prompts: prompts
        };

        chrome.storage.sync.set(settings, () => {
            renderPrompts();

            // Kullanıcıya geri bildirim ver
            const status = document.getElementById('status');
            status.textContent = 'Butonlar varsayılan değerlere sıfırlandı ve ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);
        });
    }
};

// =============================================================================
// EVENT LİSTENER'LAR
// =============================================================================

/**
 * Tema seçimi değiştiğinde temayı uygula ve kaydet.
 */
const setupThemeSelector = () => {
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            applyTheme(selectedTheme);

            // Tema seçimini kaydet
            chrome.storage.sync.set({ theme: selectedTheme }, () => {
                const status = document.getElementById('status');
                status.textContent = 'Tema kaydedildi.';
                status.className = 'status success';
                status.style.display = 'block';
                setTimeout(() => {
                    status.textContent = '';
                    status.className = 'status';
                    status.style.display = 'none';
                }, 2000);
            });
        });
    }
};

/**
 * Tab geçişlerini ayarlar ve aktif tab'ı storage'a kaydeder.
 */
const setupTabs = () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Remove active from all
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const tabContent = document.getElementById('tab-' + tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }

            // Aktif tab'ı storage'a kaydet
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ optionsActiveTab: tabId });
            }
        });
    });
};

/**
 * Kaydedilmiş aktif tab'ı geri yükler veya varsayılanı ayarlar.
 * Bu fonksiyon sayfa yüklenmeden önce çağrılmalı.
 */
const restoreActiveTab = async () => {
    let savedTab = 'api'; // Varsayılan tab

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        try {
            const result = await new Promise(resolve => {
                chrome.storage.sync.get('optionsActiveTab', resolve);
            });
            if (result.optionsActiveTab) {
                savedTab = result.optionsActiveTab;
            }
        } catch (e) {
            // Storage erişimi başarısız, varsayılanı kullan
        }
    }

    // Doğru tab'ı aktif yap
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
    const tabContent = document.getElementById('tab-' + savedTab);

    if (tabBtn && tabContent) {
        // Önce tümünden active'i kaldır
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Doğru tab'ı aktif yap
        tabBtn.classList.add('active');
        tabContent.classList.add('active');
    }
};

/**
 * Collapsible section'ları ayarlar.
 */
const setupCollapsibleSections = () => {
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.parentElement;
            if (section && section.classList.contains('section')) {
                section.classList.toggle('collapsed');
            }
        });
    });
};

/**
 * Sayfa yüklendiğinde ayarları geri yükle ve system prompt'u göster.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Önce temayı yükle (sayfa yüklenirken hemen uygulanması için)
    restoreTheme();
    // Önce kaydedilmiş tab'ı geri yükle (flash önlemek için)
    await restoreActiveTab();
    // Tab ve section ayarlarını yap
    setupTabs();
    setupCollapsibleSections();
    // Modal ayarlarını yap
    setupModal();
    // Sonra diğer ayarları yükle
    restoreOptions();
    displaySystemPrompt();
    setupThemeSelector();
});

/**
 * Sistem promptunu sayfada görüntüler.
 * SYSTEM_PROMPT sabiti constants.js'den alınır.
 */
const displaySystemPrompt = () => {
    const displayElement = document.getElementById('systemPromptDisplay');
    if (displayElement && typeof SYSTEM_PROMPT !== 'undefined') {
        displayElement.textContent = SYSTEM_PROMPT;
    }
};

/**
 * Sistem promptunu panoya kopyalar.
 */
const copySystemPrompt = async () => {
    const copyBtn = document.getElementById('copySystemPromptBtn');
    try {
        await navigator.clipboard.writeText(SYSTEM_PROMPT);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Kopyalandı';
        copyBtn.style.backgroundColor = '#28a745';
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.backgroundColor = ''; // btn-secondary class'ının rengini kullan
        }, 2000);
    } catch (err) {
        copyBtn.textContent = '✗ Hata';
        copyBtn.style.backgroundColor = '#d9534f';
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.backgroundColor = ''; // btn-secondary class'ının rengini kullan
        }, 2000);
    }
};

/**
 * Kaydet butonuna tıklandığında ayarları kaydet.
 */
document.getElementById('saveBtn').addEventListener('click', () => {
    saveOptions();
});

/**
 * Yeni Buton Ekle butonuna tıklandığında prompt ekle.
 */
document.getElementById('addBtn').addEventListener('click', addPrompt);

/**
 * Sıfırla butonuna tıklandığında promptları varsayılana döndür.
 */
document.getElementById('resetBtn').addEventListener('click', resetPrompts);

/**
 * API Key input'unda Enter tuşuna basıldığında kaydet.
 */
document.getElementById('apiKey').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        saveOptions();
    }
});

/**
 * API Key input'undan çıkıldığında (blur) anahtarı doğrula.
 * Bu, kullanıcıya kaydetmeden önce geri bildirim verir.
 */
document.getElementById('apiKey').addEventListener('blur', async (e) => {
    const apiKey = e.target.value.trim();
    if (apiKey) {
        const validation = await validateApiKey(apiKey, true);
        // API key doğrulaması yapıldı, ancak modellerin durumunu otomatik gösterme
        // Kullanıcı "Yenile" butonuna basarak manuel olarak kontrol edebilir
    } else {
        // Boş input'ta doğrulama sınıflarını kaldır ve modeller durumunu gizle
        e.target.classList.remove('valid', 'invalid');
        const apiKeyError = document.getElementById('apiKeyError');
        if (apiKeyError) {
            apiKeyError.style.display = 'none';
            apiKeyError.textContent = '';
        }
        const statusDiv = document.getElementById('allModelsStatus');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    }
});

/**
 * Sistem promptu kopyalama butonuna tıklandığında panoya kopyala.
 */
document.getElementById('copySystemPromptBtn').addEventListener('click', copySystemPrompt);

/**
 * Tüm modellerin durumunu yenile butonuna tıklandığında durumu yeniden kontrol et.
 */
const setupRefreshButton = () => {
    const refreshBtn = document.getElementById('refreshModelsStatus');
    if (refreshBtn) {
        // Önceki listener'ı kaldır (varsa)
        refreshBtn.replaceWith(refreshBtn.cloneNode(true));
        document.getElementById('refreshModelsStatus').addEventListener('click', refreshAllModelsStatus);
    }
};

/**
 * Modal kapatma işlevlerini ayarlar.
 */
const setupModal = () => {
    const modal = document.getElementById('modelComparisonModal');
    const closeBtn = document.getElementById('modalCloseBtn');
    
    if (!modal || !closeBtn) return;
    
    // Kapat butonuna tıklandığında
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        // İptal et
        isCheckingModels = false;
    });
    
    // Modal overlay'e tıklandığında (modal içeriğine değil)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            isCheckingModels = false;
        }
    });
    
    // ESC tuşu ile kapat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
            isCheckingModels = false;
        }
    });
};

// =============================================================================
// İSTATİSTİK FONKSİYONLARI
// =============================================================================

/**
 * Token sayısını okunabilir formata çevirir.
 */
const formatTokenDisplay = (tokens) => {
    if (tokens >= 1000000) {
        return (tokens / 1000000).toFixed(1) + 'M';
    } else if (tokens >= 1000) {
        return (tokens / 1000).toFixed(1) + 'K';
    }
    return tokens.toString();
};

/**
 * Zaman damgasını göreceli zamana çevirir.
 */
const formatRelativeTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return new Date(timestamp).toLocaleDateString('tr-TR');
};

/**
 * İstatistikleri yükler ve UI'da gösterir.
 */
const loadAndDisplayStats = async () => {
    try {
        const summary = await getStatsSummary();

        // Toplam istatistikler
        document.getElementById('statsTotalCalls').textContent = summary.totals.apiCalls;
        document.getElementById('statsTotalTokens').textContent = formatTokenDisplay(summary.totals.totalTokens);
        document.getElementById('statsCacheHits').textContent = summary.totals.cacheHits;

        // Son 24 saat
        document.getElementById('stats24hCalls').textContent = summary.last24h.apiCalls;
        document.getElementById('stats24hCache').textContent = summary.last24h.cacheHits;
        document.getElementById('stats24hTokens').textContent = formatTokenDisplay(summary.last24h.totalTokens);

        // Model kullanımı
        const modelUsageDiv = document.getElementById('statsModelUsage');
        if (Object.keys(summary.modelUsage).length > 0) {
            modelUsageDiv.innerHTML = Object.entries(summary.modelUsage)
                .sort((a, b) => b[1] - a[1])
                .map(([model, count]) => `<span style="background:#e9ecef;padding:4px 10px;border-radius:15px;">${model}: <strong>${count}</strong></span>`)
                .join('');
        } else {
            modelUsageDiv.innerHTML = '<span style="color:#999;">Henüz veri yok</span>';
        }

        // Son çağrılar tablosu
        const historyBody = document.getElementById('statsHistoryBody');
        if (summary.recentHistory.length > 0) {
            historyBody.innerHTML = summary.recentHistory.map(h => `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${formatRelativeTime(h.timestamp)}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${h.modelId || '-'}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${formatTokenDisplay(h.tokenEstimate)}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${h.responseTime ? (h.responseTime / 1000).toFixed(2) + 's' : '-'}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${h.fromCache ? '💾 Cache' : '🔄 API'}</td>
                </tr>
            `).join('');
        } else {
            historyBody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#999;">Henüz kayıt yok</td></tr>';
        }
    } catch (err) {
        console.warn('Stats yükleme hatası:', err);
    }
};

/**
 * İstatistikleri sıfırla butonuna event listener ekle.
 */
const setupClearStatsButton = () => {
    const clearBtn = document.getElementById('clearStatsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('Tüm kullanım istatistiklerini silmek istediğinize emin misiniz?')) {
                await clearUsageStats();
                await loadAndDisplayStats();

                const status = document.getElementById('status');
                status.textContent = 'İstatistikler sıfırlandı.';
                status.className = 'status success';
                status.style.display = 'block';
                setTimeout(() => {
                    status.style.display = 'none';
                }, 3000);
            }
        });
    }
};

// Sayfa yüklendiğinde istatistikleri yükle
document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplayStats();
    setupClearStatsButton();
});
