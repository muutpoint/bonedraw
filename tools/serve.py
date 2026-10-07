"""Local dev server with caching off, so edits show up on reload.  python3 tools/serve.py [port]  (or PORT=...)"""
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8766))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
