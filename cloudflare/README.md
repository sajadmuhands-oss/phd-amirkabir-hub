# Cloudflare binding — Research Track

Verified zone from project config / `.env.cloudflare`: **`ol-ui-ac.net`**

| App | Public URL |
|-----|------------|
| PhD hub (existing) | `https://ol-ui-ac.net/sajad_phd/` |
| Research Track (this) | **`https://research.ol-ui-ac.net/`** |

Chosen subdomain: **`research.ol-ui-ac.net`** (not inventing a zone; matches the existing Cloudflare zone and keeps Research Track off the `/sajad_phd` path).

## What the Worker does

`research-track-proxy.js` reverse-proxies all paths on `research.ol-ui-ac.net` to the Worker secret `ORIGIN` (same pattern as `sajad-phd-proxy.js`).

## DNS record (zone `ol-ui-ac.net`)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| `CNAME` | `research` | `ol-ui-ac.pages.dev` *(or any proxied CF target)* **or** `<tunnel-id>.cfargotunnel.com` if using a named Tunnel | Proxied (orange cloud) |

A proxied record is required so the Worker route `research.ol-ui-ac.net/*` can match.

## Worker route

| Pattern | Script |
|---------|--------|
| `research.ol-ui-ac.net/*` | `research-track` |

## `ORIGIN` secret

Point `ORIGIN` at a reachable HTTPS upstream **without** a trailing slash:

1. **Preferred (stable):** hosted Research Track origin after its `NEXTAUTH_URL` is `https://research.ol-ui-ac.net`
2. **Dev / agent VM:** Cloudflare quick/named tunnel to `http://127.0.0.1:3000`

Named Tunnel creation needs a Cloudflare API token with **Cloudflare Tunnel:Edit**. The token in `.env.cloudflare` can manage DNS + Workers but returned `403` on tunnel create — grant Tunnel edit (or create the tunnel in the Zero Trust dashboard) then:

```bash
cloudflared tunnel create research-track
cloudflared tunnel route dns research-track research.ol-ui-ac.net
# ingress -> http://127.0.0.1:3000
cloudflared tunnel run research-track
```

## App env

```env
NEXTAUTH_URL="https://research.ol-ui-ac.net"
APP_URL="https://research.ol-ui-ac.net"
```

Login path: **`https://research.ol-ui-ac.net/login`**

## Deploy commands

```bash
# from repo root (requires CLOUDFLARE_API_TOKEN + account access)
npx wrangler deploy --config cloudflare/wrangler.research-track.toml
npx wrangler secret put ORIGIN --config cloudflare/wrangler.research-track.toml
# paste https://<upstream>
```

Or use the Cloudflare API (Workers upload + secrets + routes) as automated by the bind agent.
