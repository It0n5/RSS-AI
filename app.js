/**
 * AI Paper Feed - arXiv RSS Reader
 * 
 * A lightweight, client-side RSS feed reader for AI academic papers from arXiv.
 * 
 * Features:
 * - Fetches papers from 7 arXiv categories via RSS feeds (daily) or API (historical)
 * - Filtering by category, keyword search, and quick filter chips
 * - Bookmarking with localStorage persistence
 * - Modern dark glassmorphism UI
 * 
 * Architecture:
 * - State-based UI rendering with vanilla JavaScript
 * - CORS proxy fallback chain for reliable feed fetching
 * - Debounced search for performance
 * 
 * @author AI Paper Feed
 * @version 1.0.0
 */

// ===========================================
// Configuration
// ===========================================

/**
 * Application configuration
 * Modify these values to customize the app behavior
 */
const CONFIG = {
    // arXiv RSS feed sources - each category has a unique ID and RSS URL
    // These feeds update daily at midnight EST (not on weekends)
    feeds: [
        { id: 'cs.LG', name: 'Machine Learning', url: 'https://export.arxiv.org/rss/cs.LG' },
        { id: 'cs.CL', name: 'NLP / LLMs', url: 'https://export.arxiv.org/rss/cs.CL' },
        { id: 'cs.AI', name: 'General AI', url: 'https://export.arxiv.org/rss/cs.AI' },
        { id: 'cs.CV', name: 'Computer Vision', url: 'https://export.arxiv.org/rss/cs.CV' },
        { id: 'cs.RO', name: 'Robotics', url: 'https://export.arxiv.org/rss/cs.RO' },
        { id: 'cs.IR', name: 'Information Retrieval', url: 'https://export.arxiv.org/rss/cs.IR' },
        { id: 'stat.ML', name: 'Statistics ML', url: 'https://export.arxiv.org/rss/stat.ML' }
    ],

    // CORS proxy chain - tries each in order until one succeeds
    // Local proxy (server.js) is most reliable; public proxies are fallbacks
    corsProxies: [
        'http://localhost:3001/?url=',              // Local proxy (run server.js)
        'https://api.codetabs.com/v1/proxy?quest=', // Public proxy 1
        'https://corsproxy.io/?',                   // Public proxy 2
        'https://api.allorigins.win/raw?url='       // Public proxy 3
    ],

    storageKey: 'ai-paper-feed-bookmarks',  // localStorage key for bookmarks
    debounceMs: 300                          // Delay before triggering search filter
};

// Quick filter keywords
const QUICK_FILTERS = {
    'all': null,
    'llm': ['llm', 'language model', 'gpt', 'bert', 'transformer', 'chatgpt', 'llama', 'gemini'],
    'transformer': ['transformer', 'attention', 'self-attention', 'multi-head'],
    'rag': ['retrieval', 'rag', 'retrieval-augmented', 'dense retrieval', 'knowledge base'],
    'diffusion': ['diffusion', 'stable diffusion', 'ddpm', 'score-based', 'denoising'],
    'reinforcement': ['reinforcement learning', 'rl', 'policy gradient', 'q-learning', 'ppo', 'rlhf']
};

// ===========================================
// State
// ===========================================

/**
 * Application state - single source of truth for the UI
 * Changes to state trigger re-renders via updateUI() and renderPapers()
 */
let state = {
    papers: [],              // All fetched papers (raw data)
    filteredPapers: [],      // Papers after applying all filters (displayed)
    bookmarks: [],           // User's saved papers (persisted to localStorage)
    activeCategories: new Set(['cs.LG', 'cs.CL', 'cs.AI', 'cs.CV', 'cs.RO', 'cs.IR', 'stat.ML']),
    searchQuery: '',         // Current text in search box
    quickFilter: 'all',      // Active quick filter chip
    dateRange: 'today',      // Date range: 'today' (RSS), 'week', or 'month' (API)
    isLoading: true,         // Show loading spinner
    error: null              // Error message to display (null = no error)
};

// ===========================================
// DOM Elements
// ===========================================

const elements = {
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    papersGrid: document.getElementById('papers-grid'),
    emptyState: document.getElementById('empty-state'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    categoryFilters: document.getElementById('category-filters'),
    dateRangeFilters: document.getElementById('date-range-filters'),
    quickFilters: document.querySelectorAll('.chip[data-filter]'),
    totalPapers: document.getElementById('total-papers'),
    filteredPapersCount: document.getElementById('filtered-papers'),
    bookmarksToggle: document.getElementById('bookmarks-toggle'),
    bookmarksSidebar: document.getElementById('bookmarks-sidebar'),
    bookmarksList: document.getElementById('bookmarks-list'),
    bookmarkCount: document.getElementById('bookmark-count'),
    closeBookmarks: document.getElementById('close-bookmarks'),
    overlay: document.getElementById('overlay'),
    refreshBtn: document.getElementById('refresh-btn')
};

// ===========================================
// Utilities
// ===========================================

/**
 * Debounce utility - delays function execution until input stops
 * Used for search to avoid filtering on every keystroke
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Milliseconds to wait before executing
 * @returns {Function} Debounced function
 */
function debounce(fn, ms) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 * Uses browser's built-in escaping via textContent/innerHTML
 * @param {string} text - Raw text to escape
 * @returns {string} HTML-safe text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractArxivId(link) {
    const match = link.match(/abs\/([^\?]+)/);
    return match ? match[1] : '';
}

function cleanText(text) {
    // Remove HTML tags and clean up whitespace
    return text
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

// ===========================================
// Storage
// ===========================================

function loadBookmarks() {
    try {
        const stored = localStorage.getItem(CONFIG.storageKey);
        state.bookmarks = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Failed to load bookmarks:', e);
        state.bookmarks = [];
    }
}

function saveBookmarks() {
    try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.bookmarks));
    } catch (e) {
        console.error('Failed to save bookmarks:', e);
    }
}

function isBookmarked(paperId) {
    return state.bookmarks.some(b => b.id === paperId);
}

function toggleBookmark(paper) {
    const index = state.bookmarks.findIndex(b => b.id === paper.id);
    if (index > -1) {
        state.bookmarks.splice(index, 1);
    } else {
        state.bookmarks.push({
            id: paper.id,
            title: paper.title,
            link: paper.link,
            category: paper.category,
            addedAt: new Date().toISOString()
        });
    }
    saveBookmarks();
    updateBookmarkCount();
    renderBookmarks();
    // Re-render the specific card to update bookmark button
    renderPapers();
}

function removeBookmark(paperId) {
    state.bookmarks = state.bookmarks.filter(b => b.id !== paperId);
    saveBookmarks();
    updateBookmarkCount();
    renderBookmarks();
    renderPapers();
}

// ===========================================
// RSS Fetching & Parsing
// ===========================================

async function fetchFeed(feed) {
    // Try each CORS proxy until one works
    for (const proxy of CONFIG.corsProxies) {
        const url = proxy + encodeURIComponent(feed.url);

        try {
            const response = await fetch(url);
            if (!response.ok) continue; // Try next proxy

            const text = await response.text();
            const papers = parseFeed(text, feed.id);
            if (papers.length > 0) {
                console.log(`✓ Fetched ${papers.length} papers from ${feed.id} via ${proxy.split('/')[2]}`);
                return papers;
            }
        } catch (error) {
            console.warn(`Proxy ${proxy.split('/')[2]} failed for ${feed.id}:`, error.message);
            // Continue to next proxy
        }
    }

    console.error(`All proxies failed for ${feed.id}`);
    return [];
}

function parseFeed(xmlText, categoryId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const items = doc.querySelectorAll('item');
    const papers = [];

    items.forEach((item, index) => {
        const title = cleanText(item.querySelector('title')?.textContent || '');
        const link = item.querySelector('link')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const creator = item.querySelector('creator')?.textContent ||
            item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0]?.textContent || '';

        // Extract abstract from description (arXiv includes it there)
        const abstract = cleanText(description);

        // Get arXiv ID from link
        const id = extractArxivId(link);

        if (title && link) {
            papers.push({
                id: id || `${categoryId}-${index}`,
                title: title.replace(/^\([^)]+\)\s*/, ''), // Remove category prefix like (cs.LG)
                link,
                abstract,
                authors: cleanText(creator),
                category: categoryId,
                fetchedAt: new Date().toISOString()
            });
        }
    });

    return papers;
}

// Helper: format date for arXiv API (YYYYMMDDTTTT format)
function formatArxivDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}0000`;
}

// Fetch papers from arXiv API by date range
async function fetchFromArxivAPI(category, daysBack) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const dateQuery = `submittedDate:[${formatArxivDate(startDate)}+TO+${formatArxivDate(endDate)}]`;
    const catQuery = `cat:${category}`;
    const query = `${catQuery}+AND+${dateQuery}`;

    const apiUrl = `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=100&sortBy=submittedDate&sortOrder=descending`;

    // Try each CORS proxy
    for (const proxy of CONFIG.corsProxies) {
        const url = proxy + encodeURIComponent(apiUrl);

        try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const text = await response.text();
            const papers = parseArxivAPIResponse(text, category);
            if (papers.length > 0) {
                console.log(`✓ API: Fetched ${papers.length} papers from ${category} (${daysBack} days)`);
                return papers;
            }
        } catch (error) {
            console.warn(`API proxy failed for ${category}:`, error.message);
        }
    }

    return [];
}

// Parse arXiv API Atom response
function parseArxivAPIResponse(xmlText, categoryId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const entries = doc.querySelectorAll('entry');
    const papers = [];

    entries.forEach((entry, index) => {
        const title = cleanText(entry.querySelector('title')?.textContent || '');
        const id = entry.querySelector('id')?.textContent || '';
        const summary = entry.querySelector('summary')?.textContent || '';
        const authors = Array.from(entry.querySelectorAll('author name'))
            .map(a => a.textContent)
            .join(', ');
        const link = entry.querySelector('link[title="pdf"]')?.getAttribute('href') ||
            entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
            id;

        // Extract arXiv ID from the full URL
        const arxivId = id.match(/abs\/([^\?]+)/)?.[1] || id.split('/').pop();

        if (title && arxivId) {
            papers.push({
                id: arxivId,
                title: title,
                link: id.replace('http://', 'https://'), // Ensure HTTPS
                abstract: cleanText(summary),
                authors: authors,
                category: categoryId,
                fetchedAt: new Date().toISOString()
            });
        }
    });

    return papers;
}

async function fetchAllFeeds() {
    state.isLoading = true;
    state.error = null;
    updateUI();

    try {
        let results;

        if (state.dateRange === 'today') {
            // Use RSS feeds for today's papers
            const feedPromises = CONFIG.feeds.map(feed => fetchFeed(feed));
            results = await Promise.all(feedPromises);
        } else {
            // Use arXiv API for historical search
            const daysBack = state.dateRange === 'week' ? 7 : 30;
            const categories = Array.from(state.activeCategories);
            const apiPromises = categories.map(cat => fetchFromArxivAPI(cat, daysBack));
            results = await Promise.all(apiPromises);
        }

        // Flatten and deduplicate by ID
        const allPapers = results.flat();
        const uniquePapers = [];
        const seenIds = new Set();

        for (const paper of allPapers) {
            if (!seenIds.has(paper.id)) {
                seenIds.add(paper.id);
                uniquePapers.push(paper);
            }
        }

        state.papers = uniquePapers;
        state.isLoading = false;

        if (state.papers.length === 0) {
            if (state.dateRange === 'today') {
                const day = new Date().getDay();
                const isWeekend = (day === 0 || day === 6);
                state.error = isWeekend
                    ? 'No new papers today. arXiv does not publish on weekends—try "Past 7 Days" instead!'
                    : 'No papers found. The feeds may be temporarily unavailable.';
            } else {
                state.error = 'No papers found for this date range. Try different categories.';
            }
        }

        applyFilters();
        updateUI();

    } catch (error) {
        console.error('Failed to fetch feeds:', error);
        state.isLoading = false;
        state.error = 'Failed to load papers. Please try again.';
        updateUI();
    }
}

// ===========================================
// Filtering
// ===========================================

function applyFilters() {
    let filtered = [...state.papers];

    // Filter by category
    filtered = filtered.filter(p => state.activeCategories.has(p.category));

    // Filter by search query
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(p =>
            p.title.toLowerCase().includes(query) ||
            p.abstract.toLowerCase().includes(query) ||
            p.authors.toLowerCase().includes(query)
        );
    }

    // Filter by quick filter
    if (state.quickFilter !== 'all') {
        const keywords = QUICK_FILTERS[state.quickFilter];
        if (keywords) {
            filtered = filtered.filter(p => {
                const text = (p.title + ' ' + p.abstract).toLowerCase();
                return keywords.some(kw => text.includes(kw));
            });
        }
    }

    state.filteredPapers = filtered;
    updateStats();
    renderPapers();
}

// ===========================================
// Rendering
// ===========================================

function updateStats() {
    elements.totalPapers.textContent = state.papers.length;
    elements.filteredPapersCount.textContent = state.filteredPapers.length;
}

function updateBookmarkCount() {
    elements.bookmarkCount.textContent = state.bookmarks.length;
}

function updateUI() {
    // Loading state
    elements.loading.style.display = state.isLoading ? 'flex' : 'none';

    // Error state
    if (state.error && !state.isLoading) {
        elements.error.style.display = 'flex';
        elements.errorMessage.textContent = state.error;
    } else {
        elements.error.style.display = 'none';
    }

    // Empty state
    const showEmpty = !state.isLoading && !state.error && state.filteredPapers.length === 0;
    elements.emptyState.style.display = showEmpty ? 'flex' : 'none';

    // Papers grid
    elements.papersGrid.style.display = (state.isLoading || state.error || showEmpty) ? 'none' : 'grid';
}

function renderPapers() {
    elements.papersGrid.innerHTML = '';

    state.filteredPapers.forEach((paper, index) => {
        const card = createPaperCard(paper, index);
        elements.papersGrid.appendChild(card);
    });

    updateUI();
}

function createPaperCard(paper, index) {
    const card = document.createElement('article');
    card.className = 'paper-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const bookmarked = isBookmarked(paper.id);

    card.innerHTML = `
        <div class="paper-header">
            <span class="paper-category" data-category="${paper.category}">${paper.category}</span>
            <button class="bookmark-btn ${bookmarked ? 'bookmarked' : ''}" 
                    data-paper-id="${paper.id}" 
                    title="${bookmarked ? 'Remove bookmark' : 'Add bookmark'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
            </button>
        </div>
        <h2 class="paper-title">
            <a href="${paper.link}" target="_blank" rel="noopener">${escapeHtml(paper.title)}</a>
        </h2>
        ${paper.authors ? `<p class="paper-authors">${escapeHtml(paper.authors)}</p>` : ''}
        ${paper.abstract ? `<p class="paper-abstract">${escapeHtml(paper.abstract)}</p>` : ''}
        <div class="paper-footer">
            <a href="${paper.link}" target="_blank" rel="noopener" class="paper-link">
                View on arXiv
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
            </a>
            <span class="paper-id">${paper.id}</span>
        </div>
    `;

    // Add bookmark click handler
    const bookmarkBtn = card.querySelector('.bookmark-btn');
    bookmarkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleBookmark(paper);
    });

    return card;
}

function renderBookmarks() {
    if (state.bookmarks.length === 0) {
        elements.bookmarksList.innerHTML = `
            <div class="empty-bookmarks">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <p>No bookmarks yet</p>
                <span>Click the bookmark icon on any paper to save it</span>
            </div>
        `;
        return;
    }

    elements.bookmarksList.innerHTML = state.bookmarks.map(bookmark => `
        <div class="bookmark-item">
            <div class="bookmark-item-header">
                <h4 class="bookmark-item-title">
                    <a href="${bookmark.link}" target="_blank" rel="noopener">${escapeHtml(bookmark.title)}</a>
                </h4>
                <button class="remove-bookmark" data-id="${bookmark.id}" title="Remove bookmark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <span class="paper-category" data-category="${bookmark.category}">${bookmark.category}</span>
        </div>
    `).join('');

    // Add remove handlers
    elements.bookmarksList.querySelectorAll('.remove-bookmark').forEach(btn => {
        btn.addEventListener('click', () => {
            removeBookmark(btn.dataset.id);
        });
    });
}

// ===========================================
// Event Handlers
// ===========================================

function setupEventListeners() {
    // Category checkboxes
    elements.categoryFilters.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const category = e.target.value;
            if (e.target.checked) {
                state.activeCategories.add(category);
            } else {
                state.activeCategories.delete(category);
            }
            applyFilters();
        }
    });

    // Date range radio buttons
    elements.dateRangeFilters.addEventListener('change', (e) => {
        if (e.target.type === 'radio' && e.target.name === 'dateRange') {
            state.dateRange = e.target.value;
            fetchAllFeeds(); // Re-fetch with new date range
        }
    });

    // Search input
    const debouncedSearch = debounce(() => {
        state.searchQuery = elements.searchInput.value.trim();
        applyFilters();
    }, CONFIG.debounceMs);

    elements.searchInput.addEventListener('input', debouncedSearch);

    // Clear search
    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        applyFilters();
    });

    // Quick filters
    elements.quickFilters.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.quickFilters.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.quickFilter = chip.dataset.filter;
            applyFilters();
        });
    });

    // Bookmarks toggle
    elements.bookmarksToggle.addEventListener('click', () => {
        elements.bookmarksSidebar.classList.add('open');
        elements.overlay.classList.add('visible');
    });

    // Close bookmarks
    elements.closeBookmarks.addEventListener('click', closeBookmarksSidebar);
    elements.overlay.addEventListener('click', closeBookmarksSidebar);

    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        fetchAllFeeds();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close bookmarks
        if (e.key === 'Escape') {
            closeBookmarksSidebar();
        }
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            elements.searchInput.focus();
        }
    });
}

function closeBookmarksSidebar() {
    elements.bookmarksSidebar.classList.remove('open');
    elements.overlay.classList.remove('visible');
}

// ===========================================
// Initialization
// ===========================================

function init() {
    loadBookmarks();
    updateBookmarkCount();
    renderBookmarks();
    setupEventListeners();
    fetchAllFeeds();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
