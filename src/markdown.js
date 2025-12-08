/**
 * @fileoverview Ekşi Sözlük AI Analiz - Markdown İşleme
 * 
 * Bu dosya Markdown metnini HTML'e dönüştürür:
 * - Başlıklar, listeler, tablolar
 * - Kod blokları ve inline kod
 * - JSON syntax highlighting
 * - Linkler ve URL'ler
 * 
 * Bağımlılıklar:
 * - constants.js (escapeHtml)
 */

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
