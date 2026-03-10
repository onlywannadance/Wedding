/**
 * Локальный прокси для обхода CORS при отправке анкеты на Google Apps Script.
 * Запуск: node proxy-server.js
 * Затем откройте сайт через Live Server и отправляйте форму — запросы пойдут через этот сервер.
 */
var http = require('http');
var https = require('https');
var url = require('url');

var PORT = 3456;

var server = http.createServer(function (req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  var targetUrl = req.headers['x-forward-to'];
  if (!targetUrl || targetUrl.indexOf('https://') !== 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Missing or invalid X-Forward-To header' }));
    return;
  }

  var chunks = [];
  req.on('data', function (chunk) { chunks.push(chunk); });
  req.on('end', function () {
    var body = Buffer.concat(chunks).toString();
    var opts = url.parse(targetUrl);
    opts.method = 'POST';
    opts.headers = {
      'Content-Type': req.headers['content-type'] || 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    };

    var lib = opts.protocol === 'https:' ? https : http;
    var proxyReq = lib.request(opts, function (proxyRes) {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', function (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    });
    proxyReq.end(body);
  });
});

server.listen(PORT, '127.0.0.1', function () {
  console.log('Прокси запущен: http://127.0.0.1:' + PORT);
  console.log('Откройте сайт через Live Server и отправляйте анкету.');
});
