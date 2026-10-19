# Local test server with HTTP Range support, so the browser can seek in videos.
import http.server, os, re, sys

class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        match = re.match(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        path = self.translate_path(self.path)
        if not match or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start = int(match.group(1) or 0)
        end = min(int(match.group(2) or size - 1), size - 1)
        f = open(path, 'rb')
        f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        self.range_left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, 'range_left', None)
        if left is None:
            return super().copyfile(source, outputfile)
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk:
                break
            try:
                outputfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break
            left -= len(chunk)

http.server.ThreadingHTTPServer(('', int(sys.argv[1])), RangeHandler).serve_forever()
