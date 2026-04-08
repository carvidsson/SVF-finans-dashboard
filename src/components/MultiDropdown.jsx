import React, { useState, useRef, useEffect, useMemo } from 'react';

export default function MultiDropdown({ id, label, placeholder, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const triggerLabel = useMemo(() => {
    if (!selected.length) return placeholder;
    if (selected.length === 1) return selected[0];
    return `${selected.length} valda`;
  }, [selected, placeholder]);

  const toggle = (val) => {
    const next = selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val];
    onChange(next);
  };

  const selectAll = () => onChange([...filtered]);
  const clearAll = () => onChange([]);

  return (
    <div ref={wrapRef} className={`multi-dropdown${open ? ' open' : ''}`} id={id}>
      <button
        type="button"
        className="multi-dropdown__trigger"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        {triggerLabel}
      </button>
      <div className="multi-dropdown__menu">
        <input
          type="text"
          className="multi-dropdown__search"
          placeholder={`Sök ${label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="multi-dropdown__actions">
          <button type="button" className="multi-dropdown__action" onClick={selectAll}>Välj alla</button>
          <button type="button" className="multi-dropdown__action" onClick={clearAll}>Rensa</button>
        </div>
        <div className="multi-dropdown__list">
          {filtered.length === 0 && <div className="multi-dropdown__empty">Inga träffar</div>}
          {filtered.map((opt) => (
            <label key={opt} className="multi-dropdown__option">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
