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

    // Mevcut ayarları al ve sadece modeli güncelle
    chrome.storage.sync.get(['geminiApiKey', 'prompts'], (items) => {
        const settings = {
            geminiApiKey: items.geminiApiKey || '',
            selectedModel: selectedModel,
            prompts: items.prompts || []
        };

        chrome.storage.sync.set(settings, () => {
            window.close();
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
 * Geçmiş sayfasını açar.
 * chrome.tabs.create() ile history.html açılır.
 */
document.getElementById('historyLink').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/history.html') });
    window.close();
});

/**
 * Tam ayarlar sayfasına yönlendirme linki.
 * chrome.runtime.openOptionsPage() ile options.html açılır.
 */
document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
});

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
const restoreTheme = () => {
    chrome.storage.sync.get(
        {
            theme: 'auto'
        },
        (items) => {
            applyTheme(items.theme || 'auto');
        }
    );
};

/**
 * Storage değişikliklerini dinle ve temayı güncelle.
 */
const setupThemeStorageListener = () => {
    // Mevcut listener'ları kaldır (çoklu kurulumu önlemek için)
    if (window.themeStorageListener) {
        chrome.storage.onChanged.removeListener(window.themeStorageListener);
    }
    
    // Yeni listener oluştur
    window.themeStorageListener = (changes, areaName) => {
        if (areaName === 'sync' && changes.theme) {
            const newTheme = changes.theme.newValue || 'auto';
            applyTheme(newTheme);
        }
    };
    
    chrome.storage.onChanged.addListener(window.themeStorageListener);
};

/**
 * Popup açıldığında kayıtlı ayarları yükle.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Önce temayı yükle (sayfa yüklenirken hemen uygulanması için)
    restoreTheme();
    // Storage değişikliklerini dinle (options sayfasından tema değişikliği için)
    setupThemeStorageListener();
    
    // Sayfa görünür olduğunda temayı kontrol et (diğer sekmelerden döndüğünde)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            restoreTheme();
        }
    });
    
    restoreOptions();

    // Model değiştiğinde otomatik kaydet
    document.getElementById('modelSelect').addEventListener('change', saveOptions);
});
