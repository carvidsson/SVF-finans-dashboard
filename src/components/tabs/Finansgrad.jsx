import React, { useState, useRef, useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { parseVWExcel } from '../../utils/csvParser';

// ── Date preset helpers ───────────────────────────────────────────────────────
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

// ── DateFilter sub-component (reusable preset picker) ────────────────────────
function DateFilter({ label, hint, preset, from, to, onPreset, onFrom, onTo }) {
  return (
    <div className="filter-group">
      <label style={{ fontSize: '.85em', fontWeight: 600, color: '#666', marginBottom: 4 }}>{label}</label>
      {hint && <div style={{ fontSize: '.72em', color: '#aaa', marginBottom: 4 }}>{hint}</div>}
      <div className="date-bar" style={{ padding: '10px 14px', borderRadius: 8, gap: 8 }}>
        <div className="date-bar__presets" style={{ gap: 4 }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`date-preset${preset === p.id ? ' active' : ''}`}
              onClick={() => onPreset(p.id)}
              style={{ fontSize: '.75em', padding: '4px 10px' }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="date-bar__custom" style={{ marginTop: 8 }}>
            <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} title="Från" />
            <span style={{ color: '#aaa', fontSize: '.9em' }}>–</span>
            <input type="date" value={to} onChange={(e) => onTo(e.target.value)} title="Till" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI sub-component ─────────────────────────────────────────────────────────
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

  // VW Finance Excel state
  const [vwExcelData, setVwExcelData] = useState(null); // { period, goals, leveranser, finanskontrakt }
  const [reportName, setReportName]   = useState('—');

  // VW Finance date filter (based on Leveransdatum / Startdatum from Excel)
  const [vwPreset, setVwPreset] = useState('all');
  const [vwFrom,   setVwFrom]   = useState('');
  const [vwTo,     setVwTo]     = useState('');

  // Stockrapporten date filter (based on Start Datum in CSV)
  const [stockPreset, setStockPreset] = useState('all');
  const [stockFrom,   setStockFrom]   = useState('');
  const [stockTo,     setStockTo]     = useState('');

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = await parseVWExcel(file);
      if (!parsed.leveranser.length && !parsed.finanskontrakt.length) {
        alert('Kunde inte läsa data ur filen. Kontrollera att det är rätt format (ÅF Utfall mot mål .xlsx).');
        return;
      }
      setVwExcelData(parsed);
      setReportName(file.name);
      setVwPreset('all');
      setVwFrom('');
      setVwTo('');
    } catch (err) {
      alert('Fel vid inläsning av Excel-filen: ' + err.message);
    }
    e.target.value = '';
  };

  // ── Preset handlers ──────────────────────────────────────────────────────
  const handleVwPreset = (preset) => {
    setVwPreset(preset);
    if (preset !== 'custom') {
      const { from, to } = computePresetDates(preset);
      setVwFrom(from);
      setVwTo(to);
    }
  };

  const handleStockPreset = (preset) => {
    setStockPreset(preset);
    if (preset !== 'custom') {
      const { from, to } = computePresetDates(preset);
      setStockFrom(from);
      setStockTo(to);
    }
  };

  // ── Filtered leveranser (by Leveransdatum) ───────────────────────────────
  const filteredLeveranser = useMemo(() => {
    if (!vwExcelData) return [];
    const df = vwFrom ? new Date(vwFrom) : null;
    const dt = vwTo   ? new Date(vwTo + 'T23:59:59') : null;
    if (!df && !dt) return vwExcelData.leveranser;
    return vwExcelData.leveranser.filter((r) => {
      if (df && r.datum < df) return false;
      if (dt && r.datum > dt) return false;
      return true;
    });
  }, [vwExcelData, vwFrom, vwTo]);

  // ── Filtered finanskontrakt (by Startdatum) ──────────────────────────────
  const filteredFinanskontrakt = useMemo(() => {
    if (!vwExcelData) return [];
    const df = vwFrom ? new Date(vwFrom) : null;
    const dt = vwTo   ? new Date(vwTo + 'T23:59:59') : null;
    if (!df && !dt) return vwExcelData.finanskontrakt;
    return vwExcelData.finanskontrakt.filter((r) => {
      if (df && r.datum < df) return false;
      if (dt && r.datum > dt) return false;
      return true;
    });
  }, [vwExcelData, vwFrom, vwTo]);

  // ── VW Finance analytics ─────────────────────────────────────────────────
  const pct = (n, d) => (d ? (n / d) * 100 : 0);
  const f1  = (v) => v.toFixed(1) + '%';

  const vwAnalytics = useMemo(() => {
    if (!vwExcelData) return null;
    const goals = vwExcelData.goals;

    // Accumulate per region × nybeg
    const byKey = {};
    const getOrCreate = (nybeg, region) => {
      const key = `${nybeg}|${region}`;
      if (!byKey[key]) {
        const g = goals[key] || {};
        byKey[key] = { nybeg, region, total: 0, vfsCount: 0, opkCount: 0,
          vfsMal: g.vfsMal || 0, opkMal: g.opkMal || 0 };
      }
      return byKey[key];
    };

    filteredLeveranser.forEach((r) => {
      if (r.nybeg !== 'Ny' && r.nybeg !== 'Beg') return;
      getOrCreate(r.nybeg, r.region).total++;
    });

    filteredFinanskontrakt.forEach((r) => {
      if (r.nybeg !== 'Ny' && r.nybeg !== 'Beg') return;
      const d = getOrCreate(r.nybeg, r.region);
      d.vfsCount++;                          // all are VFS (VW Finance portal)
      if (r.opFi === 'OP') d.opkCount++;    // operational leasing subset
    });

    // Region order: sorted, from leveranser
    const regionOrder = [...new Set(filteredLeveranser
      .filter((r) => r.nybeg === 'Ny' || r.nybeg === 'Beg')
      .map((r) => r.region)
    )].sort();

    // Totals
    let nyTot = 0, nyVfsC = 0, nyOpkC = 0, nyVfsMalSum = 0, nyOpkMalSum = 0, nyRgnCount = 0;
    let begTot = 0, begVfsC = 0, begOpkC = 0, begVfsMalSum = 0, begOpkMalSum = 0, begRgnCount = 0;

    Object.values(byKey).forEach((d) => {
      if (d.nybeg === 'Ny') {
        nyTot += d.total; nyVfsC += d.vfsCount; nyOpkC += d.opkCount;
        nyVfsMalSum += d.vfsMal; nyOpkMalSum += d.opkMal; nyRgnCount++;
      } else {
        begTot += d.total; begVfsC += d.vfsCount; begOpkC += d.opkCount;
        begVfsMalSum += d.vfsMal; begOpkMalSum += d.opkMal; begRgnCount++;
      }
    });

    const avgNyVfsMal  = nyRgnCount  ? nyVfsMalSum  / nyRgnCount  : 0;
    const avgNyOpkMal  = nyRgnCount  ? nyOpkMalSum  / nyRgnCount  : 0;
    const avgBegVfsMal = begRgnCount ? begVfsMalSum / begRgnCount : 0;
    const avgBegOpkMal = begRgnCount ? begOpkMalSum / begRgnCount : 0;

    const labels = [...regionOrder, 'Total'];

    const getVal = (nb, r, field) => {
      if (r === 'Total') {
        const tot = nb === 'Ny' ? nyTot  : begTot;
        const vC  = nb === 'Ny' ? nyVfsC : begVfsC;
        const oC  = nb === 'Ny' ? nyOpkC : begOpkC;
        const vM  = nb === 'Ny' ? avgNyVfsMal  : avgBegVfsMal;
        const oM  = nb === 'Ny' ? avgNyOpkMal  : avgBegOpkMal;
        if (field === 'vfsGrad')  return pct(vC, tot);
        if (field === 'opkGrad')  return pct(oC, tot);
        if (field === 'vfsMal')   return vM;
        if (field === 'opkMal')   return oM;
        if (field === 'vfsCount') return vC;
        if (field === 'opkCount') return oC;
        return tot;
      }
      const d = byKey[`${nb}|${r}`];
      if (!d) return 0;
      if (field === 'vfsGrad') return pct(d.vfsCount, d.total);
      if (field === 'opkGrad') return pct(d.opkCount, d.total);
      return d[field] || 0;
    };

    return { labels, getVal, regionOrder, byKey,
      nyTot, nyVfsC, nyOpkC, begTot, begVfsC, begOpkC,
      avgNyVfsMal, avgNyOpkMal, avgBegVfsMal, avgBegOpkMal };
  }, [filteredLeveranser, filteredFinanskontrakt, vwExcelData]);

  // ── Filtered stockrapporten (by Start Datum) ─────────────────────────────
  const filteredStock = useMemo(() => {
    if (!rawData.length) return [];
    const df = stockFrom ? new Date(stockFrom) : null;
    const dt = stockTo   ? new Date(stockTo + 'T23:59:59') : null;
    // Only personbilar (Objektsgrupp = Personbil) and active contracts
    return rawData.filter((r) => {
      if (df || dt) {
        const start = r['Start Datum'];
        if (!start || isNaN(start)) return false;
        if (df && start < df) return false;
        if (dt && start > dt) return false;
      }
      return true;
    });
  }, [rawData, stockFrom, stockTo]);

  // ── Finansbolagsfördelning från stockrapporten ───────────────────────────
  const stockFinansbolag = useMemo(() => {
    if (!filteredStock.length) return null;
    const byCompany = {};
    filteredStock.forEach((r) => {
      const name = r['Leverantörsnamn'] || 'Okänt';
      byCompany[name] = (byCompany[name] || 0) + 1;
    });
    return Object.entries(byCompany).sort((a, b) => b[1] - a[1]);
  }, [filteredStock]);

  const stockFinansbolagNyBeg = useMemo(() => {
    if (!filteredStock.length) return null;
    const ny = {}, beg = {};
    filteredStock.forEach((r) => {
      const name  = r['Leverantörsnamn'] || 'Okänt';
      // Begagnat = 'Yes' → begagnad, 'No' → ny
      const bucket = r['Begagnat'] === 'No' ? ny : beg;
      bucket[name] = (bucket[name] || 0) + 1;
    });
    return { ny, beg };
  }, [filteredStock]);

  // ── Stock summary ────────────────────────────────────────────────────────
  const stockSummary = useMemo(() => {
    if (!filteredStock.length) return null;
    const total    = filteredStock.length;
    const active   = filteredStock.filter((r) => r['Status kontraktsrad'] === 'Active').length;
    const ny       = filteredStock.filter((r) => r['Begagnat'] === 'No').length;
    const beg      = filteredStock.filter((r) => r['Begagnat'] === 'Yes').length;
    const totalFin = filteredStock.reduce((s, r) => s + (r['Finansierat Belopp'] || 0), 0);
    return { total, active, ny, beg, totalFin };
  }, [filteredStock]);

  // ── Upload screen ────────────────────────────────────────────────────────
  if (!vwExcelData) {
    return (
      <div className="vw-upload-state">
        <svg width="48" height="48" fill="none" stroke="#ccc" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p><strong>Ladda upp Volkswagen Finans Excel-rapport</strong></p>
        <p style={{ fontSize: '.85em', color: '#999' }}>Rapporten "ÅF Utfall mot mål" (.xlsx) från VW Finance-portalen</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        <button className="vw-upload-btn-large" onClick={() => fileRef.current.click()}>Välj ÅF Utfall mot mål (.xlsx)…</button>
      </div>
    );
  }

  const { labels, getVal, regionOrder, byKey } = vwAnalytics;
  const tickPct = { ticks: { callback: (v) => v.toFixed(0) + '%' } };
  const DOUGHNUT_COLORS = ['#4472C4','#70AD47','#ED7D31','#FFC000','#A9C4E8','#C5E0B4','#FF7F7F','#9E480E','#636363','#997300'];

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />

      {/* ── Info bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '10px 20px', background: '#f5f7fa', borderBottom: '1px solid #e8ecf0', fontSize: '.85em', color: '#555', flexWrap: 'wrap' }}>
        <span><strong>VW Finans rapport:</strong> <span style={{ color: '#0f3460' }}>{reportName}</span></span>
        <span><strong>Rapportens period:</strong> <span style={{ color: '#0f3460' }}>{vwExcelData.period}</span></span>
        <span><strong>Leveranser:</strong> {filteredLeveranser.length} st</span>
        <span><strong>Finanskontrakt:</strong> {filteredFinanskontrakt.length} st</span>
        <button className="filter-clear-btn" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '.8em' }} onClick={() => fileRef.current.click()}>Ladda ny Excel-rapport</button>
      </div>

      {/* ── Period controls ── */}
      <div className="section" style={{ padding: '14px 20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <DateFilter
            label="VW Finans — Leverans-/kontraktsperiod"
            hint="Filtrerar Leveransdatum (leveranser) och Startdatum (finanskontrakt) i Excel-filen"
            preset={vwPreset} from={vwFrom} to={vwTo}
            onPreset={handleVwPreset} onFrom={setVwFrom} onTo={setVwTo}
          />
          <DateFilter
            label="Stockrapporten — Kontraktsperiod"
            hint="Filtrerar Start Datum i stockrapporten (CSV)"
            preset={stockPreset} from={stockFrom} to={stockTo}
            onPreset={handleStockPreset} onFrom={setStockFrom} onTo={setStockTo}
          />
        </div>
      </div>

      {/* ── VW Finance KPIs ── */}
      <div style={{ fontSize: '.78em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#888', marginBottom: 8, paddingLeft: 4 }}>
        VW Finans — {rangeLabel(vwPreset, vwFrom, vwTo)}
      </div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KPI label="Ny — Levererade"        value={vwAnalytics.nyTot.toLocaleString('sv-SE')} />
        <KPI label="Ny — VFS Finansierade"  value={vwAnalytics.nyVfsC.toLocaleString('sv-SE')} sub={f1(pct(vwAnalytics.nyVfsC, vwAnalytics.nyTot)) + ' finansgrad'} />
        <KPI label="Ny — VFS Mål"           value={f1(vwAnalytics.avgNyVfsMal)} />
        <KPI label="Ny — Op.leasing"        value={vwAnalytics.nyOpkC.toLocaleString('sv-SE')} sub={f1(pct(vwAnalytics.nyOpkC, vwAnalytics.nyTot)) + ' grad'} />
        <KPI label="Ny — Op.leasing Mål"    value={f1(vwAnalytics.avgNyOpkMal)} />
        <KPI label="Beg — Levererade"       value={vwAnalytics.begTot.toLocaleString('sv-SE')} />
        <KPI label="Beg — VFS Finansierade" value={vwAnalytics.begVfsC.toLocaleString('sv-SE')} sub={f1(pct(vwAnalytics.begVfsC, vwAnalytics.begTot)) + ' finansgrad'} />
        <KPI label="Beg — VFS Mål"          value={f1(vwAnalytics.avgBegVfsMal)} />
      </div>

      {/* ── Charts ── */}
      <div className="chart-row">
        <div className="chart-box">
          <Bar
            data={{
              labels,
              datasets: [
                { label: 'Beg VFS+Op.leasing', data: labels.map((r) => getVal('Beg', r, 'vfsGrad') + getVal('Beg', r, 'opkGrad')), backgroundColor: '#4472C4', borderRadius: 4 },
                { label: 'Mål tot. beg.',       data: labels.map((r) => getVal('Beg', r, 'vfsMal')),  type: 'line', borderColor: '#ED7D31', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2 },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { title: { display: true, text: 'Finansgrad Begagnat (VFS+Op.leasing)', font: { size: 13 } }, legend: { position: 'bottom' } }, scales: { y: tickPct } }}
          />
        </div>
        <div className="chart-box">
          <Bar
            data={{
              labels,
              datasets: [
                { label: 'Nytt VFS',       data: labels.map((r) => getVal('Ny',  r, 'vfsGrad')), backgroundColor: '#4472C4', borderRadius: 2 },
                { label: 'Beg VFS',        data: labels.map((r) => getVal('Beg', r, 'vfsGrad')), backgroundColor: '#A9C4E8', borderRadius: 2 },
                { label: 'Nytt Op.leas.',  data: labels.map((r) => getVal('Ny',  r, 'opkGrad')), backgroundColor: '#70AD47', borderRadius: 2 },
                { label: 'Beg Op.leas.',   data: labels.map((r) => getVal('Beg', r, 'opkGrad')), backgroundColor: '#C5E0B4', borderRadius: 2 },
                { label: 'VFS mål ny',     data: labels.map((r) => getVal('Ny',  r, 'vfsMal')),  type: 'line', borderColor: '#ED7D31', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2 },
                { label: 'VFS mål beg.',   data: labels.map((r) => getVal('Beg', r, 'vfsMal')),  type: 'line', borderColor: '#FFC000', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2 },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { title: { display: true, text: 'Finansgrad VFS + Op.leasing (Ny / Beg)', font: { size: 13 } }, legend: { position: 'bottom' } }, scales: { y: tickPct } }}
          />
        </div>
      </div>

      {/* ── Region table ── */}
      <div className="section">
        <h2>Sammanställning per region — {rangeLabel(vwPreset, vwFrom, vwTo)}</h2>
        <div className="table-scroll">
          <table id="tableVw">
            <thead>
              <tr>
                <th>Region</th>
                <th>Ny Lev.</th><th>Ny VFS</th><th>Ny VFS%</th><th>VFS Mål%</th>
                <th>Ny Op.leas.</th><th>Ny Op%</th><th>Op Mål%</th>
                <th>Beg Lev.</th><th>Beg VFS</th><th>Beg VFS%</th>
                <th>Beg Op.leas.</th><th>Beg Op%</th>
              </tr>
            </thead>
            <tbody>
              {regionOrder.map((r) => {
                const ny  = byKey[`Ny|${r}`]  || {};
                const beg = byKey[`Beg|${r}`] || {};
                return (
                  <tr key={r}>
                    <td><strong>{r}</strong></td>
                    <td>{ny.total    || 0}</td>
                    <td>{ny.vfsCount || 0}</td>
                    <td>{ny.total ? pct(ny.vfsCount, ny.total).toFixed(1) : '–'}%</td>
                    <td>{(ny.vfsMal  || 0).toFixed(0)}%</td>
                    <td>{ny.opkCount || 0}</td>
                    <td>{ny.total ? pct(ny.opkCount, ny.total).toFixed(1) : '–'}%</td>
                    <td>{(ny.opkMal  || 0).toFixed(0)}%</td>
                    <td>{beg.total    || 0}</td>
                    <td>{beg.vfsCount || 0}</td>
                    <td>{beg.total ? pct(beg.vfsCount, beg.total).toFixed(1) : '–'}%</td>
                    <td>{beg.opkCount || 0}</td>
                    <td>{beg.total ? pct(beg.opkCount, beg.total).toFixed(1) : '–'}%</td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ fontWeight: 700, borderTop: '2px solid #ddd' }}>
                <td>Total</td>
                <td>{vwAnalytics.nyTot}</td>
                <td>{vwAnalytics.nyVfsC}</td>
                <td>{pct(vwAnalytics.nyVfsC, vwAnalytics.nyTot).toFixed(1)}%</td>
                <td>{vwAnalytics.avgNyVfsMal.toFixed(0)}%</td>
                <td>{vwAnalytics.nyOpkC}</td>
                <td>{pct(vwAnalytics.nyOpkC, vwAnalytics.nyTot).toFixed(1)}%</td>
                <td>{vwAnalytics.avgNyOpkMal.toFixed(0)}%</td>
                <td>{vwAnalytics.begTot}</td>
                <td>{vwAnalytics.begVfsC}</td>
                <td>{pct(vwAnalytics.begVfsC, vwAnalytics.begTot).toFixed(1)}%</td>
                <td>{vwAnalytics.begOpkC}</td>
                <td>{pct(vwAnalytics.begOpkC, vwAnalytics.begTot).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Finansbolagsfördelning från stockrapporten ── */}
      {stockFinansbolag && stockFinansbolag.length > 0 && (
        <div className="section">
          <h2>
            Finansbolagsfördelning — Stockrapporten
            <span style={{ fontWeight: 400, fontSize: '.85em', color: '#888', marginLeft: 8 }}>
              {rangeLabel(stockPreset, stockFrom, stockTo)}
            </span>
          </h2>
          {stockSummary && (
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
              <KPI label="Kontrakt i perioden"  value={stockSummary.total.toLocaleString()} sub="totalt" />
              <KPI label="Aktiva kontrakt"       value={stockSummary.active.toLocaleString()} />
              <KPI label="Nya fordon"            value={stockSummary.ny.toLocaleString()} sub="Begagnat = Nej" />
              <KPI label="Begagnade fordon"      value={stockSummary.beg.toLocaleString()} sub="Begagnat = Ja" />
              <KPI label="Finansierat belopp"    value={(stockSummary.totalFin / 1e6).toFixed(1) + ' Mkr'} />
            </div>
          )}
          <div className="chart-row">
            <div className="chart-box" style={{ maxWidth: 420 }}>
              <Doughnut
                data={{
                  labels: stockFinansbolag.map(([name]) => name),
                  datasets: [{ data: stockFinansbolag.map(([, c]) => c), backgroundColor: DOUGHNUT_COLORS, borderWidth: 1 }],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    title: { display: true, text: 'Alla kontrakt per finansbolag', font: { size: 13 } },
                    legend: { position: 'right' },
                    tooltip: { callbacks: { label: (ctx) => {
                      const tot = ctx.dataset.data.reduce((a, b) => a + b, 0);
                      return ` ${ctx.label}: ${ctx.raw} (${((ctx.raw / tot) * 100).toFixed(1)}%)`;
                    }}},
                  },
                }}
              />
            </div>
            <div className="chart-box">
              <Bar
                data={{
                  labels: stockFinansbolag.map(([name]) => name),
                  datasets: [
                    { label: 'Nya fordon',      data: stockFinansbolag.map(([name]) => stockFinansbolagNyBeg?.ny[name]  || 0), backgroundColor: '#4472C4', borderRadius: 4 },
                    { label: 'Begagnade fordon', data: stockFinansbolag.map(([name]) => stockFinansbolagNyBeg?.beg[name] || 0), backgroundColor: '#A9C4E8', borderRadius: 4 },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { title: { display: true, text: 'Kontrakt per finansbolag (Ny / Beg)', font: { size: 13 } }, legend: { position: 'bottom' } },
                  scales: { x: { stacked: true }, y: { stacked: true } },
                }}
              />
            </div>
          </div>
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Finansbolag</th>
                  <th style={{ textAlign: 'right' }}>Totalt</th>
                  <th style={{ textAlign: 'right' }}>Andel</th>
                  <th style={{ textAlign: 'right' }}>Nya</th>
                  <th style={{ textAlign: 'right' }}>Begagnade</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const grandTotal = stockFinansbolag.reduce((s, [, c]) => s + c, 0);
                  return stockFinansbolag.map(([name, count]) => (
                    <tr key={name}>
                      <td><strong>{name}</strong></td>
                      <td style={{ textAlign: 'right' }}>{count}</td>
                      <td style={{ textAlign: 'right' }}>{((count / grandTotal) * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: 'right' }}>{stockFinansbolagNyBeg?.ny[name]  || 0}</td>
                      <td style={{ textAlign: 'right' }}>{stockFinansbolagNyBeg?.beg[name] || 0}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 4, marginBottom: 20 }}>
        <button className="filter-clear-btn" onClick={() => fileRef.current.click()}>Ladda ny Excel-rapport</button>
      </div>
    </div>
  );
}
