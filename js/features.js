/* ============================================================
   features.js — Enhanced Features Module
   Search, Export, Fullscreen, Shortcuts, Bookmarks, Minimap, etc.
   ============================================================ */

const Features = (() => {
    'use strict';

    // ==================== GRAPH SEARCH ====================
    function initSearch() {
        const searchInput = document.getElementById('graph-search-input');
        const searchResults = document.getElementById('search-results');
        if (!searchInput) return;

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            if (query.length < 1) {
                searchResults.classList.add('hidden');
                RepoGraph.clearHighlight();
                return;
            }

            const repos = window.__allRepos || [];
            const matches = repos.filter(r =>
                r.name.toLowerCase().includes(query) ||
                r.fullName.toLowerCase().includes(query) ||
                (r.description && r.description.toLowerCase().includes(query)) ||
                r.topics.some(t => t.toLowerCase().includes(query))
            ).slice(0, 8);

            if (matches.length === 0) {
                searchResults.innerHTML = '<div class="search-no-results">No repos found</div>';
                searchResults.classList.remove('hidden');
                return;
            }

            searchResults.innerHTML = matches.map(r => `
                <div class="search-result-item" data-repo-name="${r.name}">
                    <span class="search-dot" style="background:${RepoGraph.getLanguageColor(r.language)}"></span>
                    <span class="search-name">${r.name}</span>
                    <span class="search-lang">${r.language}</span>
                </div>
            `).join('');

            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const name = item.dataset.repoName;
                    RepoGraph.zoomToNode(name);
                    searchInput.value = '';
                    searchResults.classList.add('hidden');
                });
            });

            searchResults.classList.remove('hidden');
        });

        // Close on blur
        searchInput.addEventListener('blur', () => {
            setTimeout(() => searchResults.classList.add('hidden'), 200);
        });

        // Escape to clear
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchResults.classList.add('hidden');
                RepoGraph.clearHighlight();
                searchInput.blur();
            }
            if (e.key === 'Enter') {
                const first = searchResults.querySelector('.search-result-item');
                if (first) first.click();
            }
        });
    }

    // ==================== EXPORT PNG ====================
    function exportPNG() {
        const svgEl = document.getElementById('graph-svg');
        if (!svgEl || !svgEl.querySelector('g')) {
            showFeatureToast('No graph to export.', 'error');
            return;
        }

        const svgClone = svgEl.cloneNode(true);
        const rect = svgEl.getBoundingClientRect();

        // Add background
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', rect.width);
        bg.setAttribute('height', rect.height);
        bg.setAttribute('fill', getComputedStyle(document.querySelector('.graph-area')).backgroundColor);
        svgClone.insertBefore(bg, svgClone.firstChild);

        // Inline computed styles
        svgClone.setAttribute('width', rect.width);
        svgClone.setAttribute('height', rect.height);
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Convert to canvas
        const data = new XMLSerializer().serializeToString(svgClone);
        const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = rect.width * 2; // 2x for retina
            canvas.height = rect.height * 2;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
            URL.revokeObjectURL(url);

            canvas.toBlob((pngBlob) => {
                const link = document.createElement('a');
                link.download = `repograph-${Date.now()}.png`;
                link.href = URL.createObjectURL(pngBlob);
                link.click();
                URL.revokeObjectURL(link.href);
                showFeatureToast('Graph exported as PNG!', 'success');
            });
        };
        img.onerror = () => {
            // Fallback: download SVG
            const link = document.createElement('a');
            link.download = `repograph-${Date.now()}.svg`;
            link.href = url;
            link.click();
            showFeatureToast('Graph exported as SVG!', 'success');
        };
        img.src = url;
    }

    // ==================== FULLSCREEN ====================
    function toggleFullscreen() {
        const graphArea = document.getElementById('graph-area');
        if (!document.fullscreenElement) {
            graphArea.requestFullscreen().catch(() => {
                // Fallback: toggle class
                graphArea.classList.toggle('pseudo-fullscreen');
            });
        } else {
            document.exitFullscreen();
        }
    }

    function initFullscreen() {
        document.addEventListener('fullscreenchange', () => {
            const btn = document.getElementById('fullscreen-btn');
            if (btn) {
                btn.title = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
            }
        });
    }

    // ==================== KEYBOARD SHORTCUTS ====================
    const SHORTCUTS = [
        { key: '/', desc: 'Focus search', category: 'Navigation' },
        { key: 'F', desc: 'Toggle fullscreen', category: 'Navigation' },
        { key: 'D', desc: 'Toggle dark mode', category: 'UI' },
        { key: 'E', desc: 'Export graph as PNG', category: 'Data' },
        { key: 'J', desc: 'Export data as JSON', category: 'Data' },
        { key: 'B', desc: 'Bookmark current view', category: 'Data' },
        { key: 'Escape', desc: 'Close modals / clear search', category: 'Navigation' },
        { key: '?', desc: 'Show keyboard shortcuts', category: 'Help' },
    ];

    function initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't fire when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                if (e.key === 'Escape') {
                    e.target.blur();
                }
                return;
            }

            switch(e.key) {
                case '/':
                    e.preventDefault();
                    const searchInput = document.getElementById('graph-search-input');
                    if (searchInput) searchInput.focus();
                    break;
                case 'f':
                case 'F':
                    if (!e.ctrlKey && !e.metaKey) toggleFullscreen();
                    break;
                case 'd':
                case 'D':
                    if (!e.ctrlKey && !e.metaKey) document.getElementById('dark-mode-toggle')?.click();
                    break;
                case 'e':
                case 'E':
                    if (!e.ctrlKey && !e.metaKey) exportPNG();
                    break;
                case 'j':
                case 'J':
                    if (!e.ctrlKey && !e.metaKey) exportJSON();
                    break;
                case 'b':
                case 'B':
                    if (!e.ctrlKey && !e.metaKey) bookmarkCurrentView();
                    break;
                case '?':
                    toggleShortcutsModal();
                    break;
                case 'Escape':
                    closeAllModals();
                    break;
            }
        });
    }

    function toggleShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) modal.classList.toggle('hidden');
    }

    function closeAllModals() {
        document.getElementById('shortcuts-modal')?.classList.add('hidden');
        document.getElementById('profile-modal-overlay')?.classList.add('hidden');
        document.getElementById('comparison-panel')?.classList.add('hidden');
    }

    // ==================== BOOKMARKS ====================
    function bookmarkCurrentView() {
        const repos = window.__allRepos || [];
        if (repos.length === 0) {
            showFeatureToast('No repos loaded to bookmark.', 'error');
            return;
        }

        const bookmarks = JSON.parse(localStorage.getItem('repograph-bookmarks') || '[]');
        const name = prompt('Name this bookmark:', `Collection ${bookmarks.length + 1}`);
        if (!name) return;

        bookmarks.push({
            id: Date.now(),
            name: name,
            repos: repos.map(r => r.fullName),
            createdAt: new Date().toISOString(),
        });

        localStorage.setItem('repograph-bookmarks', JSON.stringify(bookmarks));
        showFeatureToast(`Bookmarked "${name}" (${repos.length} repos)`, 'success');
        renderBookmarks();
    }

    function renderBookmarks() {
        const container = document.getElementById('bookmarks-list');
        if (!container) return;

        const bookmarks = JSON.parse(localStorage.getItem('repograph-bookmarks') || '[]');
        container.innerHTML = '';

        if (bookmarks.length === 0) {
            container.innerHTML = '<p class="bookmark-empty">No bookmarks yet. Press <kbd>B</kbd> to save.</p>';
            return;
        }

        bookmarks.forEach(bm => {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            item.innerHTML = `
                <div class="bookmark-info">
                    <span class="bookmark-name">${bm.name}</span>
                    <span class="bookmark-count">${bm.repos.length} repos</span>
                </div>
                <button class="bookmark-delete" data-id="${bm.id}" title="Delete">&times;</button>
            `;
            item.querySelector('.bookmark-info').addEventListener('click', () => {
                showFeatureToast(`Loading "${bm.name}"...`, 'info');
                // Load bookmarked repos
                window.dispatchEvent(new CustomEvent('load-bookmarked-repos', { detail: bm.repos }));
            });
            item.querySelector('.bookmark-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                const updated = bookmarks.filter(b => b.id !== bm.id);
                localStorage.setItem('repograph-bookmarks', JSON.stringify(updated));
                showFeatureToast(`Deleted "${bm.name}"`, 'info');
                renderBookmarks();
            });
            container.appendChild(item);
        });
    }

    // ==================== CSV / JSON EXPORT ====================
    function exportJSON() {
        const repos = window.__allRepos || [];
        if (repos.length === 0) {
            showFeatureToast('No data to export.', 'error');
            return;
        }

        const data = JSON.stringify(repos, null, 2);
        downloadFile(data, `repograph-data-${Date.now()}.json`, 'application/json');
        showFeatureToast(`Exported ${repos.length} repos as JSON`, 'success');
    }

    function exportCSV() {
        const repos = window.__allRepos || [];
        if (repos.length === 0) {
            showFeatureToast('No data to export.', 'error');
            return;
        }

        const headers = ['Name', 'Full Name', 'Language', 'Stars', 'Forks', 'Topics', 'URL', 'Description', 'Created'];
        const rows = repos.map(r => [
            r.name, r.fullName, r.language, r.stars, r.forks,
            r.topics.join(';'), r.url, `"${(r.description || '').replace(/"/g, '""')}"`, r.createdAt
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadFile(csv, `repograph-data-${Date.now()}.csv`, 'text/csv');
        showFeatureToast(`Exported ${repos.length} repos as CSV`, 'success');
    }

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const link = document.createElement('a');
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ==================== SHARE URL ====================
    function generateShareURL() {
        const repos = window.__allRepos || [];
        if (repos.length === 0) {
            showFeatureToast('No data to share.', 'error');
            return;
        }

        const params = new URLSearchParams();
        const username = document.getElementById('username-input')?.value.trim();
        if (username) params.set('user', username);

        // For individual repos, encode them
        const addedRepos = repos.filter(r => !username || !r.fullName.startsWith(username + '/'));
        if (addedRepos.length > 0) {
            params.set('repos', addedRepos.map(r => r.fullName).join(','));
        }

        const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            showFeatureToast('Share URL copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback
            prompt('Copy this share URL:', shareUrl);
        });
    }



    // ==================== COMPARISON PANEL ====================
    let selectedForComparison = [];

    function toggleComparisonSelect(repoName) {
        const idx = selectedForComparison.indexOf(repoName);
        if (idx >= 0) {
            selectedForComparison.splice(idx, 1);
        } else {
            if (selectedForComparison.length >= 4) {
                showFeatureToast('Max 4 repos for comparison.', 'info');
                return;
            }
            selectedForComparison.push(repoName);
        }

        updateComparisonPanel();
    }

    function updateComparisonPanel() {
        const panel = document.getElementById('comparison-panel');
        const content = document.getElementById('comparison-content');
        if (!panel || !content) return;

        if (selectedForComparison.length < 2) {
            panel.classList.add('hidden');
            return;
        }

        const repos = window.__allRepos || [];
        const selected = selectedForComparison.map(name => repos.find(r => r.name === name)).filter(Boolean);

        if (selected.length < 2) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');

        const maxStars = Math.max(...selected.map(r => r.stars));

        content.innerHTML = `
            <div class="compare-grid" style="grid-template-columns: 120px repeat(${selected.length}, 1fr)">
                <div class="compare-label"></div>
                ${selected.map(r => `<div class="compare-header">
                    <span class="compare-repo-dot" style="background:${RepoGraph.getLanguageColor(r.language)}"></span>
                    ${r.name}
                </div>`).join('')}

                <div class="compare-label">Language</div>
                ${selected.map(r => `<div class="compare-cell">${r.language}</div>`).join('')}

                <div class="compare-label">Stars</div>
                ${selected.map(r => `<div class="compare-cell">
                    <div class="compare-bar-wrap">
                        <div class="compare-bar" style="width:${(r.stars/maxStars)*100}%; background:var(--accent)"></div>
                    </div>
                    <span>${r.stars.toLocaleString()}</span>
                </div>`).join('')}

                <div class="compare-label">Forks</div>
                ${selected.map(r => `<div class="compare-cell">${r.forks.toLocaleString()}</div>`).join('')}

                <div class="compare-label">Topics</div>
                ${selected.map(r => `<div class="compare-cell compare-topics">${r.topics.slice(0, 4).map(t => `<span class="tooltip-topic-tag">${t}</span>`).join('')}</div>`).join('')}

                <div class="compare-label">Created</div>
                ${selected.map(r => `<div class="compare-cell">${new Date(r.createdAt).toLocaleDateString()}</div>`).join('')}
            </div>
        `;
    }

    function clearComparison() {
        selectedForComparison = [];
        updateComparisonPanel();
    }

    function getSelectedForComparison() {
        return selectedForComparison;
    }

    // ==================== UTILS ====================
    function showFeatureToast(message, type) {
        // Reuse the app's toast system
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { error: '⚠️', success: '✅', info: 'ℹ️' };
        toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(30px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ==================== INIT ALL ====================
    function init() {
        initSearch();
        initFullscreen();
        initKeyboardShortcuts();
        renderBookmarks();
    }

    return {
        init,
        exportPNG,
        exportJSON,
        exportCSV,
        toggleFullscreen,
        bookmarkCurrentView,
        renderBookmarks,
        generateShareURL,
        toggleComparisonSelect,
        clearComparison,
        getSelectedForComparison,
        toggleShortcutsModal,
        SHORTCUTS,
    };
})();
