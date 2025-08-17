#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8082;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain'
};

function getMimeType(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    
    // Handle root path
    if (pathname === '/') {
        pathname = '/test-latest-generator.html';
    }
    
    // Construct file path (remove leading slash)
    const filepath = path.join(__dirname, pathname.slice(1));
    
    console.log(`🌐 ${req.method} ${pathname} -> ${filepath}`);
    
    // Check if file exists
    fs.stat(filepath, (err, stats) => {
        if (err) {
            console.log(`❌ File not found: ${filepath}`);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
                <h1>404 - File Not Found</h1>
                <p>Could not find: ${pathname}</p>
                <p>Looking for: ${filepath}</p>
                <hr>
                <h2>Available Files:</h2>
                <ul>
                    <li><a href="/test-latest-generator.html">🧪 Test Latest Generator</a></li>
                    <li><a href="/current/deterministic-full.html">🎨 Full Deterministic Art</a></li>
                    <li><a href="/current/web-preview.html">👁️ Web Preview</a></li>
                    <li><a href="/tests/">📁 Tests Directory</a></li>
                    <li><a href="/archive/">📁 Archive Directory</a></li>
                </ul>
            `);
            return;
        }
        
        if (stats.isDirectory()) {
            // List directory contents
            fs.readdir(filepath, (err, files) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error reading directory');
                    return;
                }
                
                const fileList = files.map(file => {
                    const isDir = fs.statSync(path.join(filepath, file)).isDirectory();
                    const icon = isDir ? '📁' : '📄';
                    const href = pathname === '/' ? file : path.join(pathname, file);
                    return `<li>${icon} <a href="${href}">${file}</a></li>`;
                }).join('');
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <h1>📁 Directory: ${pathname}</h1>
                    <ul>${fileList}</ul>
                    <hr>
                    <a href="/">🏠 Home</a>
                `);
            });
            return;
        }
        
        // Serve file
        const mimeType = getMimeType(filepath);
        
        fs.readFile(filepath, (err, data) => {
            if (err) {
                console.log(`❌ Error reading file: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error reading file');
                return;
            }
            
            res.writeHead(200, { 
                'Content-Type': mimeType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(data);
            console.log(`✅ Served: ${pathname} (${mimeType})`);
        });
    });
});

server.listen(PORT, () => {
    console.log('🎨 Barely Human Art Generator Test Server');
    console.log('==========================================');
    console.log(`🌐 Server running at: http://localhost:${PORT}`);
    console.log('');
    console.log('📄 Available URLs:');
    console.log(`   🧪 Test Latest Generator: http://localhost:${PORT}/test-latest-generator.html`);
    console.log(`   🎨 Full Art Generator:   http://localhost:${PORT}/current/deterministic-full.html`);
    console.log(`   👁️ Web Preview:          http://localhost:${PORT}/current/web-preview.html`);
    console.log(`   📁 Browse Files:         http://localhost:${PORT}/`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('==========================================');
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});