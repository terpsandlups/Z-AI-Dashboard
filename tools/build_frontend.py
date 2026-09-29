"""Gera somente arquivos públicos. Nunca copia data/ ou credenciais administrativas."""
import json
import os
from pathlib import Path
import shutil
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[1]
url = os.environ.get('SUPABASE_URL', '').rstrip('/')
key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '')
parsed = urlsplit(url)
if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
    raise SystemExit('Configure SUPABASE_URL com a URL HTTPS pública do projeto.')
if not key.startswith('sb_publishable_') or len(key) < 20:
    raise SystemExit('Configure SUPABASE_PUBLISHABLE_KEY. Apenas chave publishable é aceita.')
dest = root / 'dist'
if dest.exists():
    shutil.rmtree(dest)
shutil.copytree(root/'web', dest, ignore=shutil.ignore_patterns('config.js', 'config.example.js'))
(dest/'config.js').write_text('window.ZAI_CONFIG = '+json.dumps(
    {'supabaseUrl': url, 'publishableKey': key})+';\n', encoding='utf-8')
print('Frontend gerado em dist/. Nenhum dado operacional incluído.')
