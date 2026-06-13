import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface ScrapeWindow { startHour: number; pkmtw: number; pkmjp: number; pkmen: number; }
interface KapaiConfig {
  scrapeWindows: ScrapeWindow[];
  params: { discountThreshold: number; minProfit: number; minMarketValue: number; minSamples: number };
  push: { noPushStartHour: number; noPushEndHour: number; lineBatchTopN: number };
}

const GAMES: { key: keyof Pick<ScrapeWindow, 'pkmtw' | 'pkmjp' | 'pkmen'>; label: string }[] = [
  { key: 'pkmtw', label: '繁中' }, { key: 'pkmjp', label: '日文' }, { key: 'pkmen', label: '英文' },
];

export default function AdminKapaiSettings() {
  const [config, setConfig] = useState<KapaiConfig | null>(null);
  const [env, setEnv] = useState('production');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const readOnly = env === 'staging';

  useEffect(() => {
    api.get('/admin/kapai/config').then(r => { setConfig(r.data.config); setEnv(r.data.env); }).catch(() => {});
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true); setMsg('');
    try {
      const { data } = await api.put('/admin/kapai/config', config);
      setConfig(data.config); setMsg('✅ 已儲存，下一輪偵測生效');
    } catch (e: any) {
      setMsg(`⚠️ ${e?.response?.data?.error ?? '儲存失敗'}`);
    } finally { setSaving(false); }
  }

  function setWin(i: number, key: keyof ScrapeWindow, v: number) {
    if (!config) return;
    const w = config.scrapeWindows.map((x, j) => j === i ? { ...x, [key]: v } : x);
    setConfig({ ...config, scrapeWindows: w });
  }
  function addWin() {
    if (!config) return;
    setConfig({ ...config, scrapeWindows: [...config.scrapeWindows, { startHour: 12, pkmtw: 1500, pkmjp: 1500, pkmen: 350 }] });
  }
  function delWin(i: number) {
    if (!config || config.scrapeWindows.length <= 1) return;
    setConfig({ ...config, scrapeWindows: config.scrapeWindows.filter((_, j) => j !== i) });
  }
  const setParam = (k: keyof KapaiConfig['params'], v: number) => config && setConfig({ ...config, params: { ...config.params, [k]: v } });
  const setPush = (k: keyof KapaiConfig['push'], v: number) => config && setConfig({ ...config, push: { ...config.push, [k]: v } });

  if (!config) return <div style={{ color: '#64748B', fontFamily: 'system-ui' }}>載入中…</div>;

  const inputS: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: readOnly ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.3)', color: '#F1F5F9', fontSize: 13, width: 80,
  };
  const num = (val: number, on: (v: number) => void, w = 80) => (
    <input type="number" value={val} disabled={readOnly} onChange={e => on(Number(e.target.value))} style={{ ...inputS, width: w }} />
  );
  const cell: React.CSSProperties = { padding: '8px 8px', fontSize: 13, color: '#CBD5E1' };
  const th: React.CSSProperties = { ...cell, color: '#64748B', fontWeight: 700, textAlign: 'left' };
  const sectionT: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: '#E2E8F0', margin: '24px 0 10px' };
  const label: React.CSSProperties = { fontSize: 13, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 };

  return (
    <div style={{ maxWidth: 760, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', marginBottom: 6 }}>卡報報設定</h2>
      <p style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>偵測頻率固定（偵測每5分、LINE每20分）。以下數值改完，下一輪偵測就生效。</p>

      {readOnly && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#FCD34D', fontSize: 13, marginBottom: 8 }}>
          ⚠️ 此為<strong>測試機</strong>，僅展示介面，實際請在正式機設定。
        </div>
      )}

      {/* ① 分時段爬取量 */}
      <div style={sectionT}>① 分時段爬取量</div>
      <p style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>依台灣時間，每個時段各 game 爬幾筆最新商品。熱門時段（晚上）上架爆量可調高。</p>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>起始時(台灣)</th>{GAMES.map(g => <th key={g.key} style={th}>{g.label}</th>)}<th style={th}></th></tr></thead>
        <tbody>{config.scrapeWindows.map((w, i) => (
          <tr key={i}>
            <td style={cell}>{num(w.startHour, v => setWin(i, 'startHour', v), 64)} 點</td>
            {GAMES.map(g => <td key={g.key} style={cell}>{num(w[g.key], v => setWin(i, g.key, v))}</td>)}
            <td style={cell}>
              <button onClick={() => delWin(i)} disabled={readOnly || config.scrapeWindows.length <= 1}
                style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 16, opacity: config.scrapeWindows.length <= 1 ? 0.3 : 1 }}>✕</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
      {!readOnly && (
        <button onClick={addWin} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.12)', color: '#C4B5FD', fontSize: 13, cursor: 'pointer' }}>＋ 新增時段</button>
      )}

      {/* ② 套利門檻 */}
      <div style={sectionT}>② 套利門檻</div>
      <div style={label}>售價 ≤ 行情的 {num(Math.round(config.params.discountThreshold * 100), v => setParam('discountThreshold', v / 100), 64)} %</div>
      <div style={label}>最低省額 {num(config.params.minProfit, v => setParam('minProfit', v))} 元</div>
      <div style={label}>最低行情價（過濾小卡）{num(config.params.minMarketValue, v => setParam('minMarketValue', v))} 元</div>
      <div style={label}>繁中同卡最低賣家數 {num(config.params.minSamples, v => setParam('minSamples', v), 64)}</div>

      {/* ③ 推播 */}
      <div style={sectionT}>③ 推播</div>
      <div style={label}>不推時段（台灣）{num(config.push.noPushStartHour, v => setPush('noPushStartHour', v), 64)} 點 ～ {num(config.push.noPushEndHour, v => setPush('noPushEndHour', v), 64)} 點</div>
      <div style={label}>LINE 每批推前 {num(config.push.lineBatchTopN, v => setPush('lineBatchTopN', v), 64)} 大價差</div>

      {!readOnly && (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#7C3AED', color: '#fff', opacity: saving ? 0.5 : 1 }}>
            {saving ? '儲存中…' : '儲存設定'}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('✅') ? '#4ADE80' : '#F87171' }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}
