/**
 * @fileoverview Ekşi Sözlük AI Analiz - Analiz Geçmişi Yönetimi
 * 
 * Bu dosya analiz geçmişini yönetir:
 * - Analiz sonuçlarını chrome.storage.local'e kaydetme
 * - Geçmişi alma ve temizleme
 * 
 * Not: Bu dosya popup sayfasındaki history.js'den farklıdır.
 * O dosya geçmiş sayfasının UI'ını yönetirken, bu dosya
 * content script içinde geçmiş kaydetme işlemlerini yapar.
 * 
 * Bağımlılıklar: Yok
 */

// =============================================================================
// ANALİZ GEÇMİŞİ
// =============================================================================

/** @type {number} Geçmişin varsayılan saklama süresi (gün) */
const DEFAULT_HISTORY_RETENTION_DAYS = 30;

/**
 * Analiz sonucunu geçmişe kaydeder.
 * 
 * chrome.storage.local kullanarak kalıcı depolama sağlar.
 * Ayarlanan saklama süresinden eski kayıtlar otomatik olarak temizlenir.
 * 
 * @param {Object} analysisData - Kaydedilecek analiz verisi
 * @param {string} analysisData.topicTitle - Başlık adı
 * @param {string} analysisData.topicId - Başlık ID'si
 * @param {string} analysisData.prompt - Kullanılan prompt
 * @param {string} analysisData.response - AI yanıtı
 * @param {string} analysisData.modelId - Kullanılan model
 * @param {number} analysisData.entryCount - Entry sayısı
 * @returns {Promise<void>}
 */
const saveToHistory = async (analysisData) => {
    return new Promise((resolve) => {
        // Hem geçmiş hem de saklama süresini al
        chrome.storage.local.get({
            analysisHistory: [],
            historyRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS
        }, (result) => {
            let history = result.analysisHistory;
            const retentionDays = result.historyRetentionDays;

            // Yeni kayıt oluştur
            const newEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                topicTitle: analysisData.topicTitle,
                topicId: analysisData.topicId,
                topicUrl: window.location.href,
                prompt: analysisData.prompt,
                promptPreview: analysisData.prompt.substring(0, 100) + (analysisData.prompt.length > 100 ? '...' : ''),
                response: analysisData.response,
                responsePreview: analysisData.response.substring(0, 200) + (analysisData.response.length > 200 ? '...' : ''),
                modelId: analysisData.modelId,
                entryCount: analysisData.entryCount,
                responseTime: analysisData.responseTime
            };

            // Başa ekle (en yeni en üstte)
            history.unshift(newEntry);

            // Eski kayıtları temizle (ayarlanan saklama süresine göre, 0 = sınırsız)
            if (retentionDays > 0) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
                history = history.filter(item => {
                    const itemDate = new Date(item.timestamp);
                    return itemDate >= cutoffDate;
                });
            }

            chrome.storage.local.set({ analysisHistory: history }, resolve);
        });
    });
};

/**
 * Kaydedilmiş analiz geçmişini alır.
 * 
 * @returns {Promise<Array>} Analiz geçmişi listesi (en yeniden en eskiye)
 */
const getHistory = async () => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ analysisHistory: [] }, (result) => {
            resolve(result.analysisHistory);
        });
    });
};

/**
 * Tüm analiz geçmişini temizler.
 * 
 * @returns {Promise<void>}
 */
const clearHistory = async () => {
    return new Promise((resolve) => {
        chrome.storage.local.set({ analysisHistory: [] }, resolve);
    });
};
