/**
 * Reverse-proxy Worker: https://ol-ui-ac.net/sajad_phd/* -> ORIGIN/sajad_phd/*
 * Set ORIGIN to the Uppcoder HTTPS hostname (no trailing slash).
 */
const PREFIX = "/sajad_phd";

export default {
  async fetch(request, env) {
    const origin = (env.ORIGIN || "").replace(/\/$/, "");
    if (!origin) {
      return new Response("ORIGIN not configured", { status: 500 });
    }

    const url = new URL(request.url);
    if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + "/")) {
      return fetch(request);
    }

    const target = new URL(url.pathname + url.search, origin + "/");
    const headers = new Headers(request.headers);
    headers.set("Host", new URL(origin).host);
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    headers.set("X-Forwarded-Prefix", PREFIX);

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
        if (locUrl.origin === new URL(origin).origin) {
          outHeaders.set("Location", url.origin + locUrl.pathname + locUrl.search);
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
