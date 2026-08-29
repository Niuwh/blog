export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const CLIENT_ID = env.GITHUB_CLIENT_ID;
    const CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;

    // ===== 诊断端点 =====
    if (url.pathname === '/api/auth/diag') {
        return new Response(JSON.stringify({
            client_id_loaded: Boolean(CLIENT_ID),
            client_secret_loaded: Boolean(CLIENT_SECRET),
            env_origin: url.origin,           // 关键：跟 Decap CMS 同源
        }, null, 2), { headers: { 'Content-Type': 'text/plain' } });
    }

    if (url.pathname !== '/api/auth') {
        return new Response('Not Found', { status: 404 });
    }

    const code = url.searchParams.get('code');

    // ===== Step 1: 没有 code → 跳 GitHub =====
    if (!code) {
        const redirectUri = url.origin + '/api/auth';
        return Response.redirect(
            'https://github.com/login/oauth/authorize' +
            '?client_id=' + encodeURIComponent(CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(redirectUri) +
            '&scope=repo,user' +
            '&state=netlify-cms',
            302
        );
    }

    // ===== Step 2: 有 code → 拿 token =====
    let tokenRes, rawText, data;
    try {
        tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'decap-cms-oauth-pages-function',
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
            }),
        });
        rawText = await tokenRes.text();
        data = JSON.parse(rawText);
    } catch (err) {
        return new Response(
            '<pre style="color:red;background:#1a1a1a;padding:20px;">fetch error: ' + err.message + '</pre>',
            { status: 500, headers: { 'Content-Type': 'text/html' } }
        );
    }

    if (data.error || !data.access_token) {
        return new Response(
            '<pre style="color:red;background:#1a1a1a;padding:20px;">Token exchange failed: ' +
            JSON.stringify(data, null, 2) + '</pre>',
            { status: 400, headers: { 'Content-Type': 'text/html' } }
        );
    }

    const token = data.access_token;
    const tokenJson = JSON.stringify(token);

    // ===== Step 3: 同源 postMessage 回 Decap CMS =====
    return new Response(`<!DOCTYPE html><html><body style="background:#1f2229;color:#0f0;font-family:monospace;padding:20px;">
  <h3>OAuth (Same-Origin) — token received</h3>
  <script>
  (function() {
    var token = ${tokenJson};
    var opener = window.opener;
    function done() {
      if (!opener) {
        document.body.innerHTML += '<p style="color:red;">window.opener is null</p>';
        return;
      }
      opener.postMessage({
        type: 'authorization',
        token: token,
        provider: 'github'
      }, '*');
      document.body.innerHTML += '<p>Sent. Closing...</p>';
      setTimeout(function() { window.close(); }, 200);
    }
    // 立即发, 同源下没有 CSP / 跨域问题
    done();
  })();
  </script>
  </body></html>`, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}