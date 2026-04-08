import React, { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { COLORS, fmtNum } from '../../utils/formatters';

function exportTable(rows) {
  const headers = ['#', 'Säljare', 'Kontrakt', 'Aktiva', 'Finansierat belopp', 'Aktivt nuvärde', 'Total månadsbet.', 'Snittränta', 'Bytesmogna <12 mån', 'Hög ränta >6%', 'Hög månadsbet. >5000', 'Snitt/aktivt kontrakt'];
  const csvRows = [headers, ...rows.map((s, i) => {
    const medal = i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : String(i + 1);
    return [medal, s.seller, s.contracts, s.active, Math.round(s.financed), Math.round(s.present), Math.round(s.totalPayment), s.avgRate ? s.avgRate.toFixed(2) + '%' : '-', s.mature, s.highRate, s.highPayment, Math.round(s.avgFinancedPerActive)];
  })];
  const csv = csvRows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tableSellers.csv';
  a.click();
}

export default function Sellers() {
  const { filteredData } = useData();
  const [sortKey, setSortKey] = useState('financed');
  const [sortDir, setSortDir] = useState('desc');

  const sellerData = useMemo(() => {
    const now = new Date();
    const map = {};
    filteredData.forEach((r) => {
      const seller = (r['Case-ägare'] || 'Ej tilldelad').trim() || 'Ej tilldelad';
      if (!map[seller]) map[seller] = { seller, contracts: 0, active: 0, financed: 0, present: 0, totalPayment: 0, rates: [], mature: 0, highRate: 0, highPayment: 0 };
      const s = map[seller];
      s.contracts++;
      s.financed += r['Finansierat Belopp'] || 0;
      if (r['Status kontraktsrad'] === 'Active') {
        s.active++;
        s.present += r['Nuvärde'] || 0;
        s.totalPayment += r['Aktuell per amort+rta'] || 0;
        const rate = r['Aktuell ränta'] || 0;
        if (rate > 0) s.rates.push(rate);
        if (rate > 6) s.highRate++;
        if ((r['Aktuell per amort+rta'] || 0) > 5000) s.highPayment++;
        if (r['Slutdatum'] && !isNaN(r['Slutdatum'])) {
          const m = (r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44);
          if (m >= 0 && m <= 12) s.mature++;
        }
      }
    });
    return Object.values(map).map((s) => {
      s.avgRate = s.rates.length ? s.rates.reduce((a, b) => a + b, 0) / s.rates.length : 0;
      s.avgFinancedPerActive = s.active ? s.financed / s.active : 0;
      return s;
    });
  }, [filteredData]);

  const sorted = useMemo(() => {
    return [...sellerData].sort((a, b) => {
      let valA = sortKey === 'rank' ? a.financed : a[sortKey];
      let valB = sortKey === 'rank' ? b.financed : b[sortKey];
      if (typeof valA === 'string' || typeof valB === 'string') {
        valA = String(valA || '');
        valB = String(valB || '');
        return sortDir === 'asc' ? valA.localeCompare(valB, 'sv') : valB.localeCompare(valA, 'sv');
      }
      return sortDir === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
  }, [sellerData, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'seller' ? 'asc' : 'desc'); }
  };

  const top15byFinanced = useMemo(() => [...sellerData].sort((a, b) => b.financed - a.financed).slice(0, 15), [sellerData]);
  const top15byPresent = useMemo(() => [...sellerData].sort((a, b) => b.present - a.present).slice(0, 15), [sellerData]);

  const SortTh = ({ col, label }) => {
    const ind = sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '';
    return (
      <th className="sortable" onClick={() => handleSort(col)}>
        {label}<span className="sort-indicator">{ind}</span>
      </th>
    );
  };

  return (
    <div>
      <div className="chart-row">
        <div className="chart-box">
          <h3>Topp 15 säljare - Finansierat belopp</h3>
          <Bar
            data={{ labels: top15byFinanced.map((s) => s.seller), datasets: [{ data: top15byFinanced.map((s) => Math.round(s.financed)), backgroundColor: COLORS.concat(COLORS) }] }}
            options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'kr' } } } }}
          />
        </div>
        <div className="chart-box">
          <h3>Topp 15 säljare - Aktivt nuvärde</h3>
          <Bar
            data={{ labels: top15byPresent.map((s) => s.seller), datasets: [{ data: top15byPresent.map((s) => Math.round(s.present)), backgroundColor: COLORS.concat(COLORS) }] }}
            options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'kr' } } } }}
          />
        </div>
      </div>

      <div className="section">
        <h2>
          Säljarranking
          <button className="export-btn" onClick={() => exportTable(sorted)}>Exportera CSV</button>
        </h2>
        <p style={{ fontSize: '.85em', color: '#666', marginBottom: 16 }}>
          Summering per case-ägare med fokus på finansierat belopp, aktiv portfölj, månadsbetalningar, ränta och bytesmognad.
        </p>
        <div className="table-scroll">
          <table id="tableSellers">
            <thead>
              <tr>
                <SortTh col="rank" label="#" />
                <SortTh col="seller" label="Säljare" />
                <SortTh col="contracts" label="Kontrakt" />
                <SortTh col="active" label="Aktiva" />
                <SortTh col="financed" label="Finansierat belopp" />
                <SortTh col="present" label="Aktivt nuvärde" />
                <SortTh col="totalPayment" label="Total månadsbet." />
                <SortTh col="avgRate" label="Snittränta" />
                <SortTh col="mature" label="Bytesmogna <12 mån" />
                <SortTh col="highRate" label="Hög ränta >6%" />
                <SortTh col="highPayment" label="Hög månadsbet. >5 000" />
                <SortTh col="avgFinancedPerActive" label="Snitt/aktivt kontrakt" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
                return (
                  <tr key={s.seller}>
                    <td>{medal}</td>
                    <td>{s.seller}</td>
                    <td>{s.contracts}</td>
                    <td>{s.active}</td>
                    <td>{fmtNum(s.financed)}</td>
                    <td>{fmtNum(s.present)}</td>
                    <td>{fmtNum(s.totalPayment)}</td>
                    <td>{s.avgRate ? s.avgRate.toFixed(2) + '%' : '-'}</td>
                    <td>
                      <span className={`badge ${s.mature >= 10 ? 'badge-red' : s.mature >= 5 ? 'badge-yellow' : 'badge-green'}`}>
                        {s.mature}
                      </span>
                    </td>
                    <td>{s.highRate}</td>
                    <td>{s.highPayment}</td>
                    <td>{fmtNum(s.avgFinancedPerActive)}</td>
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
