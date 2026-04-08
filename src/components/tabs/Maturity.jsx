import React, { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { COLORS, DARK, BLUE, ACCENT, TEAL, PURPLE, fmtNum, fmtDate } from '../../utils/formatters';

function exportTableData(rows) {
  const headers = ['Kund', 'Kundtyp', 'Kontrakt', 'Fordon', 'Regnr', 'Slutdatum', 'Mån kvar', 'Månadsbet.', 'Nuvärde', 'Restvärde', 'Ränta', 'Telefon', 'E-post'];
  const csvRows = [headers, ...rows.map((r) => {
    const now = new Date();
    const m = Math.round((r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44));
    return [r['Kundnamn'] || '', r['Kundtyp'] || '', r['Kontrakt'] || '', r['Fakturatext'] || '', r['Registreringsnummer'] || '', fmtDate(r['Slutdatum']), m, Math.round(r['Aktuell per amort+rta'] || 0), Math.round(r['Nuvärde'] || 0), Math.round(r['Restvärde'] || 0), (r['Aktuell ränta'] || 0).toFixed(2) + '%', r['Telefon Mobil'] || r['Telefonarbete'] || '', r['Epost'] || ''];
  })];
  const csv = csvRows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tableMature.csv'; a.click();
}

export default function Maturity() {
  const { filteredData, openDrawer } = useData();
  const [search, setSearch] = useState('');
  const now = new Date();

  const active = useMemo(() => filteredData.filter((r) => r['Status kontraktsrad'] === 'Active'), [filteredData]);

  const buckets = useMemo(() => {
    const b = { '0-6 mån': 0, '7-12 mån': 0, '13-24 mån': 0, '25-36 mån': 0, '37-48 mån': 0, '49-60 mån': 0, '60+ mån': 0 };
    active.forEach((r) => {
      if (!r['Slutdatum'] || isNaN(r['Slutdatum'])) return;
      const m = Math.max(0, (r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44));
      if (m <= 6) b['0-6 mån']++;
      else if (m <= 12) b['7-12 mån']++;
      else if (m <= 24) b['13-24 mån']++;
      else if (m <= 36) b['25-36 mån']++;
      else if (m <= 48) b['37-48 mån']++;
      else if (m <= 60) b['49-60 mån']++;
      else b['60+ mån']++;
    });
    return b;
  }, [active]);

  const payoffData = useMemo(() => {
    const totFin = active.reduce((s, r) => s + (r['Finansierat Belopp'] || 0), 0);
    const totPres = active.reduce((s, r) => s + (r['Nuvärde'] || 0), 0);
    const totRes = active.reduce((s, r) => s + (r['Restvärde'] || 0), 0);
    const totPaid = Math.max(0, totFin - totPres - totRes);
    return { totPaid, totPres, totRes };
  }, [active]);

  const matureRows = useMemo(() => {
    return active
      .filter((r) => {
        if (!r['Slutdatum'] || isNaN(r['Slutdatum'])) return false;
        const m = (r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44);
        return m >= 0 && m <= 12;
      })
      .sort((a, b) => (a['Slutdatum'] || 0) - (b['Slutdatum'] || 0));
  }, [active]);

  const filtered = useMemo(() => {
    if (!search) return matureRows;
    const q = search.toLowerCase();
    return matureRows.filter((r) =>
      [r['Kundnamn'], r['Kund'], r['Kontrakt'], r['Fakturatext'], r['Registreringsnummer']]
        .join(' ').toLowerCase().includes(q)
    );
  }, [matureRows, search]);

  return (
    <div>
      <div className="chart-row">
        <div className="chart-box">
          <h3>Återstående löptid - Alla aktiva</h3>
          <Bar
            data={{
              labels: Object.keys(buckets),
              datasets: [{ data: Object.values(buckets), backgroundColor: [ACCENT, ACCENT + '99', BLUE, DARK, PURPLE, TEAL, '#5c8a8b'] }],
            }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }}
          />
        </div>
        <div className="chart-box">
          <h3>Avbetald andel</h3>
          <Doughnut
            data={{
              labels: [
                `Avbetalt ${Math.round(payoffData.totPaid / 1e6)} Mkr`,
                `Kvarvarande ${Math.round(payoffData.totPres / 1e6)} Mkr`,
                `Restvärde ${Math.round(payoffData.totRes / 1e6)} Mkr`,
              ],
              datasets: [{ data: [Math.round(payoffData.totPaid / 1e6), Math.round(payoffData.totPres / 1e6), Math.round(payoffData.totRes / 1e6)], backgroundColor: [TEAL, ACCENT, '#e0e0e0'] }],
            }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }}
          />
        </div>
      </div>

      <div className="section">
        <h2>
          Bytesmogna kunder — Förfaller inom 12 månader
          <button className="export-btn" onClick={() => exportTableData(matureRows)}>Exportera CSV</button>
        </h2>
        <input
          className="search-input"
          placeholder="Sök kund..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="table-scroll">
          <table id="tableMature">
            <thead>
              <tr>
                <th>Kund</th><th>Kundtyp</th><th>Kontrakt</th><th>Fordon</th><th>Regnr</th>
                <th>Slutdatum</th><th>Mån kvar</th><th>Månadsbet.</th><th>Nuvärde</th>
                <th>Restvärde</th><th>Ränta</th><th>Telefon</th><th>E-post</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const m = Math.round((r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44));
                const badge = m <= 6 ? 'badge-red' : 'badge-yellow';
                return (
                  <tr key={r['Kontrakt']} className="clickable-row" onClick={() => openDrawer('contract', r['Kontrakt'])}>
                    <td onClick={(e) => { e.stopPropagation(); openDrawer('customer', r['Kund']); }} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
                      {r['Kundnamn'] || ''}
                    </td>
                    <td>{r['Kundtyp'] || ''}</td>
                    <td>{r['Kontrakt'] || ''}</td>
                    <td>{r['Fakturatext'] || ''}</td>
                    <td>{r['Registreringsnummer'] || ''}</td>
                    <td>{fmtDate(r['Slutdatum'])}</td>
                    <td><span className={`badge ${badge}`}>{m} mån</span></td>
                    <td>{fmtNum(r['Aktuell per amort+rta'])}</td>
                    <td>{fmtNum(r['Nuvärde'])}</td>
                    <td>{fmtNum(r['Restvärde'])}</td>
                    <td>{(r['Aktuell ränta'] || 0).toFixed(2)}%</td>
                    <td>{r['Telefon Mobil'] || r['Telefonarbete'] || ''}</td>
                    <td>{r['Epost'] || ''}</td>
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
