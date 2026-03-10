# -*- coding: utf-8 -*-
"""
Локальный прокси для обхода CORS при отправке анкеты на Google Apps Script.
Запуск: python proxy-server.py
Затем откройте сайт через Live Server и отправляйте форму.
"""
import urllib.request
import urllib.error
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3456


class ProxyHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        target = self.headers.get('X-Forward-To', '')
        if not target.startswith('https://'):
            self.send_error(400, 'Missing or invalid X-Forward-To header')
            return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else b''
        try:
            req = urllib.request.Request(
                target,
                data=body,
                method='POST',
                headers={
                    'Content-Type': self.headers.get('Content-Type', 'application/x-www-form-urlencoded'),
                }
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(resp.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Forward-To')
        self.end_headers()


def main():
    server = HTTPServer(('127.0.0.1', PORT), ProxyHandler)
    print('Прокси запущен: http://127.0.0.1:' + str(PORT))
    print('Откройте сайт через Live Server и отправляйте анкету.')
    server.serve_forever()


if __name__ == '__main__':
    main()
