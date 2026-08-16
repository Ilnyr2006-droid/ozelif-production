# OZELIF public canonical path normalization.
# Remove a trailing slash from public HTML URLs before location selection.
# API/admin/static-resource namespaces are excluded deliberately.
rewrite ^/(?!api(?:/|$)|admin(?:/|$)|assets(?:/|$)|uploads(?:/|$)|images(?:/|$)|\.well-known(?:/|$))(.+)/$ /$1 permanent;
