import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const DataContext = createContext(null);

const DEFAULT_FILTERS = {
  dealers: [],
  sellers: [],
  status: 'Active',
  custType: 'all',
  datePreset: 'all',
  dateFrom: '',
  dateTo: '',
};

export function DataProvider({ children }) {
  const [rawData, setRawData] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [drawer, setDrawer] = useState({ open: false, type: null, id: null });

  const filteredData = useMemo(() => {
    const { dealers, sellers, status, custType, dateFrom, dateTo } = filters;
    const df = dateFrom ? new Date(dateFrom) : null;
    const dt = dateTo ? new Date(dateTo + 'T23:59:59') : null;

    return rawData.filter((r) => {
      if (dealers.length && !dealers.includes(r['Leverantörsnamn'])) return false;
      if (sellers.length && !sellers.includes(r['Case-ägare'])) return false;
      if (status !== 'all' && r['Status kontraktsrad'] !== status) return false;
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

  const updateFilters = useCallback((partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const openDrawer = useCallback((type, id) => {
    setDrawer({ open: true, type, id });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer({ open: false, type: null, id: null });
  }, []);

  // Unique values for filter dropdowns
  const uniqueDealers = useMemo(
    () => [...new Set(rawData.map((r) => r['Leverantörsnamn']).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), 'sv')
    ),
    [rawData]
  );

  const uniqueSellers = useMemo(
    () => [...new Set(rawData.map((r) => r['Case-ägare']).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), 'sv')
    ),
    [rawData]
  );

  const uniqueCustTypes = useMemo(
    () => [...new Set(rawData.map((r) => r['Kundtyp']).filter(Boolean))].sort(),
    [rawData]
  );

  return (
    <DataContext.Provider
      value={{
        rawData, setRawData,
        filteredData,
        filters, updateFilters, resetFilters,
        drawer, openDrawer, closeDrawer,
        uniqueDealers, uniqueSellers, uniqueCustTypes,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
