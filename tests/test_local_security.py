import http.client
import json
import tempfile
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
import local_security as security


class Handler(security.SecureLocalMixin, SimpleHTTPRequestHandler):
    def do_GET(self):
        if not self.security_get():
            super().do_GET()
    def handle_post(self):
        data = self.rfile.read(int(self.headers['Content-Length']))
        self.send_response(200)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def log_message(self, *args):
        pass


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        (root/'index.html').write_text('<html><head></head><body>lab</body></html>')
        (root/'.env').write_text('not-a-real-secret')
        (root/'private.txt').write_text('not-public')
        (root/'static-files.json').write_text(json.dumps(['index.html']))
        self.httpd = security.BoundedHTTPServer(('127.0.0.1',0), partial(Handler,directory=str(root)))
        self.thread = threading.Thread(target=self.httpd.serve_forever,daemon=True)
        self.thread.start()
        self.port = self.httpd.server_address[1]
    def tearDown(self):
        self.httpd.shutdown(); self.httpd.server_close(); self.thread.join(3); self.temp.cleanup()
    def request(self, method='GET', path='/', headers=None, body=None):
        conn = http.client.HTTPConnection('127.0.0.1',self.port,timeout=5)
        conn.request(method,path,body=body,headers=headers or {})
        response = conn.getresponse(); result=(response.status,response.read(),dict(response.getheaders()))
        conn.close(); return result
    def authenticated(self):
        status, body, _ = self.request(path='/api/security-token')
        self.assertEqual(status,200)
        return {'Content-Type':'application/json','X-Local-CSRF':json.loads(body)['token']}
    def test_frontend_and_token(self):
        self.assertIn(b'local-api-security.js',self.request()[1])
        self.assertEqual(self.request('POST','/api/solve',self.authenticated(),b'{}')[0],200)
    def test_reject_foreign_origins_and_hosts(self):
        for headers in ({'Host':'attacker.example'}, {'Origin':'https://attacker.example'}, {'Origin':'null'}, {'Sec-Fetch-Site':'cross-site'}):
            self.assertEqual(self.request(path='/api/security-token',headers=headers)[0],403)
    def test_reject_cross_origin_even_with_token(self):
        headers=self.authenticated(); headers['Origin']='https://attacker.example'
        self.assertEqual(self.request('POST','/api/solve',headers,b'{}')[0],403)
    def test_reject_unprotected_posts(self):
        self.assertEqual(self.request('POST','/api/solve',{'Content-Type':'text/plain'},b'{}')[0],415)
        self.assertEqual(self.request('POST','/api/solve',{'Content-Type':'application/json'},b'{}')[0],403)
    def test_reject_oversized_and_chunked(self):
        headers=self.authenticated(); headers['Content-Length']=str(security.MAX_BODY+1)
        self.assertEqual(self.request('POST','/api/solve',headers)[0],413)
        headers=self.authenticated(); headers['Transfer-Encoding']='chunked'
        self.assertEqual(self.request('POST','/api/solve',headers,b'{}')[0],400)
    def test_deny_private_files_head_and_traversal(self):
        for path in ('/.env','/private.txt','/.git/config','/%2eenv','/../.env','/%252eenv','/static-files.json'):
            for method in ('GET','HEAD'):
                self.assertEqual(self.request(method,path)[0],404, path)
    def test_parallel_jobs_are_bounded(self):
        security.JOBS.acquire(); security.JOBS.acquire()
        try:
            self.assertEqual(self.request('POST','/api/solve',self.authenticated(),b'{}')[0],503)
        finally:
            security.JOBS.release(); security.JOBS.release()

if __name__ == '__main__':
    unittest.main()
