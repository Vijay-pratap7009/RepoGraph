/* ============================================================
   app.js — Main Application Entry Point
   Orchestrates UI, API calls, graph rendering, and filters
   ============================================================ */

(function () {
    'use strict';

    // --- DOM Elements ---
    const usernameInput = document.getElementById('username-input');
    const apiKeyInput = document.getElementById('api-key-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const toggleApiKeyBtn = document.getElementById('toggle-api-key-visibility');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingProgress = document.getElementById('loading-progress');
    const emptyState = document.getElementById('empty-state');
    const filtersSection = document.getElementById('filters-section');
    const statsSection = document.getElementById('stats-section');
    const legendSection = document.getElementById('legend-section');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const repoInput = document.getElementById('repo-input');
    const addRepoBtn = document.getElementById('add-repo-btn');
    const addedReposList = document.getElementById('added-repos-list');
    const userProfileBtn = document.getElementById('user-profile-btn');
    const profileModalOverlay = document.getElementById('profile-modal-overlay');
    const profileCloseBtn = document.getElementById('profile-close-btn');

    // --- State ---
    let allRepos = [];
    let currentUserProfile = null;

    // --- Initialize ---
    function init() {
        loadDarkMode();
        attachEventListeners();
        Features.init();
    }

    // --- Event Listeners ---
    function attachEventListeners() {
        fetchBtn.addEventListener('click', handleFetch);
        usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleFetch();
        });

        toggleApiKeyBtn.addEventListener('click', () => {
            const input = apiKeyInput;
            input.type = input.type === 'password' ? 'text' : 'password';
        });

        darkModeToggle.addEventListener('click', toggleDarkMode);

        applyFiltersBtn.addEventListener('click', handleApplyFilters);
        clearFiltersBtn.addEventListener('click', handleClearFilters);

        // Fine-grained repo insertion
        addRepoBtn.addEventListener('click', handleAddRepo);
        repoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAddRepo();
        });

        // User profile panel
        userProfileBtn.addEventListener('click', openProfileModal);
        profileCloseBtn.addEventListener('click', closeProfileModal);
        profileModalOverlay.addEventListener('click', (e) => {
            if (e.target === profileModalOverlay) closeProfileModal();
        });

        // Toolbar buttons
        document.getElementById('export-png-btn').addEventListener('click', Features.exportPNG);
        document.getElementById('fullscreen-btn').addEventListener('click', Features.toggleFullscreen);
        document.getElementById('share-btn').addEventListener('click', Features.generateShareURL);
        document.getElementById('shortcuts-btn').addEventListener('click', Features.toggleShortcutsModal);
        document.getElementById('clear-comparison-btn').addEventListener('click', Features.clearComparison);

        // Export dropdown
        const exportDataBtn = document.getElementById('export-data-btn');
        const exportDropdown = document.getElementById('export-dropdown');
        exportDataBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = exportDataBtn.getBoundingClientRect();
            exportDropdown.style.top = rect.bottom + 4 + 'px';
            exportDropdown.style.right = (window.innerWidth - rect.right) + 'px';
            exportDropdown.classList.toggle('hidden');
        });
        document.getElementById('export-json-btn').addEventListener('click', () => {
            Features.exportJSON();
            exportDropdown.classList.add('hidden');
        });
        document.getElementById('export-csv-btn').addEventListener('click', () => {
            Features.exportCSV();
            exportDropdown.classList.add('hidden');
        });
        document.addEventListener('click', () => exportDropdown.classList.add('hidden'));

        // Right-click comparison on graph nodes
        document.getElementById('graph-svg').addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    // --- Fetch Handler ---
    async function handleFetch() {
        const username = usernameInput.value.trim();
        if (!username) {
            showToast('Please enter a GitHub username.', 'error');
            usernameInput.focus();
            return;
        }

        const token = apiKeyInput.value.trim() || null;

        showLoading(true);
        emptyState.classList.add('hidden');

        try {
            allRepos = await GitHubAPI.fetchAllData(username, token, (msg) => {
                loadingProgress.textContent = msg;
            });
            window.__allRepos = allRepos;

            showToast(`Loaded ${allRepos.length} repositories for ${username}`, 'success');

            // Show sections
            filtersSection.classList.remove('hidden');
            statsSection.classList.remove('hidden');
            legendSection.classList.remove('hidden');

            // Populate filters
            Filters.populateLanguageDropdown(allRepos);

            // Render graph
            renderGraph(allRepos);

            // Fetch user profile and show badge
            try {
                currentUserProfile = await GitHubAPI.fetchUserProfile(username, token);
                showHeaderBadge(currentUserProfile);
            } catch (e) {
                console.warn('Could not fetch user profile:', e);
            }

        } catch (error) {
            showToast(error.message, 'error');
            emptyState.classList.remove('hidden');
            console.error('Fetch error:', error);
        } finally {
            showLoading(false);
        }
    }

    // --- Add Individual Repo Handler ---
    async function handleAddRepo() {
        const rawInput = repoInput.value.trim();
        if (!rawInput) {
            showToast('Enter a repo URL or owner/repo name.', 'error');
            repoInput.focus();
            return;
        }

        const parsed = GitHubAPI.parseRepoInput(rawInput);
        if (!parsed) {
            showToast('Invalid format. Use owner/repo or paste a GitHub URL.', 'error');
            repoInput.focus();
            return;
        }

        // Check for duplicates
        const exists = allRepos.find(r => r.fullName === `${parsed.owner}/${parsed.repo}`);
        if (exists) {
            showToast(`${parsed.owner}/${parsed.repo} is already in the graph.`, 'info');
            repoInput.value = '';
            return;
        }

        const token = apiKeyInput.value.trim() || null;

        // Show mini loading on button
        addRepoBtn.disabled = true;
        addRepoBtn.innerHTML = '<span class="btn-spinner"></span> Adding...';

        try {
            const enrichedRepo = await GitHubAPI.fetchSingleRepo(parsed.owner, parsed.repo, token);

            allRepos.push(enrichedRepo);
            window.__allRepos = allRepos;
            repoInput.value = '';

            showToast(`Added ${enrichedRepo.fullName} to the graph.`, 'success');

            // Add chip to the added repos list
            addRepoChip(enrichedRepo);

            // Show sections if first repo
            filtersSection.classList.remove('hidden');
            statsSection.classList.remove('hidden');
            legendSection.classList.remove('hidden');

            // Re-populate filters & re-render
            Filters.populateLanguageDropdown(allRepos);
            const filters = Filters.getCurrentFilters();
            const filtered = Filters.applyAll(allRepos, filters);
            renderGraph(filtered);

        } catch (error) {
            showToast(error.message, 'error');
            console.error('Add repo error:', error);
        } finally {
            addRepoBtn.disabled = false;
            addRepoBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to Graph';
        }
    }

    // --- Repo Chip (removable) ---
    function addRepoChip(repo) {
        const chip = document.createElement('div');
        chip.className = 'repo-chip';
        chip.dataset.fullName = repo.fullName;

        const langColor = RepoGraph.getLanguageColor(repo.language);

        chip.innerHTML = `
            <span class="repo-chip-dot" style="background:${langColor}"></span>
            <span class="repo-chip-name" title="${repo.fullName}">${repo.fullName}</span>
            <span class="repo-chip-stars">⭐ ${repo.stars}</span>
            <button class="repo-chip-remove" title="Remove from graph" aria-label="Remove ${repo.name}">&times;</button>
        `;

        chip.querySelector('.repo-chip-remove').addEventListener('click', () => {
            allRepos = allRepos.filter(r => r.fullName !== repo.fullName);
            chip.remove();
            showToast(`Removed ${repo.fullName} from the graph.`, 'info');

            if (allRepos.length === 0) {
                RepoGraph.destroy();
                emptyState.classList.remove('hidden');
                filtersSection.classList.add('hidden');
                statsSection.classList.add('hidden');
                legendSection.classList.add('hidden');
            } else {
                Filters.populateLanguageDropdown(allRepos);
                const filters = Filters.getCurrentFilters();
                const filtered = Filters.applyAll(allRepos, filters);
                renderGraph(filtered);
            }
        });

        addedReposList.appendChild(chip);
    }

    // --- Render Graph + Update UI ---
    function renderGraph(repos) {
        if (repos.length === 0) {
            showToast('No repos match the current filters.', 'info');
            RepoGraph.destroy();
            emptyState.classList.remove('hidden');
            updateStats(repos, 0);
            return;
        }

        emptyState.classList.add('hidden');

        const graphData = RepoGraph.render(repos, '#graph-area');

        // Update stats
        updateStats(repos, graphData.edges.length);

        // Update legend
        updateLegend(repos);
    }

    // --- Update Stats ---
    function updateStats(repos, edgeCount) {
        document.getElementById('stat-repos').textContent = repos.length;

        const languages = new Set(repos.map(r => r.language));
        document.getElementById('stat-languages').textContent = languages.size;

        document.getElementById('stat-connections').textContent = edgeCount;

        const totalStars = repos.reduce((acc, r) => acc + r.stars, 0);
        document.getElementById('stat-stars').textContent =
            totalStars > 999 ? (totalStars / 1000).toFixed(1) + 'k' : totalStars;
    }

    // --- Update Legend ---
    function updateLegend(repos) {
        const legendList = document.getElementById('legend-list');
        legendList.innerHTML = '';

        const langMap = RepoGraph.getLanguageMap(repos);
        langMap.forEach((color, language) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<span class="legend-dot" style="background:${color}"></span>${language}`;
            item.addEventListener('click', () => {
                document.getElementById('language-filter').value = language;
                handleApplyFilters();
            });
            legendList.appendChild(item);
        });
    }

    // --- Filter Handlers ---
    function handleApplyFilters() {
        const filters = Filters.getCurrentFilters();
        const filtered = Filters.applyAll(allRepos, filters);
        renderGraph(filtered);
    }

    function handleClearFilters() {
        Filters.clearAll();
        renderGraph(allRepos);
    }

    // --- Dark Mode ---
    function toggleDarkMode() {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('repograph-dark', isDark ? '1' : '0');

        // Re-render graph if data exists (to update CSS-driven colors)
        if (allRepos.length > 0) {
            const filters = Filters.getCurrentFilters();
            const filtered = Filters.applyAll(allRepos, filters);
            renderGraph(filtered);
        }
    }

    function loadDarkMode() {
        const saved = localStorage.getItem('repograph-dark');
        if (saved === '1' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark');
        }
    }

    // --- Loading ---
    function showLoading(show) {
        loadingOverlay.classList.toggle('hidden', !show);
        if (!show) loadingProgress.textContent = '';
    }

    // --- Toast Notifications ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            error: '⚠️',
            success: '✅',
            info: 'ℹ️',
        };

        toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(30px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // --- User Profile ---
    function showHeaderBadge(profile) {
        const btn = userProfileBtn;
        document.getElementById('header-avatar').src = profile.avatarUrl;
        document.getElementById('header-username').textContent = profile.login;
        btn.classList.remove('hidden');
    }

    function openProfileModal() {
        if (!currentUserProfile) return;
        const p = currentUserProfile;

        document.getElementById('profile-avatar').src = p.avatarUrl;
        document.getElementById('profile-displayname').textContent = p.name;
        document.getElementById('profile-username').textContent = '@' + p.login;
        document.getElementById('profile-bio').textContent = p.bio || 'No bio available.';

        // Meta items
        const companyEl = document.getElementById('profile-company');
        if (p.company) {
            companyEl.querySelector('span:last-child').textContent = p.company;
            companyEl.classList.remove('hidden');
        } else companyEl.classList.add('hidden');

        const locationEl = document.getElementById('profile-location');
        if (p.location) {
            locationEl.querySelector('span:last-child').textContent = p.location;
            locationEl.classList.remove('hidden');
        } else locationEl.classList.add('hidden');

        const blogEl = document.getElementById('profile-blog');
        if (p.blog) {
            const a = blogEl.querySelector('a');
            a.href = p.blog.startsWith('http') ? p.blog : 'https://' + p.blog;
            a.textContent = p.blog.replace(/^https?:\/\//, '');
            blogEl.classList.remove('hidden');
        } else blogEl.classList.add('hidden');

        // Stats
        document.getElementById('profile-repos-count').textContent = p.publicRepos;
        document.getElementById('profile-followers').textContent = formatNum(p.followers);
        document.getElementById('profile-following').textContent = formatNum(p.following);

        const totalStars = allRepos.reduce((sum, r) => sum + r.stars, 0);
        document.getElementById('profile-total-stars').textContent = formatNum(totalStars);

        // Top Languages (computed from loaded repos)
        buildLanguageBars();

        // Project Topics (aggregated from repos)
        buildTopicsList();

        // GitHub link
        document.getElementById('profile-github-link').href = p.htmlUrl;

        profileModalOverlay.classList.remove('hidden');
    }

    function closeProfileModal() {
        profileModalOverlay.classList.add('hidden');
    }

    function formatNum(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return n;
    }

    function buildLanguageBars() {
        const container = document.getElementById('profile-languages');
        container.innerHTML = '';

        // Count repos per language
        const langCount = {};
        allRepos.forEach(r => {
            if (r.language && r.language !== 'Unknown') {
                langCount[r.language] = (langCount[r.language] || 0) + 1;
            }
        });

        // Sort by count desc, take top 8
        const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (sorted.length === 0) {
            container.textContent = 'No language data available.';
            return;
        }

        const maxCount = sorted[0][1];

        sorted.forEach(([lang, count]) => {
            const row = document.createElement('div');
            row.className = 'lang-bar-row';

            const pct = Math.round((count / allRepos.length) * 100);
            const color = RepoGraph.getLanguageColor(lang);

            row.innerHTML = `
                <span class="lang-bar-name">${lang}</span>
                <div class="lang-bar-track">
                    <div class="lang-bar-fill" style="width:${(count / maxCount) * 100}%; background:${color}"></div>
                </div>
                <span class="lang-bar-pct">${pct}%</span>
            `;
            container.appendChild(row);
        });
    }

    function buildTopicsList() {
        const container = document.getElementById('profile-topics');
        container.innerHTML = '';

        // Aggregate all topics across repos
        const topicCount = {};
        allRepos.forEach(r => {
            r.topics.forEach(t => {
                topicCount[t] = (topicCount[t] || 0) + 1;
            });
        });

        const sorted = Object.entries(topicCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
        if (sorted.length === 0) {
            container.textContent = 'No topics found.';
            return;
        }

        sorted.forEach(([topic, count]) => {
            const tag = document.createElement('span');
            tag.className = 'profile-topic-tag';
            tag.innerHTML = `${topic} <span class="profile-topic-count">${count}</span>`;
            container.appendChild(tag);
        });
    }

    // --- Go ---
    init();
})();
