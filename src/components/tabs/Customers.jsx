import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { fmtNum } from '../../utils/formatters';

function exportCSV(rows) {
  const headers = ['Kund', 'Kundtyp', 'Stad', 'Kontrakt', 'Aktiva', 'Närmast förfall', 'Total volym', 'Kvar att betala', 'Tot. månadsbet.', 'Snittränta', 'Fordon', 'Telefon', 'E-post'];
  const csvRows = [headers, ...rows.map(c => [c.name || '', c.type || '', c.city || '', c.contracts, c.active, c.nearestExpiryMonths === 999 ? '-' : c.nearestExpiryMonths + ' mån', Math.round(c.totalVol), Math.round(c.totalPresent), Math.round(c.totalPayment), c.avgRate > 0 ? c.avgRate.toFixed(2) + '%' : '-', c.vehicleList || '-', c.phone, c.email])];
  const csv = csvRows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tableCustomers.csv'; a.click();
}

export default function Customers() {
  const { filteredData, openDrawer } = useData();
  const now = new Date();

  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [minContracts, setMinContracts] = useState('');
  const [minActive, setMinActive] = useState('');
  const [minRate, setMinRate] = useState('');
  const [minVol, setMinVol] = useState('');
  const [minPresent, setMinPresent] = useState('');
  const [expiryMonths, setExpiryMonths] = useState('');
  const [city, setCity] = useState('all');
  const [vehicle, setVehicle] = useState('all');
  const [contractType, setContractType] = useState('all');
  const [sortBy, setSortBy] = useState('contracts');

  const allCustomers = useMemo(() => {
    const map = {};
    filteredData.forEach((r) => {
      const c = r['Kund']; if (!c) return;
      if (!map[c]) map[c] = {
        id: c, name: r['Kundnamn'], type: r['Kundtyp'], city: r['Stad'] || '',
        contracts: 0, active: 0, totalVol: 0, totalPresent: 0, totalPayment: 0, rates: [],
        phone: r['Telefon Mobil'] || r['Telefonarbete'] || '', email: r['Epost'] || '',
        vehicles: new Set(), contractTypes: new Set(), objectTypes: new Set(), nearestExpiry: null, nearExpiryCount: 0,
      };
      const cm = map[c];
      cm.contracts++;
      if (r['Status kontraktsrad'] === 'Active') {
        cm.active++;
        cm.totalPayment += r['Aktuell per amort+rta'] || 0;
        if (r['Slutdatum'] && !isNaN(r['Slutdatum'])) {
          const m = (r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44);
          if (m >= 0) {
            if (!cm.nearestExpiry || r['Slutdatum'] < cm.nearestExpiry) cm.nearestExpiry = r['Slutdatum'];
            if (m <= 12) cm.nearExpiryCount++;
          }
        }
      }
      cm.totalVol += r['Finansierat Belopp'] || 0;
      cm.totalPresent += r['Nuvärde'] || 0;
      if (r['Aktuell ränta'] > 0) cm.rates.push(r['Aktuell ränta']);
      if (r['Fakturatext']) cm.vehicles.add(r['Fakturatext']);
      if (r['Kontraktstyp']) cm.contractTypes.add(r['Kontraktstyp']);
      if (r['Objektsgrupp Beskrivning']) cm.objectTypes.add(r['Objektsgrupp Beskrivning']);
    });
    return Object.values(map).map((c) => {
      c.avgRate = c.rates.length ? c.rates.reduce((a, b) => a + b, 0) / c.rates.length : 0;
      c.nearestExpiryMonths = c.nearestExpiry ? Math.max(0, Math.round((c.nearestExpiry - now) / (1000 * 60 * 60 * 24 * 30.44))) : 999;
      c.vehicleList = [...c.vehicles].join(', ');
      c.contractTypeList = [...c.contractTypes];
      c.objectTypeList = [...c.objectTypes];
      c.searchText = [c.name, c.email, c.phone, c.city, c.vehicleList].join(' ').toLowerCase();
      return c;
    });
  }, [filteredData]);

  const cities = useMemo(() => [...new Set(allCustomers.map((c) => c.city).filter(Boolean))].sort(), [allCustomers]);
  const vTypes = useMemo(() => [...new Set(filteredData.map((r) => r['Objektsgrupp Beskrivning']).filter(Boolean))].sort(), [filteredData]);
  const cTypes = useMemo(() => [...new Set(filteredData.map((r) => r['Kontraktstyp']).filter(Boolean))].sort(), [filteredData]);

  const results = useMemo(() => {
    let r = allCustomers.filter((c) => {
      if (searchText && !c.searchText.includes(searchText.toLowerCase())) return false;
      if (searchType !== 'all' && c.type !== searchType) return false;
      if (minContracts && c.contracts < parseInt(minContracts)) return false;
      if (minActive && c.active < parseInt(minActive)) return false;
      if (minRate && c.avgRate < parseFloat(minRate)) return false;
      if (minVol && c.totalVol < parseFloat(minVol)) return false;
      if (minPresent && c.totalPresent < parseFloat(minPresent)) return false;
      if (expiryMonths && (c.nearestExpiryMonths > parseInt(expiryMonths) || c.nearestExpiryMonths === 999)) return false;
      if (city !== 'all' && c.city !== city) return false;
      if (vehicle !== 'all' && !c.objectTypeList.includes(vehicle)) return false;
      if (contractType !== 'all' && !c.contractTypeList.includes(contractType)) return false;
      return true;
    });
    const sortFns = {
      contracts: (a, b) => b.contracts - a.contracts,
      active: (a, b) => b.active - a.active,
      volume: (a, b) => b.totalVol - a.totalVol,
      present: (a, b) => b.totalPresent - a.totalPresent,
      rate: (a, b) => b.avgRate - a.avgRate,
      payment: (a, b) => b.totalPayment - a.totalPayment,
      expiry: (a, b) => a.nearestExpiryMonths - b.nearestExpiryMonths,
    };
    r.sort(sortFns[sortBy] || sortFns.contracts);
    return r;
  }, [allCustomers, searchText, searchType, minContracts, minActive, minRate, minVol, minPresent, expiryMonths, city, vehicle, contractType, sortBy]);

  const resetSearch = () => {
    setSearchText(''); setSearchType('all'); setMinContracts(''); setMinActive('');
    setMinRate(''); setMinVol(''); setMinPresent(''); setExpiryMonths('');
    setCity('all'); setVehicle('all'); setContractType('all'); setSortBy('contracts');
  };

  const fi = { padding: '8px', border: '1px solid #ddd', borderRadius: '8px', width: '100%' };

  return (
    <div className="section">
      <h2>
        Kundsökning
        <button className="export-btn" onClick={() => exportCSV(results)}>Exportera CSV</button>
        <button className="export-btn" style={{ background: '#e94560' }} onClick={resetSearch}>Nollställ filter</button>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16, padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
        <div className="filter-group"><label>Fritextsök (namn, e-post, telefon)</label><input style={{ ...fi, margin: 0 }} placeholder="Sök..." value={searchText} onChange={(e) => setSearchText(e.target.value)} /></div>
        <div className="filter-group"><label>Kundtyp</label><select style={fi} value={searchType} onChange={(e) => setSearchType(e.target.value)}><option value="all">Alla</option><option value="Privat">Privat</option><option value="Näringsidkare">Näringsidkare</option></select></div>
        <div className="filter-group"><label>Minst antal kontrakt</label><input type="number" style={fi} placeholder="1" min="1" value={minContracts} onChange={(e) => setMinContracts(e.target.value)} /></div>
        <div className="filter-group"><label>Minst antal aktiva</label><input type="number" style={fi} placeholder="0" min="0" value={minActive} onChange={(e) => setMinActive(e.target.value)} /></div>
        <div className="filter-group"><label>Snittränta högre än (%)</label><input type="number" style={fi} placeholder="t.ex. 5" step="0.1" value={minRate} onChange={(e) => setMinRate(e.target.value)} /></div>
        <div className="filter-group"><label>Total volym minst (kr)</label><input type="number" style={fi} placeholder="t.ex. 500000" step="10000" value={minVol} onChange={(e) => setMinVol(e.target.value)} /></div>
        <div className="filter-group"><label>Kvar att betala minst (kr)</label><input type="number" style={fi} placeholder="t.ex. 100000" step="10000" value={minPresent} onChange={(e) => setMinPresent(e.target.value)} /></div>
        <div className="filter-group"><label>Förfaller inom (månader)</label><input type="number" style={fi} placeholder="t.ex. 12" min="1" value={expiryMonths} onChange={(e) => setExpiryMonths(e.target.value)} /></div>
        <div className="filter-group"><label>Stad</label><select style={fi} value={city} onChange={(e) => setCity(e.target.value)}><option value="all">Alla</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="filter-group"><label>Fordonstyp (Objektsgrupp)</label><select style={fi} value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="all">Alla</option>{vTypes.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
        <div className="filter-group"><label>Kontraktstyp</label><select style={fi} value={contractType} onChange={(e) => setContractType(e.target.value)}><option value="all">Alla</option>{cTypes.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="filter-group"><label>Sortera efter</label>
          <select style={fi} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="contracts">Antal kontrakt</option><option value="active">Antal aktiva</option>
            <option value="volume">Total volym</option><option value="present">Kvar att betala</option>
            <option value="rate">Snittränta (högst)</option><option value="payment">Total månadsbet.</option>
            <option value="expiry">Närmast förfall</option>
          </select>
        </div>
      </div>
      <div style={{ fontSize: '.85em', color: '#666', marginBottom: 8 }}>
        {results.length} kunder hittade av {allCustomers.length} totalt
      </div>
      <div className="table-scroll" style={{ maxHeight: 600 }}>
        <table id="tableCustomers">
          <thead>
            <tr><th>Kund</th><th>Kundtyp</th><th>Stad</th><th>Kontrakt</th><th>Aktiva</th><th>Närmast förfall</th><th>Total volym</th><th>Kvar att betala</th><th>Tot. månadsbet.</th><th>Snittränta</th><th>Fordon</th><th>Telefon</th><th>E-post</th></tr>
          </thead>
          <tbody>
            {results.slice(0, 500).map((c) => {
              const eb = c.nearestExpiryMonths <= 6 ? 'badge-red' : c.nearestExpiryMonths <= 12 ? 'badge-yellow' : 'badge-green';
              const et = c.nearestExpiryMonths === 999 ? '-' : c.nearestExpiryMonths + ' mån';
              return (
                <tr key={c.id} className="clickable-row" onClick={() => openDrawer('customer', c.id)}>
                  <td style={{ textDecoration: 'underline' }}>{c.name || ''}</td>
                  <td>{c.type || ''}</td><td>{c.city || ''}</td>
                  <td>{c.contracts}</td><td>{c.active}</td>
                  <td><span className={`badge ${eb}`}>{et}</span></td>
                  <td>{fmtNum(c.totalVol)}</td><td>{fmtNum(c.totalPresent)}</td>
                  <td>{fmtNum(c.totalPayment)}</td>
                  <td>{c.avgRate > 0 ? c.avgRate.toFixed(2) + '%' : '-'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.vehicleList}>{c.vehicleList || '-'}</td>
                  <td>{c.phone}</td><td>{c.email}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
