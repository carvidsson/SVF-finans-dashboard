import React, { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { COLORS, fmtNum, fmtDate } from '../../utils/formatters';

function exportCSV(rows, filename, headers, mapper) {
  const csvRows = [headers, ...rows.map(mapper)];
  const csv = csvRows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

export default function Financial() {
  const { filteredData, openDrawer } = useData();
  const [searchHighRate, setSearchHighRate] = useState('');
  const [searchHighPay, setSearchHighPay] = useState('');

  const active = useMemo(() => filteredData.filter((r) => r['Status kontraktsrad'] === 'Active'), [filteredData]);

  const interestBuckets = useMemo(() => {
    const b = { '0-2%': 0, '2-3%': 0, '3-4%': 0, '4-5%': 0, '5-6%': 0, '6-7%': 0, '7-8%': 0, '8%+': 0 };
    active.forEach((r) => {
      const rate = r['Aktuell ränta'] || 0;
      if (rate <= 2) b['0-2%']++;
      else if (rate <= 3) b['2-3%']++;
      else if (rate <= 4) b['3-4%']++;
      else if (rate <= 5) b['4-5%']++;
      else if (rate <= 6) b['5-6%']++;
      else if (rate <= 7) b['6-7%']++;
      else if (rate <= 8) b['7-8%']++;
      else b['8%+']++;
    });
    return b;
  }, [active]);

  const paymentBuckets = useMemo(() => {
    const b = { '<2000': 0, '2-3000': 0, '3-5000': 0, '5-7500': 0, '7500-10000': 0, '10000-20000': 0, '20000+': 0 };
    active.filter((r) => r['Aktuell per amort+rta'] > 0).forEach((r) => {
      const p = r['Aktuell per amort+rta'];
      if (p < 2000) b['<2000']++;
      else if (p < 3000) b['2-3000']++;
      else if (p < 5000) b['3-5000']++;
      else if (p < 7500) b['5-7500']++;
      else if (p < 10000) b['7500-10000']++;
      else if (p < 20000) b['10000-20000']++;
      else b['20000+']++;
    });
    return b;
  }, [active]);

  const highRateRows = useMemo(() =>
    active.filter((r) => (r['Aktuell ränta'] || 0) > 6).sort((a, b) => (b['Aktuell ränta'] || 0) - (a['Aktuell ränta'] || 0)),
    [active]
  );

  const highPayRows = useMemo(() =>
    active.filter((r) => (r['Aktuell per amort+rta'] || 0) > 5000).sort((a, b) => (b['Aktuell per amort+rta'] || 0) - (a['Aktuell per amort+rta'] || 0)),
    [active]
  );

  const filteredHighRate = useMemo(() => {
    if (!searchHighRate) return highRateRows;
    const q = searchHighRate.toLowerCase();
    return highRateRows.filter(r => [r['Kundnamn'], r['Kund'], r['Kontrakt'], r['Fakturatext']].join(' ').toLowerCase().includes(q));
  }, [highRateRows, searchHighRate]);

  const filteredHighPay = useMemo(() => {
    if (!searchHighPay) return highPayRows;
    const q = searchHighPay.toLowerCase();
    return highPayRows.filter(r => [r['Kundnamn'], r['Kund'], r['Kontrakt'], r['Fakturatext']].join(' ').toLowerCase().includes(q));
  }, [highPayRows, searchHighPay]);

  const barOpts = (title) => ({
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: { y: { title: { display: true, text: 'Antal' } } },
  });

  return (
    <div>
      <div className="chart-row">
        <div className="chart-box">
          <h3>Räntefördelning (aktiva)</h3>
          <Bar
            data={{ labels: Object.keys(interestBuckets), datasets: [{ data: Object.values(interestBuckets), backgroundColor: COLORS }] }}
            options={barOpts('Räntefördelning')}
          />
        </div>
        <div className="chart-box">
          <h3>Månadsbetalning fördelning (aktiva)</h3>
          <Bar
            data={{ labels: Object.keys(paymentBuckets), datasets: [{ data: Object.values(paymentBuckets), backgroundColor: COLORS }] }}
            options={barOpts('Betalningsfördelning')}
          />
        </div>
      </div>

      <div className="section">
        <h2>
          Kunder med hög ränta (&gt; 6%)
          <button className="export-btn" onClick={() => exportCSV(highRateRows, 'tableHighRate.csv',
            ['Kund', 'Kundtyp', 'Kontrakt', 'Fordon', 'Regnr', 'Ränta', 'Månadsbet.', 'Nuvärde', 'Slutdatum', 'Telefon', 'E-post'],
            r => [r['Kundnamn'] || '', r['Kundtyp'] || '', r['Kontrakt'] || '', r['Fakturatext'] || '', r['Registreringsnummer'] || '', (r['Aktuell ränta'] || 0).toFixed(2) + '%', Math.round(r['Aktuell per amort+rta'] || 0), Math.round(r['Nuvärde'] || 0), fmtDate(r['Slutdatum']), r['Telefon Mobil'] || r['Telefonarbete'] || '', r['Epost'] || '']
          )}>Exportera CSV</button>
        </h2>
        <input className="search-input" placeholder="Sök kund..." value={searchHighRate} onChange={(e) => setSearchHighRate(e.target.value)} />
        <div className="table-scroll">
          <table id="tableHighRate">
            <thead>
              <tr><th>Kund</th><th>Kundtyp</th><th>Kontrakt</th><th>Fordon</th><th>Regnr</th><th>Ränta</th><th>Månadsbet.</th><th>Nuvärde</th><th>Slutdatum</th><th>Telefon</th><th>E-post</th></tr>
            </thead>
            <tbody>
              {filteredHighRate.map((r) => (
                <tr key={r['Kontrakt']} className="clickable-row" onClick={() => openDrawer('contract', r['Kontrakt'])}>
                  <td onClick={(e) => { e.stopPropagation(); openDrawer('customer', r['Kund']); }} style={{ textDecoration: 'underline', cursor: 'pointer' }}>{r['Kundnamn'] || ''}</td>
                  <td>{r['Kundtyp'] || ''}</td><td>{r['Kontrakt'] || ''}</td>
                  <td>{r['Fakturatext'] || ''}</td><td>{r['Registreringsnummer'] || ''}</td>
                  <td><span className="badge badge-red">{(r['Aktuell ränta'] || 0).toFixed(2)}%</span></td>
                  <td>{fmtNum(r['Aktuell per amort+rta'])}</td><td>{fmtNum(r['Nuvärde'])}</td>
                  <td>{fmtDate(r['Slutdatum'])}</td>
                  <td>{r['Telefon Mobil'] || r['Telefonarbete'] || ''}</td><td>{r['Epost'] || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2>
          Kunder med hög månadskostnad (&gt; 5 000 kr)
          <button className="export-btn" onClick={() => exportCSV(highPayRows, 'tableHighPay.csv',
            ['Kund', 'Kundtyp', 'Kontrakt', 'Fordon', 'Regnr', 'Månadsbet.', 'Ränta', 'Nuvärde', 'Slutdatum', 'Telefon', 'E-post'],
            r => [r['Kundnamn'] || '', r['Kundtyp'] || '', r['Kontrakt'] || '', r['Fakturatext'] || '', r['Registreringsnummer'] || '', Math.round(r['Aktuell per amort+rta'] || 0), (r['Aktuell ränta'] || 0).toFixed(2) + '%', Math.round(r['Nuvärde'] || 0), fmtDate(r['Slutdatum']), r['Telefon Mobil'] || r['Telefonarbete'] || '', r['Epost'] || '']
          )}>Exportera CSV</button>
        </h2>
        <input className="search-input" placeholder="Sök kund..." value={searchHighPay} onChange={(e) => setSearchHighPay(e.target.value)} />
        <div className="table-scroll">
          <table id="tableHighPay">
            <thead>
              <tr><th>Kund</th><th>Kundtyp</th><th>Kontrakt</th><th>Fordon</th><th>Regnr</th><th>Månadsbet.</th><th>Ränta</th><th>Nuvärde</th><th>Slutdatum</th><th>Telefon</th><th>E-post</th></tr>
            </thead>
            <tbody>
              {filteredHighPay.map((r) => (
                <tr key={r['Kontrakt']} className="clickable-row" onClick={() => openDrawer('contract', r['Kontrakt'])}>
                  <td onClick={(e) => { e.stopPropagation(); openDrawer('customer', r['Kund']); }} style={{ textDecoration: 'underline', cursor: 'pointer' }}>{r['Kundnamn'] || ''}</td>
                  <td>{r['Kundtyp'] || ''}</td><td>{r['Kontrakt'] || ''}</td>
                  <td>{r['Fakturatext'] || ''}</td><td>{r['Registreringsnummer'] || ''}</td>
                  <td><span className="badge badge-blue">{fmtNum(r['Aktuell per amort+rta'])}</span></td>
                  <td>{(r['Aktuell ränta'] || 0).toFixed(2)}%</td><td>{fmtNum(r['Nuvärde'])}</td>
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
