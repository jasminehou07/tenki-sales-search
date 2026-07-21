from pathlib import Path


path = Path("/opt/tenki-dashboard/api/server.js")
text = path.read_text()

old = "if (!bounds || !/^(all|\\d+)$/.test(genreParam)) return res.status(400).send('bad_request\\n');"
new = "if (!bounds || !/^(all|all-items|\\d+)$/.test(genreParam)) return res.status(400).send('bad_request\\n');"

if old not in text and new not in text:
    raise SystemExit("rank genre validation pattern not found")

if old in text:
    path.write_text(text.replace(old, new, 1))
