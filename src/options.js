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
        // Sadece hem isim hem de prompt dolu olan öğeleri kaydet
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
    
    // Boş anahtar kontrolü
    if (!apiKey || apiKey.trim() === '') {
        if (updateInputStyle) {
            apiKeyInput.classList.remove('valid', 'invalid');
        }
        return { valid: false, error: 'API Key boş olamaz.' };
    }

    try {
        // Google'ın models listesi endpoint'ine test isteği
        const modelsUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
        const response = await fetch(modelsUrl);
        
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'API Key geçersiz';
            if (updateInputStyle) {
                apiKeyInput.classList.remove('valid');
                apiKeyInput.classList.add('invalid');
            }
            return { valid: false, error: errorMessage };
        }

        // Başarılı doğrulama
        if (updateInputStyle) {
            apiKeyInput.classList.remove('invalid');
            apiKeyInput.classList.add('valid');
        }
        return { valid: true };
    } catch (error) {
        // Ağ hatası veya diğer beklenmeyen hatalar
        if (updateInputStyle) {
            apiKeyInput.classList.remove('valid');
            apiKeyInput.classList.add('invalid');
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

    // Kaydetme öncesi API anahtarı doğrulaması
    status.textContent = 'API Key doğrulanıyor...';
    status.className = 'status';
    status.style.display = 'block';

    const validation = await validateApiKey(apiKey, true);
    
    if (!validation.valid) {
        status.textContent = `Hata: ${validation.error}`;
        status.className = 'status error';
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
            status.style.display = 'none';
        }, 5000);
        return;
    }

    // DOM'dan güncel prompt listesini al
    updatePromptsFromDOM();

    const settings = {
        geminiApiKey: apiKey,
        selectedModel: selectedModel,
        prompts: prompts
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
        
        // Tüm modellerin durumunu güncelle
        await updateAllModelsStatus();
        setupRefreshButton();
    });
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
            prompts: DEFAULT_PROMPTS
        },
        async (items) => {
            // API anahtarını input'a yükle
            document.getElementById('apiKey').value = items.geminiApiKey;
            
            // Prompt listesini yükle (boşsa varsayılanları kullan)
            prompts = (items.prompts && items.prompts.length > 0) 
                ? items.prompts 
                : DEFAULT_PROMPTS;

            // UI bileşenlerini doldur
            await populateModelSelect(items.selectedModel);
            renderPrompts();
            
            // Mevcut API anahtarını doğrula
            if (items.geminiApiKey) {
                await validateApiKey(items.geminiApiKey, true);
                // Tüm modellerin durumunu göster
                await updateAllModelsStatus();
            }
            
            // Yenile butonunu ayarla
            setupRefreshButton();
        }
    );
};

// =============================================================================
// MODEL SEÇİMİ
// =============================================================================

// checkModelAvailability fonksiyonu artık constants.js'de tanımlı


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

    // Her model için option elementi oluştur
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

    // İlk yüklemede bilgiyi göster
    updateInfo();

    // Seçim değişikliklerini dinle
    select.addEventListener('change', updateInfo);
};

/**
 * Tüm modellerin availability durumunu gösterir.
 * Her model için ayrı DOM elementi oluşturur ve sonuçlar hazır oldukça anında günceller.
 */
const updateAllModelsStatus = async () => {
    const statusDiv = document.getElementById('allModelsStatus');
    const statusList = document.getElementById('modelsStatusList');
    
    if (!statusDiv || !statusList) return;
    
    const apiKey = document.getElementById('apiKey').value;
    
    if (!apiKey || !apiKey.trim()) {
        statusDiv.style.display = 'none';
        return;
    }
    
    statusDiv.style.display = 'block';
    
    // Her model için ayrı bir DOM elementi oluştur (hepsi loading durumunda başlar)
    statusList.innerHTML = '';
    MODELS.forEach((model) => {
        const modelRowId = `model-status-${model.id}`;
        const modelRow = document.createElement('div');
        modelRow.id = modelRowId;
        modelRow.style.cssText = 'padding: 8px; margin-bottom: 5px; border-left: 3px solid #999; background: #f5f5f5;';
        modelRow.innerHTML = `
            <div>
                <strong>${model.name}</strong><br>
                <small style="color: #666;">⏳ Kontrol ediliyor...</small>
            </div>
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
            
            // Sonucu göster
            if (availability.available && !availability.quotaExceeded) {
                // Kullanılabilir - buton ekle
                modelRow.style.cssText = 'padding: 8px; margin-bottom: 5px; border-left: 3px solid #5cb85c; background: #f5f5f5; display: flex; align-items: center; justify-content: space-between;';
                modelRow.innerHTML = `
                    <div>
                        <strong>${model.name}</strong><br>
                        <small style="color: #5cb85c;"><strong>✅ Kullanılabilir</strong></small>
                    </div>
                    <button class="use-model-btn" data-model-id="${model.id}" style="padding: 6px 12px; background-color: #81c14b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; margin-left: 10px; font-weight: 500; transition: background-color 0.2s ease;">
                        Bu modeli kullan
                    </button>
                `;
                
                // Buton event listener ekle
                const useBtn = modelRow.querySelector('.use-model-btn');
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
};

/**
 * Yenile butonuna tıklandığında tüm modellerin durumunu yeniden kontrol eder.
 */
const refreshAllModelsStatus = async () => {
    await updateAllModelsStatus();
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
    chrome.storage.sync.set(settings, async () => {
        status.textContent = `Model "${model?.name || modelId}" seçildi ve ayarlar kaydedildi.`;
        status.className = 'status success';
        status.style.display = 'block';
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
            status.style.display = 'none';
        }, 3000);
        
        // Tüm modellerin durumunu güncelle (butonların görünümünü güncellemek için)
        await updateAllModelsStatus();
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
    list.innerHTML = '';

    prompts.forEach((item, index) => {
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
 * Sayfa yüklendiğinde ayarları geri yükle ve system prompt'u göster.
 */
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    displaySystemPrompt();
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
        copyBtn.textContent = '✓';
        copyBtn.style.backgroundColor = '#28a745';
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.backgroundColor = '#81c14b';
        }, 2000);
    } catch (err) {
        copyBtn.textContent = '✗';
        copyBtn.style.backgroundColor = '#d9534f';
        setTimeout(() => {
            copyBtn.textContent = '📋';
            copyBtn.style.backgroundColor = '#81c14b';
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
        // API key geçerliyse tüm modellerin durumunu göster
        if (validation.valid) {
            await updateAllModelsStatus();
        }
    } else {
        // Boş input'ta doğrulama sınıflarını kaldır ve modeller durumunu gizle
        e.target.classList.remove('valid', 'invalid');
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

