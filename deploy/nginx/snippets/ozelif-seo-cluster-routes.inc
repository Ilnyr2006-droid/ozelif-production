# OZELIF live Commercial SEO cluster routes.
# This file intentionally uses .inc under a subdirectory so generic
# deploy/nginx/*.conf globs cannot load it a second time.
# Exact matches outrank the static SPA try_files handler.

location = /odejnayakozha/krs {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}

location = /odejnayakozha/perforirovannaya {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}

location = /odejnayakozha/vintazhnaya {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}

location = /odejnayakozha/nappa {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}

location = /dublyonka/kerli {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}

location = /dublyonka/toskana {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}

location = /dublyonka/merinos {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}

location = /dublyonka/tigrado {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}

location = /furnitura/ykk {
    proxy_pass http://127.0.0.1:8093;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Ozelif-SEO-Cluster "express-live" always;
}
