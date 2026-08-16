# OZELIF optimized exact homepage route.
# Keep the existing no-cache/security behavior while serving home-cwv.html.
location = / {
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    include /etc/nginx/snippets/ozelif-security-headers.conf;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Ozelif-Home-CWV "1" always;
    try_files /home-cwv.html =404;
}
