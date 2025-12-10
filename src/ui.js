/**
 * @fileoverview Ekşi Sözlük AI Analiz - UI Bileşenleri
 */

/**
 * Bir container'ın tema sınıfını günceller.
 * @param {HTMLElement} container - Güncellenecek container elementi
 */
const updateContainerTheme = (container) => {
    if (!container) return;
    if (detectTheme()) {
        container.classList.add('eksi-ai-dark');
    } else {
        container.classList.remove('eksi-ai-dark');
    }
};

const createAnalysisButton = async (h1Element, topicId = null, useCurrentPage = false) => {
    if (!h1Element) return;
    const existingBtnId = topicId ? `eksi-ai-main-btn-${topicId}` : 'eksi-ai-main-btn';
    if (document.getElementById(existingBtnId)) return;
    const btn = document.createElement('button');
    btn.id = existingBtnId;
    btn.className = 'eksi-ai-btn';
    btn.textContent = "Entry'leri Analiz Et";
    btn.onclick = useCurrentPage ? startAnalysis : () => startAnalysisForTopic(h1Element, topicId);
    if (h1Element.nextSibling) h1Element.parentNode.insertBefore(btn, h1Element.nextSibling);
    else h1Element.parentNode.appendChild(btn);
    const container = document.createElement('div');
    const containerId = topicId ? `eksi-ai-container-${topicId}` : 'eksi-ai-container';
    container.id = containerId;
    container.className = 'eksi-ai-container';
    container.style.display = 'none';
    updateContainerTheme(container);
    btn.parentNode.insertBefore(container, btn.nextSibling);

    // Cache kontrolü yap - varsa sonuçları hazırla ve kayıtlı analizler butonunu ekle (gizli başlar)
    try {
        const currentUrl = window.location.href;
        const cachedResults = await getCachedAnalysisForUrl(currentUrl);
        if (cachedResults && cachedResults.length > 0) {
            // Sonuçları container'da hazırla (gizli)
            showCachedResultsInContainer(cachedResults, container);
            // Kayıtlı analizleri göstermek için ayrı buton ekle
            addShowCachedResultsButton(existingBtnId, containerId, cachedResults.length);
        }
    } catch (err) {
        // Cache kontrol hatası - sessizce devam et
    }
};

/**
 * Cache'teki sonuçları container içinde gösterir.
 * Kayıtlı analizler ayrı bir div içinde tutulur, böylece renderActions içeriği değiştiğinde korunur.
 * 
 * @param {Array} cachedResults - Cache'teki analiz sonuçları
 * @param {HTMLElement} container - Ana container
 */
const showCachedResultsInContainer = (cachedResults, container) => {
    // Kayıtlı analizler için ayrı bir div oluştur (eğer yoksa)
    let cachedSection = container.querySelector('.eksi-ai-cached-results-section');
    if (!cachedSection) {
        cachedSection = document.createElement('div');
        cachedSection.className = 'eksi-ai-cached-results-section';
        cachedSection.style.display = 'none'; // Başlangıçta gizli
        container.appendChild(cachedSection);
    }
    
    // En yeni analizler en üstte olacak şekilde sırala (timestamp'e göre azalan sırada)
    const sortedResults = [...cachedResults].sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA; // Descending order (en yeni en üstte)
    });
    
    let html = `<h3>${sortedResults.length} kayıtlı analiz bulundu</h3>`;
    html += '<div class="eksi-ai-cached-content">';

    sortedResults.forEach((item, index) => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const timeStr = item.responseTime ? `${(item.responseTime / 1000).toFixed(2)}s` : '-';

        html += `
            <div class="eksi-ai-cached-item">
                <div class="eksi-ai-cached-header" data-index="${index}">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(item.promptPreview || item.prompt.substring(0, 80) + '...')}</div>
                        <div style="font-size: 12px; opacity: 0.7;">📝 ${escapeHtml(item.modelId)} | ⏱️ ${timeStr} | 📊 ${item.entryCount} entry | 📅 ${dateStr}</div>
                    </div>
                    <span class="eksi-ai-cached-toggle">▼</span>
                </div>
                <div class="eksi-ai-cached-body">
                    <div class="eksi-ai-markdown">${parseMarkdown(item.response)}</div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    cachedSection.innerHTML = html;

    // Toggle event'leri ekle
    cachedSection.querySelectorAll('.eksi-ai-cached-header').forEach(header => {
        header.onclick = () => {
            const body = header.nextElementSibling;
            const toggle = header.querySelector('.eksi-ai-cached-toggle');
            // getComputedStyle ile gerçek display değerini kontrol et
            const computedDisplay = window.getComputedStyle(body).display;
            const isVisible = computedDisplay !== 'none';
            if (isVisible) {
                body.style.display = 'none';
                toggle.textContent = '▼';
            } else {
                body.style.display = 'block';
                toggle.textContent = '▲';
            }
        };
    });
};

const createSingleEntryButton = async (heading) => {
    if (!heading || document.getElementById('eksi-ai-entry-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'eksi-ai-entry-btn';
    btn.className = 'eksi-ai-btn';
    btn.textContent = "Bu Entry'yi Analiz Et";
    btn.onclick = startSingleEntryAnalysis;
    if (heading.nextSibling) heading.parentNode.insertBefore(btn, heading.nextSibling);
    else heading.parentNode.appendChild(btn);
    const container = document.createElement('div');
    container.id = 'eksi-ai-entry-container';
    container.className = 'eksi-ai-container';
    container.style.display = 'none';
    updateContainerTheme(container);
    btn.parentNode.insertBefore(container, btn.nextSibling);

    // Cache kontrolü yap - varsa sonuçları hazırla ve kayıtlı analizler butonunu ekle (gizli başlar)
    try {
        const currentUrl = window.location.href;
        const cachedResults = await getCachedAnalysisForUrl(currentUrl);
        if (cachedResults && cachedResults.length > 0) {
            showCachedResultsInContainer(cachedResults, container);
            addShowCachedResultsButton('eksi-ai-entry-btn', 'eksi-ai-entry-container', cachedResults.length);
        }
    } catch (err) {
        // Cache kontrol hatası - sessizce devam et
    }
};

/**
 * Kayıtlı analizler butonunun state'ini günceller.
 * @param {string} mainBtnId - Ana buton ID'si
 * @param {string} containerId - Container ID'si
 */
const updateCachedResultsButtonState = (mainBtnId, containerId) => {
    const cachedBtnId = `${mainBtnId}-cached`;
    const cachedBtn = document.getElementById(cachedBtnId);
    if (!cachedBtn) return;
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
    if (!cachedSection) return;
    
    const cachedCount = cachedSection.querySelectorAll('.eksi-ai-cached-item').length;
    const isVisible = cachedSection.style.display !== 'none';
    
    cachedBtn.textContent = isVisible 
        ? `📚 Kayıtlı Analizleri Gizle (${cachedCount})`
        : `📚 Kayıtlı Analizler (${cachedCount})`;
};

/**
 * Kayıtlı analizleri göstermek için ayrı bir buton ekler.
 * @param {string} mainBtnId - Ana buton ID'si
 * @param {string} containerId - Container ID'si
 * @param {number} cachedCount - Kayıtlı analiz sayısı
 */
const addShowCachedResultsButton = (mainBtnId, containerId, cachedCount) => {
    const cachedBtnId = `${mainBtnId}-cached`;
    // Eğer buton zaten varsa, sadece güncelle
    let cachedBtn = document.getElementById(cachedBtnId);
    const mainBtn = document.getElementById(mainBtnId);
    const container = document.getElementById(containerId);
    if (!mainBtn || !container) return;
    
    if (!cachedBtn) {
        cachedBtn = document.createElement('button');
        cachedBtn.id = cachedBtnId;
        cachedBtn.className = 'eksi-ai-btn secondary eksi-ai-cached-btn';
        if (mainBtn.nextSibling) mainBtn.parentNode.insertBefore(cachedBtn, mainBtn.nextSibling);
        else mainBtn.parentNode.appendChild(cachedBtn);
    }
    
    // Kayıtlı analizler bölümünü bul
    const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
    const isVisible = cachedSection && cachedSection.style.display !== 'none';
    
    cachedBtn.textContent = isVisible 
        ? `📚 Kayıtlı Analizleri Gizle (${cachedCount})`
        : `📚 Kayıtlı Analizler (${cachedCount})`;
    
    cachedBtn.onclick = () => {
        // Container'ı göster (eğer gizliyse)
        if (container.style.display === 'none') {
            container.style.display = 'block';
        }
        
        // cachedSection'ı dinamik olarak bul (renderActions sonrası yeniden oluşturulmuş olabilir)
        const currentCachedSection = container.querySelector('.eksi-ai-cached-results-section');
        if (!currentCachedSection) return;
        
        const isCurrentlyVisible = currentCachedSection.style.display !== 'none';
        if (isCurrentlyVisible) {
            currentCachedSection.style.display = 'none';
            cachedBtn.textContent = `📚 Kayıtlı Analizler (${cachedCount})`;
        } else {
            currentCachedSection.style.display = 'block';
            cachedBtn.textContent = `📚 Kayıtlı Analizleri Gizle (${cachedCount})`;
        }
    };
};

const addToggleVisibilityButton = (mainBtnId, containerId, startHidden = false) => {
    const toggleBtnId = `${mainBtnId}-toggle`;
    if (document.getElementById(toggleBtnId)) return;
    const mainBtn = document.getElementById(mainBtnId);
    const container = document.getElementById(containerId);
    if (!mainBtn || !container) return;
    const toggleBtn = document.createElement('button');
    toggleBtn.id = toggleBtnId;
    toggleBtn.className = 'eksi-ai-btn secondary eksi-ai-toggle-btn';
    toggleBtn.textContent = startHidden ? 'Göster' : 'Gizle';
    toggleBtn.onclick = () => {
        if (container.style.display === 'none') { container.style.display = 'block'; toggleBtn.textContent = 'Gizle'; }
        else { container.style.display = 'none'; toggleBtn.textContent = 'Göster'; }
    };
    if (mainBtn.nextSibling) mainBtn.parentNode.insertBefore(toggleBtn, mainBtn.nextSibling);
    else mainBtn.parentNode.appendChild(toggleBtn);
};

const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allEntries, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${sanitizeFilename(topicTitle) || 'entries'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
};

const downloadMarkdown = (content) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(topicTitle) || 'analiz'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

const copyToClipboard = async (text, button) => {
    try {
        await navigator.clipboard.writeText(text);
        const orig = button.innerHTML;
        button.innerHTML = '<span>Kopyalandı!</span>';
        button.classList.add('success');
        setTimeout(() => { button.innerHTML = orig; button.classList.remove('success'); }, 2000);
    } catch (e) {
        button.innerHTML = '<span>Hata!</span>';
    }
};

const addResultActionButtons = (resultArea, markdownContent, userPrompt, showPromptHeader, clickedButton) => {
    const ac = document.createElement('div');
    ac.className = 'eksi-ai-result-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'eksi-ai-result-action-btn';
    copyBtn.innerHTML = '<span>Kopyala</span>';
    copyBtn.onclick = () => copyToClipboard(markdownContent, copyBtn);
    const dlBtn = document.createElement('button');
    dlBtn.className = 'eksi-ai-result-action-btn';
    dlBtn.innerHTML = '<span>Markdown İndir</span>';
    dlBtn.onclick = () => downloadMarkdown(markdownContent);
    const retryBtn = document.createElement('button');
    retryBtn.className = 'eksi-ai-result-action-btn';
    retryBtn.innerHTML = '<span>Tekrar Sor</span>';
    retryBtn.onclick = () => {
        responseCache.delete(userPrompt);
        if (clickedButton) clickedButton.classList.remove('eksi-ai-btn-cached');
        runGemini(userPrompt, showPromptHeader, clickedButton);
    };
    ac.appendChild(copyBtn);
    ac.appendChild(dlBtn);
    ac.appendChild(retryBtn);
    resultArea.insertBefore(ac, resultArea.firstChild);
};

const renderActions = async (container, wasStopped = false) => {
    // Container'ın tema durumunu güncelle
    updateContainerTheme(container);
    
    // Kayıtlı analizler bölümünü koru (varsa)
    const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
    let cachedSectionHtml = '';
    let cachedSectionDisplay = 'none';
    if (cachedSection) {
        cachedSectionDisplay = cachedSection.style.display || 'none';
        cachedSectionHtml = cachedSection.outerHTML;
    }
    
    const settings = await getSettings();
    const { tokenEstimate } = estimateTokens(allEntries);
    const tokenStr = formatTokenCount(tokenEstimate);
    const selectedModel = MODELS.find(m => m.id === settings.selectedModel);
    const contextWindow = selectedModel?.contextWindow || 1000000;
    const contextStr = formatTokenCount(contextWindow);
    const usagePercent = ((tokenEstimate / contextWindow) * 100).toFixed(1);
    let tokenClass = '';
    if (tokenEstimate > contextWindow * 0.95) tokenClass = 'eksi-ai-token-danger';
    else if (tokenEstimate > contextWindow * 0.80) tokenClass = 'eksi-ai-token-warning';
    const statusMessage = wasStopped
        ? `<div class="eksi-ai-info">İşlem durduruldu. ${allEntries.length} entry toplandı.</div><div class="eksi-ai-token-info ${tokenClass}">📊 ${allEntries.length} entry | ~${tokenStr} token</div>`
        : `<h3>${allEntries.length} entry toplandı.</h3><div class="eksi-ai-token-info ${tokenClass}">📊 ~${tokenStr} token | %${usagePercent} kullanım</div>`;
    let buttonsHtml = `<button id="btn-download" class="eksi-ai-btn secondary">JSON İndir</button>`;
    settings.prompts.forEach((item, index) => {
        buttonsHtml += `<div class="eksi-ai-button-group"><button id="btn-prompt-${index}" class="eksi-ai-btn" data-index="${index}">${item.name}</button><button id="btn-prompt-ve-${index}" class="eksi-ai-btn-ve" data-index="${index}" title="Prompt'u düzenle">ve</button></div>`;
    });
    buttonsHtml += `<button id="btn-custom-manual" class="eksi-ai-btn">Özel Prompt</button>`;
    
    // Kayıtlı analizler bölümünü koruyarak container içeriğini güncelle
    container.innerHTML = cachedSectionHtml + `${statusMessage}<div class="eksi-ai-actions">${buttonsHtml}</div><div id="ai-result" class="eksi-ai-result-area"></div><div id="ai-warning" class="eksi-ai-warning"></div>`;
    
    // Kayıtlı analizler bölümündeki toggle event'lerini yeniden bağla ve görünürlük durumunu koru
    if (cachedSectionHtml) {
        const restoredSection = container.querySelector('.eksi-ai-cached-results-section');
        if (restoredSection) {
            // Görünürlük durumunu koru
            restoredSection.style.display = cachedSectionDisplay;
            
            // Toggle event'lerini yeniden bağla
            restoredSection.querySelectorAll('.eksi-ai-cached-header').forEach(header => {
                header.onclick = () => {
                    const body = header.nextElementSibling;
                    const toggle = header.querySelector('.eksi-ai-cached-toggle');
                    // getComputedStyle ile gerçek display değerini kontrol et
                    const computedDisplay = window.getComputedStyle(body).display;
                    const isVisible = computedDisplay !== 'none';
                    if (isVisible) {
                        body.style.display = 'none';
                        toggle.textContent = '▼';
                    } else {
                        body.style.display = 'block';
                        toggle.textContent = '▲';
                    }
                };
            });
        }
    }
    
    document.getElementById('btn-download').onclick = downloadJson;
    settings.prompts.forEach((item, index) => {
        const btn = document.getElementById(`btn-prompt-${index}`);
        btn.onclick = () => {
            const vePrompt = btn.getAttribute('data-ve-prompt');
            if (vePrompt && responseCache.has(vePrompt)) runGemini(vePrompt, true, btn);
            else runGemini(item.prompt, false, btn);
        };
        document.getElementById(`btn-prompt-ve-${index}`).onclick = () => openCustomPromptModal(null, item.prompt, btn);
    });
    document.getElementById('btn-custom-manual').onclick = () => {
        const customBtn = document.getElementById('btn-custom-manual');
        if (customBtn.classList.contains('eksi-ai-btn-selected')) { openCustomPromptModal(customBtn); return; }
        if (lastCustomPrompt && responseCache.has(lastCustomPrompt)) { runGemini(lastCustomPrompt, true, customBtn); return; }
        openCustomPromptModal(customBtn);
    };
    
    // Kayıtlı analizler butonunun state'ini güncelle
    const containerId = container.id;
    let mainBtnId = null;
    if (containerId === 'eksi-ai-entry-container') {
        mainBtnId = 'eksi-ai-entry-btn';
    } else if (containerId.startsWith('eksi-ai-container-')) {
        const topicId = containerId.replace('eksi-ai-container-', '');
        mainBtnId = `eksi-ai-main-btn-${topicId}`;
    } else if (containerId === 'eksi-ai-container') {
        mainBtnId = 'eksi-ai-main-btn';
    }
    
    if (mainBtnId) {
        updateCachedResultsButtonState(mainBtnId, containerId);
    }
};

const openCustomPromptModal = (customButton = null, prefillPrompt = null, mainButton = null) => {
    const overlay = document.createElement('div');
    overlay.id = 'eksi-ai-modal-overlay';
    overlay.className = 'eksi-ai-modal-overlay';
    updateContainerTheme(overlay);
    const modal = document.createElement('div');
    modal.className = 'eksi-ai-modal-content';

    // Mevcut prompt'un satır sayısına göre textarea yüksekliğini hesapla
    const textToUse = prefillPrompt || lastCustomPrompt || '';
    const lineCount = textToUse ? textToUse.split('\n').length : 4;
    // Minimum 4 satır, maksimum 20 satır
    const rows = Math.max(4, Math.min(20, lineCount));
    // Her satır yaklaşık 24px (line-height + padding dikkate alınarak)
    const textareaHeight = rows * 24;

    modal.innerHTML = `<h3 class="eksi-ai-modal-title">Ne yapmamı istersin?</h3><textarea id="eksi-ai-custom-prompt" class="eksi-ai-textarea" style="height: ${textareaHeight}px" placeholder="Örnek: Bu konudaki mizahi entry'leri listele"></textarea><div class="eksi-ai-modal-actions"><button id="eksi-ai-modal-cancel" class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn">vazgeç</button><button id="eksi-ai-modal-submit" class="eksi-ai-modal-btn eksi-ai-modal-submit-btn">gönder</button></div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const textarea = document.getElementById('eksi-ai-custom-prompt');
    if (prefillPrompt) textarea.value = prefillPrompt;
    else if (lastCustomPrompt) textarea.value = lastCustomPrompt;
    setTimeout(() => { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = textarea.value.length; }, 100);
    const closeModal = () => { overlay.remove(); document.removeEventListener('keydown', handleEscape, true); };
    const handleEscape = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); } };
    document.getElementById('eksi-ai-modal-cancel').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    document.addEventListener('keydown', handleEscape, true);
    document.getElementById('eksi-ai-modal-submit').onclick = () => {
        const userPrompt = textarea.value.trim();
        if (mainButton) { mainButton.setAttribute('data-ve-prompt', userPrompt); runGemini(userPrompt, true, customButton, mainButton); }
        else { lastCustomPrompt = userPrompt; runGemini(userPrompt, true, customButton); }
        closeModal();
    };
    textarea.onkeydown = (e) => {
        if (textarea.style.borderColor === 'rgb(217, 83, 79)') textarea.style.borderColor = '';
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') document.getElementById('eksi-ai-modal-submit').click();
    };
};

const runGemini = async (userPrompt, showPromptHeader = false, clickedButton = null, mainButton = null) => {
    let container = clickedButton ? clickedButton.closest('#eksi-ai-container, #eksi-ai-entry-container') : null;
    const resultArea = container ? container.querySelector('#ai-result') : document.getElementById('ai-result');
    const warningArea = container ? container.querySelector('#ai-warning') : document.getElementById('ai-warning');
    if (clickedButton) {
        const ac = container ? container.querySelector('.eksi-ai-actions') : clickedButton.closest('.eksi-ai-actions');
        if (ac) ac.querySelectorAll('.eksi-ai-btn').forEach(b => b.classList.remove('eksi-ai-btn-selected'));
        clickedButton.classList.add('eksi-ai-btn-selected');
    }
    if (!resultArea || !warningArea) return;
    resultArea.style.display = 'block'; warningArea.style.display = 'none';
    const cacheKey = userPrompt;
    if (responseCache.has(cacheKey)) {
        const cd = responseCache.get(cacheKey);
        let html = '';
        if (showPromptHeader) html += `<div class="eksi-ai-custom-prompt-header"><span class="eksi-ai-custom-prompt-label">Özel Prompt:</span><span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span></div>`;
        if (cd.modelId) { const t = cd.responseTime ? ` (${(cd.responseTime / 1000).toFixed(2)}s)` : ''; html += `<div class="eksi-ai-model-note">📝 ${cd.modelId}${t}</div>`; }
        html += parseMarkdown(cd.response);
        resultArea.innerHTML = html;
        resultArea.classList.add('eksi-ai-markdown');
        addResultActionButtons(resultArea, cd.response, userPrompt, showPromptHeader, clickedButton);
        if (clickedButton) clickedButton.classList.add('eksi-ai-btn-cached');
        return;
    }
    const abortController = new AbortController();
    resultArea.innerHTML = '<span>Gemini düşünüyor...</span> <button class="eksi-ai-btn" style="padding:5px 12px;font-size:12px;margin:0" id="stop-gemini">Durdur</button>';
    document.getElementById('stop-gemini').onclick = () => { abortController.abort(); resultArea.innerHTML = 'İstek iptal ediliyor...'; };
    const settings = await getSettings();
    const apiKey = settings.geminiApiKey;
    const modelId = settings.selectedModel || 'gemini-2.5-flash';
    if (!apiKey) {
        resultArea.style.display = 'none'; warningArea.style.display = 'block';
        warningArea.innerHTML = 'Gemini API Key bulunamadı. <a href="#" id="open-settings">Ayarlar</a> sayfasından ekleyin.';
        document.getElementById('open-settings').onclick = (e) => { e.preventDefault(); window.open(chrome.runtime.getURL('src/options.html'), '_blank'); };
        return;
    }
    const entriesJson = JSON.stringify(allEntries);
    const finalPrompt = `Başlık: "${topicTitle}"\n\nAşağıda Ekşi Sözlük entry'leri JSON formatında verilmiştir:\n${entriesJson}\n\n${userPrompt}`;
    try {
        let headerHTML = '';
        if (showPromptHeader) headerHTML = `<div class="eksi-ai-custom-prompt-header"><span class="eksi-ai-custom-prompt-label">Özel Prompt:</span><span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span></div>`;
        headerHTML += `<div class="eksi-ai-model-note" id="model-note-temp">📝 ${modelId} ⏳</div>`;
        resultArea.innerHTML = headerHTML + '<div class="eksi-ai-streaming-content eksi-ai-streaming eksi-ai-markdown"></div>';
        resultArea.classList.add('eksi-ai-markdown');
        const sc = resultArea.querySelector('.eksi-ai-streaming-content');
        const { text: response, responseTime } = await callGeminiApiStreaming(apiKey, modelId, finalPrompt, abortController.signal, (chunk, fullText) => { sc.innerHTML = parseMarkdown(fullText); });
        sc.classList.remove('eksi-ai-streaming');
        const mn = resultArea.querySelector('#model-note-temp');
        if (mn) { mn.innerHTML = `📝 ${modelId} (${(responseTime / 1000).toFixed(2)}s)`; mn.removeAttribute('id'); }
        addToCache(cacheKey, { response, modelId, responseTime, timestamp: Date.now() });
        await saveToHistory({ topicTitle, topicId, prompt: userPrompt, response, modelId, entryCount: allEntries.length, responseTime, sourceEntries: allEntries });
        // API çağrısı istatistiği kaydet
        const { tokenEstimate } = estimateTokens(allEntries);
        recordApiCall({ modelId, tokenEstimate, responseTime, fromCache: false, topicTitle });
        if (clickedButton) clickedButton.classList.add('eksi-ai-btn-cached');
        if (mainButton) mainButton.classList.add('eksi-ai-btn-cached');
        if (clickedButton && !clickedButton.classList.contains('eksi-ai-btn-selected')) return;
        addResultActionButtons(resultArea, response, userPrompt, showPromptHeader, clickedButton);
    } catch (err) {
        const msg = err.message;
        if (msg.includes('quota') || msg.includes('Quota exceeded')) showQuotaErrorWithRetry(resultArea, msg, userPrompt, showPromptHeader, clickedButton, modelId);
        else if (err.name === 'AbortError' || msg.includes('aborted')) resultArea.textContent = 'İstek iptal edildi.';
        else resultArea.textContent = 'Hata: ' + msg;
    }
};

const showQuotaErrorWithRetry = async (resultArea, errorMessage, userPrompt, showPromptHeader, clickedButton, currentModelId = null) => {
    const settings = await getSettings();
    const modelId = currentModelId || settings.selectedModel || 'gemini-2.5-flash';
    const apiKey = settings.geminiApiKey;
    const overlay = document.createElement('div');
    overlay.id = 'eksi-ai-quota-modal-overlay'; overlay.className = 'eksi-ai-modal-overlay';
    updateContainerTheme(overlay);
    const modal = document.createElement('div'); modal.className = 'eksi-ai-modal-content'; modal.style.maxWidth = '600px';
    let mc = `<h3 class="eksi-ai-modal-title">API Kota Limiti Aşıldı</h3><div class="eksi-ai-quota-modal-message"><p>Model (<strong>${modelId}</strong>) için quota aşıldı.</p></div><div id="eksi-ai-models-check-list">`;
    MODELS.forEach(m => { mc += `<div id="eksi-ai-model-check-${m.id}" class="eksi-ai-model-check-row"><div class="eksi-ai-model-check-info"><div class="eksi-ai-model-check-name">${m.name}</div><div class="eksi-ai-model-check-status checking">⏳ Kontrol ediliyor...</div></div></div>`; });
    mc += `</div><div class="eksi-ai-modal-actions"><button id="eksi-ai-compare-results-btn" class="eksi-ai-modal-btn" style="display:none">🔍 Karşılaştır</button><button id="eksi-ai-quota-modal-cancel" class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn">kapat</button></div>`;
    modal.innerHTML = mc; overlay.appendChild(modal); document.body.appendChild(overlay);
    const closeModal = () => { overlay.remove(); resultArea.innerHTML = '<div class="eksi-ai-warning">API kota limiti aşıldı.</div>'; };
    const handleEscape = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); document.removeEventListener('keydown', handleEscape, true); } };
    document.getElementById('eksi-ai-quota-modal-cancel').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    document.addEventListener('keydown', handleEscape, true);
    const modelResults = new Map();
    const entriesJson = JSON.stringify(allEntries);
    const finalPrompt = `Başlık: "${topicTitle}"\n\nAşağıda Ekşi Sözlük entry'leri JSON formatında verilmiştir:\n${entriesJson}\n\n${userPrompt}`;
    const checkModel = async (m) => {
        const row = document.getElementById(`eksi-ai-model-check-${m.id}`);
        if (!row) return;
        try {
            const av = await checkModelAvailability(apiKey, m.id, false);
            if (!av.available) { row.innerHTML = `<div class="eksi-ai-model-check-info"><div class="eksi-ai-model-check-name">${m.name}</div><div class="eksi-ai-model-check-status unavailable">❌ Kullanılamıyor</div></div>`; return; }
            try {
                const ac = new AbortController();
                const { text: response, responseTime } = await callGeminiApi(apiKey, m.id, finalPrompt, ac.signal);
                modelResults.set(m.id, { response, responseTime });
                const ts = responseTime ? ` (${(responseTime / 1000).toFixed(2)}s)` : '';
                row.innerHTML = `<div class="eksi-ai-model-check-info"><div class="eksi-ai-model-check-name">${m.name}</div><div class="eksi-ai-model-check-status available">✅ Başarılı${ts}</div></div><button class="eksi-ai-use-model-btn" style="padding:8px 16px;background:#81c14b;color:white;border:none;border-radius:4px;cursor:pointer">Bu sonucu göster</button>`;
                row.querySelector('.eksi-ai-use-model-btn').onclick = () => {
                    document.removeEventListener('keydown', handleEscape, true); overlay.remove();
                    addToCache(userPrompt, { response, modelId: m.id, responseTime, timestamp: Date.now() });
                    if (clickedButton) { clickedButton.classList.add('eksi-ai-btn-selected', 'eksi-ai-btn-cached'); }
                    resultArea.style.display = 'block';
                    let html = showPromptHeader ? `<div class="eksi-ai-custom-prompt-header"><span class="eksi-ai-custom-prompt-label">Özel Prompt:</span><span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span></div>` : '';
                    html += `<div class="eksi-ai-model-note">📝 ${m.id}${ts}</div>`;
                    html += parseMarkdown(response);
                    resultArea.innerHTML = html; resultArea.classList.add('eksi-ai-markdown');
                    addResultActionButtons(resultArea, response, userPrompt, showPromptHeader, clickedButton);
                };
            } catch (apiErr) {
                const em = apiErr.message || 'Hata';
                if (em.includes('quota') || em.includes('429')) row.innerHTML = `<div class="eksi-ai-model-check-info"><div class="eksi-ai-model-check-name">${m.name}</div><div class="eksi-ai-model-check-status quota-exceeded">⚠️ Quota aşıldı</div></div>`;
                else row.innerHTML = `<div class="eksi-ai-model-check-info"><div class="eksi-ai-model-check-name">${m.name}</div><div class="eksi-ai-model-check-status unavailable">❌ Hata</div></div>`;
            }
        } catch (e) { row.innerHTML = `<div class="eksi-ai-model-check-info"><div class="eksi-ai-model-check-name">${m.name}</div><div class="eksi-ai-model-check-status unavailable">❌ Hata</div></div>`; }
    };
    await Promise.all(MODELS.map(m => checkModel(m)));
    const cb = document.getElementById('eksi-ai-compare-results-btn');
    if (cb && modelResults.size > 0) { cb.style.display = 'block'; cb.onclick = () => { document.removeEventListener('keydown', handleEscape, true); showCompareResultsModal(modelResults, overlay, handleEscape); }; }
};

const showCompareResultsModal = (modelResults, parentOverlay, parentEscapeHandler) => {
    parentOverlay.style.display = 'none';
    const overlay = document.createElement('div'); overlay.className = 'eksi-ai-modal-overlay';
    updateContainerTheme(overlay);
    const modal = document.createElement('div'); modal.className = 'eksi-ai-modal-content'; modal.style.cssText = 'max-width:95vw;max-height:90vh;display:flex;flex-direction:column';
    let c = `<h3 class="eksi-ai-modal-title">Model Karşılaştırma</h3><div class="eksi-ai-compare-grid">`;
    MODELS.forEach(m => { const r = modelResults.get(m.id); if (r) { const t = r.responseTime ? ` (${(r.responseTime / 1000).toFixed(2)}s)` : ''; c += `<div class="eksi-ai-compare-card"><div class="eksi-ai-compare-card-header">${m.name}${t}</div><div class="eksi-ai-markdown" style="flex:1;overflow-y:auto">${parseMarkdown(r.response)}</div></div>`; } });
    c += `</div><div class="eksi-ai-modal-actions"><button id="eksi-ai-compare-modal-close" class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn">Kapat</button></div>`;
    modal.innerHTML = c; overlay.appendChild(modal); document.body.appendChild(overlay);
    const closeModal = () => { overlay.remove(); parentOverlay.style.display = ''; if (parentEscapeHandler) document.addEventListener('keydown', parentEscapeHandler, true); };
    document.getElementById('eksi-ai-compare-modal-close').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    const handleEscape = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); document.removeEventListener('keydown', handleEscape, true); } };
    document.addEventListener('keydown', handleEscape, true);
};

const startAnalysisForTopic = async (h1Element, topicId) => {
    let topicUrl = h1Element.getAttribute('data-focusto-href') || h1Element.getAttribute('data-topic-href');
    if (!topicUrl) { const tl = h1Element.querySelector('a'); if (!tl || !tl.href) return; topicUrl = tl.href; }
    const btnId = topicId ? `eksi-ai-main-btn-${topicId}` : 'eksi-ai-main-btn';
    const containerId = topicId ? `eksi-ai-container-${topicId}` : 'eksi-ai-container';
    const btn = document.getElementById(btnId); const container = document.getElementById(containerId);
    if (!btn || !container) return;

    // İkinci tıklamada yeniden scrape yap (allEntries zaten doluysa)
    const shouldUseFreshScrape = allEntries.length > 0;

    shouldStopScraping = false; responseCache.clear(); lastCustomPrompt = null;
    btn.textContent = 'Durdur'; btn.onclick = stopScraping; btn.disabled = false;
    container.style.display = 'block'; container.innerHTML = '<span class="eksi-ai-loading">Entry\'ler kontrol ediliyor...</span>';

    try {
        if (shouldUseFreshScrape) {
            // İkinci tıklama: Yeni scrape yap
            const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
            const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
            container.innerHTML = cachedSectionHtml + '<span class="eksi-ai-loading">Entry\'ler yeniden toplanıyor...</span>';
            await scrapeEntriesFromUrl(topicUrl);
        } else {
            // İlk tıklama: Önce cache'te sourceEntries var mı kontrol et
            const cachedResults = await getCachedAnalysisForUrl(topicUrl);
            const cachedWithEntries = cachedResults?.find(r => r.sourceEntries && r.sourceEntries.length > 0);

            if (cachedWithEntries) {
                // Cache'teki entry'leri kullan
                allEntries = cachedWithEntries.sourceEntries;
                topicTitle = cachedWithEntries.topicTitle || h1Element.innerText || 'Basliksiz';
                container.innerHTML = `<div class="eksi-ai-info">📦 Cache'ten ${allEntries.length} entry yüklendi.</div>`;
            } else {
                // Yeni scrape yap
                const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
                const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
                container.innerHTML = cachedSectionHtml + '<span class="eksi-ai-loading">Entry\'ler toplanıyor...</span>';
                await scrapeEntriesFromUrl(topicUrl);
            }
        }

        if (allEntries.length > 0) {
            // Scrape tamamlandığında (başarıyla veya durdurularak) geçmişe kaydet
            await saveToHistory({
                topicTitle,
                topicId,
                entryCount: allEntries.length,
                sourceEntries: allEntries,
                scrapeOnly: true,
                wasStopped: shouldStopScraping
            });
            await renderActions(container, shouldStopScraping);
            addToggleVisibilityButton(btnId, containerId);
            // Kayıtlı analizler butonunun state'ini güncelle
            updateCachedResultsButtonState(btnId, containerId);
        } else {
            const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
            const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
            container.innerHTML = cachedSectionHtml + '<div class="eksi-ai-warning">Hiç entry toplanamadı.</div>';
        }
    }
    catch (err) { 
        const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
        const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
        container.innerHTML = cachedSectionHtml + `<div class="eksi-ai-warning">Hata: ${escapeHtml(err.message)}</div>`;
    }
    finally { btn.disabled = false; btn.textContent = "Entry'leri Analiz Et"; btn.onclick = () => startAnalysisForTopic(h1Element, topicId); }
};

const startAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-main-btn'); const container = document.getElementById('eksi-ai-container');
    if (!btn || !container) return;

    // İkinci tıklamada yeniden scrape yap (allEntries zaten doluysa)
    const shouldUseFreshScrape = allEntries.length > 0;

    shouldStopScraping = false; responseCache.clear(); lastCustomPrompt = null;
    btn.textContent = 'Durdur'; btn.onclick = stopScraping; btn.disabled = false;
    container.style.display = 'block';
    
    // Kayıtlı analizler bölümünü koru (varsa)
    const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
    const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
    container.innerHTML = cachedSectionHtml + '<span class="eksi-ai-loading">Entry\'ler kontrol ediliyor...</span>';
    
    // Kayıtlı analizler butonunun state'ini güncelle
    updateCachedResultsButtonState('eksi-ai-main-btn', 'eksi-ai-container');

    try {
        if (shouldUseFreshScrape) {
            // İkinci tıklama: Yeni scrape yap
            const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
            const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
            container.innerHTML = cachedSectionHtml + '<span class="eksi-ai-loading">Entry\'ler yeniden toplanıyor...</span>';
            await scrapeEntries();
        } else {
            // İlk tıklama: Önce cache'te sourceEntries var mı kontrol et
            const currentUrl = window.location.href;
            const cachedResults = await getCachedAnalysisForUrl(currentUrl);
            const cachedWithEntries = cachedResults?.find(r => r.sourceEntries && r.sourceEntries.length > 0);

            if (cachedWithEntries) {
                // Cache'teki entry'leri kullan
                allEntries = cachedWithEntries.sourceEntries;
                topicTitle = cachedWithEntries.topicTitle || document.querySelector('h1')?.innerText || 'Basliksiz';
                const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
                const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
                container.innerHTML = cachedSectionHtml + `<div class="eksi-ai-info">📦 Cache'ten ${allEntries.length} entry yüklendi.</div>`;
            } else {
                // Yeni scrape yap
                const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
                const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
                container.innerHTML = cachedSectionHtml + '<span class="eksi-ai-loading">Entry\'ler toplanıyor...</span>';
                await scrapeEntries();
            }
        }

        if (allEntries.length > 0) {
            // Scrape tamamlandığında (başarıyla veya durdurularak) geçmişe kaydet
            await saveToHistory({
                topicTitle,
                topicId,
                entryCount: allEntries.length,
                sourceEntries: allEntries,
                scrapeOnly: true,
                wasStopped: shouldStopScraping
            });
            await renderActions(container, shouldStopScraping);
            addToggleVisibilityButton('eksi-ai-main-btn', 'eksi-ai-container');
            // Kayıtlı analizler butonunun state'ini güncelle
            updateCachedResultsButtonState('eksi-ai-main-btn', 'eksi-ai-container');
        } else {
            const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
            const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
            container.innerHTML = cachedSectionHtml + '<div class="eksi-ai-warning">Hiç entry toplanamadı.</div>';
        }
    }
    catch (err) { 
        const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
        const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
        container.innerHTML = cachedSectionHtml + `<div class="eksi-ai-warning">Hata: ${escapeHtml(err.message)}</div>`;
    }
    finally { btn.disabled = false; btn.textContent = "Entry'leri Analiz Et"; btn.onclick = startAnalysis; }
};

const startSingleEntryAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-entry-btn'); const container = document.getElementById('eksi-ai-entry-container');
    if (!btn || !container) return;

    // İkinci tıklamada yeniden scrape yap (allEntries zaten doluysa)
    const shouldUseFreshScrape = allEntries.length > 0;

    shouldStopScraping = false; responseCache.clear(); lastCustomPrompt = null;
    btn.textContent = 'Durdur'; btn.onclick = stopScraping; btn.disabled = false;
    container.style.display = 'block';
    
    // Kayıtlı analizler bölümünü koru (varsa)
    const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
    const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
    container.innerHTML = cachedSectionHtml + '<span class="eksi-ai-loading">Entry kontrol ediliyor...</span>';
    
    // Kayıtlı analizler butonunun state'ini güncelle
    updateCachedResultsButtonState('eksi-ai-entry-btn', 'eksi-ai-entry-container');

    try {
        if (shouldUseFreshScrape) {
            // İkinci tıklama: Yeni scrape yap
            const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
            const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
            container.innerHTML = cachedSectionHtml + '<span class="eksi-ai-loading">Entry yeniden toplanıyor...</span>';
            scrapeSingleEntryFromCurrentPage();
            if (!shouldStopScraping && allEntries.length > 0) {
                await fetchAllReferencedEntries(container.querySelector('.eksi-ai-loading'));
            }
        } else {
            // İlk tıklama: Önce cache'te sourceEntries var mı kontrol et
            const currentUrl = window.location.href;
            const cachedResults = await getCachedAnalysisForUrl(currentUrl);
            const cachedWithEntries = cachedResults?.find(r => r.sourceEntries && r.sourceEntries.length > 0);

            if (cachedWithEntries) {
                // Cache'teki entry'leri kullan
                allEntries = cachedWithEntries.sourceEntries;
                topicTitle = cachedWithEntries.topicTitle || 'Entry Analizi';
                const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
                const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
                container.innerHTML = cachedSectionHtml + `<div class="eksi-ai-info">📦 Cache'ten ${allEntries.length} entry yüklendi.</div>`;
            } else {
                // Yeni scrape yap
                const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
                const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
                container.innerHTML = cachedSectionHtml + '<span class="eksi-ai-loading">Entry toplanıyor...</span>';
                scrapeSingleEntryFromCurrentPage();
                if (!shouldStopScraping && allEntries.length > 0) {
                    await fetchAllReferencedEntries(container.querySelector('.eksi-ai-loading'));
                }
            }
        }

        if (allEntries.length > 0) {
            // Scrape tamamlandığında (başarıyla veya durdurularak) geçmişe kaydet
            await saveToHistory({
                topicTitle,
                topicId,
                entryCount: allEntries.length,
                sourceEntries: allEntries,
                scrapeOnly: true,
                wasStopped: shouldStopScraping
            });
            await renderActions(container, shouldStopScraping);
            addToggleVisibilityButton('eksi-ai-entry-btn', 'eksi-ai-entry-container');
            // Kayıtlı analizler butonunun state'ini güncelle
            updateCachedResultsButtonState('eksi-ai-entry-btn', 'eksi-ai-entry-container');
        } else {
            const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
            const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
            container.innerHTML = cachedSectionHtml + '<div class="eksi-ai-warning">Entry toplanamadı.</div>';
        }
    }
    catch (err) { 
        const cachedSection = container.querySelector('.eksi-ai-cached-results-section');
        const cachedSectionHtml = cachedSection ? cachedSection.outerHTML : '';
        container.innerHTML = cachedSectionHtml + `<div class="eksi-ai-warning">Hata: ${escapeHtml(err.message)}</div>`;
    }
    finally { btn.disabled = false; btn.textContent = "Bu Entry'yi Analiz Et"; btn.onclick = startSingleEntryAnalysis; }
};

const scrapeEntries = async () => {
    allEntries = [];
    topicTitle = document.querySelector('h1')?.innerText || document.querySelector('#topic h1')?.innerText || 'Basliksiz';
    const pager = document.querySelector('.pager');
    const totalPages = pager ? parseInt(pager.getAttribute('data-pagecount')) || 1 : 1;
    const currentUrlObj = new URL(window.location.href);
    const baseUrl = currentUrlObj.origin + currentUrlObj.pathname;
    const existingParams = new URLSearchParams(currentUrlObj.search);
    const focustoEntryId = existingParams.get('focusto');
    let startPage = existingParams.get('p') ? parseInt(existingParams.get('p')) : 1;
    if (focustoEntryId) { const cp = pager?.getAttribute('data-currentpage'); if (cp) startPage = parseInt(cp) || 1; }
    existingParams.delete('p'); existingParams.delete('focusto');
    const statusSpan = document.querySelector('.eksi-ai-loading');
    if (startPage === 1 || focustoEntryId) { const { entries } = extractEntriesFromDoc(document, focustoEntryId); allEntries.push(...entries); }
    else { const sp = new URLSearchParams(existingParams); sp.set('p', startPage.toString()); if (statusSpan) statusSpan.textContent = `Sayfa ${startPage}/${totalPages} taranıyor...`; const r = await fetch(`${baseUrl}?${sp.toString()}`); const { entries } = extractEntriesFromDoc(new DOMParser().parseFromString(await r.text(), 'text/html')); allEntries.push(...entries); }
    for (let i = startPage + 1; i <= totalPages; i++) { if (shouldStopScraping) { if (statusSpan) statusSpan.textContent = `Durduruldu. ${allEntries.length} entry.`; break; } if (statusSpan) statusSpan.textContent = `Sayfa ${i}/${totalPages} taranıyor...`; const p = new URLSearchParams(existingParams); p.set('p', i.toString()); const r = await fetch(`${baseUrl}?${p.toString()}`); const { entries } = extractEntriesFromDoc(new DOMParser().parseFromString(await r.text(), 'text/html')); allEntries.push(...entries); }
    if (!shouldStopScraping) await fetchAllReferencedEntries(statusSpan);
};
