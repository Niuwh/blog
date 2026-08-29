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
            env_origin: url.origin,
        }, null, 2), { headers: { 'Content-Type': 'text/plain' } });
    }

    if (url.pathname !== '/api/auth') {
        return new Response('Not Found', { status: 404 });
    }

    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state') || 'netlify-cms';

    // ===== Step 1: 没有 code → 跳 GitHub (透传 state) =====
    if (!code) {
        const redirectUri = url.origin + '/api/auth';
        return Response.redirect(
            'https://github.com/login/oauth/authorize' +
            '?client_id=' + encodeURIComponent(CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(redirectUri) +
            '&scope=repo,user' +
            '&state=' + encodeURIComponent(stateParam),
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

    // ===== Step 3: 用 Decap CMS 3.x 真实协议 (字符串握手) =====
    // 协议:
    //   1. popup → opener:  postMessage('authorizing:github', '*')
    //   2. Decap CMS → popup 回某个 ack
    //   3. popup → opener:  postMessage('authorization:github:success:' + JSON.stringify(payload), message.origin || '*')
    return new Response(`<!DOCTYPE html><html><body style="background:#1f2229;color:#0f0;font-family:monospace;padding:20px;">
<h3>OAuth (Decap 3.x string protocol)</h3>
<pre id="log">starting...</pre>
<script>
(function() {
  var token = ${tokenJson};
  var opener = window.opener;
  var log = document.getElementById('log');

  function add(msg) {
    log.textContent += '\\n' + msg;
    console.log('[popup] ' + msg);
  }

  if (!opener) {
    add('ERROR: window.opener is NULL');
    return;
  }
  add('window.opener exists');

  var acked = false;

  function sendToken(targetOrigin) {
    var payload = {
      token: token,
      provider: 'github'
    };
    add('-> sending authorization:github:success:' + payload.token.substring(0, 6) + '... (targetOrigin=' + targetOrigin + ')');
    opener.postMessage(
      'authorization:github:success:' + JSON.stringify(payload),
      targetOrigin
    );
    add('Sent. Will close popup in 300ms.');
    setTimeout(function() { window.close(); }, 300);
  }

  // 监听来自 opener (Decap CMS) 的消息
  window.addEventListener('message', function(event) {
    add('<- received from source=' + (event.source === opener ? 'opener' : 'other') + ' origin=' + event.origin + ' data=' + JSON.stringify(event.data));
    // 只接受来自 Decap CMS 的回信
    if (event.source !== opener) return;
    acked = true;
    // 用回信的 origin 作为 targetOrigin (更安全)
    sendToken(event.origin);
  });

  // Step 1: 通知 Decap CMS 我们准备好了
  add('-> sending authorizing:github');
  opener.postMessage('authorizing:github', '*');

  // Fallback: 2 秒后还没收到 opener 回信, 直接发 (兼容老版本 Decap CMS)
  setTimeout(function() {
    if (!acked) {
      add('!! no ack from opener in 2s, sending authorization directly as fallback');
      sendToken('*');
    }
  }, 2000);
})();
</script>
</body></html>`, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}
