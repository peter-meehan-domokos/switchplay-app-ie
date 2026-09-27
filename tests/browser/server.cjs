/* eslint-disable @typescript-eslint/no-require-imports */
// Browser fixture bundles real components without a database, credentials, or a test route in the app.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'switchplay-media-viewer-'));
webpack({ mode: 'development', devtool: false, entry: path.resolve(__dirname, 'fixture.tsx'), output: { path: output, filename: 'fixture.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': path.resolve(__dirname, '../../src') } },
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.resolve(__dirname, 'fixture-loader.cjs') }] },
  plugins: [new webpack.DefinePlugin({ 'process.env': JSON.stringify({ NODE_ENV: 'development' }) })],
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exit(1); }
  const server = http.createServer((request, response) => {
    if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); fs.createReadStream(path.join(output, 'fixture.js')).pipe(response); return; }
    if (/^\/image-\d+\.svg$/.test(request.url)) {
      const index = Number(request.url.match(/\d+/)[0]);
      const [width, height] = index === 0 ? [800, 1200] : index === 3 ? [1600, 400] : [900, 900];
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ded5c6"/><text x="50%" y="50%" text-anchor="middle" font-size="80">Image ${index + 1}</text></svg>`);
      return;
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
      if (action === 'playback') response.end(JSON.stringify({ status: 'ready' }));
      else response.end(JSON.stringify({ status: 'ready', url: '/api/media/card/file?fixture=1', filename: 'written-work.png' }));
      return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>');
  });
  server.listen(4178, '127.0.0.1', () => console.log('Media viewer fixture ready on 4178'));
  const close = () => server.close(() => { fs.rmSync(output, { recursive: true, force: true }); process.exit(0); });
  process.on('SIGTERM', close); process.on('SIGINT', close);
});
