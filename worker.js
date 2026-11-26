const AVIARY_ORIGIN = "https://aviary.herebox.org";
const SLNC_ORIGIN = "https://here.github.io";
const SLNC_SOURCE_PATH = "/lax-slnc-transpo";
const AVIARY_ASSET = /^\/(?:$|index\.html$|datapackage\.json$|(?:maps|data|corridors)(?:\/|$))/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = url.pathname.split("/", 2)[1];
    if (prefix !== "lax" && prefix !== "slnc") {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const mountPath = "/" + prefix;
    if (url.pathname === mountPath) {
      url.pathname += "/";
      return Response.redirect(url, 308);
    }

    const isSlnc = prefix === "slnc";
    const sourcePath = isSlnc ? SLNC_SOURCE_PATH : "";
    const upstream = new URL(isSlnc ? SLNC_ORIGIN : AVIARY_ORIGIN);
    upstream.pathname = sourcePath + url.pathname.slice(mountPath.length);
    upstream.search = url.search;
    if (!isSlnc && !AVIARY_ASSET.test(upstream.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    for (const name of ["range", "if-range", "if-none-match", "if-modified-since"]) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    const response = await fetch(upstream, { method: request.method, headers, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      const target = new URL(location, upstream);
      if (target.origin === upstream.origin && target.pathname.startsWith(sourcePath + "/")) {
        url.pathname = mountPath + target.pathname.slice(sourcePath.length);
        url.search = target.search;
        url.hash = target.hash;
        const redirect = new Response(response.body, response);
        redirect.headers.set("location", url.href);
        return redirect;
      }
    }
    return response;
  },
};
