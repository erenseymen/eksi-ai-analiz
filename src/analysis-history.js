/**
 * @fileoverview Ekşi Sözlük AI Analiz - Analiz Geçmişi Yönetimi
 * 
 * Bu dosya analiz geçmişini yönetir:
 * - Scrape edilmiş entry'leri ve analiz sonuçlarını chrome.storage.local'e kaydetme
 * - Geçmişi alma ve temizleme
 * 
 * Veri Yapısı:
 * - scrapedData: Array of { id, topicId, topicTitle, topicUrl, scrapedAt, entryCount, sourceEntries, wasStopped, analyses: [...] }
 * - Her başlık için tek bir scrape kaydı tutulur
 * - Aynı scrape için yapılan tüm analizler analyses array'inde tutulur
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
 * Scrape edilmiş entry'leri veya analiz sonuçlarını kaydeder.
 * 
 * - Eğer scrapeOnly ise: scrapedData'da aynı başlık için kayıt varsa günceller ve sona taşır, yoksa yeni ekler
 * - Eğer analiz ise: scrapedData'da ilgili scrape'i bulur ve analyses array'ine ekler
 * 
 * @param {Object} data - Kaydedilecek veri
 * @param {string} data.topicTitle - Başlık adı
 * @param {string} data.topicId - Başlık ID'si
 * @param {number} data.entryCount - Entry sayısı
 * @param {Array} [data.sourceEntries] - Kaynak entry'ler (scrapeOnly için zorunlu)
 * @param {boolean} [data.scrapeOnly] - Sadece scrape verisi mi (response yok)
 * @param {boolean} [data.wasStopped] - İşlem yarıda mı kesildi
 * @param {string} [data.prompt] - Kullanılan prompt (analiz için)
 * @param {string} [data.response] - AI yanıtı (analiz için)
 * @param {string} [data.modelId] - Kullanılan model (analiz için)
 * @param {number} [data.responseTime] - Yanıt süresi (ms, analiz için)
 * @returns {Promise<void>}
 */
const saveToHistory = async (data) => {
    return new Promise((resolve) => {
        chrome.storage.local.get({
            scrapedData: [],
            historyRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS
        }, (result) => {
            let scrapedData = result.scrapedData;
            const retentionDays = result.historyRetentionDays;

            if (data.scrapeOnly) {
                // Scrape kaydetme/güncelleme
                const topicKey = data.topicId || data.topicTitle;
                const existingIndex = scrapedData.findIndex(item => {
                    const itemKey = item.topicId || item.topicTitle;
                    return itemKey === topicKey;
                });

                if (existingIndex >= 0) {
                    // Mevcut scrape'i güncelle
                    const existing = scrapedData[existingIndex];
                    existing.scrapedAt = new Date().toISOString();
                    existing.entryCount = data.entryCount;
                    existing.sourceEntries = data.sourceEntries || [];
                    existing.wasStopped = data.wasStopped || false;
                    existing.topicUrl = window.location.href;
                    
                    // Sona taşı (en yeni en sonda)
                    scrapedData.splice(existingIndex, 1);
                    scrapedData.push(existing);
                } else {
                    // Yeni scrape ekle
                    const newScrape = {
                        id: `scrape-${Date.now()}`,
                        topicId: data.topicId || '',
                        topicTitle: data.topicTitle,
                        topicUrl: window.location.href,
                        scrapedAt: new Date().toISOString(),
                        entryCount: data.entryCount,
                        sourceEntries: data.sourceEntries || [],
                        wasStopped: data.wasStopped || false,
                        analyses: []
                    };
                    scrapedData.push(newScrape);
                }
            } else {
                // Analiz kaydetme
                const topicKey = data.topicId || data.topicTitle;
                const scrapeIndex = scrapedData.findIndex(item => {
                    const itemKey = item.topicId || item.topicTitle;
                    return itemKey === topicKey;
                });

                if (scrapeIndex >= 0) {
                    // İlgili scrape'i bulduk, analyses'e ekle
                    const scrape = scrapedData[scrapeIndex];
                    const newAnalysis = {
                        id: `analysis-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        prompt: data.prompt || '',
                        promptPreview: data.prompt ? (data.prompt.substring(0, 100) + (data.prompt.length > 100 ? '...' : '')) : '',
                        response: data.response || '',
                        responsePreview: data.response ? (data.response.substring(0, 200) + (data.response.length > 200 ? '...' : '')) : '',
                        modelId: data.modelId || '',
                        responseTime: data.responseTime || 0
                    };
                    scrape.analyses.push(newAnalysis);
                } else {
                    // Scrape bulunamadı, önce scrape oluştur sonra analiz ekle
                    const newScrape = {
                        id: `scrape-${Date.now()}`,
                        topicId: data.topicId || '',
                        topicTitle: data.topicTitle,
                        topicUrl: window.location.href,
                        scrapedAt: new Date().toISOString(),
                        entryCount: data.entryCount || 0,
                        sourceEntries: data.sourceEntries || [],
                        wasStopped: false,
                        analyses: [{
                            id: `analysis-${Date.now()}`,
                            timestamp: new Date().toISOString(),
                            prompt: data.prompt || '',
                            promptPreview: data.prompt ? (data.prompt.substring(0, 100) + (data.prompt.length > 100 ? '...' : '')) : '',
                            response: data.response || '',
                            responsePreview: data.response ? (data.response.substring(0, 200) + (data.response.length > 200 ? '...' : '')) : '',
                            modelId: data.modelId || '',
                            responseTime: data.responseTime || 0
                        }]
                    };
                    scrapedData.push(newScrape);
                }
            }

            // Eski kayıtları temizle (ayarlanan saklama süresine göre, 0 = sınırsız)
            if (retentionDays > 0) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
                const cutoffTime = cutoffDate.getTime();
                
                scrapedData = scrapedData.filter(item => {
                    const itemDate = new Date(item.scrapedAt);
                    return itemDate.getTime() >= cutoffTime;
                });
            }

            chrome.storage.local.set({ scrapedData }, resolve);
        });
    });
};

/**
 * Kaydedilmiş analiz geçmişini alır (flat view).
 * 
 * Her analiz için ayrı bir entry döndürür, scrape bilgileri de dahil edilir.
 * UI'da gösterim için kullanılır.
 * 
 * @returns {Promise<Array>} Analiz geçmişi listesi (en yeniden en eskiye, timestamp'e göre sıralı)
 */
const getHistory = async () => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ scrapedData: [] }, (result) => {
            const scrapedData = result.scrapedData;
            const flatHistory = [];

            // Her scrape için
            scrapedData.forEach(scrape => {
                // Scrape-only entry (analiz yoksa)
                if (scrape.analyses.length === 0) {
                    flatHistory.push({
                        id: scrape.id,
                        timestamp: scrape.scrapedAt,
                        topicTitle: scrape.topicTitle,
                        topicId: scrape.topicId,
                        topicUrl: scrape.topicUrl,
                        entryCount: scrape.entryCount,
                        sourceEntries: scrape.sourceEntries,
                        scrapeOnly: true,
                        wasStopped: scrape.wasStopped,
                        prompt: '',
                        promptPreview: '',
                        response: '',
                        responsePreview: '',
                        modelId: '',
                        responseTime: 0
                    });
                } else {
                    // Her analiz için ayrı entry
                    scrape.analyses.forEach(analysis => {
                        flatHistory.push({
                            id: analysis.id,
                            timestamp: analysis.timestamp,
                            topicTitle: scrape.topicTitle,
                            topicId: scrape.topicId,
                            topicUrl: scrape.topicUrl,
                            entryCount: scrape.entryCount,
                            sourceEntries: scrape.sourceEntries,
                            scrapeOnly: false,
                            wasStopped: scrape.wasStopped,
                            prompt: analysis.prompt,
                            promptPreview: analysis.promptPreview,
                            response: analysis.response,
                            responsePreview: analysis.responsePreview,
                            modelId: analysis.modelId,
                            responseTime: analysis.responseTime
                        });
                    });
                }
            });

            // Timestamp'e göre sırala (descending - en yeni en üstte)
            flatHistory.sort((a, b) => {
                const dateA = new Date(a.timestamp);
                const dateB = new Date(b.timestamp);
                return dateB - dateA; // Descending order
            });

            resolve(flatHistory);
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
        chrome.storage.local.set({ scrapedData: [] }, resolve);
    });
};

/**
 * Belirli bir URL için kaydedilmiş analiz sonuçlarını alır.
 * 
 * URL'nin base path'ini kullanarak eşleşme yapar (query parametreleri dahil).
 * 
 * @param {string} url - Kontrol edilecek URL
 * @returns {Promise<Array>} URL ile eşleşen analiz sonuçları listesi (flat view)
 */
const getCachedAnalysisForUrl = async (url) => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ scrapedData: [] }, (result) => {
            const scrapedData = result.scrapedData;

            // URL'leri normalize et (trailing slash, hash kaldır)
            const normalizeUrl = (u) => {
                try {
                    const parsed = new URL(u);
                    // Hash'i kaldır, pathname ve search'ü birleştir
                    return parsed.origin + parsed.pathname + parsed.search;
                } catch {
                    return u;
                }
            };

            const normalizedUrl = normalizeUrl(url);
            const matches = [];

            // Eşleşen scrape'leri bul
            scrapedData.forEach(scrape => {
                const itemUrl = normalizeUrl(scrape.topicUrl);
                if (itemUrl === normalizedUrl) {
                    // Scrape-only entry
                    if (scrape.analyses.length === 0) {
                        matches.push({
                            id: scrape.id,
                            timestamp: scrape.scrapedAt,
                            topicTitle: scrape.topicTitle,
                            topicId: scrape.topicId,
                            topicUrl: scrape.topicUrl,
                            entryCount: scrape.entryCount,
                            sourceEntries: scrape.sourceEntries,
                            scrapeOnly: true,
                            wasStopped: scrape.wasStopped,
                            prompt: '',
                            promptPreview: '',
                            response: '',
                            responsePreview: '',
                            modelId: '',
                            responseTime: 0
                        });
                    } else {
                        // Her analiz için ayrı entry
                        scrape.analyses.forEach(analysis => {
                            matches.push({
                                id: analysis.id,
                                timestamp: analysis.timestamp,
                                topicTitle: scrape.topicTitle,
                                topicId: scrape.topicId,
                                topicUrl: scrape.topicUrl,
                                entryCount: scrape.entryCount,
                                sourceEntries: scrape.sourceEntries,
                                scrapeOnly: false,
                                wasStopped: scrape.wasStopped,
                                prompt: analysis.prompt,
                                promptPreview: analysis.promptPreview,
                                response: analysis.response,
                                responsePreview: analysis.responsePreview,
                                modelId: analysis.modelId,
                                responseTime: analysis.responseTime
                            });
                        });
                    }
                }
            });

            resolve(matches);
        });
    });
};
