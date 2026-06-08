import { useState, useEffect } from 'react';
import { apiBase } from '../../api/catalog';

interface Setting {
  key: string;
  value: string;
  hasValue: boolean;
  updatedAt: string;
}

const LINE_KEYS = [
  { key: 'LINE_CHANNEL_SECRET',       label: 'Channel Secret',       hint: '在 LINE Developers → Messaging API → Channel secret' },
  { key: 'LINE_CHANNEL_ACCESS_TOKEN', label: 'Channel Access Token', hint: '在 LINE Developers → Messaging API → Channel access token (long-lived)' },
];

export default function AdminLineSettings() {
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [inputs, setInputs]     = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<Record<string, boolean>>({});
  const [msg, setMsg]           = useState('');

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const token = localStorage.getItem('token');
    const res   = await fetch(`${apiBase}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data: Setting[] = await res.json();
    const map: Record<string, Setting> = {};
    data.forEach(s => { map[s.key] = s; });
    setSettings(map);
  }

  async function saveSetting(key: string) {
    const value = inputs[key]?.trim();
    if (!value) return;
    setSaving(prev => ({ ...prev, [key]: true }));
    const token = localStorage.getItem('token');
    const res   = await fetch(`${apiBase}/admin/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value }),
    });
    setSaving(prev => ({ ...prev, [key]: false }));
    if (res.ok) {
      setMsg(`✅ ${key} 已更新`);
      setInputs(prev => ({ ...prev, [key]: '' }));
      loadSettings();
      setTimeout(() => setMsg(''), 3000);
    }
  }

  const webhookUrl = `${window.location.origin.replace('5173', '3000').replace('pptcg-dev.vercel.app', 'pptcg-backend-staging-production.up.railway.app')}/api/line/webhook`
    .replace('https://pipicards.com', 'https://pptcg-backend-production.up.railway.app');

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-1">LINE Bot 設定</h2>
      <p className="text-sm text-gray-500 mb-6">設定完成後即可開始接收 LINE 事件並推播通知。</p>

      {/* Webhook URL */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Webhook URL（填入 LINE Developers）</p>
        <code className="text-sm text-blue-900 break-all">{webhookUrl}</code>
        <p className="text-xs text-blue-600 mt-2">
          LINE Developers → Messaging API → Webhook settings → Webhook URL
        </p>
      </div>

      {/* Credential inputs */}
      <div className="space-y-5">
        {LINE_KEYS.map(({ key, label, hint }) => {
          const current = settings[key];
          return (
            <div key={key} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{label}</span>
                {current?.hasValue
                  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ 已設定 {current.value}</span>
                  : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">未設定</span>
                }
              </div>
              <p className="text-xs text-gray-400 mb-2">{hint}</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="flex-1 border rounded px-3 py-1.5 text-sm"
                  placeholder={current?.hasValue ? '輸入新值以覆蓋' : '貼上憑證值'}
                  value={inputs[key] ?? ''}
                  onChange={e => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveSetting(key)}
                />
                <button
                  onClick={() => saveSetting(key)}
                  disabled={!inputs[key]?.trim() || saving[key]}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded disabled:opacity-40 hover:bg-blue-700"
                >
                  {saving[key] ? '儲存中…' : '儲存'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {msg && <div className="mt-4 text-sm text-green-700 font-medium">{msg}</div>}

      {/* Setup guide */}
      <div className="mt-8 bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
        <p className="font-semibold text-gray-700">設定步驟</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>前往 <a href="https://developers.line.biz" target="_blank" rel="noreferrer" className="text-blue-600 underline">LINE Developers Console</a></li>
          <li>建立 Provider → 建立 Messaging API channel</li>
          <li>Messaging API → 複製 <strong>Channel secret</strong>，填入上方</li>
          <li>Messaging API → Issue <strong>Channel access token (long-lived)</strong>，填入上方</li>
          <li>Webhook settings → 貼入上方 Webhook URL → Verify → 啟用 Use webhook</li>
        </ol>
      </div>
    </div>
  );
}
