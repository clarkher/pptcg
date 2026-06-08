import { useEffect, useState } from 'react';
import { catalogApi, type SetInfo } from '../api/catalog';
import type { SeriesDef } from '../types/catalog';

const LANGS: { value: string; label: string }[] = [
  { value: 'zh', label: '繁中' },
  { value: 'ja', label: '日文' },
  { value: 'en', label: '英文' },
];

interface Props {
  language: string;
  onLanguage: (l: string) => void;
  seriesKey: string;
  onSeries: (k: string) => void;
  setId: string;
  onSet: (id: string) => void;
}

const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap', border: 'none',
  background: active ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'rgba(255,255,255,0.04)',
  color: active ? '#fff' : '#94A3B8',
  outline: active ? 'none' : '1px solid rgba(255,255,255,0.07)',
  boxShadow: active ? '0 0 16px rgba(124,58,237,0.35)' : 'none',
  transition: 'all 0.15s',
});

export function SeriesSetNav({ language, onLanguage, seriesKey, onSeries, setId, onSet }: Props) {
  const [series, setSeries] = useState<SeriesDef[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);

  useEffect(() => {
    catalogApi.series(language).then(setSeries).catch(() => setSeries([]));
  }, [language]);

  useEffect(() => {
    if (!seriesKey) { setSets([]); return; }
    catalogApi.sets(language, seriesKey).then(setSets).catch(() => setSets([]));
  }, [language, seriesKey]);

  const rowStyle: React.CSSProperties = { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Language */}
      <div style={{ ...rowStyle, marginBottom: 10 }}>
        {LANGS.map((l) => (
          <button key={l.value} style={chip(language === l.value)}
            onClick={() => { onLanguage(l.value); onSeries(''); onSet(''); }}>
            {l.label}
          </button>
        ))}
      </div>

      {/* Series */}
      <div style={{ ...rowStyle, marginBottom: 10 }}>
        <button style={chip(seriesKey === '')} onClick={() => { onSeries(''); onSet(''); }}>全部系列</button>
        {series.map((s) => (
          <button key={s.key} style={chip(seriesKey === s.key)}
            onClick={() => { onSeries(s.key); onSet(''); }}>
            {s.name}
          </button>
        ))}
      </div>

      {/* Sets (only when a series is selected) */}
      {seriesKey && (
        <div style={rowStyle}>
          <button style={chip(setId === '')} onClick={() => onSet('')}>全部套系</button>
          {sets.map((st) => (
            <button key={st.id} style={{ ...chip(setId === st.id), display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => onSet(st.id)}>
              {st.logo && <img src={st.logo} alt="" style={{ height: 16, width: 'auto' }} />}
              {st.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
