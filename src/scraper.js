/**
 * @fileoverview Ekşi Sözlük AI Analiz - Entry Toplama (Scraping)
 * 
 * Bu dosya Ekşi Sözlük sayfalarından entry toplama işlemlerini yönetir:
 * - Tek sayfa ve çok sayfalı başlıklardan entry toplama
 * - Referans entry'leri (bkz: #id) yükleme
 * - DOM'dan entry verisi çıkarma
 * 
 * Bağımlılıklar:
 * - utils.js (allEntries, topicTitle, topicId, shouldStopScraping)
 */

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
 * Entry toplama işlemini durdurur.
 * 
 * Kullanıcı "Durdur" butonuna tıkladığında çağrılır.
 */
const stopScraping = () => {
    shouldStopScraping = true;
};
