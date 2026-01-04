/**
 * AI Paper Feed - Start Script
 * 
 * Launches both the CORS proxy server and HTTP file server with one command.
 * Usage: node start.js
 */

const { spawn } = require('child_process');
const path = require('path');

// Configuration
const PROXY_PORT = 3001;
const HTTP_PORT = 3000;

console.log('\n🚀 AI Paper Feed - Starting servers...\n');

// Start the CORS proxy server
const proxyServer = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'pipe'
});

proxyServer.stdout.on('data', (data) => {
    process.stdout.write(`[Proxy] ${data}`);
});

proxyServer.stderr.on('data', (data) => {
    process.stderr.write(`[Proxy] ${data}`);
});

// Start the HTTP file server using npx http-server
const httpServer = spawn('npx', ['-y', 'http-server', '-p', String(HTTP_PORT), '-c-1', '-o'], {
    cwd: __dirname,
    stdio: 'pipe',
    shell: true
});

httpServer.stdout.on('data', (data) => {
    const output = data.toString();
    // Only show important lines
    if (output.includes('Available on') || output.includes('http://')) {
        process.stdout.write(`[HTTP] ${output}`);
    }
});

httpServer.stderr.on('data', (data) => {
    process.stderr.write(`[HTTP] ${data}`);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down servers...');
    proxyServer.kill();
    httpServer.kill();
    process.exit(0);
});

// Status message
setTimeout(() => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                   AI Paper Feed                        ║
╠════════════════════════════════════════════════════════╣
║  📡 CORS Proxy:  http://localhost:${PROXY_PORT}                 ║
║  🌐 Web App:     http://localhost:${HTTP_PORT}                  ║
╠════════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop both servers                     ║
╚════════════════════════════════════════════════════════╝
`);
}, 2000);
