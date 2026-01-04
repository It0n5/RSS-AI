/**
 * CORS Proxy Server for arXiv RSS Feeds
 * 
 * This server acts as a local CORS proxy to fetch arXiv RSS feeds and API responses.
 * Browsers block direct requests to arXiv due to CORS policy, so we proxy through
 * this server which adds the necessary CORS headers.
 * 
 * SECURITY FEATURES:
 * - Whitelist-based URL validation (only arxiv.org domains allowed)
 * - No sensitive data storage
 * - Read-only operations (GET only)
 * 
 * USAGE:
 *   node server.js
 *   Then access: http://localhost:3001/?url=https://export.arxiv.org/rss/cs.LG
 * 
 * @author AI Paper Feed
 * @version 1.0.0
 */

const http = require('http');   // HTTP server for local requests
const https = require('https'); // HTTPS client for arXiv requests
const url = require('url');     // URL parsing utility

// Server configuration
const PORT = 3001;

// SECURITY: Whitelist of allowed target hosts
// Only arXiv domains can be proxied - prevents SSRF attacks
const ALLOWED_HOSTS = [
    'export.arxiv.org',  // RSS feeds and API
    'arxiv.org',         // Main site (abstracts)
    'rss.arxiv.org'      // Alternative RSS endpoint
];

/**
 * HTTP Request Handler
 * Validates incoming requests and proxies them to arXiv
 */
const server = http.createServer((req, res) => {
    // ==========================================
    // CORS Headers - Allow browser requests
    // ==========================================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ==========================================
    // Input Validation
    // ==========================================

    // Parse the URL query parameter
    const parsedUrl = url.parse(req.url, true);
    const targetUrl = parsedUrl.query.url;

    // Validate: URL parameter is required
    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing url parameter' }));
        return;
    }

    // Validate: URL must be parseable
    let targetParsed;
    try {
        targetParsed = new URL(targetUrl);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid URL' }));
        return;
    }

    // SECURITY: Only allow whitelisted hosts
    if (!ALLOWED_HOSTS.includes(targetParsed.hostname)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Host not allowed' }));
        return;
    }

    // ==========================================
    // Proxy Request to arXiv
    // ==========================================

    console.log(`Fetching: ${targetUrl}`);

    https.get(targetUrl, {
        headers: {
            'User-Agent': 'AI-Paper-Feed/1.0'  // Identify ourselves to arXiv
        }
    }, (proxyRes) => {
        // Forward the response with CORS headers
        res.writeHead(proxyRes.statusCode, {
            'Content-Type': proxyRes.headers['content-type'] || 'application/xml',
            'Access-Control-Allow-Origin': '*'
        });
        // Stream the response body
        proxyRes.pipe(res);
    }).on('error', (err) => {
        console.error('Fetch error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    });
});

// ==========================================
// Server Startup
// ==========================================

server.listen(PORT, () => {
    console.log(`\n🚀 CORS Proxy Server running at http://localhost:${PORT}`);
    console.log(`\n📡 The RSS reader will fetch feeds through this proxy.`);
    console.log(`\nKeep this terminal open while using the app.\n`);
});
