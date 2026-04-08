import React from 'react';
import { useData } from '../context/DataContext';
import MultiDropdown from './MultiDropdown';

export default function FilterBar() {
  const {
    rawData, filteredData,
    filters, updateFilters, resetFilters,
    uniqueDealers, uniqueSellers, uniqueCustTypes,
  } = useData();

  const dealerText = filters.dealers.length
    ? `${filters.dealers.length} valda leverantörer`
    : 'alla leverantörer';
  const sellerText = filters.sellers.length
    ? `${filters.sellers.length} valda säljare`
    : 'alla säljare';

  const handleReset = () => {
    resetFilters();
  };

  return (
    <div className="filters">
      <div className="filter-group filter-group--multi">
        <label>Leverantör</label>
        <MultiDropdown
          id="filterDealerWrap"
          label="Leverantör"
          placeholder="Alla leverantörer"
          options={uniqueDealers}
          selected={filters.dealers}
          onChange={(vals) => updateFilters({ dealers: vals })}
        />
        <div className="multi-help">Välj en eller flera. Inget val = alla.</div>
      </div>

      <div className="filter-group filter-group--multi">
        <label>Säljare / Case-ägare</label>
        <MultiDropdown
          id="filterSellerWrap"
          label="Säljare"
          placeholder="Alla säljare"
          options={uniqueSellers}
          selected={filters.sellers}
          onChange={(vals) => updateFilters({ sellers: vals })}
        />
        <div className="multi-help">Välj en eller flera. Inget val = alla.</div>
      </div>

      <div className="filter-group">
        <label>Status</label>
        <select value={filters.status} onChange={(e) => updateFilters({ status: e.target.value })}>
          <option value="all">Alla</option>
          <option value="Active">Aktiva</option>
          <option value="Terminated">Avslutade</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Kundtyp</label>
        <select value={filters.custType} onChange={(e) => updateFilters({ custType: e.target.value })}>
          <option value="all">Alla</option>
          {uniqueCustTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="filter-actions">
        <button className="filter-clear-btn" onClick={handleReset}>Rensa val</button>
      </div>

      <div className="filter-stats">
        Visar {filteredData.length.toLocaleString()} av {rawData.length.toLocaleString()} rader
        {' '}• {dealerText} • {sellerText}
      </div>
    </div>
  );
}
