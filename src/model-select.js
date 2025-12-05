/**
 * @fileoverview Ekşi Sözlük AI Analiz - Hızlı Model Seçimi Popup'ı
 * 
 * Bu dosya eklenti simgesine tıklandığında açılan basit popup için
 * JavaScript kodunu içerir. Sadece model seçimi yapılabilir, tam ayarlara
 * erişim için ayarlar sayfası linki sunulur.
 * 
 * Bağımlılıklar:
 * - constants.js (MODELS)
 * - chrome.storage.sync API
 * - chrome.runtime API (options sayfasını açmak için)
 */

// =============================================================================
// MODEL SEÇİMİ
// =============================================================================

/**
 * Model seçim dropdown'ını MODELS listesiyle doldurur.
 * 
 * Basit bir dropdown oluşturur, options.js'deki gibi detaylı bilgi
 * göstermez (popup alanı sınırlı olduğu için).
 * 
 * @param {string} savedModelId - Önceden kaydedilmiş model ID'si
 */
const populateModelSelect = (savedModelId) => {
    const select = document.getElementById('modelSelect');

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
};

// =============================================================================
// AYARLARI KAYDETME VE GERİ YÜKLEME
// =============================================================================

/**
 * Sadece model seçimini kaydeder.
 * 
 * Diğer ayarları (API key, prompts) koruyarak sadece seçili modeli
 * günceller. Bu sayede popup'tan yapılan değişiklikler diğer ayarları
 * bozmaz.
 */
const saveOptions = () => {
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect.value;
    const status = document.getElementById('status');

    // Mevcut ayarları al, sadece modeli güncelle
    chrome.storage.sync.get(['geminiApiKey', 'prompts'], (items) => {
        const settings = {
            geminiApiKey: items.geminiApiKey || '',
            selectedModel: selectedModel,
            prompts: items.prompts || []
        };

        chrome.storage.sync.set(settings, () => {
            // Kullanıcıya kısa bir geri bildirim göster
            status.textContent = 'Model kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 2000);
        });
    });
};

/**
 * Kayıtlı model seçimini yükler.
 * 
 * Popup açıldığında mevcut model seçimini dropdown'da gösterir.
 */
const restoreOptions = () => {
    chrome.storage.sync.get(
        {
            // Varsayılan model (kayıt yoksa kullanılır)
            selectedModel: 'gemini-2.5-pro'
        },
        (items) => {
            populateModelSelect(items.selectedModel);
        }
    );
};

// =============================================================================
// EVENT LİSTENER'LAR
// =============================================================================

/**
 * Tam ayarlar sayfasına yönlendirme linki.
 * chrome.runtime.openOptionsPage() ile options.html açılır.
 */
document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

/**
 * Popup açıldığında kayıtlı ayarları yükle.
 */
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    
    // Model seçimi değiştiğinde otomatik kaydet
    // (popup'ta ayrı kaydet butonu olmadığı için)
    document.getElementById('modelSelect').addEventListener('change', saveOptions);
});
