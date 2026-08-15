# OZELIF Deployment Notes

## Production server

Host: `13.143.130.116`
Domain: `https://ozelifkoja.ru`
Project: `/opt/ozelif-website`
Frontend web root: `/var/www/ozelif-8091`
API: `127.0.0.1:8093`
Systemd: `ozelif-admin-api`

## Standard frontend validation

From `/opt/ozelif-website`:
    npm run typecheck
    npm test
    npm run build

Do not deploy when any of these steps fail.

## Standard frontend publish

After successful validation:
    rsync -a --delete dist/ /var/www/ozelif-8091/
    chown -R www-data:www-data /var/www/ozelif-8091

Always make a production backup before destructive `rsync --delete`.

## API restart

When backend or dynamic sitemap code changes:
    systemctl restart ozelif-admin-api

Health:
    curl -fsS http://127.0.0.1:8093/api/health

## Important

Never store production `.env.admin` in Git.

Do not change ports, firewall, nginx upstreams or PostgreSQL networking
unless the task explicitly requires an infrastructure change.
