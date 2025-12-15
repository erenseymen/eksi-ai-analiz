/**
 * @fileoverview Ekşi Sözlük AI Analiz - Kullanım İstatistikleri
 * 
 * API çağrılarını, token kullanımını ve cache istatistiklerini takip eder.
 * 
 * Not: İstatistikler chrome.storage.local kullanarak sadece mevcut cihazda saklanır (senkronize edilmez).
 */

// İstatistik sabitler
const STATS_STORAGE_KEY = 'eksi_ai_usage_stats';
const MAX_STATS_HISTORY = 100; // Son 100 çağrıyı sakla

// Chrome API mevcut mu kontrol et (file:// protokolünde çalışmaz)
const isChromeApiAvailable = () => {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
};

/**
 * Eski sync storage'daki istatistikleri local storage'a taşır (migration).
 * Sadece bir kez çalışır, sonraki çağrılarda hiçbir şey yapmaz.
 */
const migrateStatsFromSync = async () => {
    if (!isChromeApiAvailable()) return;
    try {
        // Local'de zaten veri varsa migration yapma
        const localResult = await chrome.storage.local.get(STATS_STORAGE_KEY);
        if (localResult[STATS_STORAGE_KEY]) {
            return; // Zaten local'de veri var
        }

        // Sync'ten veri oku (eski versiyonlardan kalan veri varsa)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            const syncResult = await chrome.storage.sync.get(STATS_STORAGE_KEY);
            if (syncResult[STATS_STORAGE_KEY]) {
                // Local'e taşı
                await chrome.storage.local.set({ [STATS_STORAGE_KEY]: syncResult[STATS_STORAGE_KEY] });
                // Sync'ten sil
                await chrome.storage.sync.remove(STATS_STORAGE_KEY);
            }
        }
    } catch (err) {
        console.warn('Stats migration hatası:', err);
    }
};

/**
 * Yeni bir API çağrısını kaydeder.
 * @param {Object} callData - Çağrı verileri
 * @param {string} callData.modelId - Kullanılan model
 * @param {number} callData.tokenEstimate - Tahmini token sayısı
 * @param {number} callData.responseTime - Yanıt süresi (ms)
 * @param {boolean} callData.fromCache - Cache'den mi geldi
 * @param {string} callData.topicTitle - Başlık adı
 */
const recordApiCall = async (callData) => {
    if (!isChromeApiAvailable()) return;
    try {
        const stats = await getUsageStats();

        const record = {
            timestamp: Date.now(),
            modelId: callData.modelId,
            tokenEstimate: callData.tokenEstimate || 0,
            responseTime: callData.responseTime || 0,
            fromCache: callData.fromCache || false,
            topicTitle: callData.topicTitle || ''
        };

        stats.history.unshift(record);

        // Limit history size
        if (stats.history.length > MAX_STATS_HISTORY) {
            stats.history = stats.history.slice(0, MAX_STATS_HISTORY);
        }

        // Toplam istatistikleri güncelle
        stats.totals.apiCalls++;
        stats.totals.totalTokens += record.tokenEstimate;

        await chrome.storage.local.set({ [STATS_STORAGE_KEY]: stats });
    } catch (err) {
        console.warn('Stats kaydetme hatası:', err);
    }
};

/**
 * Cache hit kaydeder (API çağrısı olmadan cache'den sonuç gösterildiğinde).
 */
const recordCacheHit = async () => {
    if (!isChromeApiAvailable()) return;
    try {
        const stats = await getUsageStats();
        stats.totals.cacheHits++;
        await chrome.storage.local.set({ [STATS_STORAGE_KEY]: stats });
    } catch (err) {
        console.warn('Cache hit kaydetme hatası:', err);
    }
};

/**
 * Tüm kullanım istatistiklerini döndürür.
 * @returns {Promise<Object>} İstatistik objesi
 */
const getUsageStats = async () => {
    if (!isChromeApiAvailable()) {
        return { totals: { apiCalls: 0, totalTokens: 0 }, history: [] };
    }
    try {
        // İlk çağrıda migration yap (sync'ten local'e)
        await migrateStatsFromSync();

        const result = await chrome.storage.local.get(STATS_STORAGE_KEY);
        return result[STATS_STORAGE_KEY] || {
            totals: {
                apiCalls: 0,
                totalTokens: 0
            },
            history: []
        };
    } catch (err) {
        console.warn('Stats okuma hatası:', err);
        return {
            totals: { apiCalls: 0, totalTokens: 0 },
            history: []
        };
    }
};

/**
 * İstatistikleri sıfırlar.
 */
const clearUsageStats = async () => {
    if (!isChromeApiAvailable()) return;
    try {
        await chrome.storage.local.remove(STATS_STORAGE_KEY);
        // Sync'te eski veri varsa onu da temizle (migration öncesi)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            await chrome.storage.sync.remove(STATS_STORAGE_KEY);
        }
    } catch (err) {
        console.warn('Stats silme hatası:', err);
    }
};

/**
 * Özet istatistikleri hesaplar.
 * @returns {Promise<Object>} Özet objesi
 */
const getStatsSummary = async () => {
    const stats = await getUsageStats();
    const { totals, history } = stats;

    // Son 24 saat
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = history.filter(h => h.timestamp > oneDayAgo);

    // Son 7 gün
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last7d = history.filter(h => h.timestamp > oneWeekAgo);

    // Model kullanım dağılımı
    const modelUsage = {};
    history.forEach(h => {
        modelUsage[h.modelId] = (modelUsage[h.modelId] || 0) + 1;
    });

    return {
        totals,
        last24h: {
            apiCalls: last24h.filter(h => !h.fromCache).length,
            totalTokens: last24h.reduce((sum, h) => sum + h.tokenEstimate, 0)
        },
        last7d: {
            apiCalls: last7d.filter(h => !h.fromCache).length,
            totalTokens: last7d.reduce((sum, h) => sum + h.tokenEstimate, 0)
        },
        modelUsage,
        recentHistory: history.slice(0, 10) // Son 10 çağrı
    };
};
