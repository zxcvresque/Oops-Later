from flask import Flask, send_from_directory, send_file
import os
import sys

app = Flask(__name__, static_folder='.')

@app.route('/')
def index():
    response = send_file('index.html')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/css/<path:filename>')
def serve_css(filename):
    response = send_from_directory('css', filename)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/js/<path:filename>')
def serve_js(filename):
    response = send_from_directory('js', filename)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    
    if sys.platform == 'win32' or os.environ.get('USE_WAITRESS'):
        from waitress import serve
        print(f'Starting production server with Waitress on http://0.0.0.0:{port}')
        serve(app, host='0.0.0.0', port=port)
    else:
        print(f'Starting development server on http://0.0.0.0:{port}')
        app.run(host='0.0.0.0', port=port)
