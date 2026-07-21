from pathlib import Path


SERVER = Path("/opt/tenki-dashboard/api/server.js")
text = SERVER.read_text()

old = """app.get('/api/data/all-time/ranked_shops_latest.csv', async (_req, res) => {
  const modelVersion = await latestModelVersion('dashboard_genre_rank_daily');
"""

new = """app.get('/api/data/all-time/ranked_shops_latest.csv', async (_req, res) => {
  const csvPath = path.join(CSV_DATA_ROOT, 'all-time', 'ranked_shops_latest.csv');
  if (csvPath.startsWith(CSV_DATA_ROOT) && fs.existsSync(csvPath)) {
    res.type('text/csv');
    return res.sendFile(csvPath);
  }

  const modelVersion = await latestModelVersion('dashboard_genre_rank_daily');
"""

if new in text:
    raise SystemExit("all-time ranked_shops_latest route already serves static CSV first")
if old not in text:
    raise SystemExit("Could not find all-time ranked_shops_latest route to patch")

SERVER.write_text(text.replace(old, new))
print("patched all-time ranked_shops_latest route")
