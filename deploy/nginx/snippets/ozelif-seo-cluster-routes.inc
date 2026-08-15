# OZELIF live Commercial SEO cluster routes.
# Canonical exact-route source for the public HTTPS vhost.
# Stored as .inc in a subdirectory to avoid generic *.conf glob loading.

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

location = /odejnayakozha/gladkaya {
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

location = /odejnayakozha/fakturnaya {
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

location = /zamsha/gladkaya {
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

location = /zamsha/gladkaya/ {
    return 301 /zamsha/gladkaya;
}
