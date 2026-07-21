# TENKI deployment artifacts

This directory preserves the recovered production deployment configuration:

- `server/nginx-tenki-dashboard.conf` serves the static dashboard at the
  sslip.io HTTPS origin and proxies API/health requests to the local Node API.
- `server/tenki-dashboard-api.service` is the recovered systemd unit for the
  Node API.

These files are snapshots for reconstruction and review. They intentionally
retain the production paths and internal upstream configuration observed during
the audit. Do not install them blindly on a different host.

The public dashboard origin is:

```text
https://172.237.20.132.sslip.io/
```

The real server `.env`, TLS private key, database credentials, SSH password, and
API keys are not included. Runtime values must be provisioned separately with
restricted permissions.

Before installing or restarting:

1. Compare the live server files with these snapshots.
2. Confirm the API listen address matches nginx's upstream.
3. Validate nginx configuration before reload.
4. Confirm PostgreSQL is available and the protected environment file exists.
5. Check `/health` through the sslip.io HTTPS origin after restart.

See `../docs/audit/TENKI_SERVER_DATABASE_AUDIT.md` for observed server state and
known operational risks, and `../model-generation/PIPELINE_FLOW.md` for the full
data/model/database flow.
