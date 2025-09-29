#!/usr/bin/env python3
import os
import sys
import requests

def main():
    if len(sys.argv) < 2:
        print("Usage: python purge_thumbnail.py <url>")
        sys.exit(1)

    url = sys.argv[1]
    token = os.getenv("ADMIN_TOKEN")
    if not token:
        print("Error: ADMIN_TOKEN is not set in environment")
        sys.exit(1)

    # Add purge=1 to query string
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    qs["purge"] = ["1"]
    new_query = urlencode(qs, doseq=True)
    purge_url = urlunparse(parsed._replace(query=new_query))

    print(f"Purging: {purge_url}")

    resp = requests.get(purge_url, headers={"Authorization": f"Bearer {token}"})
    print(f"Status: {resp.status_code}")
    print(resp.text)

if __name__ == "__main__":
    main()

