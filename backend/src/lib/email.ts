// 品牌化交易信。寄送走 Resend HTTP API（與專案呼叫 Telegram API 同風格，不裝 SDK）。

function layout(title: string, bodyHtml: string, link: string, cta: string): string {
  return `<div style="background:#050508;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#0d0d14;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px 28px;color:#F1F5F9;">
      <h1 style="font-size:20px;font-weight:800;color:#00e5ff;margin:0 0 16px;">屁TCG</h1>
      <h2 style="font-size:17px;font-weight:700;margin:0 0 12px;">${title}</h2>
      <div style="font-size:14px;color:#94a3b8;line-height:1.6;">${bodyHtml}</div>
      <a href="${link}" style="display:inline-block;margin:22px 0;padding:13px 26px;border-radius:12px;background:linear-gradient(135deg,#00e5ff,#00b8cc);color:#000;font-weight:800;font-size:14px;text-decoration:none;">${cta}</a>
      <p style="font-size:12px;color:#475569;margin:0;word-break:break-all;">若按鈕無法點擊，請複製此連結：<br>${link}</p>
    </div>
  </div>`;
}

export function verificationEmailHtml(link: string): string {
  return layout(
    '驗證你的信箱',
    '歡迎加入屁TCG！請點下方按鈕完成信箱驗證。連結 24 小時內有效，若你沒有註冊請忽略本信。',
    link,
    '驗證信箱',
  );
}

export function resetPasswordEmailHtml(link: string): string {
  return layout(
    '重設你的密碼',
    '我們收到重設密碼的要求。點下方按鈕設定新密碼，連結 1 小時內有效。若非你本人操作請忽略本信，你的密碼不會改變。',
    link,
    '重設密碼',
  );
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || '屁TCG <onboarding@resend.dev>';
  // 缺金鑰 fallback：本機/staging 不真寄信，改印連結到 console
  if (!apiKey) {
    console.log(`[email:fallback] to=${opts.to} subject="${opts.subject}"\n${opts.html}`);
    return true;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) console.error('[email] Resend 失敗', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('[email] 寄送例外', e);
    return false;
  }
}
