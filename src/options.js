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
    chrome.storage.sync.set(settings, () => {
        status.textContent = 'Ayarlar kaydedildi.';
        status.className = 'status success';
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
            status.style.display = 'none';
        }, 3000);

        // State tutarlılığı için listeyi yeniden render et
        renderPrompts();
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
            populateModelSelect(items.selectedModel);
            renderPrompts();
            
            // Mevcut API anahtarını doğrula
            if (items.geminiApiKey) {
                await validateApiKey(items.geminiApiKey, true);
            }
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
 * 
 * @param {string} savedModelId - Önceden kaydedilmiş model ID'si
 */
const populateModelSelect = (savedModelId) => {
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
     */
    const updateInfo = () => {
        const selectedId = select.value;
        const model = MODELS.find(m => m.id === selectedId);
        if (model) {
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
    };

    // İlk yüklemede bilgiyi göster
    updateInfo();

    // Seçim değişikliklerini dinle
    select.addEventListener('change', updateInfo);
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
 * Sayfa yüklendiğinde ayarları geri yükle.
 */
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
});

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
        await validateApiKey(apiKey, true);
    } else {
        // Boş input'ta doğrulama sınıflarını kaldır
        e.target.classList.remove('valid', 'invalid');
    }
});
