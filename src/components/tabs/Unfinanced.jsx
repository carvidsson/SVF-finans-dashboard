import React, { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { COLORS, DARK, fmtNum, fmtDate, mkr } from '../../utils/formatters';

function KPI({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export default function Unfinanced() {
  const { filteredData, openDrawer } = useData();
  const now = new Date();
  const [filterType, setFilterType] = useState('all');
  const [metric, setMetric] = useState('nuvarde');

  const contractTypes = useMemo(
    () => [...new Set(filteredData.map((r) => r['Kontraktstyp']).filter(Boolean))].sort(),
    [filteredData]
  );

  const data = useMemo(() => {
    let d = filteredData.filter((r) => r['Status kontraktsrad'] === 'Active');
    if (filterType !== 'all') d = d.filter((r) => r['Kontraktstyp'] === filterType);
    return d;
  }, [filteredData, filterType]);

  const metricField = metric === 'nuvarde' ? 'Nuvärde' : metric === 'finansierat' ? 'Finansierat Belopp' : 'Obetalt (ink VAT)';
  const metricLabel = metric === 'nuvarde' ? 'Restskuld (Nuvärde)' : metric === 'finansierat' ? 'Finansierat belopp' : 'Obetalt belopp';

  const companies = useMemo(() => [...new Set(data.map((r) => r['Leverantörsnamn']).filter(Boolean))].sort(), [data]);

  const kpis = useMemo(() => {
    const totalNuv = data.reduce((s, r) => s + (r['Nuvärde'] || 0), 0);
    const totalFin = data.reduce((s, r) => s + (r['Finansierat Belopp'] || 0), 0);
    const totalObetalt = data.reduce((s, r) => s + (r['Obetalt (ink VAT)'] || 0), 0);
    const rates = data.filter((r) => r['Aktuell ränta'] > 0).map((r) => r['Aktuell ränta']);
    const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    return { totalNuv, totalFin, totalObetalt, avgRate };
  }, [data]);

  // Area chart data
  const areaChart = useMemo(() => {
    const monthMap = {};
    data.forEach((r) => {
      if (!r['Start Datum'] || isNaN(r['Start Datum'])) return;
      const d = r['Start Datum'];
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const co = r['Leverantörsnamn'] || 'Okänd';
      if (!monthMap[key]) monthMap[key] = {};
      monthMap[key][co] = (monthMap[key][co] || 0) + (r[metricField] || 0);
    });
    const months = Object.keys(monthMap).sort();
    const monthLabels = months.map((m) => {
      const [y, mo] = m.split('-');
      return new Date(+y, +mo - 1, 1).toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' }).replace(' ', '-');
    });
    const barDatasets = companies.map((co, i) => ({
      label: co,
      type: 'bar',
      data: months.map((m) => Math.round((monthMap[m]?.[co] || 0) / 1000)),
      backgroundColor: COLORS[i % COLORS.length] + 'cc',
      borderColor: COLORS[i % COLORS.length],
      borderWidth: 0,
      stack: 'bolag',
    }));
    const totalLine = months.map((m) => Math.round(companies.reduce((s, co) => s + (monthMap[m]?.[co] || 0), 0) / 1000));
    barDatasets.push({ label: 'Total', type: 'line', data: totalLine, borderColor: DARK, backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 2, fill: false, tension: 0.25, order: 0 });
    return { labels: monthLabels, datasets: barDatasets };
  }, [data, companies, metricField]);

  const companyTotals = useMemo(() => {
    const totalMetric = data.reduce((s, r) => s + (r[metricField] || 0), 0);
    return companies.map((co) => {
      const rows = data.filter((r) => r['Leverantörsnamn'] === co);
      const metric_ = rows.reduce((s, r) => s + (r[metricField] || 0), 0);
      const nuv = rows.reduce((s, r) => s + (r['Nuvärde'] || 0), 0);
      const fin = rows.reduce((s, r) => s + (r['Finansierat Belopp'] || 0), 0);
      const obetalt = rows.reduce((s, r) => s + (r['Obetalt (ink VAT)'] || 0), 0);
      const rates = rows.filter((r) => r['Aktuell ränta'] > 0).map((r) => r['Aktuell ränta']);
      return { co, metric: metric_, nuv, fin, obetalt, count: rows.length, rates, pct: totalMetric > 0 ? (metric_ / totalMetric * 100).toFixed(1) : '0' };
    }).sort((a, b) => b.metric - a.metric);
  }, [data, companies, metricField]);

  const [detailSearch, setDetailSearch] = useState('');
  const detailRows = useMemo(() => {
    let d = [...data].sort((a, b) => (b['Nuvärde'] || 0) - (a['Nuvärde'] || 0)).slice(0, 1000);
    if (detailSearch) {
      const q = detailSearch.toLowerCase();
      d = d.filter((r) => [r['Kundnamn'], r['Kund'], r['Kontrakt']].join(' ').toLowerCase().includes(q));
    }
    return d;
  }, [data, detailSearch]);

  return (
    <div>
      <div className="section" style={{ padding: '16px 20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="filter-group">
            <label>Kontraktstyp (obelånade)</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, minWidth: 220 }}>
              <option value="all">Alla kontraktstyper</option>
              {contractTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Visa nyckeltal</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, minWidth: 180 }}>
              <option value="nuvarde">Restskuld (Nuvärde)</option>
              <option value="finansierat">Finansierat belopp</option>
              <option value="obetalt">Obetalt belopp</option>
            </select>
          </div>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KPI label="Aktiva kontrakt" value={data.length.toLocaleString()} sub={filterType !== 'all' ? filterType : 'alla typer'} />
        <KPI label="Total restskuld" value={mkr(kpis.totalNuv)} sub="nuvärde aktiva" />
        <KPI label="Finansierat belopp" value={mkr(kpis.totalFin)} sub="ursprungligt" />
        <KPI label="Obetalt" value={fmtNum(kpis.totalObetalt) + ' kr'} sub="ink. moms" />
        <KPI label="Snittränta" value={kpis.avgRate.toFixed(2) + '%'} sub="aktiva kontrakt" />
        <KPI label="Bolag / Orter" value={companies.length} sub="leverantörer" />
      </div>

      <div className="section">
        <h2>{metricLabel} per bolag — per startmånad</h2>
        <Bar
          data={areaChart}
          options={{
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { stacked: true, ticks: { maxRotation: 90, font: { size: 8 } } },
              y: { stacked: true, beginAtZero: true, title: { display: true, text: metricLabel + ' (tkr)' } },
            },
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw || 0).toLocaleString('sv-SE')} tkr` } },
            },
          }}
          height={350}
        />
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <h3>Aktuell fördelning per bolag</h3>
          <Doughnut
            data={{ labels: companyTotals.map((c) => c.co), datasets: [{ data: companyTotals.map((c) => Math.round(c.metric / 1000)), backgroundColor: COLORS }] }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${(ctx.raw || 0).toLocaleString('sv-SE')} tkr` } } } }}
          />
        </div>
        <div className="chart-box">
          <h3>Antal aktiva kontrakt per bolag</h3>
          <Bar
            data={{ labels: companyTotals.map((c) => c.co), datasets: [{ data: companyTotals.map((c) => c.count), backgroundColor: COLORS.concat(COLORS) }] }}
            options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'Antal kontrakt' } } } }}
          />
        </div>
      </div>

      <div className="section">
        <h2>Sammanställning per bolag / leverantör</h2>
        <div className="table-scroll">
          <table id="tableUnf">
            <thead>
              <tr><th>Bolag / Leverantör</th><th>Antal kontrakt</th><th>Restskuld (Nuvärde)</th><th>Finansierat belopp</th><th>Obetalt</th><th>Snittränta</th><th>Andel av portfölj</th></tr>
            </thead>
            <tbody>
              {companyTotals.map((c) => {
                const ar = c.rates.length ? (c.rates.reduce((a, b) => a + b, 0) / c.rates.length).toFixed(2) + '%' : '-';
                return (
                  <tr key={c.co}>
                    <td><strong>{c.co}</strong></td>
                    <td>{c.count}</td>
                    <td>{fmtNum(c.nuv)} kr</td>
                    <td>{fmtNum(c.fin)} kr</td>
                    <td>{c.obetalt > 0 ? <span className="badge badge-red">{fmtNum(c.obetalt)} kr</span> : '-'}</td>
                    <td>{ar}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: '#f0f2f5', borderRadius: 4, height: 8 }}>
                          <div style={{ width: c.pct + '%', background: '#0f3460', height: 8, borderRadius: 4 }} />
                        </div>
                        {c.pct}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2>Kontraktslista</h2>
        <input className="search-input" placeholder="Sök kund / kontrakt..." value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} />
        <div className="table-scroll">
          <table id="tableUnfDetail">
            <thead>
              <tr><th>Kund</th><th>Kundtyp</th><th>Kontrakt</th><th>Kontraktstyp</th><th>Bolag</th><th>Fordon</th><th>Regnr</th><th>Start</th><th>Slut</th><th>Mån kvar</th><th>Finansierat</th><th>Nuvärde</th><th>Obetalt</th><th>Ränta</th><th>Månadsbet.</th></tr>
            </thead>
            <tbody>
              {detailRows.map((r) => {
                const mLeft = r['Slutdatum'] && !isNaN(r['Slutdatum'])
                  ? Math.max(0, Math.round((r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44)))
                  : null;
                const bc = mLeft !== null ? (mLeft <= 6 ? 'badge-red' : mLeft <= 12 ? 'badge-yellow' : 'badge-blue') : '';
                return (
                  <tr key={r['Kontrakt']} className="clickable-row" onClick={() => openDrawer('contract', r['Kontrakt'])}>
                    <td onClick={(e) => { e.stopPropagation(); openDrawer('customer', r['Kund']); }} style={{ textDecoration: 'underline', cursor: 'pointer' }}>{r['Kundnamn'] || ''}</td>
                    <td>{r['Kundtyp'] || ''}</td><td>{r['Kontrakt'] || ''}</td>
                    <td>{r['Kontraktstyp'] || ''}</td><td>{r['Leverantörsnamn'] || ''}</td>
                    <td>{r['Fakturatext'] || ''}</td><td>{r['Registreringsnummer'] || ''}</td>
                    <td>{fmtDate(r['Start Datum'])}</td><td>{fmtDate(r['Slutdatum'])}</td>
                    <td>{mLeft !== null ? <span className={`badge ${bc}`}>{mLeft} mån</span> : '-'}</td>
                    <td>{fmtNum(r['Finansierat Belopp'])} kr</td>
                    <td>{fmtNum(r['Nuvärde'])} kr</td>
                    <td>{(r['Obetalt (ink VAT)'] || 0) > 0 ? <span className="badge badge-red">{fmtNum(r['Obetalt (ink VAT)'])} kr</span> : '-'}</td>
                    <td>{(r['Aktuell ränta'] || 0).toFixed(2)}%</td>
                    <td>{fmtNum(r['Aktuell per amort+rta'])} kr</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
