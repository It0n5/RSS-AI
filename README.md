# AI Paper Feed

A lightweight, beautifully designed RSS feed reader for AI academic papers from arXiv.

![AI Paper Feed Screenshot](https://export.arxiv.org/icons/e-prints/arxiv-logomark.png)

## Features

- 📰 **RSS Feed Aggregation** - Fetches papers from 7 arXiv categories (cs.LG, cs.CL, cs.AI, cs.CV, cs.RO, cs.IR, stat.ML)
- 📅 **Historical Search** - View papers from the past 7 or 30 days via arXiv API
- 🔍 **Smart Filtering** - Filter by category, keyword search, or quick filter chips (LLM, Transformer, RAG, etc.)
- 🔖 **Bookmarks** - Save papers to localStorage for later reading
- 🌙 **Modern Dark UI** - Glassmorphism design with smooth animations
- ⌨️ **Keyboard Shortcuts** - `Ctrl+K` to focus search, `Esc` to close sidebar

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher)

### Installation

```bash
# Clone the repo
git clone https://github.com/It0n5/RSS-AI.git
cd RSS-AI
```

### Running the App

**Option 1: Single command (recommended)**
```bash
npm start
```
This launches both servers and opens the app in your browser automatically.

**Option 2: Manual (two terminals)**
```bash
# Terminal 1: CORS proxy
node server.js

# Terminal 2: Web server
npx -y http-server -p 3000
```

**Open your browser:**
Navigate to **http://localhost:3000**

## Project Structure

```
RSS _READER/
├── index.html      # Main HTML structure
├── styles.css      # Dark glassmorphism theme
├── app.js          # Application logic (feed fetching, filtering, UI)
├── server.js       # Local CORS proxy server
└── README.md       # This file
```

## How It Works

### Data Sources

1. **Today's Feed** (RSS) - Uses arXiv RSS feeds which update daily at midnight EST (not on weekends)
2. **Past 7/30 Days** (API) - Uses arXiv's search API with `submittedDate` query

### CORS Handling

Browsers block direct requests to arXiv due to CORS. The app handles this via:
1. **Local proxy** (server.js on port 3001) - Most reliable
2. **Public proxies** (fallback) - codetabs, corsproxy.io, allorigins

### Data Flow

```
User loads page
    ↓
Fetch RSS feeds (or API for historical)
    ↓
Parse XML → JavaScript objects
    ↓
Apply filters (category, search, quick filters)
    ↓
Render paper cards
    ↓
User interactions → Update state → Re-render
```

## Configuration

Edit `app.js` to customize:

```javascript
const CONFIG = {
    feeds: [...],        // arXiv categories to fetch
    corsProxies: [...],  // CORS proxy servers
    storageKey: '...',   // localStorage key for bookmarks
    debounceMs: 300      // Search debounce delay
};

const QUICK_FILTERS = {...};  // Keyword groups for quick filters
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+K` / `Cmd+K` | Focus search box |
| `Esc` | Close bookmarks sidebar |

## Troubleshooting

### "No papers found" on weekends
arXiv doesn't publish new papers on weekends. Use "Past 7 Days" to see recent papers.

### Papers not loading
1. Make sure `server.js` is running on port 3001
2. Check browser console for CORS errors
3. Try refreshing the page

### Bookmarks not saving
Check if localStorage is enabled in your browser.

## Security Notes

- The local proxy server only allows requests to `arxiv.org` domains
- All external links open with `rel="noopener"` for security
- User input is escaped before rendering to prevent XSS
- No sensitive data is stored or transmitted

## License

MIT License - Feel free to use and modify!

---

Built with ❤️ for AI researchers
