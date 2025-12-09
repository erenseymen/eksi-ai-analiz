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
        chrome.storage.local.get({ scrapedData: [] }, (result) => {
            let scrapedData = result.scrapedData;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffTime = cutoffDate.getTime();

            const originalLength = scrapedData.length;
            const filteredData = scrapedData.filter(item => {
                const itemDate = new Date(item.scrapedAt);
                return itemDate.getTime() >= cutoffTime;
            });

            const deletedCount = originalLength - filteredData.length;

            chrome.storage.local.set({ scrapedData: filteredData }, () => {
                resolve(deletedCount);
            });
        });
    });
};

// =============================================================================
// GEÇMİŞ YÖNETİMİ
// =============================================================================

/**
 * Kaydedilmiş analiz geçmişini alır (unique scrapes).
 * 
 * Her unique scrape için bir item döndürür, analyses içinde tutulur.
 * 
 * @returns {Promise<Array>} Unique scrapes listesi (en yeniden en eskiye, scrapedAt'e göre sıralı)
 */
const getHistory = async () => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ scrapedData: [] }, (result) => {
            const scrapedData = result.scrapedData;

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
        chrome.storage.local.set({ scrapedData: [] }, resolve);
    });
};

/**
 * Belirli bir analizi geçmişten siler.
 * 
 * @param {string} itemId - Silinecek analizin ID'si (analysis ID veya scrape ID)
 * @returns {Promise<void>}
 */
const deleteHistoryItem = async (itemId) => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ scrapedData: [] }, (result) => {
            const scrapedData = result.scrapedData;

            // Scrape ID'si mi kontrol et
            if (itemId.startsWith('scrape-')) {
                // Scrape'i tamamen sil
                const updatedData = scrapedData.filter(item => item.id !== itemId);
                chrome.storage.local.set({ scrapedData: updatedData }, resolve);
            } else {
                // Analysis ID'si, ilgili scrape'den analizi sil
                const updatedData = scrapedData.map(scrape => {
                    if (scrape.analyses.some(a => a.id === itemId)) {
                        return {
                            ...scrape,
                            analyses: scrape.analyses.filter(a => a.id !== itemId)
                        };
                    }
                    return scrape;
                });
                chrome.storage.local.set({ scrapedData: updatedData }, resolve);
            }
        });
    });
};

/**
 * sourceEntries array'inden unique hash oluşturur.
 * 
 * analysis-history.js'deki fonksiyonla aynı mantık.
 * 
 * @param {Array} sourceEntries - Entry array'i
 * @returns {string} Hash string
 */
const createSourceEntriesHash = (sourceEntries) => {
    if (!sourceEntries || sourceEntries.length === 0) {
        return 'empty';
    }

    // Entry ID'lerini çıkar ve sırala
    const entryIds = sourceEntries
        .map(entry => entry.id)
        .filter(id => id) // null/undefined kontrolü
        .sort();

    if (entryIds.length === 0) {
        return 'empty';
    }

    // ID'leri birleştir ve basit hash oluştur
    const combined = entryIds.join(',');

    // Basit hash fonksiyonu (string hash)
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32bit integer'a çevir
    }

    return `hash${Math.abs(hash).toString(36)}`;
};

/**
 * Geçmiş sayfasından yapılan analiz sonuçlarını geçmişe kaydeder.
 * 
 * Birden fazla başlık içeren analizler için özel işlem yapar.
 * sourceEntries hash'ine göre ilgili scrape'i bulur.
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
 * @returns {Promise<void>}
 */
const saveToHistoryFromPage = async (analysisData) => {
    return new Promise((resolve) => {
        chrome.storage.local.get({
            scrapedData: [],
            historyRetentionDays: DEFAULT_RETENTION_DAYS
        }, (result) => {
            let scrapedData = result.scrapedData;
            const retentionDays = result.historyRetentionDays;

            const prompt = analysisData.prompt || '';
            const response = analysisData.response || '';

            // sourceEntries hash'ini oluştur
            const sourceEntries = analysisData.sourceEntries || [];
            const sourceEntriesHash = createSourceEntriesHash(sourceEntries);

            // Birden fazla başlık içeren analizler için özel işlem
            if (analysisData.topics && analysisData.topics.length > 1) {
                // Birden fazla başlık için, her başlık için aynı sourceEntries hash'ini kullan
                // Ama her başlık için ayrı scrape kaydı oluşturulabilir (farklı topicId/topicTitle)
                // Ancak sourceEntries aynı olduğu için, sadece bir tane scrape oluşturup
                // tüm başlıkları birleştirilmiş şekilde tutabiliriz
                const scrapeIndex = scrapedData.findIndex(item =>
                    item.sourceEntriesHash === sourceEntriesHash
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
                    fromHistoryPage: true,
                    topics: analysisData.topics
                };

                if (scrapeIndex >= 0) {
                    scrapedData[scrapeIndex].analyses.push(newAnalysis);
                } else {
                    // Yeni scrape oluştur (ilk başlığı kullan)
                    const firstTopic = analysisData.topics[0];
                    const newScrape = {
                        id: `scrape-${Date.now()}`,
                        sourceEntriesHash: sourceEntriesHash,
                        topicId: firstTopic.id || '',
                        topicTitle: firstTopic.title,
                        topicUrl: firstTopic.url,
                        scrapedAt: new Date().toISOString(),
                        entryCount: analysisData.entryCount || 0,
                        sourceEntries: sourceEntries,
                        wasStopped: false,
                        analyses: [newAnalysis]
                    };
                    scrapedData.push(newScrape);
                }
            } else {
                // Tek başlık için normal işlem
                const scrapeIndex = scrapedData.findIndex(item =>
                    item.sourceEntriesHash === sourceEntriesHash
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
    const totalAnalyses = scrapes.reduce((sum, scrape) => sum + scrape.analyses.length, 0);
    const statsTextEl = document.getElementById('statsText');
    const retentionText = currentRetentionDays === 0 ? 'Sınırsız' : `Son ${currentRetentionDays} gün`;
    statsTextEl.textContent = `Toplam ${scrapes.length} unique scrape, ${totalAnalyses} analiz (${retentionText})`;

    // Gösterilecek kayıtları hesapla
    const startIndex = displayedCount;
    const endIndex = Math.min(displayedCount + ITEMS_PER_PAGE, allHistoryData.length);
    const itemsToShow = allHistoryData.slice(startIndex, endIndex);

    displayedCount = endIndex;

    // Geçmiş listesini oluştur
    let html = '';
    itemsToShow.forEach((scrape) => {
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

        const isScrapeOnly = scrape.analyses.length === 0;
        const wasStopped = scrape.wasStopped === true;

        // Meta bilgisi
        let metaHtml = '';
        if (isScrapeOnly) {
            if (wasStopped) {
                metaHtml = `⚠️ Yarıda kesildi | 📊 ${scrape.entryCount} entry${hasSourceEntries ? ' | 📦 Kaynak Mevcut' : ''}`;
            } else {
                metaHtml = `📦 Sadece scrape | 📊 ${scrape.entryCount} entry${hasSourceEntries ? ' | 📦 Kaynak Mevcut' : ''}`;
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

        // Analizler listesi
        let analysesHtml = '';
        if (scrape.analyses.length > 0) {
            analysesHtml = '<div class="analyses-list">';
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
                if (analysis.prompt) {
                    analysisArtifactsHtml += `<button class="btn-secondary" data-type="json" data-scrape-id="${escapeHtml(scrape.id)}" data-analysis-idx="${idx}" data-artifact="prompt">💬 Prompt</button>`;
                }
                if (analysis.response) {
                    analysisArtifactsHtml += `<button class="btn-secondary" data-type="markdown" data-scrape-id="${escapeHtml(scrape.id)}" data-analysis-idx="${idx}">📝 Cevap</button>`;
                }

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
                    <button class="btn-secondary btn-download-all" data-scrape-id="${escapeHtml(scrape.id)}">📥 Tümünü İndir</button>
                    <button class="btn-danger btn-delete" data-scrape-id="${escapeHtml(scrape.id)}">Sil</button>
                </div>
            </div>
        `;
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
    // Seçilebilir öğeler için tıklama
    document.querySelectorAll('.history-item.selectable').forEach(item => {
        item.addEventListener('click', (e) => {
            // Butonlara, linklere veya artifact'lere tıklandığında seçim yapma
            if (e.target.closest('.history-actions') ||
                e.target.closest('.history-title') ||
                e.target.closest('.history-title-link') ||
                e.target.closest('.analysis-artifacts') ||
                e.target.closest('.analyses-list')) {
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

    // JSON butonu (Tümünü İndir'in solunda)
    document.querySelectorAll('.btn-json').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const scrapeId = btn.getAttribute('data-scrape-id');
            const scrape = scrapes.find(s => s.id === scrapeId);
            if (!scrape || !scrape.sourceEntries) return;

            const content = JSON.stringify(scrape.sourceEntries, null, 2);
            const filename = `${scrape.topicTitle.replace(/[^a-z0-9]/gi, '_')}_sourceEntries.json`;
            const mimeType = 'application/json';

            showArtifactPreview(content, filename, mimeType, 'json');
        });
    });

    // Prompt ve Cevap butonlarına tıklama
    document.querySelectorAll('.analysis-artifacts button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = btn.getAttribute('data-type');
            const scrapeId = btn.getAttribute('data-scrape-id');
            const analysisIdx = btn.getAttribute('data-analysis-idx');
            const artifact = btn.getAttribute('data-artifact');

            const scrape = scrapes.find(s => s.id === scrapeId);
            if (!scrape) return;

            let content = '';
            let filename = '';
            let mimeType = '';
            let previewType = type; // Görüntüleme için kullanılacak tip

            if (analysisIdx !== null) {
                const analysis = scrape.analyses[parseInt(analysisIdx)];
                if (!analysis) return;

                if (type === 'markdown') {
                    content = analysis.response || '';
                    filename = `${scrape.topicTitle.replace(/[^a-z0-9]/gi, '_')}_analysis_${analysisIdx + 1}.md`;
                    mimeType = 'text/markdown';
                } else if (artifact === 'prompt') {
                    content = analysis.prompt || '';
                    filename = `${scrape.topicTitle.replace(/[^a-z0-9]/gi, '_')}_prompt_${analysisIdx + 1}.md`;
                    mimeType = 'text/markdown';
                    previewType = 'markdown'; // Prompt'u markdown olarak göster
                }
            }

            if (content) {
                showArtifactPreview(content, filename, mimeType, previewType);
            }
        });
    });

    // Tümünü İndir butonları
    document.querySelectorAll('.btn-download-all').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const scrapeId = btn.getAttribute('data-scrape-id');
            const scrape = scrapes.find(s => s.id === scrapeId);
            if (!scrape) return;

            await downloadAllArtifacts(scrape);
        });
    });

    // Sil butonları
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const scrapeId = btn.getAttribute('data-scrape-id');
            const scrape = scrapes.find(s => s.id === scrapeId);
            if (scrape && confirm(`"${scrape.topicTitle}" scrape'ini ve tüm analizlerini silmek istediğinize emin misiniz?`)) {
                // Seçimden de kaldır
                selectedItems.delete(scrapeId);
                await deleteHistoryItem(scrapeId);
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
    } else if (type === 'json') {
        // JSON syntax highlighting için pre/code kullan - word-wrap ile
        contentEl.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;"><code>${escapeHtml(content)}</code></pre>`;
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
        zip.file(`${scrape.topicTitle.replace(/[^a-z0-9]/gi, '_')}_sourceEntries.json`, content);
        hasFiles = true;
    }

    // Her analiz için artifact'ler
    scrape.analyses.forEach((analysis, idx) => {
        if (analysis.response) {
            // Markdown
            zip.file(`${scrape.topicTitle.replace(/[^a-z0-9]/gi, '_')}_analysis_${idx + 1}.md`, analysis.response);
            hasFiles = true;
        }
        if (analysis.prompt) {
            zip.file(`${scrape.topicTitle.replace(/[^a-z0-9]/gi, '_')}_prompt_${idx + 1}.txt`, analysis.prompt);
            hasFiles = true;
        }
    });

    if (!hasFiles) {
        alert('İndirilecek artifact bulunamadı.');
        return;
    }

    try {
        // ZIP dosyasını oluştur
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scrape.topicTitle.replace(/[^a-z0-9]/gi, '_')}_artifacts.zip`;
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
        const scrapes = await getHistory();

        if (scrapes.length === 0) {
            alert('Dışa aktarılacak analiz geçmişi bulunamadı.');
            return;
        }

        // Toplam analiz sayısını hesapla
        const totalAnalyses = scrapes.reduce((sum, scrape) => sum + scrape.analyses.length, 0);

        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            scrapeCount: scrapes.length,
            totalAnalyses: totalAnalyses,
            scrapedData: scrapes
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `eksi-ai-analiz-gecmisi-${timestamp}.json`;

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

        // Format kontrolü - v2.0 (yeni format) veya v1.0 (eski format)
        if (importData.version === '2.0' && importData.scrapedData && Array.isArray(importData.scrapedData)) {
            // Yeni format - direkt scrapedData
            scrapesToImport = importData.scrapedData;
        } else if (importData.history && Array.isArray(importData.history)) {
            // Eski format - flat view'dan scrapedData'ya çevir
            const newItemsMap = new Map(); // sourceEntriesHash -> scrape object

            importData.history.forEach(item => {
                const sourceEntries = item.sourceEntries || [];
                const sourceEntriesHash = createSourceEntriesHash(sourceEntries);

                if (!newItemsMap.has(sourceEntriesHash)) {
                    // Yeni scrape oluştur
                    newItemsMap.set(sourceEntriesHash, {
                        id: item.scrapeOnly ? item.id : `scrape-${Date.now()}-${sourceEntriesHash}`,
                        sourceEntriesHash: sourceEntriesHash,
                        topicId: item.topicId || '',
                        topicTitle: item.topicTitle,
                        topicUrl: item.topicUrl,
                        scrapedAt: item.scrapeOnly ? item.timestamp : new Date().toISOString(),
                        entryCount: item.entryCount,
                        sourceEntries: sourceEntries,
                        wasStopped: item.wasStopped || false,
                        analyses: []
                    });
                }

                const scrape = newItemsMap.get(sourceEntriesHash);

                if (!item.scrapeOnly) {
                    // Analiz ekle
                    scrape.analyses.push({
                        id: item.id,
                        timestamp: item.timestamp,
                        prompt: item.prompt || '',
                        promptPreview: item.promptPreview || '',
                        response: item.response || '',
                        responsePreview: item.responsePreview || '',
                        modelId: item.modelId || '',
                        responseTime: item.responseTime || 0
                    });
                } else {
                    // Scrape-only ise, scrapedAt'i güncelle
                    scrape.scrapedAt = item.timestamp;
                }
            });

            scrapesToImport = Array.from(newItemsMap.values());
        } else {
            throw new Error('Geçersiz dosya formatı. Geçmiş verisi bulunamadı.');
        }

        if (scrapesToImport.length === 0) {
            alert('İçe aktarılacak kayıt bulunamadı.');
            return;
        }

        // Mevcut scrapedData'yı al
        const currentScrapedData = await new Promise((resolve) => {
            chrome.storage.local.get({ scrapedData: [] }, (result) => {
                resolve(result.scrapedData);
            });
        });

        // Duplicate kontrolü - sourceEntriesHash'e göre
        const existingHashes = new Set(currentScrapedData.map(s => s.sourceEntriesHash));
        const newScrapes = scrapesToImport.filter(scrape => {
            return !existingHashes.has(scrape.sourceEntriesHash);
        });

        if (newScrapes.length === 0) {
            alert('İçe aktarılacak yeni kayıt bulunamadı. Tüm kayıtlar zaten mevcut.');
            return;
        }

        // Onay al
        const confirmed = confirm(
            `${scrapesToImport.length} scrape bulundu.\n` +
            `${newScrapes.length} yeni scrape eklenecek.\n` +
            `${scrapesToImport.length - newScrapes.length} scrape zaten mevcut (atlanacak).\n\n` +
            `Devam etmek istiyor musunuz?`
        );

        if (!confirmed) {
            return;
        }

        // Yeni scrape'leri ekle
        const updatedScrapedData = [...currentScrapedData, ...newScrapes];

        // Storage'a kaydet
        await new Promise((resolve) => {
            chrome.storage.local.set({ scrapedData: updatedScrapedData }, resolve);
        });

        // Listeyi yeniden yükle
        await loadHistory();

        // Başarı mesajı
        const statsTextEl = document.getElementById('statsText');
        if (statsTextEl) {
            const originalText = statsTextEl.textContent;
            statsTextEl.textContent = `✅ ${newScrapes.length} kayıt başarıyla içe aktarıldı`;
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

    // Geçmişi yükle
    loadHistory();
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

    // Seçilen scrapes'i al
    const selectedScrapes = allHistoryData.filter(scrape => selectedItems.has(scrape.id));

    // Özet bilgi göster
    let totalEntries = 0;
    let summaryHtml = '<p><strong>Seçilen Scrapes:</strong></p><ul style="margin: 10px 0; padding-left: 20px;">';
    selectedScrapes.forEach(scrape => {
        const entryCount = scrape.sourceEntries ? scrape.sourceEntries.length : scrape.entryCount;
        totalEntries += entryCount;
        summaryHtml += `<li>${escapeHtml(scrape.topicTitle)} (${entryCount} entry, ${scrape.analyses.length} analiz)</li>`;
    });
    summaryHtml += `</ul><p><strong>Toplam:</strong> ${totalEntries} entry</p>`;
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

    // Seçilen scrapes'in kaynak entry'lerini birleştir
    const selectedScrapes = allHistoryData.filter(scrape => selectedItems.has(scrape.id));

    // Entry'leri hazırla - her başlık için ayrı grup
    let combinedData = [];
    selectedScrapes.forEach(scrape => {
        if (scrape.sourceEntries && scrape.sourceEntries.length > 0) {
            combinedData.push({
                topicTitle: scrape.topicTitle,
                topicUrl: scrape.topicUrl,
                entries: scrape.sourceEntries
            });
        }
    });

    if (combinedData.length === 0) {
        resultArea.style.display = 'block';
        resultContent.innerHTML = '<div style="color: #d9534f;">Seçilen analizlerde kaynak entry bulunamadı. Lütfen kaynak entry\'si olan analizleri seçin.</div>';
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
        // Birden fazla başlık varsa birleştir
        let combinedTopics = [];
        selectedScrapes.forEach(scrape => {
            combinedTopics.push({
                title: scrape.topicTitle,
                url: scrape.topicUrl,
                id: scrape.topicId
            });
        });

        const totalTopicCount = combinedTopics.length;
        const combinedTitle = totalTopicCount === 1
            ? combinedTopics[0].title
            : `${totalTopicCount} başlık`;

        // Tüm entry'leri birleştir
        const allSourceEntries = [];
        combinedData.forEach(d => allSourceEntries.push(...d.entries));

        await saveToHistoryFromPage({
            topicTitle: combinedTitle,
            topicId: '',
            topicUrl: window.location.href,
            prompt: userPrompt,
            response: response,
            modelId: modelId,
            entryCount: allSourceEntries.length,
            responseTime: responseTime,
            sourceEntries: allSourceEntries,
            // Birden fazla başlık varsa topics dizisini kaydet
            topics: totalTopicCount > 1 ? combinedTopics : null
        });

        // Geçmiş listesini yenile (yeni kayıt görünsün)
        await loadHistory();

        // Seçimi temizle
        clearSelection();

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
