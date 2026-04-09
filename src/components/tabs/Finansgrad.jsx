import React, { useState, useRef, useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { parseVWExcel } from '../../utils/csvParser';
import MultiDropdown from '../MultiDropdown';

// ── Default objektsgrupp filter ───────────────────────────────────────────────
const DEFAULT_OBJ_FILTER = ['Fordon Personbil', 'Fordon Lätt lastbil'];

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

function fmtMkr(v) {
  if (!v) return '0 kr';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' Mkr';
  return v.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

// ── DateFilter sub-component ─────────────────────────────────────────────────
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
function KPI({ label, value, sub, highlight, accent }) {
  return (
    <div className="kpi" style={highlight ? { borderLeft: `3px solid ${accent || '#4472C4'}` } : {}}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

const pct = (n, d) => (d ? (n / d) * 100 : 0);
const f1  = (v) => v.toFixed(1) + '%';
const COLORS = ['#4472C4','#70AD47','#ED7D31','#FFC000','#A9C4E8','#C5E0B4','#FF7F7F','#9E480E','#636363','#997300'];

// ── Main component ────────────────────────────────────────────────────────────
export default function Finansgrad() {
  const { rawData } = useData();
  const fileRef = useRef();

  const [vwExcelData, setVwExcelData] = useState(null);
  const [reportName, setReportName]   = useState('—');

  // VW Finance date filter
  const [vwPreset, setVwPreset] = useState('all');
  const [vwFrom,   setVwFrom]   = useState('');
  const [vwTo,     setVwTo]     = useState('');

  // Stockrapporten date filter
  const [stockPreset, setStockPreset] = useState('all');
  const [stockFrom,   setStockFrom]   = useState('');
  const [stockTo,     setStockTo]     = useState('');

  // Objektsgrupp filter — default Personbil + Lätt lastbil
  const [objFilter, setObjFilter] = useState(DEFAULT_OBJ_FILTER);

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
    if (preset !== 'custom') { const { from, to } = computePresetDates(preset); setVwFrom(from); setVwTo(to); }
  };
  const handleStockPreset = (preset) => {
    setStockPreset(preset);
    if (preset !== 'custom') { const { from, to } = computePresetDates(preset); setStockFrom(from); setStockTo(to); }
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

  // ── Unique objektsgrupp values from stockrapporten ───────────────────────
  const uniqueObjTypes = useMemo(
    () => [...new Set(rawData.map((r) => r['Objektsgrupp Beskrivning']).filter(Boolean))].sort(),
    [rawData]
  );

  // ── Filtered stockrapporten (date + objektsgrupp) ────────────────────────
  const filteredStock = useMemo(() => {
    if (!rawData.length) return [];
    const df = stockFrom ? new Date(stockFrom) : null;
    const dt = stockTo   ? new Date(stockTo + 'T23:59:59') : null;
    return rawData.filter((r) => {
      // Objektsgrupp filter
      if (objFilter.length > 0) {
        const og = r['Objektsgrupp Beskrivning'] || '';
        if (!objFilter.includes(og)) return false;
      }
      // Date filter
      if (df || dt) {
        const start = r['Start Datum'];
        if (!start || isNaN(start)) return false;
        if (df && start < df) return false;
        if (dt && start > dt) return false;
      }
      return true;
    });
  }, [rawData, stockFrom, stockTo, objFilter]);

  // ── VW Finance analytics ─────────────────────────────────────────────────
  const vwAnalytics = useMemo(() => {
    if (!vwExcelData) return null;
    const goals = vwExcelData.goals;
    const byKey = {};
    const getOrCreate = (nybeg, region) => {
      const key = `${nybeg}|${region}`;
      if (!byKey[key]) {
        const g = goals[key] || {};
        byKey[key] = { nybeg, region, total: 0, vfsCount: 0, opkCount: 0, serviceCount: 0, belopp: 0, vfsMal: g.vfsMal || 0, opkMal: g.opkMal || 0 };
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
      d.vfsCount++;
      d.belopp += r.belopp || 0;
      if (r.opFi === 'OP' || r.opFi.startsWith('OPER')) d.opkCount++;
      if (r.service) d.serviceCount++;
    });

    const regionOrder = [...new Set(
      filteredLeveranser.filter((r) => r.nybeg === 'Ny' || r.nybeg === 'Beg').map((r) => r.region)
    )].sort();

    let nyTot = 0, nyVfsC = 0, nyOpkC = 0, nySvcC = 0, nyBelopp = 0;
    let nyVfsMalSum = 0, nyOpkMalSum = 0, nyRgnCount = 0;
    let begTot = 0, begVfsC = 0, begOpkC = 0, begSvcC = 0, begBelopp = 0;
    let begVfsMalSum = 0, begOpkMalSum = 0, begRgnCount = 0;

    Object.values(byKey).forEach((d) => {
      if (d.nybeg === 'Ny') {
        nyTot += d.total; nyVfsC += d.vfsCount; nyOpkC += d.opkCount;
        nySvcC += d.serviceCount; nyBelopp += d.belopp;
        nyVfsMalSum += d.vfsMal; nyOpkMalSum += d.opkMal; nyRgnCount++;
      } else {
        begTot += d.total; begVfsC += d.vfsCount; begOpkC += d.opkCount;
        begSvcC += d.serviceCount; begBelopp += d.belopp;
        begVfsMalSum += d.vfsMal; begOpkMalSum += d.opkMal; begRgnCount++;
      }
    });

    const avgNyVfsMal  = nyRgnCount  ? nyVfsMalSum  / nyRgnCount  : 0;
    const avgNyOpkMal  = nyRgnCount  ? nyOpkMalSum  / nyRgnCount  : 0;
    const avgBegVfsMal = begRgnCount ? begVfsMalSum / begRgnCount : 0;
    const avgBegOpkMal = begRgnCount ? begOpkMalSum / begRgnCount : 0;

    return {
      byKey, regionOrder,
      nyTot, nyVfsC, nyOpkC, nySvcC, nyBelopp,
      begTot, begVfsC, begOpkC, begSvcC, begBelopp,
      avgNyVfsMal, avgNyOpkMal, avgBegVfsMal, avgBegOpkMal,
      hasService: filteredFinanskontrakt.some((r) => r.service),
      hasBelopp:  filteredFinanskontrakt.some((r) => r.belopp > 0),
    };
  }, [filteredLeveranser, filteredFinanskontrakt, vwExcelData]);

  // ── Stockrapporten — per finansbolag ─────────────────────────────────────
  const stockFinansbolag = useMemo(() => {
    if (!filteredStock.length) return [];
    const byCompany = {};
    filteredStock.forEach((r) => {
      const name = r['Leverantörsnamn'] || 'Okänt';
      if (!byCompany[name]) byCompany[name] = { count: 0, ny: 0, beg: 0, belopp: 0, active: 0 };
      byCompany[name].count++;
      byCompany[name].belopp += r['Finansierat Belopp'] || 0;
      if (r['Begagnat'] === 'No') byCompany[name].ny++;
      else byCompany[name].beg++;
      if (r['Status kontraktsrad'] === 'Active') byCompany[name].active++;
    });
    return Object.entries(byCompany)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, v]) => ({ name, ...v }));
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

  const { byKey, regionOrder,
    nyTot, nyVfsC, nyOpkC, nySvcC, nyBelopp,
    begTot, begVfsC, begOpkC, begSvcC, begBelopp,
    avgNyVfsMal, avgNyOpkMal, avgBegVfsMal, avgBegOpkMal,
    hasService, hasBelopp,
  } = vwAnalytics;

  const tickPct = { ticks: { callback: (v) => v.toFixed(0) + '%' } };
  const regLabels = [...regionOrder, 'Total'];
  const getByKey  = (nb, r) => byKey[`${nb}|${r}`] || {};
  const getTotal  = (nb) => nb === 'Ny'
    ? { total: nyTot, vfsCount: nyVfsC, opkCount: nyOpkC, vfsMal: avgNyVfsMal, opkMal: avgNyOpkMal }
    : { total: begTot, vfsCount: begVfsC, opkCount: begOpkC, vfsMal: avgBegVfsMal, opkMal: avgBegOpkMal };
  const getField  = (nb, r, field) => {
    const d = r === 'Total' ? getTotal(nb) : getByKey(nb, r);
    if (field === 'vfsGrad') return pct(d.vfsCount || 0, d.total || 0);
    if (field === 'opkGrad') return pct(d.opkCount || 0, d.total || 0);
    return d[field] || 0;
  };

  const grandStockTotal = stockFinansbolag.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />

      {/* ── Info bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '10px 20px', background: '#f5f7fa', borderBottom: '1px solid #e8ecf0', fontSize: '.85em', color: '#555', flexWrap: 'wrap' }}>
        <span><strong>VW Finans rapport:</strong> <span style={{ color: '#0f3460' }}>{reportName}</span></span>
        <span><strong>Period:</strong> <span style={{ color: '#0f3460' }}>{vwExcelData.period}</span></span>
        <span><strong>Leveranser i fil:</strong> {vwExcelData.leveranser.length} st</span>
        <span><strong>VFS kontrakt i fil:</strong> {vwExcelData.finanskontrakt.length} st</span>
        <button className="filter-clear-btn" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '.8em' }} onClick={() => fileRef.current.click()}>Ladda ny Excel-rapport</button>
      </div>

      {/* ── Period + objektsgrupp controls ── */}
      <div className="section" style={{ padding: '14px 20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <DateFilter
            label="VW Finans — Leverans-/kontraktsperiod"
            hint="Filtrerar Leveransdatum (leveranser) och Startdatum (finanskontrakt)"
            preset={vwPreset} from={vwFrom} to={vwTo}
            onPreset={handleVwPreset} onFrom={setVwFrom} onTo={setVwTo}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DateFilter
              label="Stockrapporten — Kontraktsperiod"
              hint="Filtrerar Start Datum i stockrapporten (CSV)"
              preset={stockPreset} from={stockFrom} to={stockTo}
              onPreset={handleStockPreset} onFrom={setStockFrom} onTo={setStockTo}
            />
            {/* Objektsgrupp filter */}
            <div className="filter-group">
              <label style={{ fontSize: '.85em', fontWeight: 600, color: '#666', marginBottom: 4 }}>
                Fordonstyp (Objektsgrupp)
                {objFilter.length > 0 && objFilter.length < uniqueObjTypes.length && (
                  <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>— {objFilter.length} valda</span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MultiDropdown
                  id="objFilter"
                  label="Fordonstyp"
                  placeholder="Alla fordonstyper"
                  options={uniqueObjTypes}
                  selected={objFilter}
                  onChange={setObjFilter}
                />
                {objFilter.length !== DEFAULT_OBJ_FILTER.length && (
                  <button
                    className="filter-clear-btn"
                    style={{ fontSize: '.75em', padding: '4px 10px' }}
                    onClick={() => setObjFilter(DEFAULT_OBJ_FILTER)}
                  >
                    Återställ standard
                  </button>
                )}
                <button
                  className="filter-clear-btn"
                  style={{ fontSize: '.75em', padding: '4px 10px' }}
                  onClick={() => setObjFilter([])}
                >
                  Visa alla
                </button>
              </div>
              <div style={{ fontSize: '.72em', color: '#aaa', marginTop: 3 }}>
                Standard: Fordon Personbil + Fordon Lätt lastbil
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SEKTION 1 — VW Finans (från Excel)
      ════════════════════════════════════════════════════════════════════ */}
      <div style={{ fontSize: '.78em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#888', marginBottom: 8, paddingLeft: 4 }}>
        VW Finans — {rangeLabel(vwPreset, vwFrom, vwTo)}
      </div>

      {/* KPI Ny */}
      <div style={{ fontSize: '.72em', fontWeight: 700, textTransform: 'uppercase', color: '#4472C4', letterSpacing: '.4px', marginBottom: 4, paddingLeft: 2 }}>Ny</div>
      <div className="kpi-grid" style={{ marginBottom: 8 }}>
        <KPI label="Levererade"           value={nyTot.toLocaleString('sv-SE')} highlight accent="#4472C4" />
        <KPI label="VFS Finanskontrakt"   value={nyVfsC.toLocaleString('sv-SE')} sub={f1(pct(nyVfsC, nyTot)) + ' finansgrad'} highlight accent="#4472C4" />
        <KPI label="VFS Mål"              value={f1(avgNyVfsMal)} />
        <KPI label="Op.leasing"           value={nyOpkC.toLocaleString('sv-SE')} sub={f1(pct(nyOpkC, nyTot)) + ' av lev.'} />
        <KPI label="Op.leasing Mål"       value={f1(avgNyOpkMal)} />
        {hasService && <KPI label="Serviceavtal" value={nySvcC.toLocaleString('sv-SE')} sub={f1(pct(nySvcC, nyVfsC)) + ' av VFS'} />}
        {hasBelopp  && <KPI label="Finansierat belopp" value={fmtMkr(nyBelopp)} />}
      </div>

      {/* KPI Beg */}
      <div style={{ fontSize: '.72em', fontWeight: 700, textTransform: 'uppercase', color: '#7a9cc5', letterSpacing: '.4px', marginBottom: 4, paddingLeft: 2 }}>Begagnat</div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KPI label="Levererade"           value={begTot.toLocaleString('sv-SE')} highlight accent="#A9C4E8" />
        <KPI label="VFS Finanskontrakt"   value={begVfsC.toLocaleString('sv-SE')} sub={f1(pct(begVfsC, begTot)) + ' finansgrad'} highlight accent="#A9C4E8" />
        <KPI label="VFS Mål"              value={f1(avgBegVfsMal)} />
        <KPI label="Op.leasing"           value={begOpkC.toLocaleString('sv-SE')} sub={f1(pct(begOpkC, begTot)) + ' av lev.'} />
        <KPI label="Op.leasing Mål"       value={f1(avgBegOpkMal)} />
        {hasService && <KPI label="Serviceavtal" value={begSvcC.toLocaleString('sv-SE')} sub={f1(pct(begSvcC, begVfsC)) + ' av VFS'} />}
        {hasBelopp  && <KPI label="Finansierat belopp" value={fmtMkr(begBelopp)} />}
      </div>

      {/* VW Charts */}
      <div className="chart-row">
        <div className="chart-box">
          <Bar
            data={{
              labels: regLabels,
              datasets: [
                { label: 'Ny — Levererade',         data: regLabels.map((r) => r === 'Total' ? nyTot  : (getByKey('Ny',  r).total    || 0)), backgroundColor: '#4472C4', borderRadius: 4 },
                { label: 'Ny — VFS Finanskontrakt', data: regLabels.map((r) => r === 'Total' ? nyVfsC : (getByKey('Ny',  r).vfsCount || 0)), backgroundColor: '#70AD47', borderRadius: 4 },
                { label: 'Beg — Levererade',        data: regLabels.map((r) => r === 'Total' ? begTot  : (getByKey('Beg', r).total    || 0)), backgroundColor: '#A9C4E8', borderRadius: 4 },
                { label: 'Beg — VFS Finanskontrakt',data: regLabels.map((r) => r === 'Total' ? begVfsC : (getByKey('Beg', r).vfsCount || 0)), backgroundColor: '#C5E0B4', borderRadius: 4 },
              ],
            }}
            options={{
              responsive: true,
              plugins: { title: { display: true, text: 'Leveranser vs VFS Finanskontrakt (antal)', font: { size: 13 } }, legend: { position: 'bottom' } },
              scales: { y: { ticks: { stepSize: 1 } } },
            }}
          />
        </div>
        <div className="chart-box">
          <Bar
            data={{
              labels: regLabels,
              datasets: [
                { label: 'Ny VFS%',    data: regLabels.map((r) => getField('Ny',  r, 'vfsGrad')), backgroundColor: '#4472C4', borderRadius: 2 },
                { label: 'Beg VFS%',   data: regLabels.map((r) => getField('Beg', r, 'vfsGrad')), backgroundColor: '#A9C4E8', borderRadius: 2 },
                { label: 'Ny Op.leas%',data: regLabels.map((r) => getField('Ny',  r, 'opkGrad')), backgroundColor: '#70AD47', borderRadius: 2 },
                { label: 'Beg Op.leas%',data:regLabels.map((r) => getField('Beg', r, 'opkGrad')), backgroundColor: '#C5E0B4', borderRadius: 2 },
                { label: 'VFS mål Ny', data: regLabels.map((r) => getField('Ny',  r, 'vfsMal')),  type: 'line', borderColor: '#ED7D31', backgroundColor: 'transparent', pointRadius: 4, borderWidth: 2, borderDash: [4,3] },
                { label: 'VFS mål Beg',data: regLabels.map((r) => getField('Beg', r, 'vfsMal')),  type: 'line', borderColor: '#FFC000', backgroundColor: 'transparent', pointRadius: 4, borderWidth: 2, borderDash: [4,3] },
              ],
            }}
            options={{
              responsive: true,
              plugins: { title: { display: true, text: 'Finansgrad % per region (VFS + Op.leasing)', font: { size: 13 } }, legend: { position: 'bottom' } },
              scales: { y: tickPct },
            }}
          />
        </div>
      </div>

      {(nyOpkC > 0 || begOpkC > 0) && (
        <div className="chart-row">
          <div className="chart-box" style={{ maxWidth: 480 }}>
            <Bar
              data={{
                labels: regLabels,
                datasets: [
                  { label: 'Ny Op.leasing',  data: regLabels.map((r) => r === 'Total' ? nyOpkC  : (getByKey('Ny',  r).opkCount || 0)), backgroundColor: '#70AD47', borderRadius: 4 },
                  { label: 'Beg Op.leasing', data: regLabels.map((r) => r === 'Total' ? begOpkC : (getByKey('Beg', r).opkCount || 0)), backgroundColor: '#C5E0B4', borderRadius: 4 },
                  { label: 'Op.leas mål Ny%',data: regLabels.map((r) => getField('Ny', r, 'opkMal')), type: 'line', yAxisID: 'yPct', borderColor: '#ED7D31', backgroundColor: 'transparent', pointRadius: 4, borderWidth: 2, borderDash: [4,3] },
                ],
              }}
              options={{
                responsive: true,
                plugins: { title: { display: true, text: 'Op.leasing — antal + mål%', font: { size: 13 } }, legend: { position: 'bottom' } },
                scales: {
                  y:    { position: 'left',  ticks: { stepSize: 1 } },
                  yPct: { position: 'right', ...tickPct, grid: { drawOnChartArea: false } },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* VW Region table */}
      <div className="section">
        <h2>Sammanställning per region — {rangeLabel(vwPreset, vwFrom, vwTo)}</h2>
        <div className="table-scroll">
          <table id="tableVw">
            <thead>
              <tr>
                <th rowSpan={2}>Region</th>
                <th colSpan={hasBelopp ? 6 : 5} style={{ textAlign: 'center', background: '#dce6f1' }}>Ny</th>
                <th colSpan={hasBelopp ? 5 : 4} style={{ textAlign: 'center', background: '#e2efda' }}>Begagnat</th>
              </tr>
              <tr>
                <th style={{ background: '#dce6f1' }}>Lev.</th>
                <th style={{ background: '#dce6f1' }}>VFS</th>
                <th style={{ background: '#dce6f1' }}>VFS%</th>
                <th style={{ background: '#dce6f1' }}>Mål%</th>
                <th style={{ background: '#dce6f1' }}>Op.leas.</th>
                {hasBelopp && <th style={{ background: '#dce6f1' }}>Belopp</th>}
                <th style={{ background: '#e2efda' }}>Lev.</th>
                <th style={{ background: '#e2efda' }}>VFS</th>
                <th style={{ background: '#e2efda' }}>VFS%</th>
                <th style={{ background: '#e2efda' }}>Mål%</th>
                <th style={{ background: '#e2efda' }}>Op.leas.</th>
                {hasBelopp && <th style={{ background: '#e2efda' }}>Belopp</th>}
              </tr>
            </thead>
            <tbody>
              {regionOrder.map((r) => {
                const ny  = getByKey('Ny',  r);
                const beg = getByKey('Beg', r);
                return (
                  <tr key={r}>
                    <td><strong>{r}</strong></td>
                    <td>{ny.total    || 0}</td>
                    <td>{ny.vfsCount || 0}</td>
                    <td>{ny.total ? pct(ny.vfsCount, ny.total).toFixed(1) : '–'}%</td>
                    <td>{(ny.vfsMal || 0).toFixed(0)}%</td>
                    <td>{ny.opkCount || 0}</td>
                    {hasBelopp && <td>{fmtMkr(ny.belopp || 0)}</td>}
                    <td>{beg.total    || 0}</td>
                    <td>{beg.vfsCount || 0}</td>
                    <td>{beg.total ? pct(beg.vfsCount, beg.total).toFixed(1) : '–'}%</td>
                    <td>{(beg.vfsMal || 0).toFixed(0)}%</td>
                    <td>{beg.opkCount || 0}</td>
                    {hasBelopp && <td>{fmtMkr(beg.belopp || 0)}</td>}
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, borderTop: '2px solid #ddd' }}>
                <td>Total</td>
                <td>{nyTot}</td><td>{nyVfsC}</td>
                <td>{pct(nyVfsC, nyTot).toFixed(1)}%</td>
                <td>{avgNyVfsMal.toFixed(0)}%</td>
                <td>{nyOpkC}</td>
                {hasBelopp && <td>{fmtMkr(nyBelopp)}</td>}
                <td>{begTot}</td><td>{begVfsC}</td>
                <td>{pct(begVfsC, begTot).toFixed(1)}%</td>
                <td>{avgBegVfsMal.toFixed(0)}%</td>
                <td>{begOpkC}</td>
                {hasBelopp && <td>{fmtMkr(begBelopp)}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SEKTION 2 — Stockrapporten / Börjessons Finans (från CSV)
      ════════════════════════════════════════════════════════════════════ */}
      {rawData.length > 0 && (
        <div className="section">
          <h2>
            Börjessons Finans — Kontrakt per finansbolag
            <span style={{ fontWeight: 400, fontSize: '.85em', color: '#888', marginLeft: 8 }}>
              {rangeLabel(stockPreset, stockFrom, stockTo)}
              {objFilter.length > 0 && objFilter.length < uniqueObjTypes.length
                ? ` · ${objFilter.join(', ')}`
                : objFilter.length === 0 ? ' · Alla fordonstyper' : ''}
            </span>
          </h2>

          {/* Summary KPIs */}
          {stockSummary && (
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
              <KPI label="Kontrakt totalt"     value={stockSummary.total.toLocaleString('sv-SE')} highlight accent="#0f3460" />
              <KPI label="Aktiva kontrakt"     value={stockSummary.active.toLocaleString('sv-SE')} sub={f1(pct(stockSummary.active, stockSummary.total)) + ' av total'} />
              <KPI label="Nya fordon"          value={stockSummary.ny.toLocaleString('sv-SE')} sub={f1(pct(stockSummary.ny, stockSummary.total))} />
              <KPI label="Begagnade fordon"    value={stockSummary.beg.toLocaleString('sv-SE')} sub={f1(pct(stockSummary.beg, stockSummary.total))} />
              <KPI label="Finansierat belopp"  value={fmtMkr(stockSummary.totalFin)} />
            </div>
          )}

          {/* Per-finansbolag KPI row */}
          {stockFinansbolag.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '.72em', fontWeight: 700, textTransform: 'uppercase', color: '#888', letterSpacing: '.4px', marginBottom: 6 }}>Antal kontrakt per finansbolag</div>
              <div className="kpi-grid">
                {stockFinansbolag.map((d, i) => (
                  <KPI
                    key={d.name}
                    label={d.name}
                    value={d.count.toLocaleString('sv-SE')}
                    sub={`${((d.count / grandStockTotal) * 100).toFixed(1)}% · ${fmtMkr(d.belopp)}`}
                    highlight
                    accent={COLORS[i % COLORS.length]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          {stockFinansbolag.length > 0 && (
            <div className="chart-row">
              <div className="chart-box" style={{ maxWidth: 400 }}>
                <Doughnut
                  data={{
                    labels: stockFinansbolag.map((d) => d.name),
                    datasets: [{ data: stockFinansbolag.map((d) => d.count), backgroundColor: COLORS, borderWidth: 1 }],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      title: { display: true, text: 'Kontrakt per finansbolag', font: { size: 13 } },
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
                    labels: stockFinansbolag.map((d) => d.name),
                    datasets: [
                      { label: 'Nya fordon',       data: stockFinansbolag.map((d) => d.ny),  backgroundColor: '#4472C4', borderRadius: 4 },
                      { label: 'Begagnade fordon', data: stockFinansbolag.map((d) => d.beg), backgroundColor: '#A9C4E8', borderRadius: 4 },
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
          )}

          {/* Finansierat belopp per bolag */}
          {stockFinansbolag.some((d) => d.belopp > 0) && (
            <div className="chart-row" style={{ marginTop: 12 }}>
              <div className="chart-box">
                <Bar
                  data={{
                    labels: stockFinansbolag.map((d) => d.name),
                    datasets: [{
                      label: 'Finansierat belopp (Mkr)',
                      data: stockFinansbolag.map((d) => +(d.belopp / 1e6).toFixed(2)),
                      backgroundColor: COLORS.slice(0, stockFinansbolag.length),
                      borderRadius: 4,
                    }],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      title: { display: true, text: 'Finansierat belopp per finansbolag (Mkr)', font: { size: 13 } },
                      legend: { display: false },
                      tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} Mkr` } },
                    },
                    scales: { y: { ticks: { callback: (v) => v + ' Mkr' } } },
                  }}
                />
              </div>
            </div>
          )}

          {/* Table per finansbolag */}
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Finansbolag</th>
                  <th style={{ textAlign: 'right' }}>Totalt</th>
                  <th style={{ textAlign: 'right' }}>Andel</th>
                  <th style={{ textAlign: 'right' }}>Aktiva</th>
                  <th style={{ textAlign: 'right' }}>Nya</th>
                  <th style={{ textAlign: 'right' }}>Begagnade</th>
                  <th style={{ textAlign: 'right' }}>Finansierat belopp</th>
                </tr>
              </thead>
              <tbody>
                {stockFinansbolag.map((d) => (
                  <tr key={d.name}>
                    <td><strong>{d.name}</strong></td>
                    <td style={{ textAlign: 'right' }}>{d.count}</td>
                    <td style={{ textAlign: 'right' }}>{((d.count / grandStockTotal) * 100).toFixed(1)}%</td>
                    <td style={{ textAlign: 'right' }}>{d.active}</td>
                    <td style={{ textAlign: 'right' }}>{d.ny}</td>
                    <td style={{ textAlign: 'right' }}>{d.beg}</td>
                    <td style={{ textAlign: 'right' }}>{d.belopp > 0 ? fmtMkr(d.belopp) : '—'}</td>
                  </tr>
                ))}
                {stockFinansbolag.length > 1 && (
                  <tr style={{ fontWeight: 700, borderTop: '2px solid #ddd' }}>
                    <td>Total</td>
                    <td style={{ textAlign: 'right' }}>{grandStockTotal}</td>
                    <td style={{ textAlign: 'right' }}>100%</td>
                    <td style={{ textAlign: 'right' }}>{stockFinansbolag.reduce((s, d) => s + d.active, 0)}</td>
                    <td style={{ textAlign: 'right' }}>{stockFinansbolag.reduce((s, d) => s + d.ny, 0)}</td>
                    <td style={{ textAlign: 'right' }}>{stockFinansbolag.reduce((s, d) => s + d.beg, 0)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMkr(stockFinansbolag.reduce((s, d) => s + d.belopp, 0))}</td>
                  </tr>
                )}
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
