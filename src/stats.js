/**
 * @fileoverview Ekşi Sözlük AI Analiz - Kullanım İstatistikleri
 * 
 * API çağrılarını, token kullanımını ve cache istatistiklerini takip eder.
 * 
 * Not: İstatistikler chrome.storage.sync kullanarak tüm cihazlarda senkronize edilir.
 */

// İstatistik sabitler
const STATS_STORAGE_KEY = 'eksi_ai_usage_stats';
const MAX_STATS_HISTORY = 100; // Son 100 çağrıyı sakla

/**
 * Mevcut local storage'daki istatistikleri sync storage'a taşır (migration).
 * Sadece bir kez çalışır, sonraki çağrılarda hiçbir şey yapmaz.
 */
const migrateStatsToSync = async () => {
    try {
        // Sync'te zaten veri varsa migration yapma
        const syncResult = await chrome.storage.sync.get(STATS_STORAGE_KEY);
        if (syncResult[STATS_STORAGE_KEY]) {
            return; // Zaten sync'te veri var
        }

        // Local'den veri oku
        const localResult = await chrome.storage.local.get(STATS_STORAGE_KEY);
        if (localResult[STATS_STORAGE_KEY]) {
            // Sync'e taşı
            await chrome.storage.sync.set({ [STATS_STORAGE_KEY]: localResult[STATS_STORAGE_KEY] });
            // Local'den sil
            await chrome.storage.local.remove(STATS_STORAGE_KEY);
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
        if (record.fromCache) {
            stats.totals.cacheHits++;
        }

        await chrome.storage.sync.set({ [STATS_STORAGE_KEY]: stats });
    } catch (err) {
        console.warn('Stats kaydetme hatası:', err);
    }
};

/**
 * Cache hit kaydeder (API çağrısı olmadan cache'den sonuç gösterildiğinde).
 */
const recordCacheHit = async () => {
    try {
        const stats = await getUsageStats();
        stats.totals.cacheHits++;
        await chrome.storage.sync.set({ [STATS_STORAGE_KEY]: stats });
    } catch (err) {
        console.warn('Cache hit kaydetme hatası:', err);
    }
};

/**
 * Tüm kullanım istatistiklerini döndürür.
 * @returns {Promise<Object>} İstatistik objesi
 */
const getUsageStats = async () => {
    try {
        // İlk çağrıda migration yap
        await migrateStatsToSync();

        const result = await chrome.storage.sync.get(STATS_STORAGE_KEY);
        return result[STATS_STORAGE_KEY] || {
            totals: {
                apiCalls: 0,
                totalTokens: 0,
                cacheHits: 0
            },
            history: []
        };
    } catch (err) {
        console.warn('Stats okuma hatası:', err);
        return {
            totals: { apiCalls: 0, totalTokens: 0, cacheHits: 0 },
            history: []
        };
    }
};

/**
 * İstatistikleri sıfırlar.
 */
const clearUsageStats = async () => {
    try {
        await chrome.storage.sync.remove(STATS_STORAGE_KEY);
        // Local'de eski veri varsa onu da temizle (migration sonrası)
        await chrome.storage.local.remove(STATS_STORAGE_KEY);
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
            cacheHits: last24h.filter(h => h.fromCache).length,
            totalTokens: last24h.reduce((sum, h) => sum + h.tokenEstimate, 0)
        },
        last7d: {
            apiCalls: last7d.filter(h => !h.fromCache).length,
            cacheHits: last7d.filter(h => h.fromCache).length,
            totalTokens: last7d.reduce((sum, h) => sum + h.tokenEstimate, 0)
        },
        modelUsage,
        recentHistory: history.slice(0, 10) // Son 10 çağrı
    };
};
