/**
 * Reverse-proxy Worker: https://research.ol-ui-ac.net/* -> ORIGIN/*
 *
 * Zone (verified): ol-ui-ac.net
 * Public host: research.ol-ui-ac.net
 *
 * Set Worker secret ORIGIN to the upstream HTTPS origin (no trailing slash), e.g.:
 *   - Cloudflare Tunnel URL for a local/dev Next.js process
 *   - Hosted app origin once NEXTAUTH_URL is set to https://research.ol-ui-ac.net
 *
 * DNS (proxied CNAME) must exist for research.ol-ui-ac.net so this route can match.
 */
export default {
  async fetch(request, env) {
    const origin = (env.ORIGIN || "").replace(/\/$/, "");
    if (!origin) {
      return new Response("ORIGIN not configured", { status: 500 });
    }

    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, origin + "/");
    const headers = new Headers(request.headers);
    headers.set("Host", new URL(origin).host);
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    headers.delete("accept-encoding");

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    const upstream = await fetch(new Request(target.toString(), init));
    const outHeaders = new Headers(upstream.headers);
    const loc = outHeaders.get("Location");
    if (loc) {
      try {
        const locUrl = new URL(loc, origin);
        const originHost = new URL(origin).host;
        if (locUrl.host === originHost || locUrl.host === url.host) {
          outHeaders.set(
            "Location",
            url.origin + locUrl.pathname + locUrl.search + locUrl.hash
          );
        }
      } catch (_) {}
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  },
};
