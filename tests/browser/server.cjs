/* eslint-disable @typescript-eslint/no-require-imports */
// Browser fixture bundles real components without a database, credentials, or a test route in the app.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const host = process.env.SWITCHPLAY_FIXTURE_HOST || '127.0.0.1';
const port = Number(process.env.SWITCHPLAY_FIXTURE_PORT || 4178);
if (!['127.0.0.1', '0.0.0.0'].includes(host) || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid fixture host/port');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'switchplay-media-viewer-'));
webpack({ mode: 'development', devtool: false, entry: { fixture: path.resolve(__dirname, 'fixture.tsx'), 'info-cards': path.resolve(__dirname, 'info-cards-fixture.tsx') }, output: { path: output, filename: '[name].js' },
  resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': path.resolve(__dirname, '../../src') } },
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.resolve(__dirname, 'fixture-loader.cjs') }] },
  plugins: [new webpack.DefinePlugin({ 'process.env': JSON.stringify({ NODE_ENV: 'development' }) })],
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exit(1); }
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const references = {
      '/info-card-references/closed-step-view.png': 'closed-step-view.png',
      '/info-card-references/open-info-card-bundle.png': 'open-info-card-bundle.png',
      '/info-card-references/emerging-bundle.png': 'emerging-bundle.png',
    };
    if (references[pathname]) {
      response.setHeader('Content-Type', 'image/png');
      fs.createReadStream(path.resolve(__dirname, '../../docs/design/features/info-cards', references[pathname])).pipe(response);
      return;
    }
    if (pathname === '/fixture.js' || pathname === '/info-cards.js') { response.setHeader('Content-Type', 'text/javascript'); fs.createReadStream(path.join(output, pathname.slice(1))).pipe(response); return; }
    if (/^\/image-\d+\.svg$/.test(request.url)) {
      const index = Number(request.url.match(/\d+/)[0]);
      const [width, height] = index === 0 ? [800, 1200] : index === 3 ? [1600, 400] : [900, 900];
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ded5c6"/><text x="50%" y="50%" text-anchor="middle" font-size="80">Image ${index + 1}</text></svg>`);
      return;
    }
    if (/^\/api\/(decks-data|cards-data)\/[^/]+\/update$/.test(request.url)) {
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('X-Personal-Viewer', '507f1f77bcf86cd799439011');
      response.end(JSON.stringify({ review: null })); return;
    }
    if (request.url?.startsWith('/api/media/card/file?')) {
      response.setHeader('Content-Type', 'image/png');
      response.setHeader('Content-Disposition', 'attachment; filename="written-work.png"');
      response.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5kAAAAASUVORK5CYII=', 'base64'));
      return;
    }
    if (request.url?.startsWith('/api/media/card')) {
      response.setHeader('Content-Type', 'application/json');
      const action = new URL(request.url, 'http://localhost').searchParams.get('action');
      if (action === 'playback') {
        const query = new URL(request.url, 'http://localhost').searchParams;
        const assetId = query.get('mediaItemId').replace('stream-', 'video-');
        response.end(JSON.stringify({ status: 'ready', viewerUserId: query.get('viewerUserId'), grant: {
          assetId, manifestUrl: `https://videodelivery.net/${assetId}/manifest/video.m3u8`,
          thumbnailUrl: `https://videodelivery.net/${assetId}/thumbnails/thumbnail.jpg`, expiresAt: Date.now() + 3600000, reuseUntil: Date.now() + 600000,
        } })); return;
      }
      const reply = (mediaItemId) => response.end(JSON.stringify(mediaItemId?.startsWith('stream-')
        ? { status: 'ready', url: `https://customer-test.cloudflarestream.com/${mediaItemId}/downloads/default.mp4?filename=Practice`, filename: 'Practice.mp4' }
        : { status: 'ready', url: '/api/media/card/file?fixture=1', filename: 'written-work.png' }));
      if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk) => { body += chunk; });
        request.on('end', () => { reply(JSON.parse(body).mediaItemId); });
      } else reply(new URL(request.url, 'http://localhost').searchParams.get('mediaItemId'));
      return;
    }
    response.setHeader('Content-Type', 'text/html');
    const script = pathname === '/info-cards' ? 'info-cards' : 'fixture';
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${script === 'info-cards' ? 'Info Cards Phase 1A' : 'Media viewer fixture'}</title></head><body><div id="fixture-root"></div><script src="/${script}.js"></script></body></html>`);
  });
  server.listen(port, host, () => {
    console.log(`Fixtures ready: http://127.0.0.1:${port}/info-cards`);
    if (host === '0.0.0.0') for (const entries of Object.values(os.networkInterfaces())) for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) console.log(`Phone (same network): http://${entry.address}:${port}/info-cards`);
    }
  });
  const close = () => server.close(() => { fs.rmSync(output, { recursive: true, force: true }); process.exit(0); });
  process.on('SIGTERM', close); process.on('SIGINT', close);
});
