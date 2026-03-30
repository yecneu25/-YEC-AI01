const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';


const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    // --- PROXY FOR NVIDIA API ---
    if (req.url === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const options = {
                hostname: 'integrate.api.nvidia.com',
                port: 443,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${NVIDIA_API_KEY}`
                }
            };

            const proxyReq = https.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                console.error(`Proxy error: ${e.message}`);
                res.writeHead(500);
                res.end(JSON.stringify({ error: { message: e.message } }));
            });

            proxyReq.write(body);
            proxyReq.end();
        });
        return;
    }

    // --- STATIC FILE SERVER ---
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 YEC Chat Server running at http://localhost:${PORT}/`);
    console.log(`🛠️  Proxy enabled for NVIDIA API at /api/chat`);
});
