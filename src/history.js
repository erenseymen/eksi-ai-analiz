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
 * Timestamp'e göre sıralı olduğu için, cutoff date'den sonraki ilk entry'yi bulup
 * ondan sonraki tüm entry'leri alır (efficient cleanup).
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
        chrome.storage.local.get({ analysisHistory: [] }, (result) => {
            let history = result.analysisHistory;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            // Timestamp'e göre sıralı olduğu için (descending), cutoff date'den sonraki
            // ilk entry'yi bulup ondan sonraki tüm entry'leri al
            // Array en yeniden en eskiye sıralı olduğu için, ilk geçersiz entry'yi bulduğumuzda
            // ondan sonraki tüm entry'ler de geçersiz olacak
            const cutoffTime = cutoffDate.getTime();
            let firstInvalidIndex = -1;
            
            for (let i = 0; i < history.length; i++) {
                const itemDate = new Date(history[i].timestamp);
                if (itemDate.getTime() < cutoffTime) {
                    firstInvalidIndex = i;
                    break;
                }
            }

            let filteredHistory;
            if (firstInvalidIndex >= 0) {
                // İlk geçersiz entry'den önceki tüm entry'leri al
                filteredHistory = history.slice(0, firstInvalidIndex);
            } else {
                // Tüm entry'ler geçerli
                filteredHistory = history;
            }

            const deletedCount = history.length - filteredHistory.length;

            chrome.storage.local.set({ analysisHistory: filteredHistory }, () => {
                resolve(deletedCount);
            });
        });
    });
};

// =============================================================================
// GEÇMİŞ YÖNETİMİ
// =============================================================================

/**
 * Kaydedilmiş analiz geçmişini alır.
 * 
 * @returns {Promise<Array>} Analiz geçmişi listesi (en yeniden en eskiye, timestamp'e göre sıralı)
 */
const getHistory = async () => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ analysisHistory: [] }, (result) => {
            const history = result.analysisHistory;
            // Timestamp'e göre sırala (descending - en yeni en üstte)
            history.sort((a, b) => {
                const dateA = new Date(a.timestamp);
                const dateB = new Date(b.timestamp);
                return dateB - dateA; // Descending order
            });
            resolve(history);
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

/**
 * Belirli bir analizi geçmişten siler.
 * 
 * @param {string} itemId - Silinecek analizin ID'si
 * @returns {Promise<void>}
 */
const deleteHistoryItem = async (itemId) => {
    return new Promise((resolve) => {
        chrome.storage.local.get({ analysisHistory: [] }, (result) => {
            const history = result.analysisHistory;
            const updatedHistory = history.filter(item => item.id !== itemId);
            chrome.storage.local.set({ analysisHistory: updatedHistory }, resolve);
        });
    });
};

/**
 * Geçmiş sayfasından yapılan analiz sonuçlarını geçmişe kaydeder.
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
 * @returns {Promise<void>}
 */
const saveToHistoryFromPage = async (analysisData) => {
    return new Promise((resolve) => {
        chrome.storage.local.get({
            analysisHistory: [],
            historyRetentionDays: DEFAULT_RETENTION_DAYS
        }, (result) => {
            let history = result.analysisHistory;
            const retentionDays = result.historyRetentionDays;

            const prompt = analysisData.prompt || '';
            const response = analysisData.response || '';

            // Yeni kayıt oluştur
            const newEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                topicTitle: analysisData.topicTitle,
                topicId: analysisData.topicId || '',
                topicUrl: analysisData.topicUrl,
                prompt: prompt,
                promptPreview: prompt ? (prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')) : '',
                response: response,
                responsePreview: response ? (response.substring(0, 200) + (response.length > 200 ? '...' : '')) : '',
                modelId: analysisData.modelId || '',
                entryCount: analysisData.entryCount,
                responseTime: analysisData.responseTime,
                sourceEntries: analysisData.sourceEntries || [],
                // Birden fazla başlık içeren analizler için topics dizisi
                topics: analysisData.topics || null,
                // Geçmiş sayfasından yapılan analiz
                fromHistoryPage: true
            };

            // Başa ekle
            history.unshift(newEntry);

            // Veriyi timestamp'e göre sırala (descending - en yeni en üstte)
            history.sort((a, b) => {
                const dateA = new Date(a.timestamp);
                const dateB = new Date(b.timestamp);
                return dateB - dateA; // Descending order
            });

            // Eski kayıtları temizle
            if (retentionDays > 0) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
                const cutoffTime = cutoffDate.getTime();
                let firstInvalidIndex = -1;
                
                for (let i = 0; i < history.length; i++) {
                    const itemDate = new Date(history[i].timestamp);
                    if (itemDate.getTime() < cutoffTime) {
                        firstInvalidIndex = i;
                        break;
                    }
                }

                if (firstInvalidIndex >= 0) {
                    history = history.slice(0, firstInvalidIndex);
                }
            }

            chrome.storage.local.set({ analysisHistory: history }, resolve);
        });
    });
};

// =============================================================================
// UI YÖNETİMİ
// =============================================================================

/**
 * Geçmiş listesini render eder.
 * 
 * @param {Array} history - Analiz geçmişi listesi
 * @param {boolean} append - True ise mevcut listeye ekle, false ise sıfırdan oluştur
 */
const renderHistory = (history, append = false) => {
    const loadingEl = document.getElementById('loading');
    const emptyStateEl = document.getElementById('emptyState');
    const historyListEl = document.getElementById('historyList');
    const statsEl = document.getElementById('stats');
    const clearBtn = document.getElementById('btnClearAll');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const remainingCountEl = document.getElementById('remainingCount');

    loadingEl.style.display = 'none';

    if (history.length === 0) {
        emptyStateEl.style.display = 'block';
        historyListEl.style.display = 'none';
        statsEl.style.display = 'none';
        clearBtn.style.display = 'none';
        loadMoreContainer.style.display = 'none';
        
        // Export/Import butonlarını gizle (boş geçmişte export anlamsız)
        const exportBtn = document.getElementById('btnExport');
        const importBtn = document.getElementById('btnImport');
        if (exportBtn) exportBtn.style.display = 'none';
        if (importBtn) importBtn.style.display = 'none';
        
        return;
    }

    // Global veriyi sakla
    if (!append) {
        allHistoryData = history;
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

    // İstatistikleri göster
    const statsTextEl = document.getElementById('statsText');
    const retentionText = currentRetentionDays === 0 ? 'Sınırsız' : `Son ${currentRetentionDays} gün`;
    statsTextEl.textContent = `Toplam ${allHistoryData.length} analiz (${retentionText})`;

    // Gösterilecek kayıtları hesapla
    const startIndex = displayedCount;
    const endIndex = Math.min(displayedCount + ITEMS_PER_PAGE, allHistoryData.length);
    const itemsToShow = allHistoryData.slice(startIndex, endIndex);

    displayedCount = endIndex;

    // Geçmiş listesini oluştur
    let html = '';
    itemsToShow.forEach((item) => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Kaynak entry'si olan öğeler seçilebilir
        const hasSourceEntries = item.sourceEntries && item.sourceEntries.length > 0;
        const selectableClass = hasSourceEntries ? 'selectable' : '';
        const selectedClass = selectedItems.has(item.id) ? 'selected' : '';

        // scrapeOnly ve wasStopped durumlarını kontrol et
        const isScrapeOnly = item.scrapeOnly === true;
        const wasStopped = item.wasStopped === true;

        // Meta bilgisi
        let metaHtml = '';
        if (isScrapeOnly) {
            if (wasStopped) {
                metaHtml = `⚠️ Yarıda kesildi | 📊 ${item.entryCount} entry${hasSourceEntries ? ' | 📦 Kaynak Mevcut' : ''}`;
            } else {
                metaHtml = `📦 Sadece scrape | 📊 ${item.entryCount} entry${hasSourceEntries ? ' | 📦 Kaynak Mevcut' : ''}`;
            }
        } else {
            metaHtml = `📝 ${escapeHtml(item.modelId || '-')} | 📊 ${item.entryCount} entry | ⏱️ ${item.responseTime ? (item.responseTime / 1000).toFixed(1) + 's' : '-'}${hasSourceEntries ? ' | 📦 Kaynak Mevcut' : ''}`;
        }

        // Prompt gösterimi
        const promptDisplay = isScrapeOnly
            ? '<em style="opacity: 0.6;">Henüz analiz yapılmadı - entry\'ler kaydedildi</em>'
            : escapeHtml(item.promptPreview || (item.prompt ? item.prompt.substring(0, 100) + (item.prompt.length > 100 ? '...' : '') : ''));

        // Başlık gösterimi - birden fazla başlık varsa alt alta linklerle göster
        let titleHtml = '';
        if (item.topics && item.topics.length > 1) {
            // Birden fazla başlık - alt alta linkli göster
            titleHtml = `<div class="history-title-multi">
                <span class="history-title-count">${item.topics.length} başlık:</span>
                ${item.topics.map(t => `<a href="${escapeHtml(t.url)}" target="_blank" class="history-title-link">${escapeHtml(t.title)}</a>`).join('')}
            </div>`;
        } else {
            // Tek başlık
            titleHtml = `<a href="${escapeHtml(item.topicUrl)}" target="_blank" class="history-title">${escapeHtml(item.topicTitle)}</a>`;
        }

        html += `
            <div class="history-item ${selectableClass} ${selectedClass}" data-id="${escapeHtml(item.id)}" data-has-source="${hasSourceEntries}">
                <div class="history-item-header">
                    ${titleHtml}
                    <span class="history-date">${dateStr}</span>
                </div>
                <div class="history-meta">
                    ${metaHtml}
                </div>
                <div class="history-prompt">${promptDisplay}</div>
                <div class="history-actions">
                    ${!isScrapeOnly ? `<button class="btn-primary btn-view" data-id="${escapeHtml(item.id)}">Görüntüle</button>` : ''}
                    ${!isScrapeOnly ? `<button class="btn-secondary btn-copy" data-id="${escapeHtml(item.id)}">Kopyala</button>` : ''}
                    <button class="btn-danger btn-delete" data-id="${escapeHtml(item.id)}">Sil</button>
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
 * @param {Array} history - Analiz geçmişi listesi
 */
const attachEventListeners = (history) => {
    // Seçilebilir öğeler için tıklama
    document.querySelectorAll('.history-item.selectable').forEach(item => {
        item.addEventListener('click', (e) => {
            // Butonlara veya linklere tıklandığında seçim yapma
            if (e.target.closest('.history-actions') || e.target.closest('.history-title') || e.target.closest('.history-title-link')) {
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

    // Görüntüle butonları
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.getAttribute('data-id');
            const item = history.find(h => h.id === itemId);
            if (item) {
                showDetailModal(item);
            }
        });
    });

    // Kopyala butonları
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.getAttribute('data-id');
            const item = history.find(h => h.id === itemId);
            if (item) {
                try {
                    await navigator.clipboard.writeText(item.response);
                    const originalText = btn.textContent;
                    btn.textContent = '✓ Kopyalandı';
                    btn.style.backgroundColor = '#28a745';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.backgroundColor = '';
                    }, 2000);
                } catch (err) {
                    alert('Kopyalama başarısız oldu. Lütfen tekrar deneyin.');
                }
            }
        });
    });

    // Sil butonları
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.getAttribute('data-id');
            const item = history.find(h => h.id === itemId);
            if (item && confirm(`"${item.topicTitle}" analizini silmek istediğinize emin misiniz?`)) {
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
 * Detay modalını gösterir.
 * 
 * @param {Object} item - Gösterilecek analiz öğesi
 */
const showDetailModal = (item) => {
    const modal = document.getElementById('detailModal');
    const titleEl = document.getElementById('detailTitle');
    const metaEl = document.getElementById('detailMeta');
    const responseEl = document.getElementById('detailResponse');

    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    titleEl.textContent = item.topicTitle;
    metaEl.innerHTML = `
        <p><strong>Tarih:</strong> ${dateStr}</p>
        <p><strong>Model:</strong> ${escapeHtml(item.modelId)}</p>
        <p><strong>Entry Sayısı:</strong> ${item.entryCount}</p>
        <p><strong>Yanıt Süresi:</strong> ${item.responseTime ? (item.responseTime / 1000).toFixed(1) + ' saniye' : '-'}</p>
        <p><strong>Başlık URL:</strong> <a href="${escapeHtml(item.topicUrl)}" target="_blank">${escapeHtml(item.topicUrl)}</a></p>
        <p><strong>Prompt:</strong></p>
        <div class="detail-response" style="margin-top: 5px; font-style: italic;">${escapeHtml(item.prompt)}</div>
    `;
    responseEl.innerHTML = parseMarkdown(item.response);

    modal.classList.add('active');

    // Modal kapatma
    const closeBtn = document.getElementById('detailModalClose');
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
 * Geçmişi yükler ve gösterir.
 * 
 * Aynı başlık için birden fazla scrape-only entry varsa (eski verilerden dolayı),
 * sadece en son olanını gösterir (benzersiz scrape'ler).
 */
const loadHistory = async () => {
    let history = await getHistory();
    
    // Aynı başlık için birden fazla scrape-only entry varsa, sadece en son olanını göster
    // (timestamp'e göre sıralı olduğu için, ilk bulduğumuz en son olanıdır)
    const seenScrapes = new Map(); // topicId veya topicTitle -> entry
    const uniqueHistory = [];
    
    for (const item of history) {
        if (item.scrapeOnly === true) {
            // Scrape-only entry için benzersizlik kontrolü
            const key = item.topicId || item.topicTitle;
            if (!seenScrapes.has(key)) {
                seenScrapes.set(key, item);
                uniqueHistory.push(item);
            }
            // Aynı başlık için daha önce bir scrape-only entry gördük, bu yüzden bu entry'yi atla
        } else {
            // Analiz sonuçları her zaman gösterilir (benzersizlik kontrolü yok)
            uniqueHistory.push(item);
        }
    }
    
    renderHistory(uniqueHistory);
};

// =============================================================================
// EXPORT/IMPORT
// =============================================================================

/**
 * Analiz geçmişini JSON dosyası olarak dışa aktarır.
 */
const exportHistory = async () => {
    try {
        const history = await getHistory();
        
        if (history.length === 0) {
            alert('Dışa aktarılacak analiz geçmişi bulunamadı.');
            return;
        }

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            itemCount: history.length,
            history: history
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

        // Veri formatını kontrol et
        if (!importData.history || !Array.isArray(importData.history)) {
            throw new Error('Geçersiz dosya formatı. Geçmiş verisi bulunamadı.');
        }

        // Mevcut geçmişi al
        const currentHistory = await getHistory();
        const existingIds = new Set(currentHistory.map(item => item.id));

        // Yeni kayıtları filtrele (duplicate kontrolü)
        const newItems = importData.history.filter(item => {
            // ID kontrolü
            if (existingIds.has(item.id)) {
                return false;
            }
            // Aynı timestamp ve topicTitle kombinasyonu kontrolü
            const duplicate = currentHistory.find(existing => 
                existing.timestamp === item.timestamp && 
                existing.topicTitle === item.topicTitle &&
                existing.prompt === item.prompt
            );
            return !duplicate;
        });

        if (newItems.length === 0) {
            alert('İçe aktarılacak yeni kayıt bulunamadı. Tüm kayıtlar zaten mevcut.');
            return;
        }

        // Onay al
        const confirmed = confirm(
            `${importData.history.length} kayıt bulundu.\n` +
            `${newItems.length} yeni kayıt eklenecek.\n` +
            `${importData.history.length - newItems.length} kayıt zaten mevcut (atlanacak).\n\n` +
            `Devam etmek istiyor musunuz?`
        );

        if (!confirmed) {
            return;
        }

        // Yeni kayıtları mevcut geçmişe ekle (başa ekle - en yeni en üstte)
        const updatedHistory = [...newItems, ...currentHistory];

        // Storage'a kaydet
        await new Promise((resolve) => {
            chrome.storage.local.set({ analysisHistory: updatedHistory }, resolve);
        });

        // Listeyi yeniden yükle
        await loadHistory();

        // Başarı mesajı
        const statsTextEl = document.getElementById('statsText');
        if (statsTextEl) {
            const originalText = statsTextEl.textContent;
            statsTextEl.textContent = `✅ ${newItems.length} kayıt başarıyla içe aktarıldı`;
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

document.addEventListener('DOMContentLoaded', async () => {
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

    // Seçilen öğeleri al
    const selectedItemsList = allHistoryData.filter(item => selectedItems.has(item.id));

    // Özet bilgi göster
    let totalEntries = 0;
    let summaryHtml = '<p><strong>Seçilen Analizler:</strong></p><ul style="margin: 10px 0; padding-left: 20px;">';
    selectedItemsList.forEach(item => {
        const entryCount = item.sourceEntries ? item.sourceEntries.length : item.entryCount;
        totalEntries += entryCount;
        summaryHtml += `<li>${escapeHtml(item.topicTitle)} (${entryCount} entry)</li>`;
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

    // Seçilen öğelerin kaynak entry'lerini birleştir
    const selectedItemsList = allHistoryData.filter(item => selectedItems.has(item.id));

    // Entry'leri hazırla - her başlık için ayrı grup
    let combinedData = [];
    selectedItemsList.forEach(item => {
        if (item.sourceEntries && item.sourceEntries.length > 0) {
            combinedData.push({
                topicTitle: item.topicTitle,
                topicUrl: item.topicUrl,
                entries: item.sourceEntries
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
        // Birden fazla başlık varsa birleştir - iç içe geçmiş "X başlık" ifadelerini çöz
        // Her öğenin gerçek başlık sayısını hesapla
        let combinedTopics = [];
        selectedItemsList.forEach(item => {
            // Eğer öğe zaten birleştirilmiş bir analiz ise (topics dizisi varsa), onları kullan
            if (item.topics && item.topics.length > 0) {
                combinedTopics.push(...item.topics);
            } else {
                // Tek başlıklı öğe
                combinedTopics.push({
                    title: item.topicTitle,
                    url: item.topicUrl
                });
            }
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
