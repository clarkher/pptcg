import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface Setting {
  key: string;
  value: string;
  hasValue: boolean;
  updatedAt: string;
}

interface WebhookResult {
  ok?: boolean;
  webhookUrl?: string;
  test?: { success?: boolean; statusCode?: number; reason?: string };
  error?: string;
}

const LINE_KEYS = [
  { key: 'LINE_CHANNEL_SECRET',       label: 'Channel Secret',       hint: '在 LINE Developers → Messaging API → Channel secret' },
  { key: 'LINE_CHANNEL_ACCESS_TOKEN', label: 'Channel Access Token', hint: '在 LINE Developers → Messaging API → Channel access token (long-lived)' },
  { key: 'LINE_BOT_LINK',             label: 'LINE 官方帳號連結',      hint: '讓用戶加入的 line.me/R/ti/p/@ 連結，用於前台綁定說明（選填）' },
  { key: 'TELEGRAM_BOT_TOKEN',        label: 'Telegram Bot Token',   hint: '@BotFather 建 bot 拿的 token（免費、無推播配額）。填完按下方「連線 Telegram」' },
];

export default function AdminLineSettings() {
  const [settings, setSettings]       = useState<Record<string, Setting>>({});
  const [inputs, setInputs]           = useState<Record<string, string>>({});
  const [saving, setSaving]           = useState<Record<string, boolean>>({});
  const [msg, setMsg]                 = useState('');
  const [webhookRes, setWebhookRes]   = useState<WebhookResult | null>(null);
  const [configuring, setConfiguring] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const { data } = await api.get<Setting[]>('/admin/settings');
      const map: Record<string, Setting> = {};
      data.forEach(s => { map[s.key] = s; });
      setSettings(map);
    } catch {}
  }

  async function saveSetting(key: string) {
    const value = inputs[key]?.trim();
    if (!value) return;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await api.put(`/admin/settings/${key}`, { value });
      setMsg(`✅ ${key} 已更新`);
      setInputs(prev => ({ ...prev, [key]: '' }));
      loadSettings();
      setTimeout(() => setMsg(''), 3000);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  }

  async function autoConfigureWebhook() {
    setConfiguring(true);
    setWebhookRes(null);
    try {
      const { data } = await api.post<WebhookResult>('/admin/line/setup-webhook', { webhookUrl });
      setWebhookRes(data);
    } catch (e: any) {
      setWebhookRes({ error: e?.response?.data?.error ?? e?.message ?? '網路錯誤' });
    } finally {
      setConfiguring(false);
    }
  }

  // Compute webhook URL based on current environment
  const isProduction = window.location.hostname === 'pipicards.com' || window.location.hostname === 'www.pipicards.com';
  const webhookUrl = isProduction
    ? 'https://pptcg-backend-production.up.railway.app/api/line/webhook'
    : 'https://pptcg-backend-staging-production.up.railway.app/api/line/webhook';

  const hasToken = !!settings['LINE_CHANNEL_ACCESS_TOKEN']?.hasValue;
  const hasTgToken = !!settings['TELEGRAM_BOT_TOKEN']?.hasValue;
  const [tgResult, setTgResult] = useState<{ ok?: boolean; chatName?: string; chatId?: number; error?: string } | null>(null);
  const [tgBusy, setTgBusy] = useState(false);

  async function connectTelegram() {
    setTgBusy(true); setTgResult(null);
    try {
      const { data } = await api.post('/admin/telegram/setup');
      setTgResult(data);
    } catch (e: any) {
      setTgResult({ error: e?.response?.data?.error ?? e?.message ?? '網路錯誤' });
    } finally {
      setTgBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', marginBottom: 4 }}>LINE Bot 設定</h2>
      <p style={{ fontSize: 13, color: '#475569', marginBottom: 24 }}>設定完成後即可開始接收 LINE 事件並推播通知。</p>

      {/* Webhook URL + auto-configure */}
      <div style={{
        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: 14, padding: '16px 18px', marginBottom: 24,
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Webhook URL
        </p>
        <code style={{ fontSize: 13, color: '#93C5FD', wordBreak: 'break-all', display: 'block', marginBottom: 14 }}>
          {webhookUrl}
        </code>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={autoConfigureWebhook}
            disabled={configuring || !hasToken}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: '1px solid rgba(59,130,246,0.4)',
              background: hasToken ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
              color: hasToken ? '#60A5FA' : '#334155',
              cursor: hasToken ? 'pointer' : 'not-allowed',
              opacity: configuring ? 0.5 : 1,
            }}
          >
            {configuring ? '設定中…' : '🚀 自動設定 Webhook'}
          </button>
          {!hasToken && (
            <span style={{ fontSize: 12, color: '#475569' }}>（需先填入 Access Token）</span>
          )}
        </div>

        {/* Webhook result */}
        {webhookRes && (
          <div style={{
            marginTop: 14, borderRadius: 10, padding: '12px 14px',
            background: webhookRes.ok ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${webhookRes.ok ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {webhookRes.ok ? (
              <div>
                <p style={{ fontSize: 13, color: '#4ADE80', fontWeight: 700, marginBottom: 6 }}>✅ Webhook 設定成功</p>
                {webhookRes.test && (
                  <p style={{ fontSize: 12, color: webhookRes.test.success ? '#4ADE80' : '#F87171' }}>
                    測試結果：{webhookRes.test.success
                      ? '✓ 伺服器回應正常'
                      : `⚠ ${webhookRes.test.reason ?? 'HTTP ' + webhookRes.test.statusCode}`}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#F87171' }}>❌ {webhookRes.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Credential inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {LINE_KEYS.map(({ key, label, hint }) => {
          const current = settings[key];
          const isSecret = key !== 'LINE_BOT_LINK';
          return (
            <div key={key} style={{
              borderRadius: 14, padding: '16px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0' }}>{label}</span>
                {current?.hasValue
                  ? <span style={{ fontSize: 11, background: 'rgba(74,222,128,0.1)', color: '#4ADE80', padding: '2px 8px', borderRadius: 6 }}>✓ 已設定 {current.value}</span>
                  : <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.1)', color: '#F87171', padding: '2px 8px', borderRadius: 6 }}>未設定</span>
                }
              </div>
              <p style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>{hint}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={isSecret ? 'password' : 'text'}
                  style={{
                    flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', padding: '8px 12px', fontSize: 13,
                    outline: 'none',
                  }}
                  placeholder={current?.hasValue
                    ? '輸入新值以覆蓋'
                    : key === 'LINE_BOT_LINK' ? 'https://line.me/R/ti/p/@xxxxx' : '貼上憑證值'}
                  value={inputs[key] ?? ''}
                  onChange={e => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveSetting(key)}
                />
                <button
                  onClick={() => saveSetting(key)}
                  disabled={!inputs[key]?.trim() || saving[key]}
                  style={{
                    padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    border: '1px solid rgba(124,58,237,0.4)',
                    background: 'rgba(124,58,237,0.12)', color: '#A78BFA',
                    cursor: 'pointer', opacity: (!inputs[key]?.trim() || saving[key]) ? 0.4 : 1,
                  }}
                >
                  {saving[key] ? '…' : '儲存'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Telegram 連線 */}
      <div style={{
        marginTop: 24, background: 'rgba(34,158,217,0.08)', border: '1px solid rgba(34,158,217,0.25)',
        borderRadius: 14, padding: '16px 18px',
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#3BA9E0', marginBottom: 6 }}>✈️ Telegram 推播（免費、無配額）</p>
        <p style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
          填好上方 Telegram Bot Token 並儲存後，在「已加入 bot 的群組」發一則訊息，再點下面按鈕自動抓 chat_id 並測試。
        </p>
        <button
          onClick={connectTelegram}
          disabled={tgBusy || !hasTgToken}
          style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            border: '1px solid rgba(34,158,217,0.4)',
            background: hasTgToken ? 'rgba(34,158,217,0.15)' : 'rgba(255,255,255,0.04)',
            color: hasTgToken ? '#3BA9E0' : '#334155',
            cursor: hasTgToken ? 'pointer' : 'not-allowed', opacity: tgBusy ? 0.5 : 1,
          }}
        >
          {tgBusy ? '連線中…' : '🔗 連線 Telegram（抓 chat_id + 測試）'}
        </button>
        {!hasTgToken && <span style={{ fontSize: 12, color: '#475569', marginLeft: 10 }}>（需先填入 Bot Token）</span>}
        {tgResult && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            {tgResult.ok
              ? <p style={{ color: '#4ADE80' }}>✅ 連線成功！已綁定「{tgResult.chatName || tgResult.chatId}」，測試訊息已送出，去 Telegram 看看。</p>
              : <p style={{ color: '#F87171' }}>❌ {tgResult.error}</p>}
          </div>
        )}
      </div>

      {msg && <p style={{ marginTop: 16, fontSize: 13, color: '#4ADE80', fontWeight: 600 }}>{msg}</p>}

      {/* Setup guide */}
      <div style={{
        marginTop: 28, borderRadius: 14, padding: '16px 18px',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
        fontSize: 13, color: '#475569',
      }}>
        <p style={{ fontWeight: 700, color: '#64748B', marginBottom: 10 }}>設定步驟</p>
        <ol style={{ listStyle: 'decimal', paddingLeft: 20, lineHeight: 2 }}>
          <li>前往 <a href="https://developers.line.biz" target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>LINE Developers Console</a></li>
          <li>建立 Provider → 建立 Messaging API channel</li>
          <li>複製 <strong style={{ color: '#94A3B8' }}>Channel secret</strong> 填入上方 → 儲存</li>
          <li>Issue <strong style={{ color: '#94A3B8' }}>Channel access token (long-lived)</strong> 填入上方 → 儲存</li>
          <li>點「🚀 自動設定 Webhook」→ 系統自動填入 URL 並驗證</li>
          <li>到 <a href="https://manager.line.biz" target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>LINE Official Account Manager</a> → 回應設定 → 關閉「自動回應訊息」</li>
        </ol>
      </div>
    </div>
  );
}
