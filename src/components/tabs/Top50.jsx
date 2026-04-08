import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { fmtNum } from '../../utils/formatters';

export default function Top50() {
  const { filteredData, openDrawer } = useData();
  const now = new Date();

  const scored = useMemo(() => {
    const map = {};
    filteredData.forEach((r) => {
      const c = r['Kund']; if (!c) return;
      if (!map[c]) map[c] = {
        id: c, name: r['Kundnamn'], type: r['Kundtyp'],
        contracts: 0, active: 0, nearExpiry: 0, totalPayment: 0, rates: [], totalVol: 0,
        phone: r['Telefon Mobil'] || r['Telefonarbete'] || '', email: r['Epost'] || '',
      };
      map[c].contracts++;
      if (r['Status kontraktsrad'] === 'Active') {
        map[c].active++;
        map[c].totalPayment += r['Aktuell per amort+rta'] || 0;
        if (r['Aktuell ränta'] > 0) map[c].rates.push(r['Aktuell ränta']);
        map[c].totalVol += r['Finansierat Belopp'] || 0;
        if (r['Slutdatum'] && !isNaN(r['Slutdatum'])) {
          const m = (r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44);
          if (m >= 0 && m <= 12) map[c].nearExpiry++;
        }
      }
    });
    return Object.values(map)
      .filter((c) => c.active > 0)
      .map((c) => {
        const avgRate = c.rates.length ? c.rates.reduce((a, b) => a + b, 0) / c.rates.length : 0;
        let score = 0;
        score += Math.min(30, c.nearExpiry * 15);
        score += Math.min(20, c.totalPayment / 1000);
        score += Math.min(20, Math.max(0, (avgRate - 3) * 5));
        score += Math.min(15, c.active * 5);
        if (c.type === 'Näringsidkare') score += 15;
        return { ...c, score: Math.round(score), avgRate };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [filteredData]);

  return (
    <div className="section">
      <h2>Topp 50 - Högst affärspotential</h2>
      <p style={{ fontSize: '.85em', color: '#666', marginBottom: 16 }}>
        Poängsättning baserad på: nära förfall, hög betalning, hög ränta (omfinansiering), antal kontrakt, och kundtyp (företag).
      </p>
      <div className="table-scroll">
        <table id="tableTop50">
          <thead>
            <tr>
              <th>#</th><th>Kund</th><th>Kundtyp</th><th>Poäng</th><th>Kontrakt</th><th>Aktiva</th>
              <th>Nära förfall</th><th>Snittränta</th><th>Tot. månadsbet.</th><th>Total volym</th>
              <th>Telefon</th><th>E-post</th>
            </tr>
          </thead>
          <tbody>
            {scored.map((c, i) => (
              <tr key={c.id} className="clickable-row" onClick={() => openDrawer('customer', c.id)}>
                <td>{i + 1}</td>
                <td style={{ textDecoration: 'underline' }}>{c.name || ''}</td>
                <td>{c.type || ''}</td>
                <td><span className="badge badge-blue">{c.score}</span></td>
                <td>{c.contracts}</td><td>{c.active}</td><td>{c.nearExpiry || 0}</td>
                <td>{c.avgRate.toFixed(2)}%</td>
                <td>{fmtNum(c.totalPayment)}</td><td>{fmtNum(c.totalVol)}</td>
                <td>{c.phone}</td><td>{c.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
