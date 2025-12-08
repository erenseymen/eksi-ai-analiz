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
            const history = result.analysisHistory;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const filteredHistory = history.filter(item => {
                const itemDate = new Date(item.timestamp);
                return itemDate >= cutoffDate;
            });

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

        html += `
            <div class="history-item" data-id="${escapeHtml(item.id)}">
                <div class="history-item-header">
                    <a href="${escapeHtml(item.topicUrl)}" target="_blank" class="history-title">${escapeHtml(item.topicTitle)}</a>
                    <span class="history-date">${dateStr}</span>
                </div>
                <div class="history-meta">
                    📝 ${escapeHtml(item.modelId)} | 📊 ${item.entryCount} entry | ⏱️ ${item.responseTime ? (item.responseTime / 1000).toFixed(1) + 's' : '-'}
                </div>
                <div class="history-prompt">${escapeHtml(item.promptPreview || item.prompt.substring(0, 100) + (item.prompt.length > 100 ? '...' : ''))}</div>
                <div class="history-actions">
                    <button class="btn-primary btn-view" data-id="${escapeHtml(item.id)}">Görüntüle</button>
                    <button class="btn-secondary btn-copy" data-id="${escapeHtml(item.id)}">Kopyala</button>
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
    // Görüntüle butonları
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemId = btn.getAttribute('data-id');
            const item = history.find(h => h.id === itemId);
            if (item) {
                showDetailModal(item);
            }
        });
    });

    // Kopyala butonları
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', async () => {
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
        btn.addEventListener('click', async () => {
            const itemId = btn.getAttribute('data-id');
            const item = history.find(h => h.id === itemId);
            if (item && confirm(`"${item.topicTitle}" analizini silmek istediğinize emin misiniz?`)) {
                await deleteHistoryItem(itemId);
                await loadHistory(); // Listeyi yeniden yükle
            }
        });
    });

    // Tümünü temizle butonu
    const clearBtn = document.getElementById('btnClearAll');
    clearBtn.addEventListener('click', async () => {
        if (confirm('Tüm analiz geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
            await clearHistory();
            await loadHistory(); // Listeyi yeniden yükle
        }
    });
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
        <div style="background: #fff; padding: 10px; border-radius: 4px; margin-top: 5px; font-style: italic; white-space: pre-wrap;">${escapeHtml(item.prompt)}</div>
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
 */
const loadHistory = async () => {
    const history = await getHistory();
    renderHistory(history);
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

    // Geçmişi yükle
    loadHistory();
});

