/* ============================================================
   api.js — GitHub API Integration
   Handles fetching repos, topics, with pagination & rate limiting
   ============================================================ */

const GitHubAPI = (() => {
    const BASE_URL = 'https://api.github.com';
    const PER_PAGE = 100;
    const CONCURRENCY = 5;

    /**
     * Make an authenticated API request
     */
    async function apiRequest(url, token) {
        const headers = {
            'Accept': 'application/vnd.github.mercy-preview+json',
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await fetch(url, { headers });

        if (response.status === 403) {
            const remaining = response.headers.get('X-RateLimit-Remaining');
            if (remaining === '0') {
                const resetTime = response.headers.get('X-RateLimit-Reset');
                const resetDate = new Date(resetTime * 1000);
                throw new Error(`Rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}. Add a GitHub API token for higher limits.`);
            }
            throw new Error('Access forbidden. Check your API token permissions.');
        }

        if (response.status === 404) {
            throw new Error('User not found. Please check the username.');
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        return {
            data: await response.json(),
            headers: response.headers,
        };
    }

    /**
     * Parse Link header for pagination
     */
    function getNextPageUrl(headers) {
        const link = headers.get('Link');
        if (!link) return null;

        const match = link.match(/<([^>]+)>;\s*rel="next"/);
        return match ? match[1] : null;
    }

    /**
     * Fetch all repositories for a user with pagination
     */
    async function fetchUserRepos(username, token, onProgress) {
        const repos = [];
        let url = `${BASE_URL}/users/${username}/repos?per_page=${PER_PAGE}&sort=updated&type=all`;
        let page = 1;

        while (url) {
            if (onProgress) onProgress(`Fetching repos page ${page}...`);

            const { data, headers } = await apiRequest(url, token);
            repos.push(...data);

            url = getNextPageUrl(headers);
            page++;
        }

        return repos;
    }

    /**
     * Fetch topics for a single repo
     */
    async function fetchRepoTopics(owner, repoName, token) {
        try {
            const url = `${BASE_URL}/repos/${owner}/${repoName}/topics`;
            const { data } = await apiRequest(url, token);
            return data.names || [];
        } catch (e) {
            // If topics fail for a single repo, return empty
            console.warn(`Could not fetch topics for ${repoName}:`, e.message);
            return [];
        }
    }

    /**
     * Batch fetch topics with concurrency control
     */
    async function fetchTopicsBatch(owner, repos, token, onProgress) {
        const results = new Map();
        const queue = [...repos];
        let completed = 0;
        const total = repos.length;

        async function processNext() {
            while (queue.length > 0) {
                const repo = queue.shift();
                const topics = await fetchRepoTopics(owner, repo.name, token);
                results.set(repo.name, topics);
                completed++;
                if (onProgress) {
                    onProgress(`Fetching topics... ${completed}/${total}`);
                }
            }
        }

        // Run workers in parallel
        const workers = Array.from(
            { length: Math.min(CONCURRENCY, repos.length) },
            () => processNext()
        );
        await Promise.all(workers);

        return results;
    }

    /**
     * Fetch all data: repos + topics, returns enriched repo objects
     */
    async function fetchAllData(username, token, onProgress) {
        // Step 1: Fetch all repos
        const rawRepos = await fetchUserRepos(username, token, onProgress);

        if (rawRepos.length === 0) {
            throw new Error(`No public repositories found for user "${username}".`);
        }

        // Step 2: Fetch topics for each repo
        const topicsMap = await fetchTopicsBatch(username, rawRepos, token, onProgress);

        // Step 3: Enrich repos
        const enrichedRepos = rawRepos.map(repo => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description || '',
            url: repo.html_url,
            language: repo.language || 'Unknown',
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            watchers: repo.watchers_count,
            topics: topicsMap.get(repo.name) || [],
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            isFork: repo.fork,
            size: repo.size,
        }));

        return enrichedRepos;
    }

    /**
     * Parse a repo input string (URL or owner/repo) into { owner, repo }
     */
    function parseRepoInput(input) {
        input = input.trim();

        // Handle full GitHub URLs
        // e.g. https://github.com/facebook/react or https://github.com/facebook/react/
        const urlMatch = input.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
        if (urlMatch) {
            return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
        }

        // Handle owner/repo format
        const slashMatch = input.match(/^([^\/\s]+)\/([^\/\s]+)$/);
        if (slashMatch) {
            return { owner: slashMatch[1], repo: slashMatch[2] };
        }

        return null;
    }

    /**
     * Fetch a single repository by owner/name and return enriched repo object
     */
    async function fetchSingleRepo(owner, repoName, token) {
        const url = `${BASE_URL}/repos/${owner}/${repoName}`;
        const { data: repo } = await apiRequest(url, token);
        const topics = await fetchRepoTopics(owner, repoName, token);

        return {
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description || '',
            url: repo.html_url,
            language: repo.language || 'Unknown',
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            watchers: repo.watchers_count,
            topics: topics,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            isFork: repo.fork,
            size: repo.size,
        };
    }
    /**
     * Fetch GitHub user profile
     */
    async function fetchUserProfile(username, token) {
        const url = `${BASE_URL}/users/${username}`;
        const { data } = await apiRequest(url, token);
        return {
            login: data.login,
            name: data.name || data.login,
            avatarUrl: data.avatar_url,
            bio: data.bio || '',
            company: data.company || '',
            location: data.location || '',
            blog: data.blog || '',
            publicRepos: data.public_repos,
            followers: data.followers,
            following: data.following,
            htmlUrl: data.html_url,
            createdAt: data.created_at,
        };
    }

    return { fetchAllData, fetchSingleRepo, parseRepoInput, fetchUserProfile };
})();
