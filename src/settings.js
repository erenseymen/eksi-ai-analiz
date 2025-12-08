/**
 * @fileoverview Ekşi Sözlük AI Analiz - Ayarlar Yönetimi
 * 
 * Bu dosya Chrome storage'dan kullanıcı ayarlarını yönetir.
 * 
 * Bağımlılıklar:
 * - prompts.js (DEFAULT_PROMPTS)
 */

// =============================================================================
// AYARLAR
// =============================================================================

/**
 * Chrome storage'dan kullanıcı ayarlarını alır.
 * 
 * @returns {Promise<{geminiApiKey: string, selectedModel: string, prompts: Array}>}
 *          Kullanıcı ayarları objesi
 */
const getSettings = async () => {
    return new Promise((resolve) => {
        chrome.storage.sync.get({
            geminiApiKey: '',
            selectedModel: 'gemini-2.5-flash',
            prompts: DEFAULT_PROMPTS
        }, (items) => {
            // Boş veya tanımsız prompt listesi için varsayılan değerleri kullan
            if (!items.prompts || items.prompts.length === 0) {
                items.prompts = DEFAULT_PROMPTS;
            }
            resolve(items);
        });
    });
};
