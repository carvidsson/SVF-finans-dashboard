import React from 'react';
import { useData } from '../context/DataContext';

const PRESETS = [
  { id: 'all', label: 'Alla' },
  { id: '30d', label: 'Senaste 30 dagarna' },
  { id: '90d', label: 'Senaste 90 dagarna' },
  { id: 'qtd', label: 'Innevarande kvartal' },
  { id: 'lq', label: 'Föregående kvartal' },
  { id: 'ytd', label: 'Innevarande år' },
  { id: 'ly', label: 'Föregående år' },
  { id: 'custom', label: 'Anpassat…' },
];

function computeRange(preset) {
  const now = new Date();
  let from = null, to = null;
  if (preset === '30d') { from = new Date(now); from.setDate(from.getDate() - 30); }
  else if (preset === '90d') { from = new Date(now); from.setDate(from.getDate() - 90); }
  else if (preset === 'ytd') { from = new Date(now.getFullYear(), 0, 1); }
  else if (preset === 'ly') {
    from = new Date(now.getFullYear() - 1, 0, 1);
    to = new Date(now.getFullYear() - 1, 11, 31);
  } else if (preset === 'qtd') {
    const q = Math.floor(now.getMonth() / 3);
    from = new Date(now.getFullYear(), q * 3, 1);
  } else if (preset === 'lq') {
    const q = Math.floor(now.getMonth() / 3);
    from = q === 0
      ? new Date(now.getFullYear() - 1, 9, 1)
      : new Date(now.getFullYear(), (q - 1) * 3, 1);
    to = q === 0
      ? new Date(now.getFullYear() - 1, 11, 31)
      : new Date(now.getFullYear(), q * 3, 0);
  }
  const toIso = (d) => (d ? d.toISOString().split('T')[0] : '');
  return { dateFrom: toIso(from), dateTo: toIso(to) };
}

export default function DateBar() {
  const { filters, updateFilters } = useData();
  const { datePreset, dateFrom, dateTo } = filters;

  const setPreset = (preset) => {
    if (preset === 'custom') {
      updateFilters({ datePreset: 'custom' });
    } else {
      const { dateFrom: f, dateTo: t } = computeRange(preset);
      updateFilters({ datePreset: preset, dateFrom: f, dateTo: t });
    }
  };

  const rangeLabel = () => {
    if (datePreset === 'all') return 'Alla perioder';
    if (datePreset === 'custom') {
      if (!dateFrom && !dateTo) return '';
      const fmt = (s) => (s ? new Date(s).toLocaleDateString('sv-SE') : '…');
      return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
    }
    const { dateFrom: f, dateTo: t } = computeRange(datePreset);
    const fmt = (s) => (s ? new Date(s).toLocaleDateString('sv-SE') : '…');
    return `${fmt(f)} – ${fmt(t || new Date().toISOString().split('T')[0])}`;
  };

  return (
    <div className="date-bar">
      <span className="date-bar__label">Kontraktsperiod</span>
      <div className="date-bar__presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`date-preset${datePreset === p.id ? ' active' : ''}`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {datePreset === 'custom' && (
        <div className="date-bar__custom">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateFilters({ dateFrom: e.target.value })}
            title="Från"
          />
          <span style={{ color: '#aaa', fontSize: '.9em' }}>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => updateFilters({ dateTo: e.target.value })}
            title="Till"
          />
        </div>
      )}
      <div className="date-bar__range">{rangeLabel()}</div>
    </div>
  );
}
