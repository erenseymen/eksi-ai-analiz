/**
 * @fileoverview Ekşi Sözlük AI Analiz - Analiz Geçmişi Sayfası
 * 
 * Bu dosya analiz geçmişi sayfasının JavaScript kodunu içerir.
 * Kaydedilmiş analizleri listeler, görüntüler, kopyalar ve siler.
 * 
 * Bağımlılıklar:
 * - constants.js (escapeHtml fonksiyonu)
 * - chrome.storage.local API
 */

// =============================================================================
// SABİTLER
// =============================================================================

/** @type {number} Geçmişin varsayılan saklama süresi (gün) */
const DEFAULT_RETENTION_DAYS = 30;

/** @type {number} Sayfa başına gösterilecek kayıt sayısı */
const ITEMS_PER_PAGE = 20;

/** @type {number} Geçerli saklama süresi (gün) - sayfa yüklendiğinde güncellenir */
let currentRetentionDays = DEFAULT_RETENTION_DAYS;

/** @type {number} Şu an gösterilen kayıt sayısı */
let displayedCount = 0;

/** @type {Array} Tüm geçmiş verileri */
let allHistoryData = [];

/** @type {Set<string>} Seçilen öğelerin ID'leri */
let selectedItems = new Set();

/** @type {Object|null} Yeniden analiz modal'ı için saklanan kaynak verileri */
let reanalyzeSourceData = null;

/**
 * Saklama süresini storage'dan alır.
 * 
 * @returns {Promise<number>} Saklama süresi (gün)
 */
const getRetentionDays = async () => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ historyRetentionDays: DEFAULT_RETENTION_DAYS }, (result) => {
            resolve(result.historyRetentionDays);
        });
    });
};

/**
 * Saklama süresini storage'a kaydeder.
 * 
 * @param {number} days - Saklama süresi (gün)
 * @returns {Promise<void>}
 */
const setRetentionDays = async (days) => {
    return new Promise((resolve) => {
        chrome.storage.local.set({ historyRetentionDays: days }, resolve);
    });
};

/**
 * Eski kayıtları temizler (ayarlanan saklama süresine göre).
 * 
 * scrapedData'da scrapedAt timestamp'ine göre filtreleme yapar.
 * Tek kaynak ve çoklu kaynak kayıtları aynı şekilde işlenir.
 * 
 * @param {number} days - Saklama süresi (gün), 0 = sınırsız
 * @returns {Promise<number>} Silinen kayıt sayısı
 */
const cleanupOldEntries = async (days) => {
    // Sınırsız ise temizleme yapma
    if (days === 0) {
        return 0;
    }

    return new Promise((resolve) => {
        chrome.storage.local.get({ 
            scrapedData: []
        }, (result) => {
            let scrapedData = result.scrapedData || [];
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffTime = cutoffDate.getTime();

            const originalCount = scrapedData.length;

            const filteredScrapes = scrapedData.filter(item => {
                const itemDate = new Date(item.scrapedAt);
                return itemDate.getTime() >= cutoffTime;
            });

            const deletedCount = originalCount - filteredScrapes.length;

            chrome.storage.local.set({ 
                scrapedData: filteredScrapes
            }, () => {
                resolve(deletedCount);
            });
        });
    });
};

// =============================================================================
// DOSYA İŞLEMLERİ
// =============================================================================

// Not: sanitizeFilename fonksiyonu utils.js'den gelir

/**
 * Timestamp'i dosya isimlerinde kullanılabilir formata çevirir.
 * 
 * @param {string} timestamp - ISO formatında timestamp (örn: "2024-01-15T14:30:00.000Z")
 * @returns {string} Dosya isimlerinde kullanılabilir format (örn: "20240115-143000")
 */
const formatTimestampForFilename = (timestamp) => {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}${seconds}`;
    } catch (err) {
        console.warn('Timestamp formatlama hatası:', err);
        return '';
    }
};

// =============================================================================
// GEÇMİŞ YÖNETİMİ
// =============================================================================

/**
 * Kaydedilmiş analiz geçmişini alır (tek kaynak + çoklu kaynak scrapes).
 * 
 * Her unique scrape için bir item döndürür, analyses içinde tutulur.
 * Çoklu kaynak kayıtları da scrapedData içinde tutulur (sourceScrapes array'i ile).
 * 
 * @returns {Promise<Array>} Tek ve çoklu kaynak scrapes listesi (en yeniden en eskiye, timestamp'e göre sıralı)
 */
const getHistory = async () => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ 
            scrapedData: []
        }, (result) => {
            const scrapedData = result.scrapedData || [];

            // Her scrape için analyses'leri timestamp'e göre sırala (en yeni en üstte)
            scrapedData.forEach(scrape => {
                if (scrape.analyses && scrape.analyses.length > 0) {
                    scrape.analyses.sort((a, b) => {
                        const dateA = new Date(a.timestamp);
                        const dateB = new Date(b.timestamp);
                        return dateB - dateA; // Descending order
                    });
                }
            });

            // scrapedAt'e göre sırala (descending - en yeni en üstte)
            scrapedData.sort((a, b) => {
                const dateA = new Date(a.scrapedAt);
                const dateB = new Date(b.scrapedAt);
                return dateB - dateA; // Descending order
            });

            resolve(scrapedData);
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
        chrome.storage.local.set({ 
            scrapedData: []
        }, resolve);
    });
};

/**
 * Belirli bir analizi geçmişten siler.
 * 
 * @param {string} itemId - Silinecek analizin ID'si (analysis ID, scrape ID veya multi-analysis ID)
 * @returns {Promise<void>}
 */
const deleteHistoryItem = async (itemId) => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ 
            scrapedData: []
        }, (result) => {
            let scrapedData = result.scrapedData || [];

            // Scrape ID'si mi kontrol et (tek veya çoklu kaynak)
            if (itemId.startsWith('scrape-') || itemId.startsWith('multi-analysis-')) {
                // Scrape'i tamamen sil (tek veya çoklu kaynak)
                scrapedData = scrapedData.filter(item => item.id !== itemId);
                chrome.storage.local.set({ scrapedData }, resolve);
            } else {
                // Analysis ID'si, ilgili scrape'den analizi sil (tek veya çoklu kaynak)
                scrapedData = scrapedData.map(scrape => {
                    if (scrape.analyses && scrape.analyses.some(a => a.id === itemId)) {
                        const filteredAnalyses = scrape.analyses.filter(a => a.id !== itemId);
                        // Eğer tüm analizler silindiyse, scrape'i de sil
                        if (filteredAnalyses.length === 0) {
                            return null;
                        }
                        const updatedScrape = {
                            ...scrape,
                            analyses: filteredAnalyses
                        };
                        // Çoklu kaynak kaydıysa lastUpdated'i güncelle
                        if (scrape.sourceScrapes && scrape.sourceScrapes.length > 0) {
                            updatedScrape.lastUpdated = new Date().toISOString();
                        }
                        return updatedScrape;
                    }
                    return scrape;
                }).filter(scrape => scrape !== null); // null olanları filtrele
                
                chrome.storage.local.set({ scrapedData }, resolve);
            }
        });
    });
};

// Not: createSourceEntriesHash fonksiyonu shared-utils.js'den gelir

/**
 * Geçmiş sayfasından yapılan analiz sonuçlarını geçmişe kaydeder.
 * 
 * Birden fazla başlık içeren analizler için özel işlem yapar.
 * Çoklu kaynak analizleri scrapedData'ya kaydedilir (sourceScrapes array'i ile).
 * 
 * @param {Object} analysisData - Kaydedilecek analiz verisi
 * @param {string} analysisData.topicTitle - Başlık adı
 * @param {string} analysisData.topicId - Başlık ID'si
 * @param {string} analysisData.topicUrl - Başlık URL'si
 * @param {string} analysisData.prompt - Kullanılan prompt
 * @param {string} analysisData.response - AI yanıtı
 * @param {string} analysisData.modelId - Kullanılan model
 * @param {number} analysisData.entryCount - Entry sayısı
 * @param {number} analysisData.responseTime - Yanıt süresi (ms)
 * @param {Array} analysisData.sourceEntries - Kaynak entry'ler
 * @param {Array} [analysisData.topics] - Birden fazla başlık içeren analizler için topics dizisi
 * @param {Array} [analysisData.sourceScrapes] - Kaynak scrape'ler (çoklu scrape analizi için)
 * @returns {Promise<void>}
 */
const saveToHistoryFromPage = async (analysisData) => {
    return new Promise((resolve) => {
        chrome.storage.local.get({
            scrapedData: [],
            historyRetentionDays: DEFAULT_RETENTION_DAYS
        }, (result) => {
            let scrapedData = result.scrapedData || [];
            const retentionDays = result.historyRetentionDays;

            const prompt = analysisData.prompt || '';
            const response = analysisData.response || '';

            // Çoklu kaynak analizi (sourceScrapes varsa)
            if (analysisData.sourceScrapes && analysisData.sourceScrapes.length > 1) {
                // Kaynak hash'lerini sırala ve birleştir (unique identifier olarak kullan)
                const sourceHashes = analysisData.sourceScrapes
                    .map(s => s.sourceEntriesHash)
                    .filter(h => h)
                    .sort();
                const combinedHash = sourceHashes.join('|');
                
                // Aynı kaynak kombinasyonuna sahip mevcut bir kayıt var mı? (scrapedData içinde)
                const existingIndex = scrapedData.findIndex(item => {
                    // Çoklu kaynak kaydı mı kontrol et (sourceScrapes array'i varsa)
                    if (!item.sourceScrapes || item.sourceScrapes.length === 0) {
                        return false;
                    }
                    const existingHashes = item.sourceScrapes
                        .map(s => s.sourceEntriesHash)
                        .filter(h => h)
                        .sort();
                    return existingHashes.join('|') === combinedHash;
                });

                const newAnalysis = {
                    id: `analysis-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    prompt: prompt,
                    promptPreview: prompt ? (prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')) : '',
                    response: response,
                    responsePreview: response ? (response.substring(0, 200) + (response.length > 200 ? '...' : '')) : '',
                    modelId: analysisData.modelId || '',
                    responseTime: analysisData.responseTime || 0
                };

                if (existingIndex >= 0) {
                    // Mevcut kayda analizi ekle
                    if (!scrapedData[existingIndex].analyses) {
                        scrapedData[existingIndex].analyses = [];
                    }
                    scrapedData[existingIndex].analyses.push(newAnalysis);
                    // Timestamp'i güncelle (en son analiz zamanı)
                    scrapedData[existingIndex].lastUpdated = new Date().toISOString();
                } else {
                    // Yeni çoklu kaynak kaydı oluştur
                    const newMultiSourceScrape = {
                        id: `multi-analysis-${Date.now()}`,
                        sourceEntriesHash: combinedHash,
                        scrapedAt: new Date().toISOString(),
                        sourceScrapes: analysisData.sourceScrapes.map(scrape => ({
                            scrapeId: scrape.id,
                            sourceEntriesHash: scrape.sourceEntriesHash,
                            topicTitle: scrape.topicTitle,
                            topicUrl: scrape.topicUrl,
                            topicId: scrape.topicId,
                            entryCount: scrape.entryCount || (scrape.sourceEntries ? scrape.sourceEntries.length : 0)
                        })),
                        analyses: [newAnalysis]
                    };
                    scrapedData.push(newMultiSourceScrape);
                }
            } else {
                // Tek başlık için normal işlem
                const sourceEntries = analysisData.sourceEntries || [];
                createSourceEntriesHash(sourceEntries).then(sourceEntriesHash => {
                    const scrapeIndex = scrapedData.findIndex(item =>
                        // Tek kaynak kaydı mı kontrol et (sourceScrapes yoksa)
                        !item.sourceScrapes && item.sourceEntriesHash === sourceEntriesHash
                    );

                    const newAnalysis = {
                        id: `analysis-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        prompt: prompt,
                        promptPreview: prompt ? (prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')) : '',
                        response: response,
                        responsePreview: response ? (response.substring(0, 200) + (response.length > 200 ? '...' : '')) : '',
                        modelId: analysisData.modelId || '',
                        responseTime: analysisData.responseTime || 0,
                        fromHistoryPage: true
                    };

                    if (scrapeIndex >= 0) {
                        scrapedData[scrapeIndex].analyses.push(newAnalysis);
                    } else {
                        // Yeni scrape oluştur
                        const newScrape = {
                            id: `scrape-${Date.now()}`,
                            sourceEntriesHash: sourceEntriesHash,
                            topicId: analysisData.topicId || '',
                            topicTitle: analysisData.topicTitle,
                            topicUrl: analysisData.topicUrl,
                            scrapedAt: new Date().toISOString(),
                            entryCount: analysisData.entryCount || 0,
                            sourceEntries: sourceEntries,
                            wasStopped: false,
                            analyses: [newAnalysis]
                        };
                        scrapedData.push(newScrape);
                    }

                    // Eski kayıtları temizle
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
                }).catch(err => {
                    console.error('Hash hesaplama hatası:', err);
                    resolve(); // Hata durumunda devam et
                });
                return;
            }

            // Eski kayıtları temizle (çoklu kaynak analizi için)
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

// =============================================================================
// UI YÖNETİMİ
// =============================================================================

/**
 * Geçmiş listesini render eder (unique scrapes).
 * 
 * @param {Array} scrapes - Unique scrapes listesi
 * @param {boolean} append - True ise mevcut listeye ekle, false ise sıfırdan oluştur
 */
const renderHistory = (scrapes, append = false) => {
    const loadingEl = document.getElementById('loading');
    const emptyStateEl = document.getElementById('emptyState');
    const historyListEl = document.getElementById('historyList');
    const statsEl = document.getElementById('stats');
    const clearBtn = document.getElementById('btnClearAll');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const remainingCountEl = document.getElementById('remainingCount');

    loadingEl.style.display = 'none';

    if (scrapes.length === 0) {
        emptyStateEl.style.display = 'block';
        historyListEl.style.display = 'none';
        statsEl.style.display = 'none';
        clearBtn.style.display = 'none';
        loadMoreContainer.style.display = 'none';

        // Export butonunu gizle (boş geçmişte export anlamsız)
        // Import butonunu göster (boş geçmişte de içe aktarılabilir)
        const exportBtn = document.getElementById('btnExport');
        const importBtn = document.getElementById('btnImport');
        if (exportBtn) exportBtn.style.display = 'none';
        if (importBtn) importBtn.style.display = 'inline-block';

        return;
    }

    // Global veriyi sakla
    if (!append) {
        allHistoryData = scrapes;
        displayedCount = 0;
    }

    emptyStateEl.style.display = 'none';
    historyListEl.style.display = 'flex';
    statsEl.style.display = 'block';
    clearBtn.style.display = 'block';

    // Export/Import butonlarını göster
    const exportBtn = document.getElementById('btnExport');
    const importBtn = document.getElementById('btnImport');
    if (exportBtn) exportBtn.style.display = 'inline-block';
    if (importBtn) importBtn.style.display = 'inline-block';

    // İstatistikleri göster - toplam analiz sayısını hesapla
    // Çoklu kaynak kayıtlarını sourceScrapes array'i ile ayırt et
    const regularScrapes = scrapes.filter(item => !item.sourceScrapes || item.sourceScrapes.length === 0);
    const multiAnalyses = scrapes.filter(item => item.sourceScrapes && item.sourceScrapes.length > 0);
    // Multi-analyses için de analyses array'deki analiz sayısını hesapla
    const multiAnalysisCount = multiAnalyses.reduce((sum, item) => {
        if (item.analyses) return sum + item.analyses.length;
        return sum;
    }, 0);
    const totalAnalyses = regularScrapes.reduce((sum, scrape) => sum + (scrape.analyses ? scrape.analyses.length : 0), 0) + multiAnalysisCount;
    const statsTextEl = document.getElementById('statsText');
    const retentionText = currentRetentionDays === 0 ? 'Sınırsız' : `Son ${currentRetentionDays} gün`;
    statsTextEl.textContent = `Toplam ${regularScrapes.length} kayıt, ${multiAnalyses.length} birleştirilmiş kaynak grubu, ${totalAnalyses} toplam analiz (${retentionText})`;

    // Gösterilecek kayıtları hesapla
    const startIndex = displayedCount;
    const endIndex = Math.min(displayedCount + ITEMS_PER_PAGE, allHistoryData.length);
    const itemsToShow = allHistoryData.slice(startIndex, endIndex);

    displayedCount = endIndex;

    // Geçmiş listesini oluştur
    let html = '';
    itemsToShow.forEach((item) => {
        // Multi-scrape analysis mi kontrol et (sourceScrapes array'i varsa çoklu kaynak)
        if (item.sourceScrapes && item.sourceScrapes.length > 0) {
            // Çoklu scrape analizi render et
            const date = new Date(item.scrapedAt);
            const dateStr = date.toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const sourceScrapes = item.sourceScrapes || [];
            const totalEntries = sourceScrapes.reduce((sum, s) => sum + (s.entryCount || 0), 0);
            
            // Kaynak scrape'ler listesi
            let sourceScrapesHtml = '<div class="source-scrapes-list">';
            sourceScrapesHtml += `<div class="source-scrapes-header">📚 ${sourceScrapes.length} farklı kaynaktan birleştirildi:</div>`;
            sourceScrapes.forEach((sourceScrape, idx) => {
                sourceScrapesHtml += `
                    <div class="source-scrape-item">
                        <a href="${escapeHtml(sourceScrape.topicUrl)}" target="_blank" class="source-scrape-link">${escapeHtml(sourceScrape.topicTitle)}</a>
                        <span class="source-scrape-count">(${sourceScrape.entryCount} entry)</span>
                    </div>
                `;
            });
            sourceScrapesHtml += '</div>';

            // Analizler (analyses array)
            const analyses = item.analyses || [];

            // Analiz sayısı
            const analysisCount = analyses.length;

            // Analizler listesi HTML'i (toggle ile)
            let analysesHtml = '';
            if (analysisCount > 0) {
                // Toggle butonu
                analysesHtml = `<button class="analyses-toggle" data-target="analyses-${escapeHtml(item.id)}">
                    <span class="analyses-toggle-icon">▶</span>
                    <span>🔬 ${analysisCount} Analiz</span>
                </button>`;
                analysesHtml += `<div class="analyses-list" id="analyses-${escapeHtml(item.id)}">`;
                analyses.forEach((analysis, idx) => {
                    const analysisDate = new Date(analysis.timestamp);
                    const analysisDateStr = analysisDate.toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    let analysisArtifactsHtml = '';
                    // Prompt butonu - boş olsa bile göster (disabled olarak)
                    const isPromptEmpty = !analysis.prompt || analysis.prompt.trim() === '';
                    if (isPromptEmpty) {
                        analysisArtifactsHtml += `<button class="btn-secondary" disabled title="Boş prompt" style="opacity: 0.5; cursor: not-allowed;">💬 Prompt</button>`;
                    } else {
                        analysisArtifactsHtml += `<button class="btn-secondary" data-type="markdown" data-multi-analysis-id="${escapeHtml(item.id)}" data-analysis-idx="${idx}" data-artifact="prompt">💬 Prompt</button>`;
                    }
                    if (analysis.response) {
                        analysisArtifactsHtml += `<button class="btn-secondary" data-type="markdown" data-multi-analysis-id="${escapeHtml(item.id)}" data-analysis-idx="${idx}" data-artifact="response">📝 Cevap</button>`;
                    }
                    // Sil butonu
                    analysisArtifactsHtml += `<button class="btn-danger btn-delete-analysis" data-analysis-id="${escapeHtml(analysis.id)}" data-multi-analysis-id="${escapeHtml(item.id)}" style="font-size: 13px; padding: 6px 12px;">🗑️ Sil</button>`;

                    analysesHtml += `
                        <div class="analysis-item">
                            <div class="analysis-header">
                                <span class="analysis-model">${escapeHtml(analysis.modelId || '-')}</span>
                                <span class="analysis-date">${analysisDateStr}</span>
                                <span class="analysis-time">⏱️ ${analysis.responseTime ? (analysis.responseTime / 1000).toFixed(1) + 's' : '-'}</span>
                            </div>
                            <div class="analysis-prompt-preview">${escapeHtml(analysis.promptPreview || analysis.prompt?.substring(0, 100) || '')}</div>
                            ${analysisArtifactsHtml ? `<div class="analysis-artifacts">${analysisArtifactsHtml}</div>` : ''}
                        </div>
                    `;
                });
                analysesHtml += '</div>';
            }

            // Birleştirilmiş analizler de seçilebilir
            const selectedClass = selectedItems.has(item.id) ? 'selected' : '';

            html += `
                <div class="history-item selectable ${selectedClass}" data-id="${escapeHtml(item.id)}" data-is-multi="true" data-has-source="true">
                    <div class="history-item-header">
                        <div class="history-title-multi">
                            <span class="history-title-count">🔗 ${sourceScrapes.length} Başlıktan Birleştirilmiş Analiz</span>
                        </div>
                        <span class="history-date">${dateStr}</span>
                    </div>
                    <div class="history-meta">
                        📊 ${totalEntries} toplam entry | 🔬 ${analysisCount} analiz
                    </div>
                    ${sourceScrapesHtml}
                    ${analysesHtml}
                    <div class="history-actions">
                        <button class="btn-secondary btn-download-all-multi" data-multi-analysis-id="${escapeHtml(item.id)}">📥 Tümünü İndir (ZIP)</button>
                        <button class="btn-danger btn-delete" data-scrape-id="${escapeHtml(item.id)}">Sil</button>
                    </div>
                </div>
            `;
        } else {
            // Normal scrape render et
            const scrape = item;
            const date = new Date(scrape.scrapedAt);
            const dateStr = date.toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Kaynak entry'si olan öğeler seçilebilir
            const hasSourceEntries = scrape.sourceEntries && scrape.sourceEntries.length > 0;
            const selectableClass = hasSourceEntries ? 'selectable' : '';
            const selectedClass = selectedItems.has(scrape.id) ? 'selected' : '';

            const isScrapeOnly = !scrape.analyses || scrape.analyses.length === 0;
            const wasStopped = scrape.wasStopped === true;

            // Meta bilgisi
            let metaHtml = '';
            if (isScrapeOnly) {
                if (wasStopped) {
                    metaHtml = `⚠️ Yarıda kesildi | 📊 ${scrape.entryCount} entry${hasSourceEntries ? ' | 📦 Kaynak Mevcut' : ''}`;
                } else {
                    metaHtml = `📦 Sadece toplama | 📊 ${scrape.entryCount} entry${hasSourceEntries ? ' | 📦 Kaynak Mevcut' : ''}`;
                }
            } else {
                metaHtml = `📊 ${scrape.entryCount} entry | 🔬 ${scrape.analyses.length} analiz${hasSourceEntries ? ' | 📦 Kaynak Mevcut' : ''}`;
            }

            // Başlık gösterimi
            const titleHtml = `<a href="${escapeHtml(scrape.topicUrl)}" target="_blank" class="history-title">${escapeHtml(scrape.topicTitle)}</a>`;

            // JSON butonu için (Tümünü İndir'in solunda gösterilecek)
            let jsonButtonHtml = '';
            if (hasSourceEntries) {
                jsonButtonHtml = `<button class="btn-secondary btn-json" data-scrape-id="${escapeHtml(scrape.id)}" data-artifact="sourceEntries">📄 JSON</button>`;
            }

            // Analizler listesi (toggle ile)
            let analysesHtml = '';
            if (scrape.analyses && scrape.analyses.length > 0) {
                const analysisCount = scrape.analyses.length;
                // Toggle butonu
                analysesHtml = `<button class="analyses-toggle" data-target="analyses-${escapeHtml(scrape.id)}">
                    <span class="analyses-toggle-icon">▶</span>
                    <span>🔬 ${analysisCount} Analiz</span>
                </button>`;
                analysesHtml += `<div class="analyses-list" id="analyses-${escapeHtml(scrape.id)}">`;
                scrape.analyses.forEach((analysis, idx) => {
                    const analysisDate = new Date(analysis.timestamp);
                    const analysisDateStr = analysisDate.toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    // Her analiz için Prompt ve Cevap butonları
                    let analysisArtifactsHtml = '';
                    // Prompt butonu - boş olsa bile göster (disabled olarak)
                    const isPromptEmpty = !analysis.prompt || analysis.prompt.trim() === '';
                    if (isPromptEmpty) {
                        analysisArtifactsHtml += `<button class="btn-secondary" disabled title="Boş prompt" style="opacity: 0.5; cursor: not-allowed;">💬 Prompt</button>`;
                    } else {
                        analysisArtifactsHtml += `<button class="btn-secondary" data-type="markdown" data-scrape-id="${escapeHtml(scrape.id)}" data-analysis-idx="${idx}" data-artifact="prompt">💬 Prompt</button>`;
                    }
                    if (analysis.response) {
                        analysisArtifactsHtml += `<button class="btn-secondary" data-type="markdown" data-scrape-id="${escapeHtml(scrape.id)}" data-analysis-idx="${idx}">📝 Cevap</button>`;
                    }
                    // Sil butonu
                    analysisArtifactsHtml += `<button class="btn-danger btn-delete-analysis" data-analysis-id="${escapeHtml(analysis.id)}" data-scrape-id="${escapeHtml(scrape.id)}" style="font-size: 13px; padding: 6px 12px;">🗑️ Sil</button>`;

                    analysesHtml += `
                        <div class="analysis-item">
                            <div class="analysis-header">
                                <span class="analysis-model">${escapeHtml(analysis.modelId || '-')}</span>
                                <span class="analysis-date">${analysisDateStr}</span>
                                <span class="analysis-time">⏱️ ${analysis.responseTime ? (analysis.responseTime / 1000).toFixed(1) + 's' : '-'}</span>
                            </div>
                            <div class="analysis-prompt-preview">${escapeHtml(analysis.promptPreview || analysis.prompt?.substring(0, 100) || '')}</div>
                            ${analysisArtifactsHtml ? `<div class="analysis-artifacts">${analysisArtifactsHtml}</div>` : ''}
                        </div>
                    `;
                });
                analysesHtml += '</div>';
            }

            html += `
                <div class="history-item ${selectableClass} ${selectedClass}" data-id="${escapeHtml(scrape.id)}" data-has-source="${hasSourceEntries}">
                    <div class="history-item-header">
                        ${titleHtml}
                        <span class="history-date">${dateStr}</span>
                    </div>
                    <div class="history-meta">
                        ${metaHtml}
                    </div>
                    ${analysesHtml}
                    <div class="history-actions">
                        ${jsonButtonHtml}
                        <button class="btn-secondary btn-download-all" data-scrape-id="${escapeHtml(scrape.id)}">📥 Tümünü İndir (ZIP)</button>
                        <button class="btn-danger btn-delete" data-scrape-id="${escapeHtml(scrape.id)}">Sil</button>
                    </div>
                </div>
            `;
        }
    });

    if (append) {
        historyListEl.insertAdjacentHTML('beforeend', html);
    } else {
        historyListEl.innerHTML = html;
    }

    // "Daha Fazla Yükle" butonunu göster/gizle
    const remainingItems = allHistoryData.length - displayedCount;
    if (remainingItems > 0) {
        loadMoreContainer.style.display = 'block';
        remainingCountEl.textContent = remainingItems;
    } else {
        loadMoreContainer.style.display = 'none';
    }

    // Event listener'ı ekle
    attachEventListeners(allHistoryData);
};

/**
 * Event listener'ları ekler.
 * 
 * @param {Array} scrapes - Unique scrapes listesi
 */
const attachEventListeners = (scrapes) => {
    // Analiz toggle butonları için tıklama
    document.querySelectorAll('.analyses-toggle').forEach(toggleBtn => {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = toggleBtn.getAttribute('data-target');
            const targetList = document.getElementById(targetId);
            
            if (targetList) {
                const isOpen = targetList.classList.contains('open');
                if (isOpen) {
                    targetList.classList.remove('open');
                    toggleBtn.classList.remove('open');
                } else {
                    targetList.classList.add('open');
                    toggleBtn.classList.add('open');
                }
            }
        });
    });

    // Seçilebilir öğeler için tıklama
    document.querySelectorAll('.history-item.selectable').forEach(item => {
        item.addEventListener('click', (e) => {
            // Doğrudan link veya butona tıklandığında seçim yapma
            // Ancak link/buton dışındaki boşluklara tıklandığında seçim yapılabilir
            if (e.target.tagName === 'A' || 
                e.target.tagName === 'BUTTON' || 
                e.target.closest('button') || 
                e.target.closest('a')) {
                return;
            }

            const itemId = item.getAttribute('data-id');
            if (selectedItems.has(itemId)) {
                selectedItems.delete(itemId);
                item.classList.remove('selected');
            } else {
                selectedItems.add(itemId);
                item.classList.add('selected');
            }
            updateSelectionToolbar();
        });
    });

    // JSON butonu (Tümünü İndir'in solunda) - Direkt indirme
    document.querySelectorAll('.btn-json').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const scrapeId = btn.getAttribute('data-scrape-id');
            const scrape = scrapes.find(s => s.id === scrapeId);
            if (!scrape || !scrape.sourceEntries) return;

            const content = JSON.stringify(scrape.sourceEntries, null, 2);
            const filename = `${sanitizeFilename(scrape.topicTitle)} sourceEntries.json`;
            const mimeType = 'application/json';

            // Direkt indirme
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    });

    // Prompt ve Cevap butonlarına tıklama
    document.querySelectorAll('.analysis-artifacts button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = btn.getAttribute('data-type');
            const scrapeId = btn.getAttribute('data-scrape-id');
            const multiAnalysisId = btn.getAttribute('data-multi-analysis-id');
            const analysisIdx = btn.getAttribute('data-analysis-idx');
            const artifact = btn.getAttribute('data-artifact');

            let content = '';
            let filename = '';
            let mimeType = '';
            let previewType = type; // Görüntüleme için kullanılacak tip

            // Multi-analysis için
            if (multiAnalysisId) {
                const multiAnalysis = scrapes.find(s => s.id === multiAnalysisId);
                if (!multiAnalysis || !multiAnalysis.analyses) return;

                if (analysisIdx === null) return;
                const analysis = multiAnalysis.analyses[parseInt(analysisIdx)];
                if (!analysis) return;

                const timestamp = formatTimestampForFilename(analysis.timestamp);
                if (artifact === 'prompt') {
                    content = analysis.prompt || '';
                    filename = timestamp 
                        ? `multi analysis ${timestamp} prompt.md`
                        : `multi analysis prompt ${parseInt(analysisIdx) + 1}.md`;
                    mimeType = 'text/markdown';
                    previewType = 'markdown';
                } else if (artifact === 'response' || !artifact) {
                    content = analysis.response || '';
                    filename = timestamp 
                        ? `multi analysis ${timestamp} analysis.md`
                        : `multi analysis response ${parseInt(analysisIdx) + 1}.md`;
                    mimeType = 'text/markdown';
                }
            } else if (scrapeId && analysisIdx !== null) {
                // Normal scrape analizi için
                const scrape = scrapes.find(s => s.id === scrapeId);
                if (!scrape || !scrape.analyses) return;

                const analysis = scrape.analyses[parseInt(analysisIdx)];
                if (!analysis) return;

                const safeTitle = sanitizeFilename(scrape.topicTitle);
                const timestamp = formatTimestampForFilename(analysis.timestamp);

                if (type === 'markdown' && !artifact) {
                    content = analysis.response || '';
                    filename = timestamp 
                        ? `${safeTitle} ${timestamp} analysis.md`
                        : `${safeTitle} analysis ${parseInt(analysisIdx) + 1}.md`;
                    mimeType = 'text/markdown';
                } else if (artifact === 'prompt') {
                    content = analysis.prompt || '';
                    filename = timestamp 
                        ? `${safeTitle} ${timestamp} prompt.md`
                        : `${safeTitle} prompt ${parseInt(analysisIdx) + 1}.md`;
                    mimeType = 'text/markdown';
                    previewType = 'markdown'; // Prompt'u markdown olarak göster
                }
            }

            if (content) {
                showArtifactPreview(content, filename, mimeType, previewType);
            }
        });
    });

    // Tümünü İndir butonları (normal scrapes için)
    document.querySelectorAll('.btn-download-all').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const scrapeId = btn.getAttribute('data-scrape-id');
            const scrape = scrapes.find(s => s.id === scrapeId);
            if (!scrape) return;

            await downloadAllArtifacts(scrape);
        });
    });

    // Tümünü İndir butonları (çoklu scrape analizleri için)
    document.querySelectorAll('.btn-download-all-multi').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const multiAnalysisId = btn.getAttribute('data-multi-analysis-id');
            const multiAnalysis = scrapes.find(s => s.id === multiAnalysisId);
            if (!multiAnalysis) return;

            await downloadMultiScrapeArtifacts(multiAnalysis, scrapes);
        });
    });

    // Analiz silme butonları (tek analiz silme)
    document.querySelectorAll('.btn-delete-analysis').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const analysisId = btn.getAttribute('data-analysis-id');
            const scrapeId = btn.getAttribute('data-scrape-id');
            const multiAnalysisId = btn.getAttribute('data-multi-analysis-id');
            
            if (!analysisId) return;
            
            // Onay mesajı
            const confirmMessage = 'Bu analizi silmek istediğinize emin misiniz?';
            
            if (confirm(confirmMessage)) {
                await deleteHistoryItem(analysisId);
                await loadHistory(); // Listeyi yeniden yükle
                updateSelectionToolbar();
            }
        });
    });

    // Sil butonları (tüm scrape/analiz grubu silme)
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.getAttribute('data-scrape-id');
            const item = scrapes.find(s => s.id === itemId);
            if (!item) return;
            
            // Multi-analysis için farklı mesaj
            let confirmMessage;
            if (itemId.startsWith('multi-analysis-')) {
                confirmMessage = 'Bu birleştirilmiş analizi silmek istediğinize emin misiniz?';
            } else {
                confirmMessage = `"${item.topicTitle}" kaydını ve tüm analizlerini silmek istediğinize emin misiniz?`;
            }
            
            if (confirm(confirmMessage)) {
                // Seçimden de kaldır
                selectedItems.delete(itemId);
                await deleteHistoryItem(itemId);
                await loadHistory(); // Listeyi yeniden yükle
                updateSelectionToolbar();
            }
        });
    });

    // Tümünü temizle butonu
    const clearBtn = document.getElementById('btnClearAll');
    clearBtn.onclick = async () => {
        if (confirm('Tüm analiz geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
            selectedItems.clear();
            await clearHistory();
            await loadHistory(); // Listeyi yeniden yükle
            updateSelectionToolbar();
        }
    };
};


/**
 * Artifact preview ekranını gösterir.
 * 
 * @param {string} content - Gösterilecek içerik
 * @param {string} filename - Dosya adı
 * @param {string} mimeType - MIME type
 * @param {string} type - Artifact tipi (markdown, text, json)
 */
const showArtifactPreview = (content, filename, mimeType, type) => {
    const modal = document.getElementById('artifactPreviewModal');
    const titleEl = document.getElementById('artifactPreviewTitle');
    const contentEl = document.getElementById('artifactPreviewContent');
    const copyBtn = document.getElementById('artifactPreviewCopy');
    const downloadBtn = document.getElementById('artifactPreviewDownload');

    titleEl.textContent = filename;

    // İçeriği göster
    if (type === 'markdown') {
        contentEl.innerHTML = parseMarkdown(content);
    } else {
        // Plain text
        contentEl.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(content)}</pre>`;
    }

    // Kopyala butonu
    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(content);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Kopyalandı';
            copyBtn.style.backgroundColor = '#28a745';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.backgroundColor = '';
            }, 2000);
        } catch (err) {
            alert('Kopyalama başarısız oldu. Lütfen tekrar deneyin.');
        }
    };

    // Download butonu
    downloadBtn.onclick = () => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    modal.classList.add('active');

    // Modal kapatma
    const closeBtn = document.getElementById('artifactPreviewClose');
    const closeModal = () => {
        modal.classList.remove('active');
    };

    closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };

    // ESC tuşu ile kapatma
    const handleEscape = (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
};

/**
 * Tüm artifact'leri ZIP dosyası olarak indirir.
 * 
 * @param {Object} scrape - Scrape objesi
 */
/**
 * Tüm artifact'leri ZIP dosyası olarak indirir.
 * 
 * @param {Object} scrape - Scrape objesi
 */
const downloadAllArtifacts = async (scrape) => {
    // JSZip kontrolü
    if (typeof JSZip === 'undefined') {
        // JSZip'i yüklemeyi dene
        const loaded = await loadJSZip();
        if (!loaded || typeof JSZip === 'undefined') {
            alert('ZIP oluşturma kütüphanesi yüklenemedi. Lütfen sayfayı yenileyin.');
            return;
        }
    }

    const zip = new JSZip();
    let hasFiles = false;

    // SourceEntries JSON
    if (scrape.sourceEntries && scrape.sourceEntries.length > 0) {
        const content = JSON.stringify(scrape.sourceEntries, null, 2);
        const safeTitle = sanitizeFilename(scrape.topicTitle);
        zip.file(`${safeTitle} sourceEntries.json`, content);
        hasFiles = true;
    }

    // Her analiz için artifact'ler
    scrape.analyses.forEach((analysis, idx) => {
        const safeTitle = sanitizeFilename(scrape.topicTitle);
        const timestamp = formatTimestampForFilename(analysis.timestamp);
        
        if (analysis.response) {
            // Markdown - timestamp ile
            const filename = timestamp 
                ? `${safeTitle} ${timestamp} analysis.md`
                : `${safeTitle} analysis ${idx + 1}.md`;
            zip.file(filename, analysis.response);
            hasFiles = true;
        }
        if (analysis.prompt) {
            // Prompt - aynı timestamp ile
            const filename = timestamp 
                ? `${safeTitle} ${timestamp} prompt.md`
                : `${safeTitle} prompt ${idx + 1}.md`;
            zip.file(filename, analysis.prompt);
            hasFiles = true;
        }
    });

    if (!hasFiles) {
        alert('İndirilecek artifact bulunamadı.');
        return;
    }

    try {
        // ZIP dosyasını oluştur (UTF-8 encoding ile)
        const blob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFilename(scrape.topicTitle)} artifacts.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('ZIP oluşturma hatası:', err);
        alert('ZIP dosyası oluşturulurken bir hata oluştu: ' + err.message);
    }
};

/**
 * Çoklu scrape analizi için tüm artifact'leri ZIP dosyası olarak indirir.
 * Her kaynak scrape için ayrı JSON dosyası oluşturur.
 * 
 * @param {Object} multiAnalysis - Multi-scrape analysis objesi
 * @param {Array} allScrapes - Tüm scrapes listesi (kaynak entry'leri bulmak için)
 */
const downloadMultiScrapeArtifacts = async (multiAnalysis, allScrapes) => {
    // JSZip kontrolü
    if (typeof JSZip === 'undefined') {
        // JSZip'i yüklemeyi dene
        const loaded = await loadJSZip();
        if (!loaded || typeof JSZip === 'undefined') {
            alert('ZIP oluşturma kütüphanesi yüklenemedi. Lütfen sayfayı yenileyin.');
            return;
        }
    }

    // Storage'dan tüm scrapes'i al (kaynak entry'leri için)
    const allStorageData = await new Promise((resolve) => {
        chrome.storage.local.get({ scrapedData: [] }, (result) => {
            resolve(result.scrapedData);
        });
    });

    const zip = new JSZip();
    let hasFiles = false;

    // Her kaynak scrape için ayrı JSON dosyası
    const sourceScrapes = multiAnalysis.sourceScrapes || [];
    for (const sourceScrape of sourceScrapes) {
        // Orijinal scrape'i storage'dan bul (sourceEntriesHash ile)
        const originalScrape = allStorageData.find(s => 
            s.sourceEntriesHash === sourceScrape.sourceEntriesHash || s.id === sourceScrape.scrapeId
        );
        if (originalScrape && originalScrape.sourceEntries && originalScrape.sourceEntries.length > 0) {
            const content = JSON.stringify(originalScrape.sourceEntries, null, 2);
            const safeTitle = sanitizeFilename(sourceScrape.topicTitle);
            zip.file(`${safeTitle} sourceEntries.json`, content);
            hasFiles = true;
        }
    }

    // Analiz sonuçları (analyses array)
    const analyses = multiAnalysis.analyses || [];

    analyses.forEach((analysis, idx) => {
        const timestamp = formatTimestampForFilename(analysis.timestamp);
        
        if (analysis.response) {
            // Timestamp ile isimlendir
            const filename = timestamp 
                ? `multi analysis ${timestamp} analysis.md`
                : `multi analysis response ${idx + 1}.md`;
            zip.file(filename, analysis.response);
            hasFiles = true;
        }
        if (analysis.prompt) {
            // Aynı timestamp ile prompt
            const filename = timestamp 
                ? `multi analysis ${timestamp} prompt.md`
                : `multi analysis prompt ${idx + 1}.md`;
            zip.file(filename, analysis.prompt);
            hasFiles = true;
        }
    });

    if (!hasFiles) {
        alert('İndirilecek artifact bulunamadı.');
        return;
    }

    try {
        // ZIP dosyasını oluştur (UTF-8 encoding ile)
        const blob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date(multiAnalysis.scrapedAt).toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `multi scrape analysis ${timestamp}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('ZIP oluşturma hatası:', err);
        alert('ZIP dosyası oluşturulurken bir hata oluştu: ' + err.message);
    }
};

/**
 * Geçmişi yükler ve gösterir.
 * 
 * Yeni yapıda zaten benzersiz scrape'ler tutulduğu için filtreleme gerekmez.
 */
const loadHistory = async () => {
    const history = await getHistory();
    renderHistory(history);
};

// =============================================================================
// EXPORT/IMPORT
// =============================================================================

/**
 * Analiz geçmişini JSON dosyası olarak dışa aktarır.
 */
const exportHistory = async () => {
    try {
        // Storage'dan direkt verileri al
        const storageData = await new Promise((resolve) => {
            chrome.storage.local.get({
                scrapedData: []
            }, resolve);
        });

        const scrapedData = storageData.scrapedData || [];

        if (scrapedData.length === 0) {
            alert('Dışa aktarılacak analiz geçmişi bulunamadı.');
            return;
        }

        // Tek ve çoklu kaynak kayıtlarını ayır
        const regularScrapes = scrapedData.filter(item => !item.sourceScrapes || item.sourceScrapes.length === 0);
        const multiSourceScrapes = scrapedData.filter(item => item.sourceScrapes && item.sourceScrapes.length > 0);

        // Toplam analiz sayısını hesapla
        const totalAnalyses = scrapedData.reduce((sum, scrape) => sum + (scrape.analyses ? scrape.analyses.length : 0), 0);

        const exportData = {
            exportDate: new Date().toISOString(),
            scrapeCount: regularScrapes.length,
            multiSourceScrapeCount: multiSourceScrapes.length,
            totalAnalyses: totalAnalyses,
            scrapedData: scrapedData
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `eksi-ai-analiz-gecmisi ${timestamp}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Export hatası:', err);
        alert('Dışa aktarma sırasında bir hata oluştu: ' + err.message);
    }
};

/**
 * JSON dosyasından analiz geçmişini içe aktarır.
 * 
 * @param {File} file - Yüklenecek JSON dosyası
 */
const importHistory = async (file) => {
    try {
        const fileText = await file.text();
        const importData = JSON.parse(fileText);

        let scrapesToImport = [];

        if (importData.scrapedData && Array.isArray(importData.scrapedData)) {
            scrapesToImport = importData.scrapedData;
        } else {
            throw new Error('Geçersiz dosya formatı. Geçmiş verisi bulunamadı.');
        }

        if (scrapesToImport.length === 0) {
            alert('İçe aktarılacak kayıt bulunamadı.');
            return;
        }

        // Mevcut verileri al
        const currentStorageData = await new Promise((resolve) => {
            chrome.storage.local.get({
                scrapedData: []
            }, resolve);
        });

        const currentScrapedData = currentStorageData.scrapedData || [];

        // Duplicate kontrolü - sourceEntriesHash'e göre (tek ve çoklu kaynak için)
        const existingHashes = new Set(currentScrapedData.map(s => s.sourceEntriesHash));
        const newScrapes = scrapesToImport.filter(scrape => {
            return !existingHashes.has(scrape.sourceEntriesHash);
        });

        if (newScrapes.length === 0) {
            alert('İçe aktarılacak yeni kayıt bulunamadı. Tüm kayıtlar zaten mevcut.');
            return;
        }

        // Onay al
        const confirmMessage = `${scrapesToImport.length} kayıt bulundu.\n` +
            `${newScrapes.length} yeni kayıt eklenecek.\n` +
            `${scrapesToImport.length - newScrapes.length} kayıt zaten mevcut (atlanacak).\n\n` +
            'Devam etmek istiyor musunuz?';

        const confirmed = confirm(confirmMessage);

        if (!confirmed) {
            return;
        }

        // Yeni verileri ekle
        const updatedScrapedData = [...currentScrapedData, ...newScrapes];

        // Storage'a kaydet
        await new Promise((resolve) => {
            chrome.storage.local.set({
                scrapedData: updatedScrapedData
            }, resolve);
        });

        // Listeyi yeniden yükle
        await loadHistory();

        // Başarı mesajı
        const statsTextEl = document.getElementById('statsText');
        if (statsTextEl) {
            const originalText = statsTextEl.textContent;
            const successMessage = `✅ ${newScrapes.length} kayıt başarıyla içe aktarıldı`;
            statsTextEl.textContent = successMessage;
            statsTextEl.style.color = '#28a745';
            setTimeout(() => {
                statsTextEl.textContent = originalText;
                statsTextEl.style.color = '';
            }, 3000);
        }
    } catch (err) {
        console.error('Import hatası:', err);
        alert('İçe aktarma sırasında bir hata oluştu: ' + err.message);
    }
};

// =============================================================================
// SAYFA YÜKLENDİĞİNDE
// =============================================================================

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
    return new Promise((resolve) => {
        chrome.storage.sync.get(
            {
                theme: 'auto'
            },
            (items) => {
                applyTheme(items.theme || 'auto');
                resolve();
            }
        );
    });
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
 * JSZip script'ini yükler.
 * 
 * @returns {Promise<boolean>} JSZip başarıyla yüklendiyse true
 */
const loadJSZip = async () => {
    if (typeof JSZip !== 'undefined') {
        return true;
    }

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/jszip.min.js');
        script.onload = () => {
            resolve(typeof JSZip !== 'undefined');
        };
        script.onerror = () => {
            console.error('JSZip yüklenemedi');
            resolve(false);
        };
        document.head.appendChild(script);
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    // JSZip'i yükle
    await loadJSZip();

    // Önce temayı yükle (sayfa yüklenirken hemen uygulanması için)
    await restoreTheme();
    // Storage değişikliklerini dinle (options sayfasından tema değişikliği için)
    setupThemeStorageListener();
    
    // Sayfa görünür olduğunda temayı kontrol et (diğer sekmelerden döndüğünde)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            restoreTheme();
        }
    });
    
    // Saklama süresini yükle
    currentRetentionDays = await getRetentionDays();

    // Select elementini güncelle
    const retentionSelect = document.getElementById('retentionDays');
    if (retentionSelect) {
        retentionSelect.value = currentRetentionDays.toString();

        // Değişiklik event listener'ı
        retentionSelect.addEventListener('change', async (e) => {
            const newDays = parseInt(e.target.value, 10);
            currentRetentionDays = newDays;

            // Yeni değeri kaydet
            await setRetentionDays(newDays);

            // Eski kayıtları temizle
            const deletedCount = await cleanupOldEntries(newDays);

            if (deletedCount > 0) {
                // Listeyi yeniden yükle
                await loadHistory();

                // Kullanıcıya bilgi ver
                const statsTextEl = document.getElementById('statsText');
                const originalText = statsTextEl.textContent;
                statsTextEl.textContent = `${deletedCount} eski kayıt silindi`;
                statsTextEl.style.color = '#ff6b6b';
                setTimeout(() => {
                    statsTextEl.textContent = originalText;
                    statsTextEl.style.color = '';
                }, 2000);
            }
        });
    }

    // "Daha Fazla Yükle" butonu event listener'ı
    const loadMoreBtn = document.getElementById('btnLoadMore');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            renderHistory(allHistoryData, true);
        });
    }

    // Seçim temizle butonu
    const clearSelectionBtn = document.getElementById('btnClearSelection');
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => {
            clearSelection();
        });
    }

    // Yeniden analiz butonu
    const reanalyzeBtn = document.getElementById('btnReanalyze');
    if (reanalyzeBtn) {
        reanalyzeBtn.addEventListener('click', () => {
            showReanalyzeModal();
        });
    }

    // Yeniden analiz modal event'leri
    setupReanalyzeModal();

    // Export butonu
    const exportBtn = document.getElementById('btnExport');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportHistory);
    }

    // Import butonu ve file input
    const importBtn = document.getElementById('btnImport');
    const importFileInput = document.getElementById('importFileInput');
    if (importBtn && importFileInput) {
        importBtn.addEventListener('click', () => {
            importFileInput.click();
        });
        importFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await importHistory(file);
                // Input'u temizle (aynı dosyayı tekrar seçebilmek için)
                e.target.value = '';
            }
        });
    }

    // Sayfa yüklendiğinde eski kayıtları temizle
    const deletedCount = await cleanupOldEntries(currentRetentionDays);
    
    // Geçmişi yükle
    await loadHistory();
    
    // Eğer kayıt silindiyse kullanıcıya bilgi ver
    if (deletedCount > 0) {
        const statsTextEl = document.getElementById('statsText');
        if (statsTextEl) {
            const originalText = statsTextEl.textContent;
            statsTextEl.textContent = `${deletedCount} eski kayıt silindi`;
            statsTextEl.style.color = '#ff6b6b';
            setTimeout(() => {
                statsTextEl.textContent = originalText;
                statsTextEl.style.color = '';
            }, 3000);
        }
    }
});

// =============================================================================
// SEÇİM YÖNETİMİ
// =============================================================================

/**
 * Seçim toolbar'ını günceller.
 */
const updateSelectionToolbar = () => {
    const toolbar = document.getElementById('selectionToolbar');
    const countEl = document.getElementById('selectionCount');

    if (selectedItems.size > 0) {
        toolbar.style.display = 'flex';
        countEl.textContent = `${selectedItems.size} öğe seçildi`;
    } else {
        toolbar.style.display = 'none';
    }
};

/**
 * Tüm seçimleri temizler.
 */
const clearSelection = () => {
    selectedItems.clear();
    document.querySelectorAll('.history-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    updateSelectionToolbar();
};

// =============================================================================
// YENİDEN ANALİZ
// =============================================================================

/**
 * Seçilen item'lardan kaynak entry'leri toplar.
 * Multi-analysis'lerin kaynak scrape'lerini de çözer.
 * Duplicate entry'leri (aynı entry ID) kaldırır.
 * 
 * @returns {Promise<{combinedData: Array, uniqueSourceScrapes: Array}>}
 */
const getSourceEntriesFromSelection = async () => {
    // Storage'dan tüm scrapes'i al
    const allStorageData = await new Promise((resolve) => {
        chrome.storage.local.get({ scrapedData: [] }, (result) => {
            resolve(result.scrapedData);
        });
    });

    // Seçilen item'ları al
    const selectedItems_arr = allHistoryData.filter(item => selectedItems.has(item.id));

    // Entry ID'lerini takip et (duplicate önleme için)
    const seenEntryIds = new Set();
    const combinedData = [];
    const uniqueSourceScrapes = [];
    const processedScrapeHashes = new Set();

    for (const item of selectedItems_arr) {
        // Çoklu kaynak kaydı mı kontrol et (sourceScrapes array'i varsa)
        if (item.sourceScrapes && item.sourceScrapes.length > 0) {
            // Çoklu kaynak kaydı: kaynak scrape'lerin entry'lerini al
            const sourceScrapes = item.sourceScrapes || [];
            for (const sourceScrape of sourceScrapes) {
                // Daha önce işlenmiş mi kontrol et
                if (processedScrapeHashes.has(sourceScrape.sourceEntriesHash)) {
                    continue;
                }
                
                // Orijinal scrape'i bul
                const originalScrape = allStorageData.find(s =>
                    s.sourceEntriesHash === sourceScrape.sourceEntriesHash || s.id === sourceScrape.scrapeId
                );
                
                if (originalScrape && originalScrape.sourceEntries && originalScrape.sourceEntries.length > 0) {
                    // Duplicate olmayan entry'leri ekle
                    const newEntries = originalScrape.sourceEntries.filter(entry => {
                        if (seenEntryIds.has(entry.id)) {
                            return false;
                        }
                        seenEntryIds.add(entry.id);
                        return true;
                    });

                    if (newEntries.length > 0) {
                        combinedData.push({
                            topicTitle: originalScrape.topicTitle,
                            topicUrl: originalScrape.topicUrl,
                            entries: newEntries
                        });
                        uniqueSourceScrapes.push(originalScrape);
                        processedScrapeHashes.add(sourceScrape.sourceEntriesHash);
                    }
                }
            }
        } else {
            // Normal scrape
            if (processedScrapeHashes.has(item.sourceEntriesHash)) {
                continue;
            }
            
            if (item.sourceEntries && item.sourceEntries.length > 0) {
                // Duplicate olmayan entry'leri ekle
                const newEntries = item.sourceEntries.filter(entry => {
                    if (seenEntryIds.has(entry.id)) {
                        return false;
                    }
                    seenEntryIds.add(entry.id);
                    return true;
                });

                if (newEntries.length > 0) {
                    combinedData.push({
                        topicTitle: item.topicTitle,
                        topicUrl: item.topicUrl,
                        entries: newEntries
                    });
                    uniqueSourceScrapes.push(item);
                    processedScrapeHashes.add(item.sourceEntriesHash);
                }
            }
        }
    }

    return { combinedData, uniqueSourceScrapes };
};

/**
 * Yeniden analiz modal'ını gösterir.
 */
const showReanalyzeModal = async () => {
    const modal = document.getElementById('reanalyzeModal');
    const summaryEl = document.getElementById('reanalyzeSummary');
    const promptSelect = document.getElementById('reanalyzePromptSelect');
    const customPromptEl = document.getElementById('reanalyzeCustomPrompt');
    const resultArea = document.getElementById('reanalyzeResult');

    // Sonuç alanını gizle
    resultArea.style.display = 'none';

    // Kaynak entry'leri topla (duplicate'sız) ve modül değişkeninde sakla
    // Bu sayede modal açıkken birden fazla analiz yapılabilir
    reanalyzeSourceData = await getSourceEntriesFromSelection();
    const { combinedData, uniqueSourceScrapes } = reanalyzeSourceData;

    // Özet bilgi göster
    let totalEntries = combinedData.reduce((sum, d) => sum + d.entries.length, 0);
    let summaryHtml = '<p><strong>Seçilen Kaynaklar:</strong></p><ul style="margin: 10px 0; padding-left: 20px;">';
    combinedData.forEach(data => {
        summaryHtml += `<li>${escapeHtml(data.topicTitle)} (${data.entries.length} entry)</li>`;
    });
    summaryHtml += `</ul><p><strong>Toplam:</strong> ${totalEntries} unique entry</p>`;
    summaryEl.innerHTML = summaryHtml;

    // Prompt seçeneklerini yükle
    try {
        const settings = await getSettings();
        promptSelect.innerHTML = '<option value="">-- Kayıtlı promptlardan seçin veya özel prompt yazın --</option>';
        settings.prompts.forEach((prompt, index) => {
            const option = document.createElement('option');
            option.value = index.toString();
            option.textContent = prompt.name;
            promptSelect.appendChild(option);
        });
    } catch (err) {
        console.warn('Prompt ayarları yüklenemedi:', err);
    }

    // Modal'ı göster
    modal.classList.add('active');
    customPromptEl.value = '';
    customPromptEl.focus();
};

/**
 * Yeniden analiz modal event'lerini ayarlar.
 */
const setupReanalyzeModal = () => {
    const modal = document.getElementById('reanalyzeModal');
    const closeBtn = document.getElementById('reanalyzeModalClose');
    const cancelBtn = document.getElementById('btnCancelReanalyze');
    const submitBtn = document.getElementById('btnSubmitReanalyze');
    const promptSelect = document.getElementById('reanalyzePromptSelect');
    const customPromptEl = document.getElementById('reanalyzeCustomPrompt');

    const closeModal = () => {
        modal.classList.remove('active');
        // Modal kapandığında seçimi ve saklanan verileri temizle
        clearSelection();
        reanalyzeSourceData = null;
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };

    // Prompt seçildiğinde textarea'ya yaz
    promptSelect.onchange = async () => {
        const selectedIndex = promptSelect.value;
        if (selectedIndex !== '') {
            try {
                const settings = await getSettings();
                const selectedPrompt = settings.prompts[parseInt(selectedIndex)];
                if (selectedPrompt) {
                    customPromptEl.value = selectedPrompt.prompt;
                }
            } catch (err) {
                console.warn('Prompt yüklenemedi:', err);
            }
        }
    };

    // Analiz başlat
    submitBtn.onclick = async () => {
        const userPrompt = customPromptEl.value.trim();
        if (!userPrompt) {
            customPromptEl.style.borderColor = '#d9534f';
            customPromptEl.focus();
            return;
        }
        customPromptEl.style.borderColor = '';

        await runReanalysis(userPrompt);
    };

    // Enter ile gönder
    customPromptEl.onkeydown = (e) => {
        if (customPromptEl.style.borderColor === 'rgb(217, 83, 79)') {
            customPromptEl.style.borderColor = '';
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            submitBtn.click();
        }
    };

    // ESC ile kapat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
};

/**
 * Yeniden analiz çalıştırır.
 * 
 * @param {string} userPrompt - Kullanıcı prompt'u
 */
const runReanalysis = async (userPrompt) => {
    const resultArea = document.getElementById('reanalyzeResult');
    const resultContent = document.getElementById('reanalyzeResultContent');
    const submitBtn = document.getElementById('btnSubmitReanalyze');

    // Modal açıldığında saklanan kaynak verilerini kullan
    // Bu sayede prompt değiştirip tekrar analiz yapılabilir
    if (!reanalyzeSourceData) {
        resultArea.style.display = 'block';
        resultContent.innerHTML = '<div style="color: #d9534f;">Kaynak verisi bulunamadı. Lütfen modal\'ı kapatıp tekrar deneyin.</div>';
        return;
    }

    const { combinedData, uniqueSourceScrapes } = reanalyzeSourceData;

    if (combinedData.length === 0) {
        resultArea.style.display = 'block';
        resultContent.innerHTML = '<div style="color: #d9534f;">Seçilen kaynaklarda entry bulunamadı. Lütfen kaynak entry\'si olan öğeleri seçin.</div>';
        return;
    }

    // UI güncelle
    resultArea.style.display = 'block';
    resultContent.innerHTML = '<div style="text-align: center; padding: 20px;">🔄 Gemini düşünüyor...</div>';
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Analiz ediliyor...';

    try {
        // Ayarları al
        const settings = await getSettings();
        const apiKey = settings.geminiApiKey;
        const modelId = settings.selectedModel || 'gemini-2.5-flash';

        if (!apiKey) {
            resultContent.innerHTML = '<div style="color: #d9534f;">Gemini API Key bulunamadı. Ayarlar sayfasından ekleyin.</div>';
            return;
        }

        // Prompt oluştur
        const entriesJson = JSON.stringify(combinedData, null, 2);
        const finalPrompt = `Aşağıda birden fazla Ekşi Sözlük başlığından toplanan entry'ler JSON formatında verilmiştir.
Her başlık için topicTitle, topicUrl ve entries alanları mevcuttur.

${entriesJson}

${userPrompt}`;

        // API çağrısı yap
        const abortController = new AbortController();
        const { text: response, responseTime } = await callGeminiApiStreaming(
            apiKey,
            modelId,
            finalPrompt,
            abortController.signal,
            (chunk, fullText) => {
                resultContent.innerHTML = parseMarkdown(fullText);
            }
        );

        // Sonucu geçmişe kaydet
        const totalTopicCount = uniqueSourceScrapes.length;
        const totalEntryCount = combinedData.reduce((sum, d) => sum + d.entries.length, 0);
        
        if (totalTopicCount > 1) {
            // Çoklu kaynak analizi - referans bazlı kaydet
            await saveToHistoryFromPage({
                topicTitle: `${totalTopicCount} başlık`,
                topicId: '',
                topicUrl: window.location.href,
                prompt: userPrompt,
                response: response,
                modelId: modelId,
                entryCount: totalEntryCount,
                responseTime: responseTime,
                sourceScrapes: uniqueSourceScrapes
            });
        } else {
            // Tek kaynak - normal işlem
            const scrape = uniqueSourceScrapes[0];
            await saveToHistoryFromPage({
                topicTitle: scrape.topicTitle,
                topicId: scrape.topicId || '',
                topicUrl: scrape.topicUrl,
                prompt: userPrompt,
                response: response,
                modelId: modelId,
                entryCount: totalEntryCount,
                responseTime: responseTime,
                sourceEntries: scrape.sourceEntries || []
            });
        }

        // Geçmiş listesini yenile (yeni kayıt görünsün)
        await loadHistory();

        // Not: Seçimi burada temizlemiyoruz - kullanıcı prompt'u değiştirip tekrar analiz yapabilir
        // Seçim modal kapandığında temizlenecek

        // Sonucu göster
        resultContent.innerHTML = `
            <div style="margin-bottom: 10px; color: #666; font-size: 13px;">
                📝 ${modelId} | ⏱️ ${(responseTime / 1000).toFixed(2)}s | ✅ Geçmişe kaydedildi
            </div>
            ${parseMarkdown(response)}
        `;

    } catch (err) {
        resultContent.innerHTML = `<div style="color: #d9534f;">Hata: ${escapeHtml(err.message)}</div>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Analiz Et';
    }
};
