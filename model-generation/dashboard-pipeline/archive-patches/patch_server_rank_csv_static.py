from pathlib import Path

path = Path("/opt/tenki-dashboard/api/server.js")
text = path.read_text()

if "const fs = require('fs');" not in text:
    text = text.replace(
        "const compression = require('compression');\n",
        "const compression = require('compression');\nconst fs = require('fs');\nconst path = require('path');\n",
        1,
    )

if "const CSV_DATA_ROOT = '/opt/tenki-dashboard/site-data/data';" not in text:
    text = text.replace(
        "const corsOrigins = new Set((process.env.CORS_ORIGIN || 'https://jasminehou07.github.io').split(',').map((origin) => origin.trim()).filter(Boolean));\n",
        "const corsOrigins = new Set((process.env.CORS_ORIGIN || 'https://jasminehou07.github.io').split(',').map((origin) => origin.trim()).filter(Boolean));\n"
        "const CSV_DATA_ROOT = '/opt/tenki-dashboard/site-data/data';\n",
        1,
    )

old = """app.get('/api/data/ranked-shops-by-genre/:genre/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  const genreId = intParam(req.params.genre);
  if (!bounds || !genreId) return res.status(400).send('bad_request\\n');
  const modelVersion = await latestModelVersion('dashboard_genre_rank_daily');
  return csvQuery(res, `
"""

new = """app.get('/api/data/ranked-shops-by-genre/:genre/:month.csv', async (req, res) => {
  const bounds = monthBounds(req.params.month);
  const genreParam = String(req.params.genre || '');
  if (!bounds || !/^(all|\\d+)$/.test(genreParam)) return res.status(400).send('bad_request\\n');

  const csvPath = path.join(CSV_DATA_ROOT, 'ranked-shops-by-genre', genreParam, `${req.params.month}.csv`);
  if (csvPath.startsWith(CSV_DATA_ROOT) && fs.existsSync(csvPath)) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.sendFile(csvPath);
  }

  const genreId = intParam(req.params.genre);
  if (!genreId) return res.status(400).send('bad_request\\n');
  const modelVersion = await latestModelVersion('dashboard_genre_rank_daily');
  return csvQuery(res, `
"""

if old not in text:
    raise SystemExit("rank route start pattern not found")

path.write_text(text.replace(old, new, 1))
