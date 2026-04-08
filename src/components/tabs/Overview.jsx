import React, { useMemo } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { COLORS, DARK, BLUE, ACCENT, TEAL, countBy } from '../../utils/formatters';
import { fmtNum } from '../../utils/formatters';

function ChartBox({ title, children }) {
  return (
    <div className="chart-box">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

export default function Overview() {
  const { filteredData, rawData, filters } = useData();
  const selectedDealers = filters.dealers;

  // All-status data for repurchase (respects other filters but ignores status filter)
  const repurchaseBase = useMemo(() => {
    const { dealers, sellers, custType, dateFrom, dateTo } = filters;
    const df = dateFrom ? new Date(dateFrom) : null;
    const dt = dateTo ? new Date(dateTo + 'T23:59:59') : null;
    return rawData.filter((r) => {
      if (dealers.length && !dealers.includes(r['Leverantörsnamn'])) return false;
      if (sellers.length && !sellers.includes(r['Case-ägare'])) return false;
      if (custType !== 'all' && r['Kundtyp'] !== custType) return false;
      if (df || dt) {
        const start = r['Start Datum'];
        if (!start || isNaN(start)) return false;
        if (df && start < df) return false;
        if (dt && start > dt) return false;
      }
      return true;
    });
  }, [rawData, filters]);

  // Growth
  const growthData = useMemo(() => {
    const growth = {};
    filteredData.forEach((r) => {
      if (!r['Start Datum'] || isNaN(r['Start Datum'])) return;
      const q = `${r['Start Datum'].getFullYear()}Q${Math.ceil((r['Start Datum'].getMonth() + 1) / 3)}`;
      if (!growth[q]) growth[q] = { count: 0, vol: 0 };
      growth[q].count++;
      growth[q].vol += r['Finansierat Belopp'] || 0;
    });
    const keys = Object.keys(growth).sort().filter((k) => k >= '2015Q1');
    return {
      labels: keys,
      datasets: [
        {
          label: 'Antal',
          data: keys.map((k) => growth[k].count),
          backgroundColor: DARK + '88',
          borderColor: DARK,
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          label: 'Volym (Mkr)',
          data: keys.map((k) => +(growth[k].vol / 1e6).toFixed(1)),
          type: 'line',
          borderColor: ACCENT,
          backgroundColor: ACCENT + '20',
          fill: true,
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    };
  }, [filteredData]);

  const growthOptions = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: { position: 'left', title: { display: true, text: 'Antal' } },
      y1: { position: 'right', title: { display: true, text: 'Mkr' }, grid: { drawOnChartArea: false } },
      x: { ticks: { maxRotation: 90, font: { size: 8 } } },
    },
  };

  // Doughnut charts
  const ctypes = useMemo(() => countBy(filteredData, 'Kontraktstyp'), [filteredData]);
  const vtypes = useMemo(() => countBy(filteredData, 'Objektsgrupp Beskrivning'), [filteredData]);
  const nuMap = useMemo(() => countBy(filteredData, 'Begagnat'), [filteredData]);
  const custTypeMap = useMemo(() => countBy(filteredData, 'Kundtyp'), [filteredData]);

  const nuLabels = Object.keys(nuMap).map((k) => (k === 'Yes' ? 'Begagnad' : k === 'No' ? 'Ny' : k));

  // Loans per customer
  const loansPerCust = useMemo(() => {
    const cc = {};
    filteredData.forEach((r) => { if (r['Kund']) cc[r['Kund']] = (cc[r['Kund']] || 0) + 1; });
    const lpc = { '1 lån': 0, '2 lån': 0, '3-5 lån': 0, '6-10 lån': 0, '11+ lån': 0 };
    Object.values(cc).forEach((n) => {
      if (n === 1) lpc['1 lån']++;
      else if (n === 2) lpc['2 lån']++;
      else if (n <= 5) lpc['3-5 lån']++;
      else if (n <= 10) lpc['6-10 lån']++;
      else lpc['11+ lån']++;
    });
    return lpc;
  }, [filteredData]);

  // Repurchase — uses all-status data to find customers with terminated + subsequent active contract
  const repurchase = useMemo(() => {
    const calcGroup = (rows) => {
      // Map customer ID → their terminated contract end dates
      const terminated = {};
      rows
        .filter((r) => r['Status kontraktsrad'] === 'Terminated')
        .forEach((r) => {
          if (!r['Kund']) return;
          if (!terminated[r['Kund']]) terminated[r['Kund']] = [];
          terminated[r['Kund']].push(r['Slutdatum']);
        });
      // Map customer ID → active contract start dates
      const activeStarts = {};
      rows
        .filter((r) => r['Status kontraktsrad'] === 'Active')
        .forEach((r) => {
          if (!r['Kund']) return;
          if (!activeStarts[r['Kund']]) activeStarts[r['Kund']] = [];
          activeStarts[r['Kund']].push(r['Start Datum']);
        });
      let repeat = 0;
      const eligible = Object.keys(terminated).length;
      for (const cust of Object.keys(terminated)) {
        const termDates = terminated[cust].filter((d) => d && !isNaN(d));
        const starts = (activeStarts[cust] || []).filter((d) => d && !isNaN(d));
        for (const td of termDates) {
          if (starts.some((s) => s > td)) { repeat++; break; }
        }
      }
      return { repeat, eligible, noRepeat: eligible - repeat };
    };

    return {
      privat: calcGroup(repurchaseBase.filter((r) => r['Kundtyp'] === 'Privat')),
      foretag: calcGroup(repurchaseBase.filter((r) => r['Kundtyp'] === 'Näringsidkare')),
    };
  }, [repurchaseBase]);

  // Dealer comparison
  const dealerComparison = useMemo(() => {
    if (selectedDealers.length < 2) return null;
    const now = new Date();
    const rows = selectedDealers
      .map((dealer) => {
        const rows = filteredData.filter((r) => r['Leverantörsnamn'] === dealer);
        const active = rows.filter((r) => r['Status kontraktsrad'] === 'Active');
        const rates = active
          .map((r) => r['Aktuell ränta'])
          .filter((v) => typeof v === 'number' && !isNaN(v) && v > 0);
        const mature = active.filter((r) => {
          if (!r['Slutdatum'] || isNaN(r['Slutdatum'])) return false;
          const m = (r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44);
          return m >= 0 && m <= 12;
        }).length;
        return {
          dealer,
          contracts: rows.length,
          active: active.length,
          customers: new Set(rows.map((r) => r['Kund']).filter(Boolean)).size,
          financed: rows.reduce((s, r) => s + (r['Finansierat Belopp'] || 0), 0),
          present: active.reduce((s, r) => s + (r['Nuvärde'] || 0), 0),
          payment: active.reduce((s, r) => s + (r['Aktuell per amort+rta'] || 0), 0),
          avgRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
          mature,
        };
      })
      .filter((d) => d.contracts > 0);
    return rows.length >= 2 ? rows : null;
  }, [filteredData, selectedDealers]);

  const doughnutOpts = { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } };

  return (
    <div>
      {dealerComparison && (
        <div className="section" id="dealerComparisonSection">
          <h2>Jämförelse mellan valda leverantörer</h2>
          <p style={{ fontSize: '.85em', color: '#666', marginBottom: 16 }}>
            Välj två eller fler leverantörer i filtret ovan för att jämföra portfölj, volym, kvar att betala och snittränta sida vid sida.
          </p>
          <div className="chart-box" style={{ marginBottom: 16 }}>
            <h3>Nyckeltal per leverantör</h3>
            <Bar
              data={{
                labels: dealerComparison.map((d) => d.dealer),
                datasets: [
                  { label: 'Kontrakt', data: dealerComparison.map((d) => d.contracts), backgroundColor: DARK + 'cc' },
                  { label: 'Aktiva', data: dealerComparison.map((d) => d.active), backgroundColor: BLUE + 'cc' },
                  { label: 'Finansierat belopp (Mkr)', data: dealerComparison.map((d) => +(d.financed / 1e6).toFixed(2)), backgroundColor: ACCENT + 'cc' },
                  { label: 'Kvar att betala (Mkr)', data: dealerComparison.map((d) => +(d.present / 1e6).toFixed(2)), backgroundColor: TEAL + 'cc' },
                ],
              }}
              options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { ticks: { font: { size: 9 } } } } }}
            />
          </div>
          <div className="table-scroll">
            <table id="tableDealerComparison">
              <thead>
                <tr>
                  <th>Leverantör</th><th>Kontrakt</th><th>Aktiva</th><th>Kunder</th>
                  <th>Finansierat belopp</th><th>Kvar att betala</th><th>Tot. månadsbet.</th>
                  <th>Snittränta</th><th>Bytesmogna &lt;12 mån</th>
                </tr>
              </thead>
              <tbody>
                {dealerComparison.map((d) => (
                  <tr key={d.dealer}>
                    <td>{d.dealer}</td>
                    <td>{d.contracts}</td>
                    <td>{d.active}</td>
                    <td>{d.customers}</td>
                    <td>{fmtNum(d.financed)}</td>
                    <td>{fmtNum(d.present)}</td>
                    <td>{fmtNum(d.payment)}</td>
                    <td>{d.avgRate ? d.avgRate.toFixed(2) + '%' : '-'}</td>
                    <td>{d.mature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <h2>Tillväxt - Nytecknade kontrakt per kvartal</h2>
        <Bar data={growthData} options={growthOptions} height={90} />
      </div>

      <div className="chart-row">
        <ChartBox title="Kontraktstyp">
          <Doughnut
            data={{ labels: Object.keys(ctypes), datasets: [{ data: Object.values(ctypes), backgroundColor: COLORS }] }}
            options={doughnutOpts}
          />
        </ChartBox>
        <ChartBox title="Fordonstyp (Objektsgrupp)">
          <Doughnut
            data={{ labels: Object.keys(vtypes), datasets: [{ data: Object.values(vtypes), backgroundColor: COLORS }] }}
            options={doughnutOpts}
          />
        </ChartBox>
      </div>

      <div className="chart-row">
        <ChartBox title="Ny vs Begagnad">
          <Doughnut
            data={{ labels: nuLabels, datasets: [{ data: Object.values(nuMap), backgroundColor: [BLUE, ACCENT, '#ccc'] }] }}
            options={doughnutOpts}
          />
        </ChartBox>
        <ChartBox title="Privat vs Näringsidkare">
          <Doughnut
            data={{ labels: Object.keys(custTypeMap), datasets: [{ data: Object.values(custTypeMap), backgroundColor: [BLUE, ACCENT] }] }}
            options={doughnutOpts}
          />
        </ChartBox>
      </div>

      <div className="chart-row">
        <ChartBox title="Kontrakt per kund">
          <Bar
            data={{ labels: Object.keys(loansPerCust), datasets: [{ data: Object.values(loansPerCust), backgroundColor: COLORS }] }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }}
          />
        </ChartBox>
        <ChartBox title="Återköpsgrad">
          {repurchase.privat.eligible === 0 && repurchase.foretag.eligible === 0 ? (
            <p style={{ color: '#999', fontSize: '.9em', textAlign: 'center', paddingTop: 16 }}>
              Ingen data — avslutade kontrakt saknas i valt filter
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8 }}>
                {repurchase.privat.eligible > 0 && (
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '.75em', fontWeight: 600, marginBottom: 4, color: '#555' }}>
                      Privat (personnr)
                    </div>
                    <Doughnut
                      data={{
                        labels: ['Återköp', 'Ej återköp'],
                        datasets: [{ data: [repurchase.privat.repeat, repurchase.privat.noRepeat], backgroundColor: [ACCENT, '#e0e0e0'] }],
                      }}
                      options={{ ...doughnutOpts, plugins: { ...doughnutOpts.plugins, legend: { position: 'bottom', labels: { font: { size: 10 } } } } }}
                    />
                    <div style={{ fontSize: '.8em', color: '#333', marginTop: 4 }}>
                      {repurchase.privat.eligible > 0
                        ? `${Math.round((repurchase.privat.repeat / repurchase.privat.eligible) * 100)}% (${repurchase.privat.repeat}/${repurchase.privat.eligible})`
                        : '–'}
                    </div>
                  </div>
                )}
                {repurchase.foretag.eligible > 0 && (
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '.75em', fontWeight: 600, marginBottom: 4, color: '#555' }}>
                      Företag (org.nr)
                    </div>
                    <Doughnut
                      data={{
                        labels: ['Återköp', 'Ej återköp'],
                        datasets: [{ data: [repurchase.foretag.repeat, repurchase.foretag.noRepeat], backgroundColor: [TEAL, '#e0e0e0'] }],
                      }}
                      options={{ ...doughnutOpts, plugins: { ...doughnutOpts.plugins, legend: { position: 'bottom', labels: { font: { size: 10 } } } } }}
                    />
                    <div style={{ fontSize: '.8em', color: '#333', marginTop: 4 }}>
                      {repurchase.foretag.eligible > 0
                        ? `${Math.round((repurchase.foretag.repeat / repurchase.foretag.eligible) * 100)}% (${repurchase.foretag.repeat}/${repurchase.foretag.eligible})`
                        : '–'}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </ChartBox>
      </div>
    </div>
  );
}
