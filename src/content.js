/**
 * @fileoverview Ekşi Sözlük AI Analiz - Ana İçerik Script'i
 * 
 * Bu dosya Ekşi Sözlük sayfalarına enjekte edilen ana script'tir.
 * Temel işlevler:
 * - Entry'leri sayfadan toplama (scraping)
 * - Gemini API ile analiz yapma
 * - Sonuçları Markdown formatında gösterme
 * - Kullanıcı etkileşimlerini yönetme
 * 
 * Desteklenen sayfa türleri:
 * - Başlık sayfaları (/baslik-adi--id)
 * - Tek entry sayfaları (/entry/id)
 * 
 * Bağımlılıklar:
 * - constants.js (SYSTEM_PROMPT, DEFAULT_PROMPTS, escapeHtml)
 * - styles.css (UI stilleri)
 */

// =============================================================================
// GLOBAL DURUM DEĞİŞKENLERİ
// =============================================================================

/** @type {Array<Object>} Toplanan tüm entry'lerin listesi */
let allEntries = [];

/** @type {string} Mevcut başlığın adı */
let topicTitle = "";

/** @type {string} Mevcut başlığın ID'si */
let topicId = "";

/** @type {boolean} Entry toplama işleminin durdurulup durdurulmayacağını belirten bayrak */
let shouldStopScraping = false;


/** @type {Map<string, Object>} Gemini yanıtları için önbellek (anahtar: prompt, değer: yanıt) */
let responseCache = new Map();

/** @type {number} Önbellekteki maksimum yanıt sayısı (bellek sızıntısını önlemek için) */
const MAX_CACHE_SIZE = 50;

/**
 * Önbelleğe güvenli bir şekilde yanıt ekler.
 * 
 * Maksimum boyut aşılırsa en eski girişi siler (FIFO).
 * 
 * @param {string} key - Önbellek anahtarı (genellikle prompt)
 * @param {Object} value - Önbellek değeri (yanıt, model bilgisi vb.)
 */
const addToCache = (key, value) => {
    // Maksimum boyut aşıldıysa en eski girişi sil
    if (responseCache.size >= MAX_CACHE_SIZE) {
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
    }
    responseCache.set(key, value);
};

/** @type {number} Maksimum yeniden deneme sayısı (ağ hataları için) */
const MAX_RETRIES = 3;

/**
 * Geçici ağ hataları için yeniden deneme yapar.
 * 
 * Exponential backoff stratejisi kullanır (1s, 2s, 4s).
 * Abort hataları ve quota hataları yeniden denenmez.
 * 
 * @param {Function} fn - Çalıştırılacak async fonksiyon
 * @param {number} [retries=MAX_RETRIES] - Maksimum deneme sayısı
 * @returns {Promise<*>} Fonksiyonun sonucu
 * @throws {Error} Tüm denemeler başarısız olursa
 */
const retryWithBackoff = async (fn, retries = MAX_RETRIES) => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            // Abort hataları yeniden denenmez
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                throw err;
            }
            // Quota hataları yeniden denenmez
            if (err.message?.includes('quota') || err.message?.includes('429')) {
                throw err;
            }
            // Son deneme ise hatayı fırlat
            if (attempt === retries - 1) {
                throw err;
            }
            // Exponential backoff ile bekle (1s, 2s, 4s)
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
    }
};

/** @type {string|null} Son kullanılan özel prompt (önbellek için) */
let lastCustomPrompt = null;

/**
 * Entry verilerinden tahmini token sayısını hesaplar.
 * 
 * Gemini tokenizer yaklaşık olarak:
 * - Türkçe için ~4 karakter = 1 token
 * - JSON yapısı ve metadata için ek ~20% overhead
 * 
 * @param {Array} entries - Entry listesi
 * @returns {{charCount: number, tokenEstimate: number}} Karakter ve tahmini token sayısı
 */
const estimateTokens = (entries) => {
    const entriesJson = JSON.stringify(entries);
    const charCount = entriesJson.length;
    // Türkçe için yaklaşık 4 karakter = 1 token, JSON overhead için %20 ekle
    const tokenEstimate = Math.ceil(charCount / 4 * 1.2);
    return { charCount, tokenEstimate };
};

/**
 * Token sayısını okunabilir formatta döndürür.
 * 
 * @param {number} tokens - Token sayısı
 * @returns {string} Formatlanmış string (örn: "38.5K")
 */
const formatTokenCount = (tokens) => {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
};

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

// =============================================================================
// SAYFA TİPİ TESPİTİ
// =============================================================================

/**
 * URL ve DOM yapısına göre sayfa tipini tespit eder.
 * 
 * Desteklenen sayfa tipleri:
 * - topic-page: Başlık sayfası (/baslik-adi--id)
 * - entry-page: Tek entry sayfası (/entry/id)
 * - home-page: Ana sayfa (/)
 * - gundem-page: Gündem sayfası (/basliklar/gundem)
 * - olay-page: Olay sayfası (/basliklar/olay)
 * - debe-page: DEBE sayfası (/debe)
 * - channel-page: Kanal sayfaları (/basliklar/kanal/*)
 * - author-page: Yazar profil sayfası (/biri/*)
 * - statistics-page: İstatistik sayfaları (/istatistik/*)
 * 
 * @returns {string} Sayfa tipi tanımlayıcısı
 */
const detectPageType = () => {
    const path = window.location.pathname;

    // Başlık sayfası: /baslik-adi--id formatı
    if (/^\/[^\/]+--\d+/.test(path)) {
        return 'topic-page';
    }

    // Ana sayfa
    if (path === '/' || path === '') {
        return 'home-page';
    }

    // Gündem sayfası
    if (path === '/basliklar/gundem') {
        return 'gundem-page';
    }

    // Olay sayfası
    if (path === '/basliklar/olay') {
        return 'olay-page';
    }

    // Debe sayfası
    if (path === '/debe') {
        return 'debe-page';
    }

    // Kanal sayfaları
    if (path.startsWith('/basliklar/kanal/')) {
        return 'channel-page';
    }

    // Yazar profil sayfası
    if (path.startsWith('/biri/')) {
        return 'author-page';
    }

    // Entry sayfası
    if (path.startsWith('/entry/')) {
        return 'entry-page';
    }

    // İstatistik sayfaları
    if (path.startsWith('/istatistik/')) {
        return 'statistics-page';
    }

    return 'unknown';
};

// =============================================================================
// UI BİLEŞENLERİ OLUŞTURMA
// =============================================================================

/**
 * Analiz butonu ve sonuç konteynerini oluşturur.
 * 
 * Verilen h1 elementinin yanına "Entry'leri Analiz Et" butonu ekler.
 * Buton tıklandığında entry toplama ve analiz işlemi başlar.
 * 
 * @param {HTMLElement} h1Element - Butonun ekleneceği başlık elementi
 * @param {string|null} [topicId=null] - Başlık ID'si (benzersiz buton ID'si için)
 * @param {boolean} [useCurrentPage=false] - true ise mevcut sayfadan entry toplar,
 *                                           false ise başlık linkinden toplar
 */
const createAnalysisButton = (h1Element, topicId = null, useCurrentPage = false) => {
    if (!h1Element) {
        return;
    }

    // Bu başlık için buton zaten var mı kontrol et
    const existingBtnId = topicId ? `eksi-ai-main-btn-${topicId}` : 'eksi-ai-main-btn';
    if (document.getElementById(existingBtnId)) {
        return; // Buton zaten mevcut
    }

    const btn = document.createElement('button');
    btn.id = existingBtnId;
    btn.className = 'eksi-ai-btn';
    btn.textContent = "Entry'leri Analiz Et";

    // Başlık sayfalarında mevcut sayfa analizi, entry sayfalarında başlık-spesifik analiz kullan
    if (useCurrentPage) {
        btn.onclick = startAnalysis;
    } else {
        btn.onclick = () => startAnalysisForTopic(h1Element, topicId);
    }

    // Üst konteyneri bul (genellikle başlık sarmalayıcı)
    let parentContainer = h1Element.parentElement;

    // Daha uygun konteyner ara
    while (parentContainer && parentContainer !== document.body) {
        // Yaygın konteyner kalıplarını ara
        if (parentContainer.id === 'topic' ||
            parentContainer.classList.contains('topic') ||
            parentContainer.tagName === 'MAIN' ||
            parentContainer.querySelector('ul[ref*="entry"]') ||
            parentContainer.querySelector('#entry-item-list')) {
            break;
        }
        parentContainer = parentContainer.parentElement;
    }

    // Butonu h1'den sonra ekle
    if (h1Element.nextSibling) {
        h1Element.parentNode.insertBefore(btn, h1Element.nextSibling);
    } else {
        h1Element.parentNode.appendChild(btn);
    }

    // Sonuçlar ve aksiyonlar için konteyner oluştur
    const container = document.createElement('div');
    container.id = topicId ? `eksi-ai-container-${topicId}` : 'eksi-ai-container';
    container.className = 'eksi-ai-container';
    container.style.display = 'none';

    // Tema uygula
    if (detectTheme()) {
        container.classList.add('eksi-ai-dark');
    }

    // Konteyneri butonun hemen altına ekle
    btn.parentNode.insertBefore(container, btn.nextSibling);
};

// =============================================================================
// ANALİZ İŞLEMLERİ
// =============================================================================

/**
 * Belirli bir başlık için analiz başlatır.
 * 
 * Entry sayfalarında kullanılır. H1 elementinden başlık URL'sini çıkarır,
 * tüm entry'leri toplar ve analiz seçeneklerini gösterir.
 * 
 * @param {HTMLElement} h1Element - Başlık elementi (URL bilgisi içerir)
 * @param {string} topicId - Başlık ID'si (UI elementleri için)
 */
const startAnalysisForTopic = async (h1Element, topicId) => {
    // Heading'de focusto href var mı kontrol et (/entry/ID URL'leri için initEntryPage tarafından ayarlanır)
    // Bu, normal topic linkinden önceliklidir
    let topicUrl = h1Element.getAttribute('data-focusto-href');

    if (!topicUrl) {
        // Saklanmış topic URL'sini kontrol et (initEntryPage tarafından ayarlanır)
        topicUrl = h1Element.getAttribute('data-topic-href');
    }

    if (!topicUrl) {
        // h1 linkinden topic URL'sini çıkar
        const topicLink = h1Element.querySelector('a');
        if (!topicLink || !topicLink.href) {
            return;
        }
        topicUrl = topicLink.href;
    }
    const btnId = topicId ? `eksi-ai-main-btn-${topicId}` : 'eksi-ai-main-btn';
    const containerId = topicId ? `eksi-ai-container-${topicId}` : 'eksi-ai-container';

    const btn = document.getElementById(btnId);
    const container = document.getElementById(containerId);

    if (!btn || !container) {
        return;
    }

    // Durdurma bayrağını sıfırla ve yeni analiz için önbellek temizle
    shouldStopScraping = false;
    responseCache.clear();
    lastCustomPrompt = null;

    // Butonu "Durdur" butonuna dönüştür
    btn.textContent = "Durdur";
    btn.onclick = stopScraping;
    btn.disabled = false;

    container.style.display = 'block';
    container.innerHTML = '<span class="eksi-ai-loading">Entry\'ler toplanıyor... Lütfen bekleyin.</span>';

    try {
        // Topic sayfasına git ve entry'leri topla
        await scrapeEntriesFromUrl(topicUrl);

        // Entry varsa (erken durdurulsa bile) aksiyonları göster
        if (allEntries.length > 0) {
            await renderActions(container, shouldStopScraping);
            // Gizle/Göster butonunu ekle
            addToggleVisibilityButton(btnId, containerId);
        } else {
            container.innerHTML = '<div class="eksi-ai-warning">Hiç entry toplanamadı.</div>';
        }
    } catch (err) {
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${escapeHtml(err.message)}</div>`;
    } finally {
        // Orijinal butonu geri yükle
        btn.disabled = false;
        btn.textContent = "Entry'leri Analiz Et";
        btn.onclick = () => startAnalysisForTopic(h1Element, topicId);
    }
};

// =============================================================================
// ENTRY REFERANS İŞLEME
// =============================================================================

/**
 * Entry içeriğinden referans verilen entry ID'lerini çıkarır.
 * 
 * Ekşi Sözlük'te entry'ler arası referans formatı: (bkz: #entry_id)
 * Bu fonksiyon bu formatı arar ve ID'leri listeler.
 * 
 * @param {string} content - Entry içeriği
 * @returns {string[]} Bulunan entry ID'leri listesi
 * 
 * @example
 * extractReferencedEntryIds('Bu konuda (bkz: #12345) entry\'sine bakın')
 * // Döndürür: ['12345']
 */
const extractReferencedEntryIds = (content) => {
    if (!content) return [];

    const regex = /\(bkz:\s*#(\d+)\)/gi;
    const matches = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
        matches.push(match[1]); // Extract just the entry ID
    }

    return matches;
};

/**
 * Belirtilen ID'ye sahip entry'yi API'den alır.
 * 
 * eksisozluk.com/entry/{id} sayfasını fetch eder ve entry verilerini
 * DOM'dan parse eder. Referans entry'leri yüklemek için kullanılır.
 * 
 * @param {string} entryId - Alınacak entry'nin ID'si
 * @returns {Promise<Object|null>} Entry objesi veya hata durumunda null
 *          Entry objesi: {id, author, date, content}
 */
const fetchEntryById = async (entryId) => {
    try {
        const url = `https://eksisozluk.com/entry/${entryId}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`Failed to fetch entry ${entryId}: ${response.status}`);
            return null;
        }

        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // Entry elementini bul
        const entryItem = doc.querySelector(`li[data-id="${entryId}"]`) ||
            doc.querySelector('#entry-item-list > li');

        if (!entryItem) {
            console.warn(`Entry element not found for ${entryId}`);
            return null;
        }

        const contentElement = entryItem.querySelector('.content');
        const content = extractContentWithFullUrls(contentElement);
        const author = entryItem.querySelector('.entry-author')?.innerText.trim();
        const date = entryItem.querySelector('.entry-date')?.innerText.trim();

        if (!content) {
            return null;
        }

        return {
            id: entryId,
            author,
            date,
            content
        };
    } catch (err) {
        return null;
    }
};

/**
 * Tüm referans entry'leri toplu olarak alır ve ana listeye ekler.
 * 
 * allEntries içindeki her entry'nin referenced_entry_ids alanını kontrol eder,
 * eksik entry'leri API'den alır ve referenced_entries alanına tam veriyi ekler.
 * 
 * @param {HTMLElement|null} [statusSpan=null] - İlerleme durumunu gösterecek element
 */
const fetchAllReferencedEntries = async (statusSpan = null) => {
    // Benzersiz referans entry ID'lerini topla
    const existingIds = new Set(allEntries.map(e => e.id));
    const referencedIds = new Set();

    allEntries.forEach(entry => {
        if (entry.referenced_entry_ids) {
            entry.referenced_entry_ids.forEach(id => {
                if (!existingIds.has(id)) {
                    referencedIds.add(id);
                }
            });
        }
    });

    if (referencedIds.size === 0) {
        return;
    }

    const idsToFetch = Array.from(referencedIds);
    const fetchedEntries = new Map();

    // Her referans entry'yi getir
    for (let i = 0; i < idsToFetch.length; i++) {
        if (shouldStopScraping) {
            break;
        }

        const entryId = idsToFetch[i];
        if (statusSpan) {
            statusSpan.textContent = `Referans entry'ler alınıyor... (${i + 1}/${idsToFetch.length})`;
        }

        const entry = await fetchEntryById(entryId);
        if (entry) {
            fetchedEntries.set(entryId, entry);
        }

        // Rate limiting
        if (i < idsToFetch.length - 1) {
            await new Promise(r => setTimeout(r, 300));
        }
    }

    // allEntries'den referans edilen entry'leri de ekle
    allEntries.forEach(entry => {
        if (!fetchedEntries.has(entry.id)) {
            fetchedEntries.set(entry.id, {
                id: entry.id,
                author: entry.author,
                date: entry.date,
                content: entry.content
            });
        }
    });

    // allEntries'i tam referans entry objeleriyle güncelle
    allEntries.forEach(entry => {
        if (entry.referenced_entry_ids && entry.referenced_entry_ids.length > 0) {
            entry.referenced_entries = entry.referenced_entry_ids
                .map(id => fetchedEntries.get(id) || { id, error: 'Entry bulunamadı' })
                .filter(e => e !== null);

            // Geçici ID alanını kaldır
            delete entry.referenced_entry_ids;
        }
    });
};

// =============================================================================
// İÇERİK ÇIKARMA YARDIMCILARI
// =============================================================================

/**
 * DOM elementinden entry içeriğini çıkarır, kısaltılmış URL'leri tam URL ile değiştirir.
 * 
 * Ekşi Sözlük uzun URL'leri "..." ile kısaltır. Bu fonksiyon href değerini
 * kullanarak tam URL'yi geri yükler. Ayrıca gizli referansları (bkz) açığa çıkarır.
 * Satır sonlarını (<br> etiketlerini) korur.
 * 
 * @param {HTMLElement} contentElement - Entry içeriğini barındıran DOM elementi
 * @returns {string} Temizlenmiş ve URL'leri düzeltilmiş metin içeriği
 */
const extractContentWithFullUrls = (contentElement) => {
    if (!contentElement) return '';

    // DOM'u değiştirmemek için elementi klonla
    const clone = contentElement.cloneNode(true);

    // Tüm linkleri bul ve kısaltılmış URL metinlerini gerçek href ile değiştir
    const links = clone.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.innerText.trim();
        const title = link.getAttribute('title');

        // URL linki gibi görünüyor mu ve href tam URL mi kontrol et
        // and if the href is a full URL (starts with http)
        if (href && href.startsWith('http')) {
            // Metin ellipsis içeriyorsa veya kısaltılmış URL gibi görünüyorsa, tam href ile değiştir
            if (text.includes('…') || text.includes('...') ||
                (text.startsWith('http') && text !== href)) {
                // URL'nin önce ve sonra okunabilirlik için boşluk ekle
                link.innerText = ' ' + href + ' ';
            }
        }

        // Title attribute'taki gizli referansları işle ("* " linkleri "(bkz: swh)" title'larıyla)
        // Genellikle <sup class="ab"> elementleri içindedir
        if (title && text === '*') {
            // Yıldızı yıldız + title içeriğiyle değiştir
            // title genellikle "(bkz: terim)" formatındadır
            link.innerText = '* ' + title;
        }
    });

    // Satır sonlarını korumak için <br> etiketlerini yeni satır karakterleriyle değiştir
    // Bu, innerText almadan önce yapılmalı çünkü innerText <br>'i boşluğa dönüştürür
    clone.querySelectorAll('br').forEach(br => {
        br.replaceWith('\n');
    });

    return clone.innerText.trim();
};

/**
 * DOM belgesinden entry'leri çıkarır.
 * 
 * Entry listesini DOM'dan parse eder. İsteğe bağlı olarak focusto parametresiyle
 * belirli bir entry'den itibaren filtreleme yapabilir.
 * 
 * @param {Document} doc - Parse edilecek HTML belgesi
 * @param {string|null} [focustoEntryId=null] - Bu ID'den itibaren entry'leri al
 * @returns {{entries: Array, foundFocusEntry: boolean}} Entry listesi ve focusto bulundu mu
 */
const extractEntriesFromDoc = (doc, focustoEntryId = null) => {
    const entries = [];
    let foundFocusEntry = !focustoEntryId; // focusto yoksa tüm entry'leri dahil et

    const entryItems = doc.querySelectorAll('#entry-item-list > li');
    entryItems.forEach(item => {
        const id = item.getAttribute('data-id');

        // focusto entry ID'si varsa, bulana kadar entry'leri atla
        if (focustoEntryId && !foundFocusEntry) {
            if (id === focustoEntryId) {
                foundFocusEntry = true;
            } else {
                return; // Bu entry'yi atla
            }
        }

        const contentElement = item.querySelector('.content');
        const content = extractContentWithFullUrls(contentElement);
        const author = item.querySelector('.entry-author')?.innerText.trim();
        const date = item.querySelector('.entry-date')?.innerText.trim();

        if (content) {
            const entry = {
                id,
                author,
                date,
                content
            };

            // İçerikten referans entry ID'lerini çıkar (daha sonra tam entry'lerle doldurulacak)
            const referencedEntryIds = extractReferencedEntryIds(content);
            if (referencedEntryIds.length > 0) {
                entry.referenced_entry_ids = referencedEntryIds;
            }

            entries.push(entry);
        }
    });

    return { entries, foundFocusEntry };
};

// =============================================================================
// ENTRY TOPLAMA (SCRAPING)
// =============================================================================

/**
 * Belirtilen URL'den entry'leri toplar.
 * 
 * Başlık sayfasına gider, sayfa sayısını tespit eder ve tüm sayfaları
 * sırayla tarayarak entry'leri toplar. Rate limiting uygular.
 * 
 * Özellikler:
 * - Çok sayfalı başlıkları destekler
 * - focusto parametresini işler (belirli entry'den başlama)
 * - Query parametrelerini korur (?day=, ?a= vb.)
 * - Referans entry'leri otomatik yükler
 * 
 * @param {string} url - Başlık URL'si
 */
const scrapeEntriesFromUrl = async (url) => {
    allEntries = [];

    // URL'yi parse et ve query parametrelerini koru
    const urlObj = new URL(url);
    const baseUrl = urlObj.origin + urlObj.pathname;
    const existingParams = new URLSearchParams(urlObj.search);

    // focusto parametresini kontrol et
    const focustoEntryId = existingParams.get('focusto');

    // URL'den mevcut sayfa numarasını al (varsa)
    const currentPageParam = existingParams.get('p');
    let startPage = currentPageParam ? parseInt(currentPageParam) : 1;

    // Varsa 'p' parametresini kaldır (döngüde ekleyeceğiz)
    existingParams.delete('p');

    // Korunan query parametreleriyle ilk sayfa URL'sini oluştur ('p' olmadan)
    // focusto parametresini koru çünkü sunucu hangi sayfayı göstereceğine karar vermek için kullanır
    const firstPageParams = new URLSearchParams(existingParams);
    const firstPageUrl = firstPageParams.toString()
        ? `${baseUrl}?${firstPageParams.toString()}`
        : baseUrl;

    // Topic sayfasını getir (ilk sayfa veya focusto sayfası)
    const response = await fetch(firstPageUrl);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    // Başlık adını çıkar
    topicTitle = doc.querySelector('h1')?.innerText || doc.querySelector('#topic h1')?.innerText || "Basliksiz";

    // URL'den başlık ID'sini çıkar
    const urlMatch = url.match(/--(\d+)/);
    topicId = urlMatch ? urlMatch[1] : '';

    // Toplam sayfa sayısını belirle
    const pager = doc.querySelector('.pager');
    let totalPages = 1;
    if (pager) {
        const lastPageLink = pager.getAttribute('data-pagecount');
        totalPages = parseInt(lastPageLink) || 1;
    }

    // focusto varsa, sunucu o entry'yi içeren sayfaya yönlendirir
    // Hangi sayfada olduğumuzu tespit etmemiz gerekiyor
    if (focustoEntryId) {
        const currentPageFromPager = pager?.getAttribute('data-currentpage');
        if (currentPageFromPager) {
            startPage = parseInt(currentPageFromPager) || 1;
        }
    }

    const statusSpan = document.querySelector('.eksi-ai-loading');

    // Sonraki sayfa getirmeleri için focusto'yu parametrelerden kaldır (sadece ilk sayfa için gerekli)
    existingParams.delete('focusto');

    // Belirli bir sayfadan başlıyorsak (sayfa 1 değil), o sayfayı getir
    if (startPage > 1 && !focustoEntryId) {
        // Başlangıç sayfası için URL oluştur
        const startPageParams = new URLSearchParams(existingParams);
        startPageParams.set('p', startPage.toString());
        const startPageUrl = `${baseUrl}?${startPageParams.toString()}`;

        if (statusSpan) statusSpan.textContent = `Sayfa ${startPage}/${totalPages} taranıyor...`;

        const startPageResponse = await fetch(startPageUrl);
        const startPageText = await startPageResponse.text();
        const startPageDoc = parser.parseFromString(startPageText, 'text/html');

        const { entries } = extractEntriesFromDoc(startPageDoc);
        allEntries.push(...entries);
    } else {
        // İlk sayfa entry'lerini getirilen dokümandan işle (varsa focusto filtrelemesiyle)
        const { entries, foundFocusEntry } = extractEntriesFromDoc(doc, focustoEntryId);
        allEntries.push(...entries);

        // focusto entry bu sayfada bulunamadı, bir sorun var
        if (focustoEntryId && !foundFocusEntry) {
            console.warn(`focusto entry ${focustoEntryId} not found on page ${startPage}`);
        }
    }

    // Kalan sayfaları işle (startPage + 1'den başlayarak)
    for (let i = startPage + 1; i <= totalPages; i++) {
        // Kullanıcı durdurma istedi mi kontrol et
        if (shouldStopScraping) {
            if (statusSpan) statusSpan.textContent = `İşlem durduruldu. ${allEntries.length} entry toplandı.`;
            break;
        }

        if (statusSpan) statusSpan.textContent = `Sayfa ${i}/${totalPages} taranıyor...`;

        // Korunan query parametreleri + sayfa numarasıyla URL oluştur
        const params = new URLSearchParams(existingParams);
        params.set('p', i.toString());
        const pageUrl = `${baseUrl}?${params.toString()}`;

        const pageResponse = await fetch(pageUrl);
        const pageText = await pageResponse.text();
        const pageDoc = parser.parseFromString(pageText, 'text/html');

        const { entries } = extractEntriesFromDoc(pageDoc);
        allEntries.push(...entries);

        // Rate limiting - sunucuya nazik davran
        await new Promise(r => setTimeout(r, 500));
    }

    // Referans entry'lerin içeriklerini al
    if (!shouldStopScraping) {
        await fetchAllReferencedEntries(statusSpan);
    }
};

// =============================================================================
// SAYFA İNİTİALİZASYONU
// =============================================================================

/**
 * Eklentiyi başlatır ve sayfa tipine göre uygun işlemleri yapar.
 * 
 * Sayfa türünü tespit eder ve uygun init fonksiyonunu çağırır.
 * Ana sayfa, gündem gibi liste sayfalarında buton göstermez.
 */
const init = () => {
    const pageType = detectPageType();

    switch (pageType) {
        case 'topic-page':
            // Tek başlık sayfası - mevcut mantık
            initTopicPage();
            break;
        case 'entry-page':
            // Tek entry sayfası - başlık sayfasına link verebilir
            initEntryPage();
            break;
        case 'home-page':
        case 'gundem-page':
        case 'olay-page':
        case 'debe-page':
        case 'author-page':
        case 'channel-page':
        case 'statistics-page':
            // Don't show buttons on these pages
            break;
        default:
            // Fallback to topic page logic
            initTopicPage();
    }
};

/**
 * Tek başlık sayfası için UI'ı hazırlar.
 * 
 * Başlık elementini bulur ve analiz butonunu ekler.
 * Mevcut sayfa üzerinden entry toplama modunu kullanır.
 */
const initTopicPage = () => {
    let topicHeader = document.getElementById('topic');
    let topicTitleH1 = topicHeader ? topicHeader.querySelector('h1') : document.querySelector('h1');

    // h1 bulunduysa ama topicHeader bulunamadıysa (veya topicHeader h1'i içermiyorsa), topicHeader'ı güncelle
    if (topicTitleH1 && (!topicHeader || !topicHeader.contains(topicTitleH1))) {
        topicHeader = topicTitleH1.parentElement;
    }

    if (topicTitleH1 && !document.getElementById('eksi-ai-main-btn')) {
        // Başlık sayfaları için mevcut sayfa analizini kullan (useCurrentPage = true)
        createAnalysisButton(topicTitleH1, null, true);
    }
};

/**
 * Tek entry sayfasından entry verisini çıkarır.
 * 
 * /entry/ID formatındaki sayfalarda DOM'dan entry bilgilerini parse eder.
 * Birden fazla strateji dener çünkü DOM yapısı değişkenlik gösterebilir.
 */
const scrapeSingleEntryFromCurrentPage = () => {
    allEntries = [];

    // Mevcut URL'den entry ID'sini çıkar (/entry/ENTRY_ID)
    const entryIdMatch = window.location.pathname.match(/\/entry\/(\d+)/);
    if (!entryIdMatch) {
        return;
    }

    const entryId = entryIdMatch[1];

    // DOM'da entry'yi bulmak için birden fazla strateji dene
    let entryItem = null;
    let contentElement = null;

    // Strateji 1: data-id attribute ile bul
    entryItem = document.querySelector(`li[data-id="${entryId}"]`);

    // Strateji 2: entry-item-list üzerinden bul
    if (!entryItem) {
        const entryList = document.querySelector('#entry-item-list');
        if (entryList) {
            entryItem = entryList.querySelector(`li[data-id="${entryId}"]`) ||
                entryList.querySelector('li:first-child');
        }
    }

    // Strateji 3: Entry URL linki ile bul (tarih linki genellikle entry URL'sini içerir)
    if (!entryItem) {
        const entryLink = document.querySelector(`a[href="/entry/${entryId}"]`);
        if (entryLink) {
            entryItem = entryLink.closest('li');
        }
    }

    // Strateji 4: Entry olabilecek ana içerik alanındaki herhangi bir list item'ı bul
    if (!entryItem) {
        const main = document.querySelector('main');
        if (main) {
            // Look for list items that contain the entry ID in links
            const allLis = main.querySelectorAll('li');
            for (const li of allLis) {
                const links = li.querySelectorAll('a');
                for (const link of links) {
                    if (link.href.includes(`/entry/${entryId}`)) {
                        entryItem = li;
                        break;
                    }
                }
                if (entryItem) break;
            }
        }
    }

    if (!entryItem) {
        return;
    }

    // Entry verisini çıkar
    const id = entryItem.getAttribute('data-id') || entryId;

    // Content elementini bulmayı dene - birden fazla olası yapı
    contentElement = entryItem.querySelector('.content');
    if (!contentElement) {
        // List item içinde doğrudan içerik bulmayı dene
        // Entry sayfalarında içerik .content sınıfı olmadan li içinde olabilir
        // Elementi klonlayıp metadata elementlerini kaldıracağız
        const clone = entryItem.cloneNode(true);

        // Yaygın metadata elementlerini kaldır
        clone.querySelectorAll('.entry-author, .entry-date, .entry-footer, .entry-meta, .entry-actions').forEach(el => el.remove());

        // Yazar linklerini kaldır
        clone.querySelectorAll('a[href^="/biri/"]').forEach(el => {
            // Keep the text if it's not just the author name
            if (el.textContent.trim() === el.href.split('/').pop()) {
                el.remove();
            }
        });

        // Tarih linklerini kaldır (entry'nin kendisine işaret ederler)
        clone.querySelectorAll(`a[href="/entry/${entryId}"]`).forEach(el => el.remove());

        contentElement = clone;
    }

    const content = extractContentWithFullUrls(contentElement);

    // Yazarı çıkar - birden fazla seçici dene
    let author = entryItem.querySelector('.entry-author')?.innerText.trim() || '';
    if (!author) {
        const authorLink = entryItem.querySelector('a[href^="/biri/"]');
        if (authorLink) {
            author = authorLink.innerText.trim();
        }
    }

    // Tarihi çıkar - birden fazla seçici dene
    let date = entryItem.querySelector('.entry-date')?.innerText.trim() || '';
    if (!date) {
        const dateLink = entryItem.querySelector(`a[href="/entry/${entryId}"]`);
        if (dateLink) {
            date = dateLink.innerText.trim();
        }
    }

    // Başlık adını çıkar
    topicTitle = document.querySelector('h1')?.innerText ||
        document.querySelector('#topic h1')?.innerText ||
        "Basliksiz";

    // Varsa başlık ID'sini çıkar
    const topicLink = document.querySelector('h1 a[href*="--"]') ||
        document.querySelector('a[href*="--"]');
    if (topicLink) {
        const urlMatch = topicLink.href.match(/--(\d+)/);
        topicId = urlMatch ? urlMatch[1] : '';
    }

    if (content && content.trim()) {
        const entry = {
            id,
            author,
            date,
            content
        };

        // İçerikten referans entry ID'lerini çıkar
        const referencedEntryIds = extractReferencedEntryIds(content);
        if (referencedEntryIds.length > 0) {
            entry.referenced_entry_ids = referencedEntryIds;
        }

        allEntries.push(entry);
    }
};

/**
 * Tek entry için analiz başlatır.
 * 
 * Entry sayfalarında "Bu Entry'yi Analiz Et" butonu için handler.
 * Mevcut entry'yi DOM'dan alır, referanslarını yükler ve analiz seçeneklerini gösterir.
 */
const startSingleEntryAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-entry-btn');
    const container = document.getElementById('eksi-ai-entry-container');

    if (!btn || !container) {
        return;
    }

    // Durdurma bayrağını sıfırla ve yeni analiz için yanıt önbelleğini temizle
    shouldStopScraping = false;
    responseCache.clear();
    lastCustomPrompt = null;

    // Butonu "Durdur" butonuna dönüştür
    btn.textContent = "Durdur";
    btn.onclick = stopScraping;
    btn.disabled = false;

    container.style.display = 'block';
    container.innerHTML = '<span class="eksi-ai-loading">Entry toplanıyor... Lütfen bekleyin.</span>';

    try {
        // Scrape single entry from current page
        scrapeSingleEntryFromCurrentPage();

        // Fetch referenced entries if any
        if (!shouldStopScraping && allEntries.length > 0) {
            const statusSpan = container.querySelector('.eksi-ai-loading');
            await fetchAllReferencedEntries(statusSpan);
        }

        // Entry varsa aksiyonları render et
        if (allEntries.length > 0) {
            await renderActions(container, shouldStopScraping);
            // Gizle/Göster butonunu ekle
            addToggleVisibilityButton('eksi-ai-entry-btn', 'eksi-ai-entry-container');
        } else {
            container.innerHTML = '<div class="eksi-ai-warning">Entry toplanamadı.</div>';
        }
    } catch (err) {
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${escapeHtml(err.message)}</div>`;
    } finally {
        // Orijinal butonu geri yükle
        btn.disabled = false;
        btn.textContent = "Bu Entry'yi Analiz Et";
        btn.onclick = startSingleEntryAnalysis;
    }
};

/**
 * Tek entry analizi için buton oluşturur.
 * 
 * Entry sayfalarında kullanılır. "Bu Entry'yi Analiz Et" butonunu
 * başlık elementinin altına ekler.
 * 
 * @param {HTMLElement} heading - Butonun ekleneceği başlık elementi
 */
const createSingleEntryButton = (heading) => {
    if (!heading) {
        return;
    }

    // Buton zaten var mı kontrol et
    if (document.getElementById('eksi-ai-entry-btn')) {
        return; // Button already exists
    }

    const btn = document.createElement('button');
    btn.id = 'eksi-ai-entry-btn';
    btn.className = 'eksi-ai-btn';
    btn.textContent = "Bu Entry'yi Analiz Et";
    btn.onclick = startSingleEntryAnalysis;

    // Butonu h1'den sonra ekle
    if (heading.nextSibling) {
        heading.parentNode.insertBefore(btn, heading.nextSibling);
    } else {
        heading.parentNode.appendChild(btn);
    }

    // Sonuçlar/aksiyonlar için container oluştur
    const container = document.createElement('div');
    container.id = 'eksi-ai-entry-container';
    container.className = 'eksi-ai-container';
    container.style.display = 'none';

    // Apply theme
    if (detectTheme()) {
        container.classList.add('eksi-ai-dark');
    }

    // Konteyneri butonun altına ekle
    btn.parentNode.insertBefore(container, btn.nextSibling);
};

/**
 * Tek entry sayfası için UI'ı hazırlar.
 * 
 * Entry sayfalarında sadece tek entry analizi butonu gösterir.
 * Tam başlık analizi için ayrı bir buton eklenmez.
 */
const initEntryPage = () => {
    // Entry sayfalarında başlık linkini ve heading'i bulmamız gerekiyor
    // Entry sayfalarında DOM yapısı: h1 başlık title linkini içerir

    // First, find the h1 element (topic title)
    const heading = document.querySelector('#topic h1') || document.querySelector('h1');
    if (!heading) {
        return;
    }

    // Tek entry analizi için buton oluştur
    createSingleEntryButton(heading);
};

// =============================================================================
// TEMA TESPİTİ
// =============================================================================

/**
 * Sayfanın karanlık mod kullanıp kullanmadığını tespit eder.
 * 
 * Body background renginin parlaklığını hesaplar.
 * Parlaklık 128'den düşükse karanlık mod olarak kabul eder.
 * 
 * @returns {boolean} true ise karanlık mod aktif
 */
const detectTheme = () => {
    // Body background rengine veya belirli sınıflara göre karanlık modu kontrol et
    // Ekşi Sözlük dark mode usually has a dark background color
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    // Simple check: if background is dark (brightness < 128), it's dark mode
    const rgb = bodyBg.match(/\d+/g);
    if (rgb) {
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        return brightness < 128;
    }
    return false;
};

/**
 * Ana analiz işlemini başlatır.
 * 
 * Başlık sayfalarında "Entry'leri Analiz Et" butonu için handler.
 * Mevcut sayfadaki tüm entry'leri toplar ve analiz seçeneklerini gösterir.
 */
const startAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-main-btn');
    const container = document.getElementById('eksi-ai-container');

    if (!btn || !container) {
        return;
    }

    // Durdurma bayrağını sıfırla ve yeni analiz için yanıt önbelleğini temizle
    shouldStopScraping = false;
    responseCache.clear();
    lastCustomPrompt = null;

    // Butonu "Durdur" butonuna dönüştür
    btn.textContent = "Durdur";
    btn.onclick = stopScraping;
    btn.disabled = false;

    container.style.display = 'block';
    container.innerHTML = '<span class="eksi-ai-loading">Entry\'ler toplanıyor... Lütfen bekleyin.</span>';

    try {
        await scrapeEntries();

        // Entry varsa (erken durdurulsa bile) aksiyonları render et
        if (allEntries.length > 0) {
            await renderActions(container, shouldStopScraping);
            // Gizle/Göster butonunu ekle
            addToggleVisibilityButton('eksi-ai-main-btn', 'eksi-ai-container');
        } else {
            container.innerHTML = '<div class="eksi-ai-warning">Hiç entry toplanamadı.</div>';
        }
    } catch (err) {
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${escapeHtml(err.message)}</div>`;
    } finally {
        // Orijinal butonu geri yükle
        btn.disabled = false;
        btn.textContent = "Entry'leri Analiz Et";
        btn.onclick = startAnalysis;
    }
};

/**
 * Entry toplama işlemini durdurur.
 * 
 * "Durdur" butonuna basıldığında çağrılır. shouldStopScraping bayrağını
 * true yaparak döngülerin durmasını sağlar.
 */
const stopScraping = () => {
    shouldStopScraping = true;
    // Her iki butonu da bulmayı dene (ana veya entry sayfa butonu)
    const btn = document.getElementById('eksi-ai-main-btn') || document.getElementById('eksi-ai-entry-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Durduruluyor...";
    }
};

/**
 * Mevcut sayfadan entry'leri toplar.
 * 
 * startAnalysis tarafından çağrılır. Mevcut başlık sayfasındaki tüm
 * entry'leri toplar, çok sayfalı başlıkları destekler.
 * 
 * Özellikler:
 * - Mevcut sayfa numarasından başlar
 * - Query parametrelerini korur
 * - Kullanıcı durdurabilir
 */
const scrapeEntries = async () => {
    allEntries = [];
    topicTitle = document.querySelector('h1')?.innerText || document.querySelector('#topic h1')?.innerText || "Basliksiz";

    // Determine total pages
    const pager = document.querySelector('.pager');
    let totalPages = 1;
    if (pager) {
        const lastPageLink = pager.getAttribute('data-pagecount');
        totalPages = parseInt(lastPageLink) || 1;
    }

    // Parse current URL to preserve query parameters (like ?day=2025-12-04, ?a=tracked&snapshot=180043127)
    const currentUrlObj = new URL(window.location.href);
    const baseUrl = currentUrlObj.origin + currentUrlObj.pathname;
    const existingParams = new URLSearchParams(currentUrlObj.search);

    // focusto parametresini kontrol et
    const focustoEntryId = existingParams.get('focusto');

    // URL'den mevcut sayfa numarasını al (varsa)
    const currentPageParam = existingParams.get('p');
    let startPage = currentPageParam ? parseInt(currentPageParam) : 1;

    // focusto varsa, sunucu o entry'yi içeren sayfayı gösterir
    // Pager'ı kontrol ederek hangi sayfada olduğumuzu tespit etmeliyiz
    if (focustoEntryId) {
        const currentPageFromPager = pager?.getAttribute('data-currentpage');
        if (currentPageFromPager) {
            startPage = parseInt(currentPageFromPager) || 1;
        }
    }

    // Remove 'p' parameter if it exists (we'll add it in the loop)
    existingParams.delete('p');
    // Remove focusto from params for subsequent page fetches
    existingParams.delete('focusto');

    const statusSpan = document.querySelector('.eksi-ai-loading');

    // Process current page entries from DOM (only if we're on page 1 without focusto, or the focusto page)
    // If we're on a later page without focusto, we'll fetch it in the loop
    if (startPage === 1 || focustoEntryId) {
        // Process entries from current DOM (with focusto filtering if applicable)
        const { entries, foundFocusEntry } = extractEntriesFromDoc(document, focustoEntryId);
        allEntries.push(...entries);

        // If focusto entry was not found on this page, something went wrong
        if (focustoEntryId && !foundFocusEntry) {
            console.warn(`focusto entry ${focustoEntryId} not found on current page`);
        }
    } else {
        // We're starting from a later page (without focusto), fetch it first
        const startPageParams = new URLSearchParams(existingParams);
        startPageParams.set('p', startPage.toString());
        const startPageUrl = `${baseUrl}?${startPageParams.toString()}`;

        if (statusSpan) statusSpan.textContent = `Sayfa ${startPage}/${totalPages} taranıyor...`;

        const startPageResponse = await fetch(startPageUrl);
        const startPageText = await startPageResponse.text();
        const parser = new DOMParser();
        const startPageDoc = parser.parseFromString(startPageText, 'text/html');

        const { entries } = extractEntriesFromDoc(startPageDoc);
        allEntries.push(...entries);
    }

    // Process remaining pages (starting from startPage + 1)
    for (let i = startPage + 1; i <= totalPages; i++) {
        // Check if user requested to stop
        if (shouldStopScraping) {
            if (statusSpan) statusSpan.textContent = `İşlem durduruldu. ${allEntries.length} entry toplandı.`;
            break;
        }

        if (statusSpan) statusSpan.textContent = `Sayfa ${i}/${totalPages} taranıyor...`;

        // Build URL with preserved query parameters + page number (no focusto needed for subsequent pages)
        const params = new URLSearchParams(existingParams);
        params.set('p', i.toString());
        const url = `${baseUrl}?${params.toString()}`;

        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const { entries } = extractEntriesFromDoc(doc);
        allEntries.push(...entries);

        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    // Referans entry'lerin içeriklerini al
    if (!shouldStopScraping) {
        await fetchAllReferencedEntries(statusSpan);
    }
};

// =============================================================================
// UI RENDER FONKSİYONLARI
// =============================================================================

/**
 * Ana analiz butonunun yanına "Gizle/Göster" butonu ekler.
 * 
 * Entry'ler toplandıktan sonra çağrılır. Ana butonun sağına bir buton ekler
 * ki kullanıcı eklentinin eklediği içeriği gizleyip gösterebilsin.
 * 
 * @param {string} mainBtnId - Ana analiz butonunun ID'si
 * @param {string} containerId - Konteyner elementinin ID'si
 */
const addToggleVisibilityButton = (mainBtnId, containerId) => {
    // Eğer buton zaten varsa, tekrar ekleme
    const toggleBtnId = `${mainBtnId}-toggle`;
    if (document.getElementById(toggleBtnId)) {
        return;
    }

    const mainBtn = document.getElementById(mainBtnId);
    const container = document.getElementById(containerId);

    if (!mainBtn || !container) {
        return;
    }

    // Gizle/Göster butonunu oluştur
    const toggleBtn = document.createElement('button');
    toggleBtn.id = toggleBtnId;
    toggleBtn.className = 'eksi-ai-btn secondary eksi-ai-toggle-btn';
    toggleBtn.textContent = 'Gizle';

    // Buton tıklandığında container'ı gizle/göster
    toggleBtn.onclick = () => {
        if (container.style.display === 'none') {
            container.style.display = 'block';
            toggleBtn.textContent = 'Gizle';
        } else {
            container.style.display = 'none';
            toggleBtn.textContent = 'Göster';
        }
    };

    // Ana butonun yanına ekle
    if (mainBtn.nextSibling) {
        mainBtn.parentNode.insertBefore(toggleBtn, mainBtn.nextSibling);
    } else {
        mainBtn.parentNode.appendChild(toggleBtn);
    }
};

/**
 * Analiz aksiyon butonlarını render eder.
 * 
 * Entry toplama tamamlandığında çağrılır. Kullanıcının ayarladığı
 * prompt butonlarını ve JSON indirme butonunu gösterir.
 * 
 * @param {HTMLElement} container - Butonların ekleneceği konteyner
 * @param {boolean} [wasStopped=false] - İşlem kullanıcı tarafından durduruldu mu
 */
const renderActions = async (container, wasStopped = false) => {
    const settings = await getSettings();

    // Token sayısını hesapla
    const { charCount, tokenEstimate } = estimateTokens(allEntries);
    const tokenStr = formatTokenCount(tokenEstimate);

    // Seçili modelin context window'unu al
    const selectedModel = MODELS.find(m => m.id === settings.selectedModel);
    const contextWindow = selectedModel?.contextWindow || 1000000;
    const contextStr = formatTokenCount(contextWindow);

    // Context kullanım yüzdesi
    const usagePercent = ((tokenEstimate / contextWindow) * 100).toFixed(1);

    // Uyarı rengi: >80% sarı, >95% kırmızı
    let tokenClass = '';
    if (tokenEstimate > contextWindow * 0.95) {
        tokenClass = 'eksi-ai-token-danger';
    } else if (tokenEstimate > contextWindow * 0.80) {
        tokenClass = 'eksi-ai-token-warning';
    }

    const statusMessage = wasStopped
        ? `<div class="eksi-ai-info">İşlem durduruldu. ${allEntries.length} entry toplandı.</div>
           <div class="eksi-ai-token-info ${tokenClass}">📊 ${allEntries.length} entry | ~${tokenStr} token | ${settings.selectedModel} (${contextStr} context)</div>`
        : `<h3>${allEntries.length} entry toplandı.</h3>
           <div class="eksi-ai-token-info ${tokenClass}">📊 ~${tokenStr} token tahmini | ${settings.selectedModel} (${contextStr} context) | %${usagePercent} kullanım</div>`;

    let buttonsHtml = `
        <button id="btn-download" class="eksi-ai-btn secondary">JSON İndir</button>
    `;

    // Add dynamic buttons from settings with "ve" buttons
    settings.prompts.forEach((item, index) => {
        buttonsHtml += `
            <div class="eksi-ai-button-group">
                <button id="btn-prompt-${index}" class="eksi-ai-btn" data-index="${index}">${item.name}</button>
                <button id="btn-prompt-ve-${index}" class="eksi-ai-btn-ve" data-index="${index}" title="Prompt'u düzenle">ve</button>
            </div>
        `;
    });

    buttonsHtml += `<button id="btn-custom-manual" class="eksi-ai-btn">Özel Prompt</button>`;

    container.innerHTML = `
        ${statusMessage}
        <div class="eksi-ai-actions">
            ${buttonsHtml}
        </div>
        <div id="ai-result" class="eksi-ai-result-area"></div>
        <div id="ai-warning" class="eksi-ai-warning"></div>
    `;

    document.getElementById('btn-download').onclick = downloadJson;

    // Add listeners for dynamic buttons
    settings.prompts.forEach((item, index) => {
        const btn = document.getElementById(`btn-prompt-${index}`);

        // Ana butona basıldığında, eğer "ve" butonundan gelen cached result varsa onu göster
        btn.onclick = () => {
            // "ve" butonundan gelen cached result'ı kontrol et
            // Cache key'i, ana prompt + "ve" butonundan gelen özel prompt kombinasyonu olabilir
            // Ancak daha basit bir yaklaşım: ana butonun data attribute'unda saklanan "ve" prompt'unu kontrol et
            const vePrompt = btn.getAttribute('data-ve-prompt');
            if (vePrompt && responseCache.has(vePrompt)) {
                // "ve" butonundan gelen cached result'ı göster
                runGemini(vePrompt, true, btn);
            } else {
                // Normal prompt'u çalıştır
                runGemini(item.prompt, false, btn);
            }
        };

        // Add listener for "ve" button
        const veBtn = document.getElementById(`btn-prompt-ve-${index}`);
        veBtn.onclick = () => openCustomPromptModal(null, item.prompt, btn);
    });

    document.getElementById('btn-custom-manual').onclick = () => {
        const customBtn = document.getElementById('btn-custom-manual');

        // If button is already selected (showing cached result), open modal for new prompt
        if (customBtn.classList.contains('eksi-ai-btn-selected')) {
            openCustomPromptModal(customBtn);
            return;
        }

        // If there's a cached custom prompt response, show it
        if (lastCustomPrompt && responseCache.has(lastCustomPrompt)) {
            runGemini(lastCustomPrompt, true, customBtn);
            return;
        }

        // Otherwise, open modal for new prompt
        openCustomPromptModal(customBtn);
    };
};

// =============================================================================
// DOSYA İŞLEMLERİ
// =============================================================================

/**
 * Dosya adını geçerli karakterlerle temizler.
 * 
 * Windows ve diğer işletim sistemlerinde geçersiz olan karakterleri
 * alt çizgi ile değiştirir.
 * 
 * @param {string} name - Temizlenecek dosya adı
 * @returns {string} Güvenli dosya adı
 */
const sanitizeFilename = (name) => {
    return name
        .replace(/[\\/:*?"<>|]/g, '_')  // Windows'ta geçersiz karakterleri değiştir
        .replace(/_+/g, '_')            // Ardışık alt çizgileri teke indir
        .replace(/^\s+|\s+$/g, '')      // Baş ve sondaki boşlukları temizle
        .replace(/^_+|_+$/g, '');       // Baş ve sondaki alt çizgileri temizle
};

/**
 * Toplanan entry'leri JSON dosyası olarak indirir.
 * 
 * allEntries dizisini formatlı JSON'a çevirir ve başlık adıyla
 * dosya olarak indirilmesini sağlar.
 */
const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allEntries, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const filename = sanitizeFilename(topicTitle) || 'entries';
    downloadAnchorNode.setAttribute("download", `${filename}.json`);
    document.body.appendChild(downloadAnchorNode); // Firefox için gerekli
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

// =============================================================================
// GEMİNİ API ENTEGRASYONu
// =============================================================================

/**
 * Gemini API'ye prompt gönderir ve sonucu gösterir.
 * 
 * Entry'leri ve kullanıcı promptunu birleştirerek Gemini API'ye gönderir.
 * Sonuçları önbelleğe alır, Markdown olarak render eder.
 * 
 * Özellikler:
 * - Yanıt önbellekleme (aynı prompt tekrar sorulduğunda API çağrısı yapmaz)
 * - İptal edilebilir istekler
 * - Hata yönetimi (quota, model hatası vb.)
 * 
 * @param {string} userPrompt - Kullanıcının promptu
 * @param {boolean} [showPromptHeader=false] - Özel prompt başlığı gösterilsin mi
 * @param {HTMLElement|null} [clickedButton=null] - Tıklanan buton (seçili görünüm için)
 * @param {HTMLElement|null} [mainButton=null] - "ve" butonundan geldiğinde ilgili ana buton (ok işareti için)
 */
const runGemini = async (userPrompt, showPromptHeader = false, clickedButton = null, mainButton = null) => {
    // Find container from clickedButton if available, otherwise use getElementById as fallback
    let container = null;
    if (clickedButton) {
        container = clickedButton.closest('#eksi-ai-container, #eksi-ai-entry-container');
    }

    // Find result and warning areas within the container, or fallback to getElementById
    const resultArea = container
        ? container.querySelector('#ai-result')
        : document.getElementById('ai-result');
    const warningArea = container
        ? container.querySelector('#ai-warning')
        : document.getElementById('ai-warning');

    // Mark clicked button as selected (remove from others first)
    if (clickedButton) {
        // Find actions container within the same container as the button
        const actionsContainer = container
            ? container.querySelector('.eksi-ai-actions')
            : clickedButton.closest('.eksi-ai-actions');
        if (actionsContainer) {
            actionsContainer.querySelectorAll('.eksi-ai-btn').forEach(btn => {
                btn.classList.remove('eksi-ai-btn-selected');
            });
        }
        clickedButton.classList.add('eksi-ai-btn-selected');
    }

    // Early return if result area not found
    if (!resultArea || !warningArea) {
        return;
    }

    resultArea.style.display = 'block';
    warningArea.style.display = 'none';

    // Check if we have a cached response for this prompt
    const cacheKey = userPrompt;
    if (responseCache.has(cacheKey)) {
        const cachedData = responseCache.get(cacheKey);

        // Build result HTML from cache
        let resultHTML = '';

        // Show custom prompt header if requested
        if (showPromptHeader && userPrompt) {
            resultHTML += `<div class="eksi-ai-custom-prompt-header">
                <span class="eksi-ai-custom-prompt-label">Özel Prompt:</span>
                <span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span>
            </div>`;
        }

        // Show model note if available
        if (cachedData.modelId) {
            const timeStr = cachedData.responseTime ? ` (${(cachedData.responseTime / 1000).toFixed(2)}s)` : '';
            resultHTML += `<div class="eksi-ai-model-note">📝 ${cachedData.modelId}${timeStr}</div>`;
        }

        resultHTML += parseMarkdown(cachedData.response);
        resultArea.innerHTML = resultHTML;
        resultArea.classList.add('eksi-ai-markdown');

        // Add action buttons for the result
        addResultActionButtons(resultArea, cachedData.response, userPrompt, showPromptHeader, clickedButton);

        // Mark button as cached
        if (clickedButton) {
            clickedButton.classList.add('eksi-ai-btn-cached');
        }
        return;
    }

    // Create AbortController for cancellation
    const abortController = new AbortController();

    // Create loading message with stop button
    const loadingContainer = document.createElement('div');
    loadingContainer.style.display = 'flex';
    loadingContainer.style.alignItems = 'center';
    loadingContainer.style.gap = '10px';

    const loadingText = document.createElement('span');
    loadingText.textContent = "Gemini düşünüyor...";

    const stopButton = document.createElement('button');
    stopButton.textContent = "Durdur";
    stopButton.className = 'eksi-ai-btn';
    stopButton.style.padding = '5px 12px';
    stopButton.style.fontSize = '12px';
    stopButton.style.margin = '0';
    stopButton.onclick = () => {
        abortController.abort();
        loadingText.textContent = "İstek iptal ediliyor...";
        stopButton.disabled = true;
    };

    loadingContainer.appendChild(loadingText);
    loadingContainer.appendChild(stopButton);
    resultArea.innerHTML = '';
    resultArea.appendChild(loadingContainer);

    const settings = await getSettings();
    const apiKey = settings.geminiApiKey;
    const modelId = settings.selectedModel || 'gemini-2.5-flash';

    if (!apiKey) {
        resultArea.style.display = 'none';
        warningArea.style.display = 'block';
        warningArea.innerHTML = 'Gemini API Key bulunamadı. Lütfen <a href="#" id="open-settings">Ayarlar</a> sayfasından ekleyin.';
        document.getElementById('open-settings').onclick = (e) => {
            e.preventDefault();
            window.open(chrome.runtime.getURL('src/options.html'), '_blank');
        };
        return;
    }

    const limitedEntries = allEntries;
    const entriesJson = JSON.stringify(limitedEntries);

    // Automatically wrap user prompt with title and entries
    const finalPrompt = `Başlık: "${topicTitle}"

Aşağıda Ekşi Sözlük entry'leri JSON formatında verilmiştir:
${entriesJson}

${userPrompt}`;

    try {
        // Streaming için değişkenler
        let fullResponse = '';
        let headerHTML = '';

        // Show custom prompt header if requested (sadece başlangıçta bir kez)
        if (showPromptHeader && userPrompt) {
            headerHTML = `<div class="eksi-ai-custom-prompt-header">
                <span class="eksi-ai-custom-prompt-label">Özel Prompt:</span>
                <span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span>
            </div>`;
        }

        // Model notu için placeholder (responseTime sonra eklenecek)
        headerHTML += `<div class="eksi-ai-model-note" id="model-note-temp">📝 ${modelId} ⏳</div>`;

        // Başlangıç HTML'ini ayarla
        resultArea.innerHTML = headerHTML + '<div class="eksi-ai-streaming-content eksi-ai-streaming eksi-ai-markdown"></div>';
        resultArea.classList.add('eksi-ai-markdown');

        const streamingContent = resultArea.querySelector('.eksi-ai-streaming-content');

        // Streaming API çağrısı
        const { text: response, responseTime } = await callGeminiApiStreaming(
            apiKey,
            modelId,
            finalPrompt,
            abortController.signal,
            (chunk, fullText) => {
                // Her chunk geldiğinde UI güncelle
                fullResponse = fullText;
                streamingContent.innerHTML = parseMarkdown(fullText);
            }
        );

        // Streaming tamamlandı - cursor'ı kaldır
        streamingContent.classList.remove('eksi-ai-streaming');

        // Model notunu responseTime ile güncelle
        const modelNote = resultArea.querySelector('#model-note-temp');
        if (modelNote) {
            const timeStr = responseTime ? ` (${(responseTime / 1000).toFixed(2)}s)` : '';
            modelNote.innerHTML = `📝 ${modelId}${timeStr}`;
            modelNote.removeAttribute('id');
        }

        // Cache the successful response with model info and response time
        addToCache(cacheKey, { response, modelId, responseTime, timestamp: Date.now() });

        // Mark button as cached
        if (clickedButton) {
            clickedButton.classList.add('eksi-ai-btn-cached');
        }

        // Eğer "ve" butonundan geldiyse, ana butonun cached işaretini ekle
        if (mainButton) {
            mainButton.classList.add('eksi-ai-btn-cached');
        }

        // Check if button is still selected (user might have clicked another button while waiting)
        // If not selected, don't overwrite the current result - user can click this button again to see cached result
        if (clickedButton && !clickedButton.classList.contains('eksi-ai-btn-selected')) {
            return;
        }

        // Add action buttons for the result
        addResultActionButtons(resultArea, response, userPrompt, showPromptHeader, clickedButton);
    } catch (err) {
        let errorMessage = err.message;

        // Provide helpful error message for model not found
        if (errorMessage.includes('not found') || errorMessage.includes('not supported')) {
            errorMessage = `Model "${modelId}" bulunamadı veya desteklenmiyor.\n\n` +
                `Lütfen Ayarlar sayfasından mevcut bir model seçin:\n` +
                `- gemini-3-pro-preview\n` +
                `- gemini-2.5-pro (Önerilen)\n` +
                `- gemini-2.5-flash\n` +
                `- gemini-2.5-flash-lite\n\n` +
                `Hata detayı: ${err.message}`;
            resultArea.textContent = "Hata: " + errorMessage;
        } else if (errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
            showQuotaErrorWithRetry(resultArea, errorMessage, userPrompt, showPromptHeader, clickedButton, modelId);
        } else {
            // Check if error is due to abort
            if (err.name === 'AbortError' || errorMessage.includes('aborted')) {
                resultArea.textContent = "İstek iptal edildi.";
            } else {
                resultArea.textContent = "Hata: " + errorMessage;
            }
        }
    }
};

/**
 * Gemini API'ye HTTP isteği yapar.
 * 
 * Model bazlı API versiyonu kullanır:
 * - Gemini 3 Pro Preview → v1beta
 * - Diğer modeller → v1
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} modelId - Kullanılacak model ID'si
 * @param {string} prompt - Gönderilecek tam prompt
 * @param {AbortSignal} signal - İstek iptal sinyali
 * @returns {Promise<string>} Model yanıtı
 * @throws {Error} API hatası durumunda
 */
const callGeminiApi = async (apiKey, modelId, prompt, signal) => {
    const startTime = performance.now();

    // Model bazlı API versiyonu belirleme (constants.js'den al)
    const model = MODELS.find(m => m.id === modelId);
    const apiVersion = model?.apiVersion || 'v1';
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:generateContent?key=${apiKey}`;

    try {
        // API versiyonuna göre payload yapısını belirle
        // v1beta: systemInstruction alanını destekler
        // v1: systemInstruction desteklemez, system instruction'ı prompt'un başına eklemeliyiz
        let requestBody;

        if (apiVersion === 'v1beta') {
            // v1beta: systemInstruction alanını kullan
            requestBody = {
                systemInstruction: {
                    parts: [{
                        text: SYSTEM_PROMPT
                    }]
                },
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            };
        } else {
            // v1: system instruction'ı prompt'un başına ekle
            const combinedPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
            requestBody = {
                contents: [{
                    parts: [{
                        text: combinedPrompt
                    }]
                }]
            };
        }

        const response = await retryWithBackoff(() => fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: signal
        }));

        if (response.ok) {
            const data = await response.json();
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            return { text: data.candidates[0].content.parts[0].text, responseTime };
        } else {
            const errorData = await response.json();
            // Get full error message including details
            const errorMsg = errorData.error?.message || 'API request failed';
            // Include error details if available
            const fullError = errorData.error?.details
                ? `${errorMsg}\n\n${JSON.stringify(errorData.error.details, null, 2)}`
                : errorMsg;
            throw new Error(fullError);
        }
    } catch (err) {
        throw new Error(err.message || 'Model bulunamadı. Lütfen model adını ve API versiyonunu kontrol edin.');
    }
};

/**
 * Gemini API'ye streaming HTTP isteği yapar.
 * 
 * SSE (Server-Sent Events) kullanarak yanıtı parça parça alır.
 * Her parça geldiğinde callback fonksiyonunu çağırır.
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} modelId - Kullanılacak model ID'si
 * @param {string} prompt - Gönderilecek tam prompt
 * @param {AbortSignal} signal - İstek iptal sinyali
 * @param {Function} onChunk - Her parça geldiğinde çağrılacak callback (chunk, fullText) => void
 * @returns {Promise<{text: string, responseTime: number}>} Tam yanıt ve süre
 * @throws {Error} API hatası durumunda
 */
const callGeminiApiStreaming = async (apiKey, modelId, prompt, signal, onChunk) => {
    const startTime = performance.now();

    // Model bazlı API versiyonu belirleme
    const model = MODELS.find(m => m.id === modelId);
    const apiVersion = model?.apiVersion || 'v1';
    // streamGenerateContent endpoint'i + SSE formatı için alt=sse
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;

    try {
        // Request body oluştur
        let requestBody;

        if (apiVersion === 'v1beta') {
            requestBody = {
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                contents: [{
                    parts: [{ text: prompt }]
                }]
            };
        } else {
            const combinedPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
            requestBody = {
                contents: [{
                    parts: [{ text: combinedPrompt }]
                }]
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = errorData.error?.message || 'API request failed';
            const fullError = errorData.error?.details
                ? `${errorMsg}\n\n${JSON.stringify(errorData.error.details, null, 2)}`
                : errorMsg;
            throw new Error(fullError);
        }

        // SSE stream'ini oku
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Gelen veriyi buffer'a ekle
            buffer += decoder.decode(value, { stream: true });

            // SSE event'lerini parse et
            // Her event "data: " ile başlar ve "\n\n" ile biter
            const lines = buffer.split('\n');
            buffer = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Son satır tamamlanmamış olabilir, buffer'a geri koy
                if (i === lines.length - 1 && !line.endsWith('\n')) {
                    buffer = line;
                    continue;
                }

                // "data: " ile başlayan satırları işle
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6).trim();

                    if (jsonStr && jsonStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(jsonStr);
                            // Gemini API yanıt formatı
                            const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                            if (chunk) {
                                fullText += chunk;
                                // Callback'i çağır
                                if (onChunk) {
                                    onChunk(chunk, fullText);
                                }
                            }
                        } catch (parseErr) {
                            // JSON parse hatası - muhtemelen eksik veri, devam et
                        }
                    }
                }
            }
        }

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        return { text: fullText, responseTime };
    } catch (err) {
        // Abort hatalarını yeniden fırlat
        if (err.name === 'AbortError') {
            throw err;
        }
        throw new Error(err.message || 'Streaming hatası oluştu.');
    }
};

/**
 * Tüm modelleri kontrol ederek quota'sı yeterli olan ilk modeli bulur.
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} [excludeModelId] - Kontrol edilmeyecek model ID'si (opsiyonel)
 * @returns {Promise<Object|null>} Uygun model objesi veya bulunamazsa null
 */
const findAvailableModel = async (apiKey, excludeModelId = null) => {
    // Tüm modelleri sırayla kontrol et (yüksekten düşüğe)
    for (const model of MODELS) {
        // Exclude edilen modeli atla
        if (excludeModelId && model.id === excludeModelId) {
            continue;
        }

        const availability = await checkModelAvailability(apiKey, model.id);

        // Model mevcut ve quota yeterli
        if (availability.available && !availability.quotaExceeded) {
            return model;
        }
    }

    return null; // Uygun model bulunamadı
};

/**
 * Kota aşım hatasını modal pencere ile gösterir.
 * 
 * Gemini API rate limit aşıldığında tüm modelleri kontrol eder ve
 * her model için progress gösterir. Quota'sı yeterli olan modeller için
 * "Bu modeli kullan" butonu ekler.
 * 
 * @param {HTMLElement} resultArea - Hata mesajının gösterileceği element
 * @param {string} errorMessage - API'den gelen hata mesajı
 * @param {string} userPrompt - Tekrar denemek için kullanılacak prompt
 * @param {boolean} showPromptHeader - Özel prompt başlığı gösterilsin mi
 * @param {HTMLElement|null} clickedButton - Seçili buton referansı
 * @param {string|null} currentModelId - Mevcut model ID'si (opsiyonel, verilmezse settings'den alınır)
 */
const showQuotaErrorWithRetry = async (resultArea, errorMessage, userPrompt, showPromptHeader, clickedButton, currentModelId = null) => {
    const settings = await getSettings();
    const modelId = currentModelId || settings.selectedModel || 'gemini-2.5-flash';
    const apiKey = settings.geminiApiKey;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'eksi-ai-quota-modal-overlay';
    overlay.className = 'eksi-ai-modal-overlay';

    // Apply theme to overlay/modal
    if (detectTheme()) {
        overlay.classList.add('eksi-ai-dark');
    }

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'eksi-ai-modal-content';
    modal.style.maxWidth = '600px';

    // Modal başlığı ve açıklama
    let modalContent = `
        <h3 class="eksi-ai-modal-title">API Kota Limiti Aşıldı</h3>
        <div class="eksi-ai-quota-modal-message">
            <p>Mevcut model (<strong>${modelId}</strong>) için API kota limiti aşıldı.</p>
            <p>Tüm modellerle sorgunuz deneniyor ve sonuçlar hazırlanıyor...</p>
        </div>
        <div id="eksi-ai-models-check-list">
    `;

    // Her model için bir satır oluştur (hepsi loading durumunda başlar)
    MODELS.forEach((model, index) => {
        const modelRowId = `eksi-ai-model-check-${model.id}`;

        // Tüm modeller için loading durumu
        modalContent += `
            <div id="${modelRowId}" class="eksi-ai-model-check-row">
                <div class="eksi-ai-model-check-info">
                    <div class="eksi-ai-model-check-name">${model.name}${model.id === modelId ? ' <span style="opacity: 0.7; font-size: 0.85em;">(Mevcut)</span>' : ''}</div>
                    <div class="eksi-ai-model-check-status checking">
                        <span class="eksi-ai-checking-spinner">⏳</span> Sorgu çalıştırılıyor...
                    </div>
                </div>
            </div>
        `;
    });

    modalContent += `
        </div>
        <div class="eksi-ai-modal-actions" style="display: flex; gap: 10px; justify-content: space-between; align-items: center;">
            <button id="eksi-ai-compare-results-btn" 
                    class="eksi-ai-modal-btn"
                    style="padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-weight: 500; transition: background-color 0.2s ease; display: none;">
                🔍 Cevapları Karşılaştır
            </button>
            <button id="eksi-ai-quota-modal-cancel" 
                    class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn">
                kapat
            </button>
        </div>
    `;

    modal.innerHTML = modalContent;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close modal function
    const closeModal = () => {
        overlay.remove();
        // Show error message in result area
        resultArea.style.display = 'block';
        resultArea.innerHTML = '<div class="eksi-ai-warning">API kota limiti aşıldı. Lütfen daha sonra tekrar deneyin.</div>';
    };

    const cancelBtn = document.getElementById('eksi-ai-quota-modal-cancel');
    cancelBtn.onclick = closeModal;

    // Close on overlay click (but not on modal click)
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
            document.removeEventListener('keydown', handleEscape, true);
        }
    };
    document.addEventListener('keydown', handleEscape, true);

    // Model sonuçlarını saklamak için Map (modelId -> response)
    const modelResults = new Map();

    // Kullanıcının gerçek prompt'unu hazırla (entry'lerle birlikte)
    const limitedEntries = allEntries;
    const entriesJson = JSON.stringify(limitedEntries);
    const finalPrompt = `Başlık: "${topicTitle}"

Aşağıda Ekşi Sözlük entry'leri JSON formatında verilmiştir:
${entriesJson}

${userPrompt}`;

    // Her modeli kontrol et ve gerçek prompt ile sonuç al
    const checkModelAndUpdateUI = async (model) => {
        const modelRowId = `eksi-ai-model-check-${model.id}`;
        const modelRow = document.getElementById(modelRowId);

        if (!modelRow) return;

        try {
            // Önce model availability kontrolü yap
            const availability = await checkModelAvailability(apiKey, model.id, false); // Quota kontrolü yapma

            if (!availability.available) {
                // Model kullanılamıyor
                modelRow.innerHTML = `
                    <div class="eksi-ai-model-check-info">
                        <div class="eksi-ai-model-check-name">${model.name}</div>
                        <div class="eksi-ai-model-check-status unavailable">
                            ❌ Kullanılamıyor${availability.error ? ` (${escapeHtml(availability.error)})` : ''}
                        </div>
                    </div>
                `;
                return;
            }

            // Model mevcut, gerçek prompt ile API çağrısı yap
            try {
                const abortController = new AbortController();
                const { text: response, responseTime } = await callGeminiApi(apiKey, model.id, finalPrompt, abortController.signal);

                // Sonucu sakla (response time ile birlikte)
                modelResults.set(model.id, { response, responseTime });

                // Başarılı - status göster (süre ile)
                const statusDiv = document.createElement('div');
                statusDiv.className = 'eksi-ai-model-check-status available';
                const timeStr = responseTime ? ` (${(responseTime / 1000).toFixed(2)}s)` : '';
                statusDiv.textContent = `✅ Başarılı${timeStr}`;

                // Response'u kısalt: tek satırlık gösterim için ilk 80 karakter
                const maxLength = 80;
                const truncatedResponse = response.length > maxLength
                    ? response.substring(0, maxLength).trim() + '...'
                    : response;

                // Tooltip için: maksimum 10 satır göster
                const maxTooltipLines = 10;
                const responseLines = response.split('\n');
                const tooltipText = responseLines.slice(0, maxTooltipLines).join('\n') +
                    (responseLines.length > maxTooltipLines ? '\n...' : '');

                modelRow.innerHTML = `
                    <div class="eksi-ai-model-check-info">
                        <div class="eksi-ai-model-check-name">${model.name}</div>
                    </div>
                    <div class="eksi-ai-use-model-btn-wrapper">
                        <button class="eksi-ai-use-model-btn" 
                                data-model-id="${model.id}"
                                style="padding: 8px 16px; background-color: #81c14b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-weight: 500; transition: background-color 0.2s ease;">
                            Bu sonucu göster
                        </button>
                    </div>
                `;

                // Status div'i ekle
                const infoDiv = modelRow.querySelector('.eksi-ai-model-check-info');
                infoDiv.appendChild(statusDiv);

                // Response önizlemesi ekle (body'ye eklenen tooltip ile, maksimum 10 satır)
                const previewTrigger = document.createElement('small');
                previewTrigger.className = 'eksi-ai-response-preview-trigger';
                previewTrigger.textContent = '💬 ' + truncatedResponse;

                // Tooltip'i body'ye ekleyerek modal'ın stacking context'inden çıkar
                let activeTooltip = null;

                previewTrigger.addEventListener('mouseenter', (e) => {
                    // Eğer zaten aktif tooltip varsa kaldır
                    if (activeTooltip) {
                        activeTooltip.remove();
                    }

                    // Tooltip oluştur
                    activeTooltip = document.createElement('div');
                    activeTooltip.className = 'eksi-ai-response-preview-tooltip eksi-ai-response-preview-tooltip-visible';
                    if (detectTheme()) {
                        activeTooltip.classList.add('eksi-ai-dark');
                    }
                    activeTooltip.textContent = tooltipText;
                    document.body.appendChild(activeTooltip);

                    // Pozisyonu hesapla (trigger'ın üstünde)
                    const rect = previewTrigger.getBoundingClientRect();
                    activeTooltip.style.position = 'fixed';
                    activeTooltip.style.left = `${rect.left}px`;
                    activeTooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`;
                });

                previewTrigger.addEventListener('mouseleave', () => {
                    if (activeTooltip) {
                        activeTooltip.remove();
                        activeTooltip = null;
                    }
                });

                infoDiv.appendChild(previewTrigger);

                // Buton event listener ekle
                const useBtn = modelRow.querySelector('.eksi-ai-use-model-btn');
                useBtn.onclick = async () => {
                    // Escape listener'ını kaldır (modal kapatılmadan önce)
                    document.removeEventListener('keydown', handleEscape, true);

                    // Modal'ı kapat
                    overlay.remove();

                    // Response'u cache'e kaydet (tekrar erişim için, responseTime ile)
                    addToCache(userPrompt, { response, modelId: model.id, responseTime, timestamp: Date.now() });

                    // Mark clicked button as selected and cached (if available)
                    if (clickedButton) {
                        // Find container from clickedButton
                        const container = clickedButton.closest('#eksi-ai-container, #eksi-ai-entry-container');
                        // Find actions container within the same container as the button
                        const actionsContainer = container
                            ? container.querySelector('.eksi-ai-actions')
                            : clickedButton.closest('.eksi-ai-actions');
                        if (actionsContainer) {
                            actionsContainer.querySelectorAll('.eksi-ai-btn').forEach(btn => {
                                btn.classList.remove('eksi-ai-btn-selected');
                            });
                        }
                        clickedButton.classList.add('eksi-ai-btn-selected');
                        // Butona ok işareti ekle (cached indicator)
                        clickedButton.classList.add('eksi-ai-btn-cached');
                    }

                    // Sonucu göster
                    resultArea.style.display = 'block';
                    resultArea.innerHTML = '';

                    // Build result HTML
                    let resultHTML = '';

                    if (showPromptHeader && userPrompt) {
                        resultHTML += `<div class="eksi-ai-custom-prompt-header">
                            <span class="eksi-ai-custom-prompt-label">Özel Prompt:</span>
                            <span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span>
                        </div>`;
                    }

                    // Add a note about the model used with response time
                    const modelTimeStr = responseTime ? ` (${(responseTime / 1000).toFixed(2)}s)` : '';
                    resultHTML += `<div class="eksi-ai-model-note">📝 ${model.id}${modelTimeStr}</div>`;

                    resultHTML += parseMarkdown(response);
                    resultArea.innerHTML = resultHTML;
                    resultArea.classList.add('eksi-ai-markdown');

                    // Add action buttons for the result
                    addResultActionButtons(resultArea, response, userPrompt, showPromptHeader, clickedButton);
                };

                // Hover efekti
                useBtn.onmouseenter = () => {
                    useBtn.style.backgroundColor = '#6da53e';
                };
                useBtn.onmouseleave = () => {
                    useBtn.style.backgroundColor = '#81c14b';
                };

            } catch (apiError) {
                const errorMsg = apiError.message || 'API çağrısı başarısız';

                // Quota/rate limit hatalarını kontrol et
                if (errorMsg.includes('quota') || errorMsg.includes('Quota exceeded') ||
                    errorMsg.includes('rate limit') || errorMsg.includes('Rate limit') ||
                    errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
                    // Quota aşıldı
                    modelRow.innerHTML = `
                        <div class="eksi-ai-model-check-info">
                            <div class="eksi-ai-model-check-name">${model.name}</div>
                            <div class="eksi-ai-model-check-status quota-exceeded">
                                ⚠️ Quota limiti aşıldı
                            </div>
                        </div>
                    `;
                } else {
                    // Diğer hatalar
                    modelRow.innerHTML = `
                        <div class="eksi-ai-model-check-info">
                            <div class="eksi-ai-model-check-name">${model.name}</div>
                            <div class="eksi-ai-model-check-status unavailable">
                                ❌ Hata: ${escapeHtml(errorMsg)}
                            </div>
                        </div>
                    `;
                }
            }
        } catch (error) {
            // Hata durumu
            modelRow.innerHTML = `
                <div class="eksi-ai-model-check-info">
                    <div class="eksi-ai-model-check-name">${model.name}</div>
                    <div class="eksi-ai-model-check-status unavailable">
                        ❌ Hata: ${escapeHtml(error.message)}
                    </div>
                </div>
            `;
        }
    };

    // Tüm modelleri paralel olarak kontrol et
    const checkPromises = MODELS.map(model => checkModelAndUpdateUI(model));
    await Promise.all(checkPromises);

    // En az bir sonuç varsa "Cevapları Karşılaştır" butonunu göster
    const compareBtn = document.getElementById('eksi-ai-compare-results-btn');
    if (compareBtn && modelResults.size > 0) {
        compareBtn.style.display = 'block';
        compareBtn.onclick = () => {
            // Ana modal'ın Escape handler'ını geçici olarak kaldır
            document.removeEventListener('keydown', handleEscape, true);
            showCompareResultsModal(modelResults, overlay, handleEscape);
        };
    }
};

/**
 * Tüm modellerin cevaplarını yan yana karşılaştırma modal'ı gösterir.
 * 
 * @param {Map<string, string>} modelResults - Model ID'leri ve cevapları
 * @param {HTMLElement} parentOverlay - Ana modal overlay (kapatılacak)
 * @param {Function} parentEscapeHandler - Ana modal'ın Escape handler'ı (tekrar eklemek için)
 */
const showCompareResultsModal = (modelResults, parentOverlay, parentEscapeHandler) => {
    // Ana modal'ı gizle (kaldırma, sadece gizle)
    parentOverlay.style.display = 'none';

    // Yeni karşılaştırma modal'ı oluştur
    const overlay = document.createElement('div');
    overlay.id = 'eksi-ai-compare-modal-overlay';
    overlay.className = 'eksi-ai-modal-overlay';

    // Apply theme to overlay/modal
    if (detectTheme()) {
        overlay.classList.add('eksi-ai-dark');
    }

    const modal = document.createElement('div');
    modal.className = 'eksi-ai-modal-content';
    modal.style.maxWidth = '95vw';
    modal.style.maxHeight = '90vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';

    // Modal başlığı
    let modalContent = `
        <h3 class="eksi-ai-modal-title" style="margin-bottom: 20px;">Model Cevaplarını Karşılaştır</h3>
        <div class="eksi-ai-compare-grid">
    `;

    // Her model için bir sütun oluştur
    MODELS.forEach(model => {
        const result = modelResults.get(model.id);
        if (result) {
            const { response, responseTime } = result;
            const timeStr = responseTime ? ` (${(responseTime / 1000).toFixed(2)}s)` : '';
            modalContent += `
                <div class="eksi-ai-compare-card">
                    <div class="eksi-ai-compare-card-header">
                        ${model.name}${timeStr}
                    </div>
                    <div class="eksi-ai-markdown" style="flex: 1; overflow-y: auto;">
                        ${parseMarkdown(response)}
                    </div>
                </div>
            `;
        }
    });

    modalContent += `
        </div>
        <div class="eksi-ai-modal-actions" style="margin-top: 20px; display: flex; justify-content: flex-end;">
            <button id="eksi-ai-compare-modal-close" 
                    class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn">
                Kapat
            </button>
        </div>
    `;

    modal.innerHTML = modalContent;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close modal function - karşılaştırma modal'ını kapat ve ana modal'ı tekrar göster
    const closeModal = () => {
        overlay.remove();
        // Ana modal'ı tekrar göster
        parentOverlay.style.display = '';
        // Ana modal'ın Escape handler'ını tekrar ekle
        if (parentEscapeHandler) {
            document.addEventListener('keydown', parentEscapeHandler, true);
        }
    };

    const closeBtn = document.getElementById('eksi-ai-compare-modal-close');
    closeBtn.onclick = closeModal;

    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
            document.removeEventListener('keydown', handleEscape, true);
        }
    };
    document.addEventListener('keydown', handleEscape, true);
};

/**
 * Seçilen model ile retry yapar.
 * 
 * @param {Object} model - Kullanılacak model objesi
 * @param {string} userPrompt - Kullanıcı promptu
 * @param {boolean} showPromptHeader - Özel prompt başlığı gösterilsin mi
 * @param {HTMLElement|null} clickedButton - Seçili buton referansı
 * @param {HTMLElement} resultArea - Sonuç alanı
 * @param {HTMLElement} overlay - Modal overlay
 */
const useModelForRetry = async (model, userPrompt, showPromptHeader, clickedButton, resultArea, overlay) => {
    const settings = await getSettings();
    const apiKey = settings.geminiApiKey;

    // Modal'ı kapat
    overlay.remove();

    // Clear the cache for this prompt
    responseCache.delete(userPrompt);

    // Create AbortController for cancellation
    const abortController = new AbortController();

    // Create loading message with stop button
    const loadingContainer = document.createElement('div');
    loadingContainer.style.display = 'flex';
    loadingContainer.style.alignItems = 'center';
    loadingContainer.style.gap = '10px';

    const loadingText = document.createElement('span');
    loadingText.textContent = "Gemini düşünüyor...";

    const stopButton = document.createElement('button');
    stopButton.textContent = "Durdur";
    stopButton.className = 'eksi-ai-btn';
    stopButton.style.padding = '5px 12px';
    stopButton.style.fontSize = '12px';
    stopButton.style.margin = '0';
    stopButton.onclick = () => {
        abortController.abort();
        loadingText.textContent = "İstek iptal ediliyor...";
        stopButton.disabled = true;
    };

    loadingContainer.appendChild(loadingText);
    loadingContainer.appendChild(stopButton);
    resultArea.style.display = 'block';
    resultArea.innerHTML = '';
    resultArea.appendChild(loadingContainer);

    // Call Gemini with the selected model
    try {
        const limitedEntries = allEntries;
        const entriesJson = JSON.stringify(limitedEntries);

        const finalPrompt = `Başlık: "${topicTitle}"

Aşağıda Ekşi Sözlük entry'leri JSON formatında verilmiştir:
${entriesJson}

${userPrompt}`;

        const { text: response, responseTime } = await callGeminiApi(apiKey, model.id, finalPrompt, abortController.signal);

        // Cache the successful response with model info and response time
        addToCache(userPrompt, { response, modelId: model.id, responseTime, timestamp: Date.now() });

        // Build result HTML
        let resultHTML = '';

        if (showPromptHeader && userPrompt) {
            resultHTML += `<div class="eksi-ai-custom-prompt-header">
                <span class="eksi-ai-custom-prompt-label">Özel Prompt:</span>
                <span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span>
            </div>`;
        }

        // Add a note about the model used with response time
        const retryTimeStr = responseTime ? ` (${(responseTime / 1000).toFixed(2)}s)` : '';
        resultHTML += `<div class="eksi-ai-model-note">📝 ${model.id}${retryTimeStr}</div>`;

        resultHTML += parseMarkdown(response);
        resultArea.innerHTML = resultHTML;
        resultArea.classList.add('eksi-ai-markdown');

        // Add action buttons for the result
        addResultActionButtons(resultArea, response, userPrompt, showPromptHeader, clickedButton);

    } catch (retryErr) {
        let retryErrorMessage = retryErr.message;

        // Check if error is due to abort
        if (retryErr.name === 'AbortError' || retryErrorMessage.includes('aborted')) {
            resultArea.innerHTML = '<div class="eksi-ai-warning">İstek iptal edildi.</div>';
        } else if (retryErrorMessage.includes('quota') || retryErrorMessage.includes('Quota exceeded')) {
            // If retry also fails with quota error, handle it recursively
            await showQuotaErrorWithRetry(resultArea, retryErrorMessage, userPrompt, showPromptHeader, clickedButton, model.id);
        } else {
            // If retry fails with a different error, show the error
            resultArea.innerHTML = `<div class="eksi-ai-warning">Hata: ${escapeHtml(retryErrorMessage)}</div>`;
        }
    }
};

// =============================================================================
// ÖZEL PROMPT MODALI
// =============================================================================

/**
 * Özel prompt giriş modalını açar.
 * 
 * Kullanıcının kendi promptunu yazabileceği bir modal pencere gösterir.
 * Ctrl+Enter ile gönderme, Escape ile kapatma destekler (yalnızca modal açıkken).
 * 
 * @param {HTMLElement|null} [customButton=null] - Modal kapandığında seçili görünecek buton
 * @param {string|null} [prefillPrompt=null] - Textarea'yı önceden dolduracak prompt metni
 * @param {HTMLElement|null} [mainButton=null] - "ve" butonundan geldiğinde ilgili ana buton referansı
 */
const openCustomPromptModal = (customButton = null, prefillPrompt = null, mainButton = null) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'eksi-ai-modal-overlay';
    overlay.className = 'eksi-ai-modal-overlay';

    // Apply theme to overlay/modal if needed (though overlay handles it via CSS vars usually, 
    // but we might need the class on the overlay to cascade)
    if (detectTheme()) {
        overlay.classList.add('eksi-ai-dark');
    }

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'eksi-ai-modal-content';

    modal.innerHTML = `
        <h3 class="eksi-ai-modal-title">Ne yapmamı istersin?</h3>
        <textarea id="eksi-ai-custom-prompt" 
                  class="eksi-ai-textarea"
                  placeholder="Örnek: Bu konudaki mizahi entry'leri listele"></textarea>
        <div class="eksi-ai-modal-actions">
            <button id="eksi-ai-modal-cancel" 
                    class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn">
                vazgeç
            </button>
            <button id="eksi-ai-modal-submit" 
                    class="eksi-ai-modal-btn eksi-ai-modal-submit-btn">
                gönder
            </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus on textarea
    const textarea = document.getElementById('eksi-ai-custom-prompt');
    const cancelBtn = document.getElementById('eksi-ai-modal-cancel');
    const submitBtn = document.getElementById('eksi-ai-modal-submit');

    // Pre-fill with provided prompt, or last custom prompt if exists
    if (prefillPrompt) {
        textarea.value = prefillPrompt;
        // "ve" butonundan geldiğinde, prompt'un satır sayısına göre textarea yüksekliğini ayarla
        const lineCount = prefillPrompt.split('\n').length;
        // Her satır için yaklaşık 22px + padding (12px üst + 12px alt = 24px) + border (2px)
        // Birkaç satır daha fazla yükseklik için +3 satır ekliyoruz
        const minHeight = 120; // Minimum yükseklik
        const maxHeight = 500; // Maksimum yükseklik
        const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, (lineCount + 3) * 22 + 26));
        textarea.style.height = `${calculatedHeight}px`;
        textarea.style.minHeight = `${minHeight}px`; // Minimum yükseklik korunmalı
        textarea.style.maxHeight = `${maxHeight}px`; // Maksimum yükseklik korunmalı
    } else if (lastCustomPrompt) {
        textarea.value = lastCustomPrompt;
    }

    setTimeout(() => {
        textarea.focus();
        // Move cursor to end of text
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }, 100);

    // Close modal function
    const closeModal = () => {
        overlay.remove();
        document.removeEventListener('keydown', handleEscape, true);
    };

    // Cancel button
    cancelBtn.onclick = closeModal;

    // Close on overlay click (but not on modal click)
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };

    // Close on Escape key (yalnızca bu modal açıkken)
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        }
    };
    document.addEventListener('keydown', handleEscape, true);

    // Submit button
    submitBtn.onclick = () => {
        const userPrompt = textarea.value.trim();
        if (userPrompt) {
            // Eğer "ve" butonundan geldiyse, ana buton referansını da geçir
            if (mainButton) {
                // Ana butonun data attribute'una "ve" prompt'unu kaydet
                mainButton.setAttribute('data-ve-prompt', userPrompt);
                // "ve" butonundan gelen prompt'ları lastCustomPrompt'a kaydetme
                runGemini(userPrompt, true, customButton, mainButton); // mainButton = ok işareti için
            } else {
                // Sadece "Özel Prompt" butonundan gelen prompt'ları kaydet
                lastCustomPrompt = userPrompt; // Store the custom prompt for caching
                runGemini(userPrompt, true, customButton); // true = show custom prompt header, customButton = mark as selected
            }
            closeModal();
        } else {
            textarea.style.borderColor = '#d9534f';
            textarea.focus();
        }
    };

    // Submit on Ctrl+Enter or Cmd+Enter
    textarea.onkeydown = (e) => {
        // Reset border color on typing
        if (textarea.style.borderColor === 'rgb(217, 83, 79)') {
            textarea.style.borderColor = ''; // Let CSS handle it
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            submitBtn.click();
        }
    };
};

// =============================================================================
// MARKDOWN İŞLEME
// =============================================================================

/**
 * Bir string'in geçerli JSON olup olmadığını kontrol eder.
 * 
 * @param {string} str - Kontrol edilecek string
 * @returns {boolean} Geçerli JSON ise true
 */
const isValidJson = (str) => {
    try {
        const parsed = JSON.parse(str);
        // Must be object or array to be considered "real" JSON
        return typeof parsed === 'object' && parsed !== null;
    } catch {
        return false;
    }
};

/**
 * JSON string'i syntax highlighting ile formatlar.
 * 
 * JSON anahtarlarını, string değerlerini, sayıları ve boolean'ları
 * farklı renklerde gösterir.
 * 
 * @param {string} jsonStr - Formatlanacak JSON string'i
 * @returns {string} HTML formatında syntax highlighted JSON
 */
const formatJsonWithHighlight = (jsonStr) => {
    try {
        const parsed = JSON.parse(jsonStr);
        const formatted = JSON.stringify(parsed, null, 2);

        // Apply syntax highlighting
        let highlighted = escapeHtml(formatted);

        // Highlight keys (property names)
        highlighted = highlighted.replace(/"((?:[^"\\]|\\.)+)":/g, '<span class="eksi-ai-json-key">"$1"</span>:');

        // Highlight string values (after colon)
        highlighted = highlighted.replace(/: "((?:[^"\\]|\\.)*)"/g, ': <span class="eksi-ai-json-string">"$1"</span>');

        // Highlight numbers
        highlighted = highlighted.replace(/: (-?\d+\.?\d*)/g, ': <span class="eksi-ai-json-number">$1</span>');

        // Highlight booleans and null
        highlighted = highlighted.replace(/: (true|false|null)/g, ': <span class="eksi-ai-json-boolean">$1</span>');

        return highlighted;
    } catch {
        return escapeHtml(jsonStr);
    }
};

/**
 * Markdown metni HTML'e dönüştürür.
 * 
 * Desteklenen formatlar:
 * - Başlıklar (# - ######)
 * - Kalın (**), italik (*), üstü çizili (~~)
 * - Kod blokları (``` ve `)
 * - Listeler (sıralı ve sırasız)
 * - Tablolar
 * - Alıntılar (>)
 * - Linkler [text](url)
 * - Otomatik URL tespiti
 * - JSON syntax highlighting
 * 
 * @param {string} text - Dönüştürülecek Markdown metni
 * @returns {string} HTML çıktısı
 */
const parseMarkdown = (text) => {
    if (!text) return '';

    try {
        // Check if the entire response is JSON (no markdown, just raw JSON)
        const trimmedText = text.trim();
        if ((trimmedText.startsWith('{') || trimmedText.startsWith('[')) && isValidJson(trimmedText)) {
            const formattedJson = formatJsonWithHighlight(trimmedText);
            return `<pre class="eksi-ai-code-block eksi-ai-json-block"><code class="language-json">${formattedJson}</code></pre>`;
        }

        // First, escape HTML
        let html = escapeHtml(text);

        // Store code blocks temporarily to prevent processing inside them
        const codeBlocks = [];
        const inlineCodes = [];

        // Handle fenced code blocks (```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const index = codeBlocks.length;
            const trimmedCode = code.trim();

            // Check if this is a JSON code block and format it nicely
            if ((lang === 'json' || lang === '') && isValidJson(trimmedCode)) {
                const formattedJson = formatJsonWithHighlight(trimmedCode);
                codeBlocks.push(`<pre class="eksi-ai-code-block eksi-ai-json-block"><code class="language-json">${formattedJson}</code></pre>`);
            } else {
                codeBlocks.push(`<pre class="eksi-ai-code-block"><code class="language-${lang || 'text'}">${trimmedCode}</code></pre>`);
            }
            return `%%CODEBLOCK${index}%%`;
        });

        // Handle inline code (`)
        // Also parse markdown links inside inline code
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            const index = inlineCodes.length;
            // Parse markdown links inside inline code
            let processedCode = code.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
            inlineCodes.push(`<code class="eksi-ai-inline-code">${processedCode}</code>`);
            return `%%INLINECODE${index}%%`;
        });

        // Handle headers (must be at start of line)
        html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

        // Handle blockquotes (can be multiline)
        html = html.replace(/^&gt;\s*(.*)$/gm, '<blockquote>$1</blockquote>');
        // Merge consecutive blockquotes
        html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

        // Handle horizontal rules
        html = html.replace(/^(?:---|\*\*\*|___)$/gm, '<hr>');

        // Handle bold and italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');

        // Handle strikethrough
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Handle links [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Auto-link plain URLs (not already inside an anchor tag)
        // Match URLs that are not preceded by href=" or >
        html = html.replace(/(?<!href="|>)(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

        // Handle unordered lists
        const processUnorderedList = (text) => {
            const lines = text.split('\n');
            let result = [];
            let listStack = []; // Stores indentation levels

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const listMatch = line.match(/^(\s*)[\-\*]\s+(.+)$/);

                if (listMatch) {
                    const indent = listMatch[1].length;
                    const content = listMatch[2];

                    if (listStack.length === 0) {
                        result.push('<ul>');
                        listStack.push(indent);
                    } else {
                        const currentIndent = listStack[listStack.length - 1];

                        if (indent > currentIndent) {
                            result.push('<ul>');
                            listStack.push(indent);
                        } else if (indent < currentIndent) {
                            while (listStack.length > 0 && indent < listStack[listStack.length - 1]) {
                                result.push('</ul>');
                                listStack.pop();
                            }

                            // If indent level is still not matching (e.g. weird indentation), start new or append
                            if (listStack.length === 0) {
                                result.push('<ul>');
                                listStack.push(indent);
                            }
                        }
                    }
                    result.push(`<li>${content}</li>`);
                } else {
                    while (listStack.length > 0) {
                        result.push('</ul>');
                        listStack.pop();
                    }
                    result.push(line);
                }
            }

            while (listStack.length > 0) {
                result.push('</ul>');
                listStack.pop();
            }

            return result.join('\n');
        };

        // Handle ordered lists
        const processOrderedList = (text) => {
            const lines = text.split('\n');
            let result = [];
            let listStack = []; // Stores indentation levels

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const listMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

                if (listMatch) {
                    const indent = listMatch[1].length;
                    const content = listMatch[2];

                    if (listStack.length === 0) {
                        result.push('<ol>');
                        listStack.push(indent);
                    } else {
                        const currentIndent = listStack[listStack.length - 1];

                        if (indent > currentIndent) {
                            result.push('<ol>');
                            listStack.push(indent);
                        } else if (indent < currentIndent) {
                            while (listStack.length > 0 && indent < listStack[listStack.length - 1]) {
                                result.push('</ol>');
                                listStack.pop();
                            }

                            if (listStack.length === 0) {
                                result.push('<ol>');
                                listStack.push(indent);
                            }
                        }
                    }
                    result.push(`<li>${content}</li>`);
                } else {
                    while (listStack.length > 0) {
                        result.push('</ol>');
                        listStack.pop();
                    }
                    result.push(line);
                }
            }

            while (listStack.length > 0) {
                result.push('</ol>');
                listStack.pop();
            }

            return result.join('\n');
        };

        // Handle tables
        const processTables = (text) => {
            const lines = text.split('\n');
            let result = [];
            let inTable = false;
            let tableRows = [];

            const isTableSeparator = (line) => {
                // Check if line contains only |- : and spaces, and at least one | or -
                // Also allow spaces at start/end
                const trimmed = line.trim();
                if (!trimmed) return false;
                // Must contain | or -
                // Must generally look like |---|---| or ---|---
                return /^\|?[\s\-:|]+\|?$/.test(trimmed) && trimmed.includes('-');
            };

            const splitTableLine = (line) => {
                let content = line.trim();
                if (content.startsWith('|')) content = content.substring(1);
                if (content.endsWith('|')) content = content.substring(0, content.length - 1);

                // Handle escaped pipes if any (though usually code blocks catch them)
                // We'll just split by | for now as code blocks are already extracted
                return content.split('|');
            };

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                if (inTable) {
                    if (trimmed.includes('|')) {
                        tableRows.push(trimmed);
                    } else {
                        // End of table
                        result.push(renderTable(tableRows));
                        inTable = false;
                        tableRows = [];
                        result.push(line);
                    }
                } else {
                    // Check for start of table
                    // A table starts with a header row, followed by a separator row
                    if (trimmed.includes('|') && i + 1 < lines.length) {
                        const nextLine = lines[i + 1];
                        if (isTableSeparator(nextLine)) {
                            inTable = true;
                            tableRows.push(trimmed);
                            // The next iteration will catch the separator as part of tableRows
                            continue;
                        }
                    }
                    result.push(line);
                }
            }

            if (inTable) {
                result.push(renderTable(tableRows));
            }

            return result.join('\n');
        };

        const renderTable = (rows) => {
            if (rows.length < 2) return rows.join('\n');

            const header = rows[0];
            // rows[1] is separator, we skip it for rendering content but could use it for alignment
            const body = rows.slice(2);

            let html = '<div class="eksi-ai-table-wrapper"><table class="eksi-ai-markdown-table"><thead><tr>';

            // Process header
            const splitTableLine = (line) => {
                let content = line.trim();
                if (content.startsWith('|')) content = content.substring(1);
                if (content.endsWith('|')) content = content.substring(0, content.length - 1);
                return content.split('|');
            };

            const headerCells = splitTableLine(header);
            headerCells.forEach(cell => {
                html += `<th>${cell.trim()}</th>`;
            });
            html += '</tr></thead><tbody>';

            // Process body
            body.forEach(row => {
                html += '<tr>';
                const cells = splitTableLine(row);
                cells.forEach(cell => {
                    html += `<td>${cell.trim()}</td>`;
                });
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            return html;
        };

        html = processTables(html);
        html = processUnorderedList(html);
        html = processOrderedList(html);

        // Handle paragraphs (double newlines)
        html = html.replace(/\n\n+/g, '</p><p>');

        // Handle single line breaks in non-list context
        html = html.replace(/(?<!<\/li>|<\/ul>|<\/ol>|<\/blockquote>|<\/h[1-6]>|<hr>|<\/p>|<p>|<\/div>|<\/table>|<\/thead>|<\/tbody>|<\/tr>|<\/td>|<\/th>)\n(?!<li>|<ul>|<ol>|<blockquote>|<h[1-6]>|<hr>|<\/p>|<p>|<div class="eksi-ai-table-wrapper">|<table>|<thead>|<tbody>|<tr>|<td>|<th>)/g, '<br>\n');

        // Wrap in paragraph if not already wrapped
        if (!html.startsWith('<')) {
            html = '<p>' + html + '</p>';
        } else if (!html.startsWith('<p>') && !html.startsWith('<h') && !html.startsWith('<ul>') && !html.startsWith('<ol>') && !html.startsWith('<blockquote>') && !html.startsWith('<hr>') && !html.startsWith('<div class="eksi-ai-table-wrapper">') && !html.startsWith('%%CODEBLOCK')) {
            html = '<p>' + html + '</p>';
        }

        // Restore code blocks
        codeBlocks.forEach((block, index) => {
            html = html.replace(`%%CODEBLOCK${index}%%`, block);
        });

        // Restore inline codes
        inlineCodes.forEach((code, index) => {
            html = html.replace(`%%INLINECODE${index}%%`, code);
        });

        // Clean up empty paragraphs
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<p>(<h[1-6]>)/g, '$1');
        html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ol>)/g, '$1');
        html = html.replace(/(<\/ol>)<\/p>/g, '$1');
        html = html.replace(/<p>(<blockquote>)/g, '$1');
        html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
        html = html.replace(/<p>(<hr>)/g, '$1');
        html = html.replace(/(<hr>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');
        html = html.replace(/<p>(<div class="eksi-ai-table-wrapper">)/g, '$1');
        html = html.replace(/(<\/div>)<\/p>/g, '$1');

        return html;
    } catch (err) {
        // Markdown parse hatası durumunda düz metin olarak göster
        return `<pre>${escapeHtml(text)}</pre>`;
    }
};

// =============================================================================
// SONUÇ AKSİYON BUTONLARI
// =============================================================================

/**
 * Sonuç alanına kopyala, indir ve tekrar sor butonları ekler.
 * 
 * Analiz sonucu gösterildikten sonra kullanıcının sonucu
 * kopyalaması, Markdown dosyası olarak indirmesi veya
 * aynı promptu tekrar sorması için butonlar ekler.
 * 
 * @param {HTMLElement} resultArea - Butonların ekleneceği sonuç alanı
 * @param {string} markdownContent - Kopyalanacak/indirilecek ham Markdown içeriği
 * @param {string} userPrompt - Tekrar sormak için kullanılacak prompt
 * @param {boolean} showPromptHeader - Özel prompt başlığı gösterilsin mi
 * @param {HTMLElement|null} clickedButton - Seçili buton referansı
 */
const addResultActionButtons = (resultArea, markdownContent, userPrompt, showPromptHeader, clickedButton) => {
    // Create action buttons container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'eksi-ai-result-actions';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'eksi-ai-result-action-btn';
    copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Kopyala</span>
    `;
    copyBtn.onclick = () => copyToClipboard(markdownContent, copyBtn);

    // Download MD button with custom icon
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'eksi-ai-result-action-btn';
    downloadBtn.innerHTML = `
        <svg width="20" height="16" viewBox="0 0 28 22" fill="none" class="eksi-ai-md-icon">
            <rect x="0.5" y="0.5" width="27" height="21" rx="2.5" stroke="currentColor" fill="none"/>
            <path d="M4 16V6h2.5l2.5 4 2.5-4H14v10h-2.5v-5.5L9 14.5l-2.5-4V16H4z" fill="currentColor"/>
            <path d="M16 16V6h4.5a3.5 3.5 0 0 1 0 7H18.5V16H16zm2.5-5.5h1.5a1 1 0 1 0 0-2h-1.5v2z" fill="currentColor"/>
            <path d="M21 13l3 3m0-3l-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>Markdown İndir</span>
    `;
    downloadBtn.onclick = () => downloadMarkdown(markdownContent);

    // Retry button (Ask Again)
    const retryBtn = document.createElement('button');
    retryBtn.className = 'eksi-ai-result-action-btn';
    retryBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span>Tekrar Sor</span>
    `;
    retryBtn.onclick = () => {
        // Clear the cache for this prompt
        responseCache.delete(userPrompt);
        // Remove cached indicator from the button
        if (clickedButton) {
            clickedButton.classList.remove('eksi-ai-btn-cached');
        }
        // Re-run the prompt
        runGemini(userPrompt, showPromptHeader, clickedButton);
    };

    actionsContainer.appendChild(copyBtn);
    actionsContainer.appendChild(downloadBtn);
    actionsContainer.appendChild(retryBtn);

    // Insert at the top of result area
    resultArea.insertBefore(actionsContainer, resultArea.firstChild);
};

/**
 * Metni panoya kopyalar ve butona görsel geri bildirim verir.
 * 
 * Başarılı kopyalamada buton geçici olarak "Kopyalandı!" gösterir,
 * hata durumunda "Hata!" gösterir.
 * 
 * @param {string} text - Kopyalanacak metin
 * @param {HTMLElement} button - Geri bildirim verilecek buton
 */
const copyToClipboard = async (text, button) => {
    try {
        await navigator.clipboard.writeText(text);
        const originalHTML = button.innerHTML;
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Kopyalandı!</span>
        `;
        button.classList.add('success');
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('success');
        }, 2000);
    } catch (err) {
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span>Hata!</span>
        `;
    }
};

/**
 * İçeriği Markdown dosyası (.md) olarak indirir.
 * 
 * Başlık adını dosya adı olarak kullanır (özel karakterler temizlenerek).
 * 
 * @param {string} content - İndirilecek Markdown içeriği
 */
const downloadMarkdown = (content) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', url);
    const filename = sanitizeFilename(topicTitle) || 'analiz';
    downloadAnchorNode.setAttribute('download', `${filename}.md`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
};

// =============================================================================
// BAŞLATMA
// =============================================================================

// Sayfa yüklendiğinde eklentiyi başlat
init();
