export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;

    // CORS preflight for /proxy/*
    if (request.method === "OPTIONS" && p.startsWith("/proxy/")) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": url.origin,
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,x-admin,x-device-id,x-session-id,x-master-bypass,x-api-key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Proxy /proxy/* to backend
    if (p.startsWith("/proxy/")) {
      const backendUrl = env.BACKEND_URL;
      const apiKey = env.BACKEND_API_KEY;
      if (!backendUrl) {
        return new Response(JSON.stringify({ success: false, error: "BACKEND_URL not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      const backendPath = p.replace(/^\/proxy/, "") || "/";
      const targetUrl = backendUrl.replace(/\/$/, "") + backendPath + url.search;
      const headers = new Headers(request.headers);
      if (apiKey) headers.set("x-api-key", apiKey);
      headers.delete("origin");
      headers.delete("host");
      const isBodyMethod = !["GET", "HEAD", "OPTIONS"].includes(request.method);
      try {
        const upstream = await fetch(targetUrl, {
          method: request.method,
          headers,
          body: isBodyMethod ? request.body : undefined,
        });
        const respHeaders = new Headers(upstream.headers);
        respHeaders.set("Access-Control-Allow-Origin", url.origin);
        respHeaders.set("Access-Control-Allow-Credentials", "true");
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: respHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: "proxy_error", detail: String(err) }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Everything else: serve static assets (SPA)
    return env.ASSETS.fetch(request);
  },
};
