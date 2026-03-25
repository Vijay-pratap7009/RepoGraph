/* ============================================================
   filters.js — Filtering & Search Logic
   Filter repos by language, stars range, and date range
   ============================================================ */

const Filters = (() => {
    /**
     * Filter repos by language
     */
    function byLanguage(repos, language) {
        if (!language || language === 'all') return repos;
        return repos.filter(r => r.language === language);
    }

    /**
     * Filter repos by star count range
     */
    function byStars(repos, min, max) {
        return repos.filter(r => {
            if (min !== null && min !== '' && r.stars < Number(min)) return false;
            if (max !== null && max !== '' && r.stars > Number(max)) return false;
            return true;
        });
    }

    /**
     * Filter repos by creation date range
     */
    function byDate(repos, startDate, endDate) {
        return repos.filter(r => {
            const created = new Date(r.createdAt);
            if (startDate && created < new Date(startDate)) return false;
            if (endDate && created > new Date(endDate)) return false;
            return true;
        });
    }

    /**
     * Apply all active filters and return filtered repos
     */
    function applyAll(repos, filters) {
        let result = [...repos];

        if (filters.language) {
            result = byLanguage(result, filters.language);
        }
        if (filters.starsMin !== '' || filters.starsMax !== '') {
            result = byStars(result, filters.starsMin, filters.starsMax);
        }
        if (filters.dateStart || filters.dateEnd) {
            result = byDate(result, filters.dateStart, filters.dateEnd);
        }

        return result;
    }

    /**
     * Get unique languages sorted by frequency
     */
    function getUniqueLanguages(repos) {
        const counts = {};
        repos.forEach(r => {
            counts[r.language] = (counts[r.language] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, count]) => ({ language: lang, count }));
    }

    /**
     * Populate the language dropdown from repo data
     */
    function populateLanguageDropdown(repos) {
        const select = document.getElementById('language-filter');
        // Clear existing options except "All"
        select.innerHTML = '<option value="all">All Languages</option>';

        const languages = getUniqueLanguages(repos);
        languages.forEach(({ language, count }) => {
            const option = document.createElement('option');
            option.value = language;
            option.textContent = `${language} (${count})`;
            select.appendChild(option);
        });
    }

    /**
     * Read current filter values from the DOM
     */
    function getCurrentFilters() {
        return {
            language: document.getElementById('language-filter').value,
            starsMin: document.getElementById('stars-min').value,
            starsMax: document.getElementById('stars-max').value,
            dateStart: document.getElementById('date-start').value,
            dateEnd: document.getElementById('date-end').value,
        };
    }

    /**
     * Clear all filter inputs
     */
    function clearAll() {
        document.getElementById('language-filter').value = 'all';
        document.getElementById('stars-min').value = '';
        document.getElementById('stars-max').value = '';
        document.getElementById('date-start').value = '';
        document.getElementById('date-end').value = '';
    }

    return { applyAll, populateLanguageDropdown, getCurrentFilters, clearAll, getUniqueLanguages };
})();
