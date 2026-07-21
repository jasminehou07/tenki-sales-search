from pathlib import Path

config_path = Path("/etc/nginx/sites-enabled/tenki-dashboard-api")
text = config_path.read_text()

old = """    location / {
        return 200 'TENKI dashboard API is running. Use /health or /api/.\\n';
        add_header Content-Type text/plain;
    }"""

new = """    location / {
        root /opt/tenki-dashboard/site-data;
        index index.html;
        try_files $uri $uri/ /index.html;
    }"""

if new in text:
    print("dashboard_site_already_enabled")
elif old in text:
    backup_path = config_path.with_name("tenki-dashboard-api.bak-serve-site")
    backup_path.write_text(text)
    config_path.write_text(text.replace(old, new, 1))
    print("dashboard_site_enabled")
else:
    raise SystemExit("expected_nginx_location_block_not_found")
