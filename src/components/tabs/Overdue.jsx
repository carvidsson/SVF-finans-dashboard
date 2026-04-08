import React, { useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { COLORS, TEAL, ACCENT, fmtNum, fmtDate } from '../../utils/formatters';

export default function Overdue() {
  const { filteredData, openDrawer } = useData();

  const active = useMemo(() => filteredData.filter((r) => r['Status kontraktsrad'] === 'Active'), [filteredData]);

  const statusData = useMemo(() => {
    const ok = active.filter((r) => (r['Förfallet (ink VAT'] || 0) === 0).length;
    const overdue = active.filter((r) => (r['Förfallet (ink VAT'] || 0) > 0).length;
    return { ok, overdue };
  }, [active]);

  const dealerOverdue = useMemo(() => {
    const map = {};
    filteredData.filter((r) => (r['Förfallet (ink VAT'] || 0) > 0).forEach((r) => {
      const d = r['Leverantörsnamn'] || 'Okänd';
      map[d] = (map[d] || 0) + r['Förfallet (ink VAT'];
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredData]);

  const overdueRows = useMemo(() =>
    filteredData.filter((r) => (r['Förfallet (ink VAT'] || 0) > 0)
      .sort((a, b) => (b['Förfallet (ink VAT'] || 0) - (a['Förfallet (ink VAT'] || 0)),
    [filteredData]
  );

  return (
    <div>
      <div className="chart-row">
        <div className="chart-box">
          <h3>Betalningsstatus - Aktiva kontrakt</h3>
          <Doughnut
            data={{ labels: ['I fas', 'Förfallet'], datasets: [{ data: [statusData.ok, statusData.overdue], backgroundColor: [TEAL, ACCENT] }] }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }}
          />
        </div>
        <div className="chart-box">
          <h3>Förfallet belopp per leverantör</h3>
          <Bar
            data={{ labels: dealerOverdue.map((e) => e[0]), datasets: [{ data: dealerOverdue.map((e) => Math.round(e[1])), backgroundColor: COLORS }] }}
            options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'kr' } } } }}
          />
        </div>
      </div>

      <div className="section">
        <h2>Kontrakt med förfallen betalning</h2>
        <div className="table-scroll">
          <table id="tableOverdue">
            <thead>
              <tr><th>Kund</th><th>Kontrakt</th><th>Fordon</th><th>Regnr</th><th>Förfallet</th><th>Obetalt</th><th>Nuvärde</th><th>Slutdatum</th><th>Telefon</th><th>E-post</th></tr>
            </thead>
            <tbody>
              {overdueRows.map((r) => (
                <tr key={r['Kontrakt']} className="clickable-row" onClick={() => openDrawer('contract', r['Kontrakt'])}>
                  <td onClick={(e) => { e.stopPropagation(); openDrawer('customer', r['Kund']); }} style={{ textDecoration: 'underline', cursor: 'pointer' }}>{r['Kundnamn'] || ''}</td>
                  <td>{r['Kontrakt'] || ''}</td><td>{r['Fakturatext'] || ''}</td><td>{r['Registreringsnummer'] || ''}</td>
                  <td><span className="badge badge-red">{fmtNum(r['Förfallet (ink VAT'])}</span></td>
                  <td>{fmtNum(r['Obetalt (ink VAT)'])}</td><td>{fmtNum(r['Nuvärde'])}</td>
                  <td>{fmtDate(r['Slutdatum'])}</td>
                  <td>{r['Telefon Mobil'] || r['Telefonarbete'] || ''}</td><td>{r['Epost'] || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
