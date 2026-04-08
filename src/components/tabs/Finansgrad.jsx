import React, { useState, useRef, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { parseVWCSV, processVWData } from '../../utils/csvParser';
import { fmtNum } from '../../utils/formatters';

// ── Date preset helpers (same logic as DateBar) ──────────────────────────────
const PRESETS = [
  { id: 'all',    label: 'Alla' },
  { id: '30d',    label: 'Senaste 30 dagarna' },
  { id: '90d',    label: 'Senaste 90 dagarna' },
  { id: 'qtd',    label: 'Innevarande kvartal' },
  { id: 'lq',     label: 'Föregående kvartal' },
  { id: 'ytd',    label: 'Innevarande år' },
  { id: 'ly',     label: 'Föregående år' },
  { id: 'custom', label: 'Anpassat…' },
];

function computePresetDates(preset) {
  const now = new Date();
  let from = null, to = null;
  if (preset === '30d') { from = new Date(now); from.setDate(from.getDate() - 30); }
  else if (preset === '90d') { from = new Date(now); from.setDate(from.getDate() - 90); }
  else if (preset === 'ytd') { from = new Date(now.getFullYear(), 0, 1); }
  else if (preset === 'ly') { from = new Date(now.getFullYear() - 1, 0, 1); to = new Date(now.getFullYear() - 1, 11, 31); }
  else if (preset === 'qtd') { const q = Math.floor(now.getMonth() / 3); from = new Date(now.getFullYear(), q * 3, 1); }
  else if (preset === 'lq') {
    const q = Math.floor(now.getMonth() / 3);
    from = q === 0 ? new Date(now.getFullYear() - 1, 9, 1) : new Date(now.getFullYear(), (q - 1) * 3, 1);
    to   = q === 0 ? new Date(now.getFullYear() - 1, 11, 31) : new Date(now.getFullYear(), q * 3, 0);
  }
  const toIso = (d) => (d ? d.toISOString().split('T')[0] : '');
  return { from: toIso(from), to: toIso(to) };
}

function rangeLabel(preset, from, to) {
  if (preset === 'all') return 'Alla perioder';
  if (preset === 'custom') {
    if (!from && !to) return '';
    const fmt = (s) => (s ? new Date(s).toLocaleDateString('sv-SE') : '…');
    return `${fmt(from)} – ${fmt(to)}`;
  }
  const { from: f, to: t } = computePresetDates(preset);
  const fmt = (s) => (s ? new Date(s).toLocaleDateString('sv-SE') : '…');
  return `${fmt(f)} – ${fmt(t || new Date().toISOString().split('T')[0])}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KPI({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Finansgrad() {
  const { rawData } = useData();
  const fileRef = useRef();

  // VW Finance state
  const [vwData, setVwData] = useState([]);
  const [reportName, setReportName] = useState('—');
  const [selectedPeriod, setSelectedPeriod] = useState('');   // '' = all periods

  // Stock date filter state (local to this tab)
  const [stockPreset, setStockPreset] = useState('all');
  const [stockFrom, setStockFrom] = useState('');
  const [stockTo, setStockTo] = useState('');

  // ── File upload ──
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const rows = await parseVWCSV(file);
    const parsed = processVWData(rows);
    if (!parsed.length) {
      alert('Kunde inte läsa data ur filen. Kontrollera att det är rätt format (ÅF Utfall mot mål).');
      return;
    }
    setVwData(parsed);
    setReportName(file.name);
    setSelectedPeriod('');   // reset to "all" on new file
    e.target.value = '';
  };

  // ── Stock date preset ──
  const handleStockPreset = (preset) => {
    setStockPreset(preset);
    if (preset !== 'custom') {
      const { from, to } = computePresetDates(preset);
      setStockFrom(from);
      setStockTo(to);
    }
  };

  // ── Derived: available VW periods ──
  const vwPeriods = useMemo(() => {
    const seen = new Set();
    const periods = [];
    vwData.forEach((d) => {
      if (!seen.has(d.period)) { seen.add(d.period); periods.push(d.period); }
    });
    return periods;
  }, [vwData]);

  // ── Derived: filtered VW data for selected period ──
  const filteredVW = useMemo(() => {
    if (!selectedPeriod) return vwData;
    return vwData.filter((d) => d.period === selectedPeriod);
  }, [vwData, selectedPeriod]);

  // ── Derived: filtered stock data ──
  const filteredStock = useMemo(() => {
    if (!rawData.length) return [];
    const df = stockFrom ? new Date(stockFrom) : null;
    const dt = stockTo ? new Date(stockTo + 'T23:59:59') : null;
    if (!df && !dt) return rawData;
    return rawData.filter((r) => {
      const start = r['Start Datum'];
      if (!start || isNaN(start)) return false;
      if (df && start < df) return false;
      if (dt && start > dt) return false;
      return true;
    });
  }, [rawData, stockFrom, stockTo]);

  // ── Analytics ──
  const pct = (n, d) => (d ? (n / d) * 100 : 0);
  const f1 = (v) => v.toFixed(1) + '%';

  const vwAnalytics = useMemo(() => {
    if (!filteredVW.length) return null;

    const byKey = {};
    filteredVW.forEach((d) => { byKey[d.nybeg + '|' + d.region] = d; });

    const regionOrder = [];
    const seen = new Set();
    filteredVW.forEach((d) => {
      if (!seen.has(d.region)) { seen.add(d.region); regionOrder.push(d.region); }
    });

    let nyTot = 0, nyVfsC = 0, nyOpkC = 0, nyVfsMalSum = 0, nyOpkMalSum = 0, nyCount = 0;
    let begTot = 0, begVfsC = 0, begOpkC = 0, begVfsMalSum = 0, begOpkMalSum = 0, begCount = 0;

    filteredVW.filter((d) => d.nybeg === 'Ny').forEach((d) => {
      nyTot += d.total; nyVfsC += d.vfsCount; nyOpkC += d.opkCount;
      nyVfsMalSum += d.vfsMal; nyOpkMalSum += d.opkMal; nyCount++;
    });
    filteredVW.filter((d) => d.nybeg === 'Beg').forEach((d) => {
      begTot += d.total; begVfsC += d.vfsCount; begOpkC += d.opkCount;
      begVfsMalSum += d.vfsMal; begOpkMalSum += d.opkMal; begCount++;
    });

    const avgNyVfsMal  = nyCount  ? nyVfsMalSum  / nyCount  : 0;
    const avgNyOpkMal  = nyCount  ? nyOpkMalSum  / nyCount  : 0;
    const avgBegVfsMal = begCount ? begVfsMalSum / begCount : 0;
    const avgBegOpkMal = begCount ? begOpkMalSum / begCount : 0;

    const labels = [...regionOrder, 'Total'];
    const getVal = (nb, r, field) => {
      if (r === 'Total') {
        const tot = nb === 'Ny' ? nyTot : begTot;
        const vC  = nb === 'Ny' ? nyVfsC : begVfsC;
        const oC  = nb === 'Ny' ? nyOpkC : begOpkC;
        const vM  = nb === 'Ny' ? avgNyVfsMal : avgBegVfsMal;
        const oM  = nb === 'Ny' ? avgNyOpkMal : avgBegOpkMal;
        if (field === 'vfsGrad') return pct(vC, tot);
        if (field === 'opkGrad') return pct(oC, tot);
        if (field === 'vfsMal')  return vM;
        if (field === 'opkMal')  return oM;
        if (field === 'vfsCount') return vC;
        if (field === 'opkCount') return oC;
        return tot;
      }
      const d = byKey[nb + '|' + r];
      if (!d) return 0;
      if (field === 'vfsGrad') return pct(d.vfsCount, d.total);
      if (field === 'opkGrad') return pct(d.opkCount, d.total);
      return d[field] || 0;
    };

    return { labels, getVal, regionOrder, byKey, nyTot, nyVfsC, nyOpkC, begTot, begVfsC, begOpkC, avgNyVfsMal, avgNyOpkMal, avgBegVfsMal, avgBegOpkMal };
  }, [filteredVW]);

  // ── Stock summary for selected period ──
  const stockSummary = useMemo(() => {
    if (!filteredStock.length) return null;
    const active = filteredStock.filter((r) => r['Status kontraktsrad'] === 'Active');
    const total  = filteredStock.length;
    const ny  = filteredStock.filter((r) => r['Begagnat'] === 'No').length;
    const beg = filteredStock.filter((r) => r['Begagnat'] === 'Yes').length;
    const totalFin = filteredStock.reduce((s, r) => s + (r['Finansierat Belopp'] || 0), 0);
    const uniqueCust = new Set(filteredStock.map((r) => r['Kund']).filter(Boolean)).size;
    return { total, active: active.length, ny, beg, totalFin, uniqueCust };
  }, [filteredStock]);

  // ── Upload screen ──
  if (!vwData.length) {
    return (
      <div className="vw-upload-state">
        <svg width="48" height="48" fill="none" stroke="#ccc" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p><strong>Ladda upp Volkswagen Finans CSV</strong></p>
        <p style={{ fontSize: '.85em', color: '#999' }}>Rapporten "ÅF Utfall mot mål" från VW Finance-portalen</p>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
        <button className="vw-upload-btn-large" onClick={() => fileRef.current.click()}>Välj VW Finans CSV…</button>
      </div>
    );
  }

  const { labels, getVal, regionOrder, byKey } = vwAnalytics;
  const tickPct = { ticks: { callback: (v) => v.toFixed(0) + '%' } };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />

      {/* ── Info bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '10px 20px', background: '#f5f7fa', borderBottom: '1px solid #e8ecf0', fontSize: '.85em', color: '#555', flexWrap: 'wrap' }}>
        <span><strong>VW Finans rapport:</strong> <span style={{ color: '#0f3460' }}>{reportName}</span></span>
        <span><strong>Stockrapport datum:</strong> <span style={{ color: '#0f3460' }}>{rangeLabel(stockPreset, stockFrom, stockTo)}</span></span>
        <button className="filter-clear-btn" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '.8em' }} onClick={() => fileRef.current.click()}>Ladda ny VW CSV</button>
      </div>

      {/* ── Period controls ── */}
      <div className="section" style={{ padding: '14px 20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* VW Finance period */}
          <div className="filter-group">
            <label style={{ fontSize: '.85em', fontWeight: 600, color: '#666', marginBottom: 4 }}>
              VW Finans — Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, minWidth: 200 }}
            >
              <option value="">Alla perioder ({vwPeriods.length} st)</option>
              {vwPeriods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div style={{ fontSize: '.72em', color: '#888', marginTop: 4 }}>
              Välj en specifik period ur VW-rapporten.
            </div>
          </div>

          {/* Stock report date filter */}
          <div className="filter-group">
            <label style={{ fontSize: '.85em', fontWeight: 600, color: '#666', marginBottom: 4 }}>
              Stockrapport — Kontraktsperiod
            </label>
            <div className="date-bar" style={{ padding: '10px 14px', borderRadius: 8, gap: 8 }}>
              <div className="date-bar__presets" style={{ gap: 4 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`date-preset${stockPreset === p.id ? ' active' : ''}`}
                    onClick={() => handleStockPreset(p.id)}
                    style={{ fontSize: '.75em', padding: '4px 10px' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {stockPreset === 'custom' && (
                <div className="date-bar__custom" style={{ marginTop: 8 }}>
                  <input type="date" value={stockFrom} onChange={(e) => setStockFrom(e.target.value)} title="Från" />
                  <span style={{ color: '#aaa', fontSize: '.9em' }}>–</span>
                  <input type="date" value={stockTo} onChange={(e) => setStockTo(e.target.value)} title="Till" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stock summary for selected period ── */}
      {stockSummary && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '.78em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#888', marginBottom: 8, paddingLeft: 4 }}>
            Stockrapport — {rangeLabel(stockPreset, stockFrom, stockTo)}
          </div>
          <div className="kpi-grid">
            <KPI label="Kontrakt i perioden"  value={stockSummary.total.toLocaleString()}         sub="totalt" />
            <KPI label="Aktiva kontrakt"       value={stockSummary.active.toLocaleString()}        sub="av perioden" />
            <KPI label="Nya fordon (Ny)"       value={stockSummary.ny.toLocaleString()}            sub="Begagnat = Nej" />
            <KPI label="Begagnade fordon"      value={stockSummary.beg.toLocaleString()}           sub="Begagnat = Ja" />
            <KPI label="Finansierat belopp"    value={(stockSummary.totalFin / 1e6).toFixed(1) + ' Mkr'} sub="perioden" />
            <KPI label="Unika kunder"          value={stockSummary.uniqueCust.toLocaleString()}    sub="perioden" />
          </div>
        </div>
      )}

      {/* ── VW Finance KPIs ── */}
      <div style={{ fontSize: '.78em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#888', marginBottom: 8, paddingLeft: 4 }}>
        VW Finans — {selectedPeriod || 'Alla perioder'}
      </div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KPI label="Ny - Levererade"       value={vwAnalytics.nyTot.toLocaleString('sv-SE')}  sub="" />
        <KPI label="Ny - VFS Finansierade" value={vwAnalytics.nyVfsC.toLocaleString('sv-SE')} sub={f1(pct(vwAnalytics.nyVfsC, vwAnalytics.nyTot)) + ' finansgrad'} />
        <KPI label="Ny - VFS Mål"          value={f1(vwAnalytics.avgNyVfsMal)}                sub="" />
        <KPI label="Ny - BFF Finansierade" value={vwAnalytics.nyOpkC.toLocaleString('sv-SE')} sub={f1(pct(vwAnalytics.nyOpkC, vwAnalytics.nyTot)) + ' finansgrad'} />
        <KPI label="Ny - BFF Mål"          value={f1(vwAnalytics.avgNyOpkMal)}                sub="" />
        <KPI label="Beg - Levererade"      value={vwAnalytics.begTot.toLocaleString('sv-SE')} sub="" />
        <KPI label="Beg - VFS Finansierade" value={vwAnalytics.begVfsC.toLocaleString('sv-SE')} sub={f1(pct(vwAnalytics.begVfsC, vwAnalytics.begTot)) + ' finansgrad'} />
        <KPI label="Beg - VFS Mål"         value={f1(vwAnalytics.avgBegVfsMal)}               sub="" />
      </div>

      {/* ── Charts ── */}
      <div className="chart-row">
        <div className="chart-box">
          <Bar
            data={{
              labels,
              datasets: [
                { label: 'Beg. BFF/VFS', data: labels.map((r) => getVal('Beg', r, 'vfsGrad') + getVal('Beg', r, 'opkGrad')), backgroundColor: '#4472C4', borderRadius: 4 },
                { label: 'Mål tot. finans beg.', data: labels.map((r) => getVal('Beg', r, 'vfsMal')), type: 'line', borderColor: '#ED7D31', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2 },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { title: { display: true, text: 'Finansgrad Begagnat BFF/VFS', font: { size: 13 } }, legend: { position: 'bottom' } }, scales: { y: tickPct } }}
          />
        </div>
        <div className="chart-box">
          <Bar
            data={{
              labels,
              datasets: [
                { label: 'Nytt VFS',     data: labels.map((r) => getVal('Ny',  r, 'vfsGrad')), backgroundColor: '#4472C4', borderRadius: 2 },
                { label: 'Beg. VFS',     data: labels.map((r) => getVal('Beg', r, 'vfsGrad')), backgroundColor: '#A9C4E8', borderRadius: 2 },
                { label: 'Nytt BFF',     data: labels.map((r) => getVal('Ny',  r, 'opkGrad')), backgroundColor: '#70AD47', borderRadius: 2 },
                { label: 'Beg. BFF',     data: labels.map((r) => getVal('Beg', r, 'opkGrad')), backgroundColor: '#C5E0B4', borderRadius: 2 },
                { label: 'VFS mål ny',   data: labels.map((r) => getVal('Ny',  r, 'vfsMal')),  type: 'line', borderColor: '#ED7D31', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2 },
                { label: 'VFS mål beg.', data: labels.map((r) => getVal('Beg', r, 'vfsMal')),  type: 'line', borderColor: '#FFC000', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2 },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { title: { display: true, text: 'Finansgrad BFF/VFS', font: { size: 13 } }, legend: { position: 'bottom' } }, scales: { y: tickPct } }}
          />
        </div>
      </div>

      {/* ── Region table ── */}
      <div className="section">
        <h2>
          Sammanställning per region
          {selectedPeriod && <span style={{ fontWeight: 400, fontSize: '.85em', color: '#888', marginLeft: 8 }}>— {selectedPeriod}</span>}
        </h2>
        <div className="table-scroll">
          <table id="tableVw">
            <thead>
              <tr>
                <th>Region</th>
                <th>Ny Lev.</th><th>Ny VFS fin.</th><th>Ny VFS%</th><th>VFS Mål%</th>
                <th>Ny BFF fin.</th><th>Ny BFF%</th><th>BFF Mål%</th>
                <th>Beg Lev.</th><th>Beg VFS fin.</th><th>Beg VFS%</th>
                <th>Beg BFF fin.</th><th>Beg BFF%</th>
              </tr>
            </thead>
            <tbody>
              {regionOrder.map((r) => {
                const ny  = byKey['Ny|'  + r] || {};
                const beg = byKey['Beg|' + r] || {};
                return (
                  <tr key={r}>
                    <td><strong>{r}</strong></td>
                    <td>{ny.total  || 0}</td><td>{ny.vfsCount  || 0}</td>
                    <td>{ny.total  ? pct(ny.vfsCount,  ny.total ).toFixed(1) : '-'}%</td>
                    <td>{(ny.vfsMal  || 0).toFixed(0)}%</td>
                    <td>{ny.opkCount  || 0}</td>
                    <td>{ny.total  ? pct(ny.opkCount,  ny.total ).toFixed(1) : '-'}%</td>
                    <td>{(ny.opkMal  || 0).toFixed(0)}%</td>
                    <td>{beg.total || 0}</td><td>{beg.vfsCount || 0}</td>
                    <td>{beg.total ? pct(beg.vfsCount, beg.total).toFixed(1) : '-'}%</td>
                    <td>{beg.opkCount || 0}</td>
                    <td>{beg.total ? pct(beg.opkCount, beg.total).toFixed(1) : '-'}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 4, marginBottom: 20 }}>
        <button className="filter-clear-btn" onClick={() => fileRef.current.click()}>Ladda ny VW CSV</button>
      </div>
    </div>
  );
}
