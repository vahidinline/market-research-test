const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildMessage = ({ projectName, panelUrl, ownerName }) => {
  const safeProjectName = escapeHtml(projectName || 'گزارش تحقیق بازار');
  const safeUrl = escapeHtml(panelUrl || '');
  const safeOwnerName = escapeHtml(ownerName || 'همراه گرامی');
  const html = `
    <div dir="rtl" style="direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif;line-height:2;color:#173139;background:#f3f7f6;padding:32px 16px">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d4e3df;border-radius:16px;overflow:hidden">
        <div style="background:#123238;color:#d9f2d0;padding:20px 28px;font-size:13px;letter-spacing:.3px">MARKET RESEARCH · گزارش اختصاصی شما</div>
        <div style="padding:30px 28px">
          <h1 style="margin:0 0 18px;font-size:24px;line-height:1.5;color:#102a30">${safeOwnerName} عزیز،</h1>
          <p style="margin:0 0 16px">گزارش تحقیق بازار <strong style="color:#0f766e">${safeProjectName}</strong> آماده شده است.</p>
          <p style="margin:0 0 24px;color:#456168">از طریق لینک اختصاصی زیر می‌توانید گزارش را در هر زمان مشاهده کنید.</p>
          <p style="margin:0 0 22px"><a href="${safeUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:bold">مشاهده گزارش</a></p>
          <p style="margin:0;color:#6b8083;font-size:12px;line-height:1.8">این لینک فقط برای شما ایجاد شده است. اگر انتظار دریافت این ایمیل را نداشتید، آن را نادیده بگیرید.</p>
        </div>
      </div>
    </div>`;
  const text = `${ownerName || 'همراه گرامی'} عزیز،\n\nگزارش تحقیق بازار «${projectName || 'گزارش تحقیق بازار'}» آماده شده است.\nبرای مشاهده گزارش از لینک اختصاصی زیر استفاده کنید:\n${panelUrl || ''}\n\nاین لینک فقط برای شما ایجاد شده است.`;
  return { html, text };
};

const toBase64 = (value) => btoa(unescape(encodeURIComponent(value)));

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function getAccessToken(env) {
  // A static API key is the simplest option. Client credentials are supported too,
  // because SendPulse's older integrations commonly provide these two values.
  const apiKey = env.SENDPULSE_API_KEY || env.SENDPULSE_TOKEN;
  if (apiKey) return apiKey;

  const clientId = env.SENDPULSE_CLIENT_ID || env.SENDPULSE_API_ID;
  const clientSecret = env.SENDPULSE_CLIENT_SECRET || env.SENDPULSE_API_SECRET;
  if (!clientId || !clientSecret) return null;

  const tokenResponse = await fetch(
    'https://api.sendpulse.com/oauth/access_token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
  );
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error(
      '[send-invite] SendPulse authorization failed',
      tokenResponse.status,
      tokenData,
    );
    throw new Error(
      tokenData?.error_description ||
        tokenData?.message ||
        'SendPulse authorization failed.',
    );
  }
  return tokenData.access_token;
}

export async function onRequestPost({ request, env }) {
  console.info('[send-invite] request received');
  const fromEmail = env.SENDPULSE_FROM_EMAIL || 'info@roxiapp.online';
  const fromName = env.SENDPULSE_FROM_NAME || 'Roxi App';
  const body = await request.json().catch(() => null);
  const ownerEmail = String(body?.ownerEmail || '')
    .trim()
    .toLowerCase();
  const ownerName = String(body?.ownerName || '').trim();
  const projectName = String(body?.projectName || '').trim();
  const panelUrl = String(body?.panelUrl || '').trim();
  if (!ownerEmail || !panelUrl)
    return json({ error: 'ownerEmail and panelUrl are required.' }, 400);
  if (!isEmail(ownerEmail))
    return json({ error: 'مالک گزارش باید یک ایمیل معتبر داشته باشد.' }, 400);

  let accessToken;
  try {
    accessToken = await getAccessToken(env);
  } catch (error) {
    return json(
      { error: error.message || 'SendPulse authorization failed.' },
      502,
    );
  }
  if (!accessToken) {
    console.error('[send-invite] missing SendPulse credentials');
    return json(
      {
        error:
          'SendPulse is not configured. Set SENDPULSE_API_KEY or SENDPULSE_CLIENT_ID and SENDPULSE_CLIENT_SECRET.',
      },
      503,
    );
  }

  const { html, text } = buildMessage({ projectName, panelUrl, ownerName });
  const response = await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: {
        subject: `${ownerName ? `${ownerName} عزیز، ` : ''}گزارش تحقیق بازار شما آماده است`,
        html: toBase64(html),
        text,
        from: { name: fromName, email: fromEmail },
        to: [{ email: ownerEmail, name: ownerName || ownerEmail }],
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[send-invite] SendPulse failed', response.status, data);
    return json(
      {
        error: data?.error || data?.message || 'SendPulse request failed.',
        details: data,
      },
      response.status,
    );
  }
  if (data?.result !== true) {
    console.error('[send-invite] SendPulse did not accept email', data);
    return json(
      {
        error:
          data?.error || data?.message || 'SendPulse did not accept the email.',
        details: data,
      },
      502,
    );
  }
  console.info('[send-invite] SendPulse accepted email', ownerEmail);
  return json({ ok: true, result: data });
}
