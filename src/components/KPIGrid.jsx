import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { mkr, fmtNum } from '../utils/formatters';

export default function KPIGrid() {
  const { filteredData } = useData();

  const kpis = useMemo(() => {
    const d = filteredData;
    const now = new Date();
    const active = d.filter((r) => r['Status kontraktsrad'] === 'Active');
    const totalFinanced = d.reduce((s, r) => s + (r['Finansierat Belopp'] || 0), 0);
    const totalPresent = active.reduce((s, r) => s + (r['Nuvärde'] || 0), 0);
    const rates = active.filter((r) => r['Aktuell ränta'] > 0).map((r) => r['Aktuell ränta']);
    const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const payments = active.filter((r) => r['Aktuell per amort+rta'] > 0);
    const avgPayment = payments.length
      ? payments.reduce((s, r) => s + r['Aktuell per amort+rta'], 0) / payments.length
      : 0;
    const uniqueCust = new Set(d.map((r) => r['Kund'])).size;
    const overdue = d.filter((r) => (r['Förfallet (ink VAT'] || 0) > 0);
    const overdueSum = overdue.reduce((s, r) => s + r['Förfallet (ink VAT'], 0);
    const m12 = active.filter((r) => {
      if (!r['Slutdatum'] || isNaN(r['Slutdatum'])) return false;
      const diff = (r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44);
      return diff >= 0 && diff <= 12;
    });

    return [
      { label: 'Kontrakt', value: d.length.toLocaleString(), sub: `${active.length.toLocaleString()} aktiva` },
      { label: 'Kunder', value: uniqueCust.toLocaleString(), sub: '' },
      { label: 'Fin. belopp', value: mkr(totalFinanced), sub: 'alla kontrakt' },
      { label: 'Kvar att betala', value: mkr(totalPresent), sub: 'aktiva kontrakt' },
      { label: 'Snittränta', value: avgRate.toFixed(2) + '%', sub: 'aktiva kontrakt' },
      { label: 'Snitt månadsbet.', value: Math.round(avgPayment).toLocaleString() + ' kr', sub: 'aktiva' },
      {
        label: 'Bytesmogna <12m',
        value: m12.length.toLocaleString(),
        sub: `${active.length ? Math.round((m12.length / active.length) * 100) : 0}% av aktiva`,
      },
      {
        label: 'Förfallet',
        value: Math.round(overdueSum).toLocaleString() + ' kr',
        sub: `${overdue.length} kontrakt`,
      },
    ];
  }, [filteredData]);

  return (
    <div className="kpi-grid">
      {kpis.map((k) => (
        <div key={k.label} className="kpi">
          <div className="label">{k.label}</div>
          <div className="value">{k.value}</div>
          {k.sub && <div className="sub">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}
