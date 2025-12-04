const MODELS = [
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash (Önerilen)',
        description: 'Hız ve verimlilik için en iyi seçenek. Çoğu görev için ideal.',
        cost: 'Ücretsiz (Rate limit dahilinde)',
        contextWindow: 1048576,
        responseTime: '~20 saniye'
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Güçlü muhakeme yeteneği ve geniş bağlam penceresi. Karmaşık görevler ve derinlemesine analiz için en güçlü model.',
        cost: 'Orta/Yüksek maliyet',
        contextWindow: 1048576,
        responseTime: '~30 saniye'
    },
    {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash-Lite',
        description: 'Maksimum hız, basit görevler için.',
        cost: 'En düşük maliyet',
        contextWindow: 1048576,
        responseTime: '~10 saniye'
    }
];

const AVG_CHAR_PER_ENTRY = 328;
const CHARS_PER_TOKEN = 4; // Approximate
const TOKENS_PER_ENTRY = Math.ceil(AVG_CHAR_PER_ENTRY / CHARS_PER_TOKEN) + 20; // +20 for metadata overhead

const DEFAULT_PROMPTS = [
    {
        name: "Özet",
        prompt: `Bu entry'leri analiz ederek kapsamlı bir özet hazırla.

## Görev:
- Ana konuları ve tartışma başlıklarını belirle
- Farklı görüşler ve fikir ayrılıklarını dengeli bir şekilde sun
- Mizahi, ironik veya dikkat çekici entry'leri vurgula
- Özgün ve derinlemesine görüşleri öne çıkar
- Entry'lerin kronolojik veya tematik akışını göz önünde bulundur

## Format ve Dil:
- Markdown formatında yaz (başlıklar, listeler, vurgular kullan)
- Bilgi verici, tarafsız ve profesyonel bir dil kullan
- Akıcı ve okunabilir bir metin oluştur
- Gereksiz spekülasyon veya çıkarımdan kaçın
- Entry'lerden kısa ve anlamlı alıntılar ekle (tırnak işareti ile)

## Link Formatı:
- Entry'lere referans verirken Markdown link formatı kullan: [link metni](https://eksisozluk.com/entry/{entry_id})
- JSON'daki entry_id değerini kullanarak link oluştur
- Link metni entry'nin anahtar kelimesini veya bağlama uygun bir ifadeyi içersin

## Çıktı:
- Yanıtın sadece özet metni olsun, ek açıklama veya meta bilgi içermesin.`
    },
    {
        name: "Blog",
        prompt: `Bu entry'lere dayalı, kapsamlı ve okunabilir bir blog yazısı yaz.

## Görev
Entry'lerdeki farklı görüşleri, deneyimleri, mizahı ve eleştirileri sentezleyerek, konuyu derinlemesine ele alan bir blog yazısı oluştur.

## Yazı Üslubu ve Stil
- Akıcı, samimi ve erişilebilir bir dil kullan
- Analitik ve düşündürücü ol, ancak akademik bir üsluptan kaçın
- Farklı perspektifleri dengeli bir şekilde sun
- Gerektiğinde örnekler, anekdotlar ve ilginç detaylar ekle
- Spekülasyondan kaçın, yalnızca entry'lerdeki bilgileri kullan

## İçerik Yapısı
1. Giriş: Konuyu kısa bir özetle tanıt ve entry'lerden çıkan ana temaları belirt
2. Gelişme: Farklı bakış açılarını, görüşleri ve deneyimleri kategorize ederek sun
3. Sonuç: Genel gözlemler ve öne çıkan noktaları özetle

## Alıntı Formatı
Her alıntı şu formatta olsun:
> [Entry içeriği]
> 
> — **{yazar}** · [{tarih}](https://eksisozluk.com/entry/{entry_id})

Notlar:
- Yukarıdaki satırı aynen bu Markdown yapısıyla üret (tarih tıklanabilir link olsun).

## Çıktı Formatı
- Yanıt YALNIZCA blog yazısı olsun (Markdown formatında)
- Başlık, alt başlıklar ve paragrafları uygun şekilde formatla
- Entry'lerden bol bol alıntı yap, farklı görüşleri yansıt
- Her alıntıda yazar, tarih ve link bilgilerini mutlaka ekle`
    }
];

let prompts = [];

// Helper to update prompts array from DOM
const updatePromptsFromDOM = () => {
    const promptItems = document.querySelectorAll('.prompt-item');
    const newPrompts = [];
    promptItems.forEach(item => {
        const name = item.querySelector('.prompt-name').value;
        const prompt = item.querySelector('.prompt-text').value;
        if (name && prompt) {
            newPrompts.push({ name, prompt });
        }
    });
    prompts = newPrompts;
};

// Saves options to chrome.storage
const saveOptions = () => {
    const apiKey = document.getElementById('apiKey').value;
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect.value;
    const status = document.getElementById('status');

    updatePromptsFromDOM();

    const settings = {
        geminiApiKey: apiKey,
        selectedModel: selectedModel,
        prompts: prompts
    };

    chrome.storage.sync.set(
        settings,
        () => {
            // Update status to let user know options were saved.
            status.textContent = 'Ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);

            // Re-render to ensure state consistency (optional but good)
            renderPrompts();
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.sync.get(
        {
            geminiApiKey: '',
            selectedModel: 'gemini-2.5-flash',
            prompts: DEFAULT_PROMPTS
        },
        (items) => {
            document.getElementById('apiKey').value = items.geminiApiKey;
            prompts = items.prompts;

            populateModelSelect(items.selectedModel);
            renderPrompts();
            
            // Load token info if API key exists
            if (items.geminiApiKey) {
                loadTokenInfo(items.geminiApiKey);
            }
        }
    );
};

const populateModelSelect = (savedModelId) => {
    const select = document.getElementById('modelSelect');
    const infoDiv = document.getElementById('modelInfo');

    select.innerHTML = '';

    MODELS.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        if (model.id === savedModelId) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // Function to update info display
    const updateInfo = () => {
        const selectedId = select.value;
        const model = MODELS.find(m => m.id === selectedId);
        if (model) {
            const capacity = Math.floor(model.contextWindow / TOKENS_PER_ENTRY);
            // Round to nearest thousand for simpler display
            const roundedCapacity = Math.round(capacity / 1000) * 1000;
            const formattedCapacity = new Intl.NumberFormat('tr-TR').format(roundedCapacity);

            infoDiv.innerHTML = `
                <strong>${model.name}</strong><br>
                ${model.description}<br>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc;">
                    <small><strong>Maliyet:</strong> ${model.cost}</small><br>
                    <small><strong>Yanıt Süresi:</strong> ${model.responseTime}</small><br>
                    <small><strong>Bağlam Penceresi:</strong> ${new Intl.NumberFormat('tr-TR').format(model.contextWindow)} token</small><br>
                    <small><strong>Tahmini Kapasite:</strong> ~${formattedCapacity} entry</small>
                </div>
            `;
        }
    };

    // Initial update
    updateInfo();

    // Listener for changes
    select.addEventListener('change', updateInfo);
};

const renderPrompts = () => {
    const list = document.getElementById('promptsList');
    list.innerHTML = '';

    prompts.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'prompt-item';

        div.innerHTML = `
            <label>Buton Adı</label>
            <input type="text" class="prompt-name" value="${item.name}" placeholder="Buton Adı">
            
            <label>Prompt</label>
            <textarea class="prompt-text" rows="4" placeholder="Prompt içeriği...">${item.prompt}</textarea>
            
            <div style="margin-top: 10px;">
                <button class="save-item-btn" style="margin-right: 5px;">Kaydet</button>
                <button class="delete-btn">Sil</button>
            </div>
        `;

        div.querySelector('.save-item-btn').onclick = saveOptions;
        div.querySelector('.delete-btn').onclick = () => removePrompt(index);
        list.appendChild(div);
    });
};

const addPrompt = () => {
    updatePromptsFromDOM(); // Capture current state before adding
    prompts.push({ name: "Yeni Buton", prompt: "" });
    renderPrompts();
};

const removePrompt = (index) => {
    if (confirm('Bu butonu silmek istediğinize emin misiniz?')) {
        updatePromptsFromDOM(); // Capture current state before deleting
        prompts.splice(index, 1);

        // Save immediately
        const apiKey = document.getElementById('apiKey').value;
        const settings = {
            geminiApiKey: apiKey,
            prompts: prompts
        };

        chrome.storage.sync.set(settings, () => {
            renderPrompts();

            // Show status
            const status = document.getElementById('status');
            status.textContent = 'Buton silindi ve ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);
        });
    }
};

const resetPrompts = () => {
    if (confirm('Tüm butonları varsayılan değerlere sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
        prompts = JSON.parse(JSON.stringify(DEFAULT_PROMPTS)); // Deep copy

        // Save immediately
        const apiKey = document.getElementById('apiKey').value;
        const settings = {
            geminiApiKey: apiKey,
            prompts: prompts
        };

        chrome.storage.sync.set(settings, () => {
            renderPrompts();

            // Show status
            const status = document.getElementById('status');
            status.textContent = 'Butonlar varsayılan değerlere sıfırlandı ve ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);
        });
    }
};

// Token info cache duration: 1 hour (3600000 ms)
const TOKEN_INFO_CACHE_DURATION = 60 * 60 * 1000;

// Known Google Gemini API limits (free tier)
const GEMINI_LIMITS = {
    dailyTokens: 300000, // 300k tokens per day
    requestsPerMinute: 60
};

// Get today's usage statistics
const getTodayUsage = () => {
    return new Promise((resolve) => {
        const today = new Date().toISOString().split('T')[0];
        const usageKey = `geminiUsage_${today}`;
        
        chrome.storage.local.get([usageKey], (result) => {
            const usage = result[usageKey] || {
                promptTokens: 0,
                candidatesTokens: 0,
                totalTokens: 0,
                requestCount: 0
            };
            resolve(usage);
        });
    });
};

// Get token info from Google Gemini API
const getTokenInfo = async (apiKey) => {
    // Check cache first
    const cacheKey = 'tokenInfoCache';
    const cached = await new Promise((resolve) => {
        chrome.storage.local.get([cacheKey], (result) => {
            resolve(result[cacheKey]);
        });
    });

    // Always get fresh usage stats (they're updated in real-time)
    const todayUsage = await getTodayUsage();
    
    if (cached) {
        const now = Date.now();
        const cacheAge = now - cached.timestamp;
        
        // If cache is still valid (less than 1 hour old), return cached data with fresh usage
        if (cacheAge < TOKEN_INFO_CACHE_DURATION) {
            return {
                ...cached.data,
                todayUsage: todayUsage
            };
        }
    }

    // Fetch fresh token info from API
    try {
        // Try to get quota info from Google AI Studio API
        // First, try to get models list to verify API key is valid
        const modelsUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
        const modelsResponse = await fetch(modelsUrl);
        
        if (!modelsResponse.ok) {
            const errorData = await modelsResponse.json();
            throw new Error(errorData.error?.message || 'API Key geçersiz');
        }

        // API key is valid (usage is already fetched above)
        const tokenInfo = {
            apiKeyValid: true,
            timestamp: Date.now(),
            todayUsage: todayUsage,
            limits: GEMINI_LIMITS
        };

        // Cache the result
        chrome.storage.local.set({
            [cacheKey]: {
                data: tokenInfo,
                timestamp: Date.now()
            }
        });

        return tokenInfo;
    } catch (error) {
        console.error('Error fetching token info:', error);
        throw error;
    }
};

// Load and display token info
const loadTokenInfo = async (apiKey) => {
    const tokenInfoDiv = document.getElementById('tokenInfo');
    const tokenInfoContent = document.getElementById('tokenInfoContent');
    const refreshBtn = document.getElementById('tokenRefreshBtn');
    
    if (!apiKey) {
        tokenInfoDiv.style.display = 'none';
        if (refreshBtn) refreshBtn.style.display = 'none';
        return;
    }

    tokenInfoDiv.style.display = 'block';
    if (refreshBtn) refreshBtn.style.display = 'inline-block';
    tokenInfoContent.innerHTML = '<span class="token-loading">Yükleniyor...</span>';

    try {
        const tokenInfo = await getTokenInfo(apiKey);
        
        let infoHtml = '';
        
        if (tokenInfo.apiKeyValid) {
            // Show cached timestamp if available
            const cacheAge = Date.now() - tokenInfo.timestamp;
            const cacheAgeMinutes = Math.floor(cacheAge / 60000);
            const cacheAgeText = cacheAgeMinutes < 60 
                ? `${cacheAgeMinutes} dakika önce güncellendi`
                : `${Math.floor(cacheAgeMinutes / 60)} saat önce güncellendi`;
            
            // Calculate usage statistics
            const usage = tokenInfo.todayUsage || { totalTokens: 0, requestCount: 0 };
            const limits = tokenInfo.limits || GEMINI_LIMITS;
            const remainingTokens = Math.max(0, limits.dailyTokens - usage.totalTokens);
            const usagePercent = limits.dailyTokens > 0 
                ? ((usage.totalTokens / limits.dailyTokens) * 100).toFixed(1)
                : 0;
            
            // Format numbers with Turkish locale
            const formatNumber = (num) => new Intl.NumberFormat('tr-TR').format(num);
            
            // Determine color based on usage
            let usageColor = '#81c14b'; // green
            if (usagePercent > 80) usageColor = '#d9534f'; // red
            else if (usagePercent > 60) usageColor = '#f0ad4e'; // orange
            
            infoHtml = `
                <small>✓ API Key geçerli</small><br>
                <small style="color: #666;">${cacheAgeText}</small><br>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc;">
                    <strong style="font-size: 0.95em;">Bugünkü Kullanım:</strong><br>
                    <small>
                        <strong>Token:</strong> ${formatNumber(usage.totalTokens)} / ${formatNumber(limits.dailyTokens)} 
                        <span style="color: ${usageColor};">(${usagePercent}%)</span><br>
                        <strong>Kalan:</strong> <span style="color: ${usageColor};">${formatNumber(remainingTokens)} token</span><br>
                        <strong>İstek Sayısı:</strong> ${formatNumber(usage.requestCount)}<br>
                    </small>
                    <div style="margin-top: 8px; background: #ddd; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: ${usageColor}; height: 100%; width: ${Math.min(usagePercent, 100)}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                <small style="color: #666; margin-top: 5px; display: block;">
                    Detaylı bilgi için 
                    <a href="https://aistudio.google.com/app/api-keys" target="_blank" style="color: #81c14b;">Google AI Studio</a>'yu kontrol edin.
                </small>
            `;
        } else {
            infoHtml = '<small style="color: #d9534f;">Token bilgisi alınamadı.</small>';
        }
        
        tokenInfoContent.innerHTML = infoHtml;
    } catch (error) {
        // Check if it's a quota/rate limit error
        if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429')) {
            tokenInfoContent.innerHTML = `
                <small style="color: #d9534f;">
                    <strong>Uyarı:</strong> Token limitine ulaşılmış olabilir.<br>
                    <a href="https://aistudio.google.com/app/api-keys" target="_blank" style="color: #81c14b;">Google AI Studio</a>'dan kalan token bilginizi kontrol edin.
                </small>
            `;
        } else if (error.message.includes('API key') || error.message.includes('invalid') || error.message.includes('403')) {
            tokenInfoContent.innerHTML = '<small style="color: #d9534f;">API Key geçersiz veya yetkisiz.</small>';
        } else {
            tokenInfoContent.innerHTML = `<small style="color: #d9534f;">Hata: ${error.message}</small>`;
        }
    }
};

// Refresh token info manually
const refreshTokenInfo = async () => {
    const apiKey = document.getElementById('apiKey').value;
    if (apiKey) {
        const tokenInfoContent = document.getElementById('tokenInfoContent');
        tokenInfoContent.innerHTML = '<span class="token-loading">Yenileniyor...</span>';
        
        // Clear cache to force refresh
        chrome.storage.local.remove(['tokenInfoCache'], () => {
            loadTokenInfo(apiKey);
        });
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    
    // Setup refresh button
    const refreshBtn = document.getElementById('tokenRefreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = refreshTokenInfo;
        refreshBtn.onmouseover = function() { this.style.backgroundColor = '#555'; };
        refreshBtn.onmouseout = function() { this.style.backgroundColor = '#666'; };
    }
});

document.getElementById('saveBtn').addEventListener('click', () => {
    saveOptions();
    // Refresh token info after saving
    const apiKey = document.getElementById('apiKey').value;
    if (apiKey) {
        loadTokenInfo(apiKey);
    }
});
document.getElementById('addBtn').addEventListener('click', addPrompt);
document.getElementById('resetBtn').addEventListener('click', resetPrompts);
document.getElementById('apiKey').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        saveOptions();
    }
});
