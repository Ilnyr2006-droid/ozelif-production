# Production deployment

This runbook describes the OZELIF deployment currently used on the server. It keeps configuration in the repository without storing secrets.

## Components

- Nginx serves the Vite build from `/var/www/ozelif-8091` on port `8091`.
- Nginx proxies API and uploads to the loopback-only Node API at `127.0.0.1:8093`.
- `ozelif-admin-api.service` runs `/opt/ozelif-admin/server/index.mjs` as the dedicated `ozelif-admin` user.
- PostgreSQL runs in the `ozelif-admin-postgres` Docker container and is bound to loopback only.
- Secrets stay in `/opt/ozelif-admin/.env.admin`; never copy that file into the repository or a release archive.

The tracked templates are:

- `ops/production/ozelif-8091.nginx.conf`;
- `ops/production/ozelif-admin-api.service`;
- `ops/production/deployment.example.env`.

Run `npm run deploy:check` before a release. It verifies the safety-critical parts of the tracked templates.

## Frontend release

1. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` locally.
2. Archive the generated `dist/` directory; do not deploy an unbuilt source tree.
3. On the server, extract it to a timestamped staging directory under `/var/www/`.
4. Verify `index.html` and any newly referenced static assets in staging.
5. Rename the current `/var/www/ozelif-8091` directory to a timestamped rollback directory, then rename staging to `/var/www/ozelif-8091`.
6. Smoke-test `/`, a deep SPA route and the new asset URLs through port `8091`.

The previous directory is the frontend rollback point. Do not remove it until the release is accepted.

## Backend release

1. Back up the selected backend files and PostgreSQL with `pg_dump` from the Docker container.
2. Upload only the reviewed backend release files. Do not upload `.env.admin`, `uploads/` or `node_modules/`.
3. Run syntax checks and server tests before restarting the service.
4. Apply pending SQL migrations with `cd /opt/ozelif-admin/server && node scripts/migrate.mjs`.
5. Restart with `systemctl restart ozelif-admin-api` and verify `systemctl is-active ozelif-admin-api`.
6. Verify `/api/health`, the changed endpoint and recent `journalctl -u ozelif-admin-api` output.

## Configuration changes

Before replacing a live Nginx or systemd configuration:

1. Copy the active file to a timestamped backup on the server.
2. Install the tracked template.
3. Run `nginx -t` before `systemctl reload nginx`.
4. Run `systemctl daemon-reload` before restarting the API after a unit-file change.
5. Keep the old file until health and public smoke checks succeed.

The admin routes are intentionally loopback-only. Access them with an SSH tunnel; do not open `/admin` or `/api/admin/*` publicly as part of a routine release.
