#!/usr/bin/env bash
#
# Render jwel.conf.template into an installable nginx config.
#
#   ./render.sh <apex-domain> <api-domain> > /tmp/jwel.conf
#   ./render.sh whisperingorion.dev api.whisperingorion.dev > /tmp/jwel.conf
#
# Then: sudo cp /tmp/jwel.conf /etc/nginx/sites-available/main
#       sudo nginx -t && sudo systemctl reload nginx
#
# Writes to stdout deliberately — rendering straight into sites-available would
# overwrite a working config before `nginx -t` has had a chance to reject the
# new one.

set -euo pipefail

APEX_DOMAIN=${1:-}
API_DOMAIN=${2:-}

if [[ -z $APEX_DOMAIN || -z $API_DOMAIN ]]; then
    echo "usage: $0 <apex-domain> <api-domain>" >&2
    echo "example: $0 example.com api.example.com" >&2
    exit 64
fi

# Bare hostnames only. A pasted "https://example.com/" substitutes into
# server_name and ssl_certificate paths and produces an nginx config that fails
# to parse in a way that does not obviously point back to this script.
for d in "$APEX_DOMAIN" "$API_DOMAIN"; do
    if [[ $d =~ ^https?:// || $d == */* || $d == *:* ]]; then
        echo "error: '$d' must be a bare hostname — no scheme, port or path." >&2
        exit 64
    fi
    if [[ ! $d =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ || $d != *.* ]]; then
        echo "error: '$d' does not look like a domain name." >&2
        exit 64
    fi
done

template=$(dirname "$(readlink -f "$0")")/jwel.conf.template

# The explicit variable list is not optional. Bare `envsubst` replaces EVERY
# $NAME it finds, which in an nginx config means $uri, $host, $scheme,
# $remote_addr and $proxy_add_x_forwarded_for all get replaced with empty
# strings — producing a config that still parses but silently breaks proxying
# and serves the wrong files. Naming the two variables limits it to those.
APEX_DOMAIN="$APEX_DOMAIN" API_DOMAIN="$API_DOMAIN" \
    envsubst '${APEX_DOMAIN} ${API_DOMAIN}' < "$template"
