import React, { useState, useEffect, useRef, useMemo } from 'react';
import { countryCodes, defaultCountry } from '../../data/countryCodes';
import { ChevronDown, Search, X } from 'lucide-react';

export default function CountryPhoneInput({
  label = 'Phone',
  name = 'phone',
  value = '',
  onChange,
  placeholder = '(555) 000-0000',
  id,
  required = false,
  disabled = false,
}) {
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Parse initial or incoming phone string
  const parsePhone = (raw) => {
    if (!raw || typeof raw !== 'string') {
      return { country: defaultCountry, number: '' };
    }
    const clean = raw.trim();
    // Sort descending by dial_code length so longer prefixes (+1-684, +355) match before shorter (+1, +35)
    const sorted = [...countryCodes].sort((a, b) => b.dial_code.length - a.dial_code.length);
    for (const c of sorted) {
      if (clean.startsWith(c.dial_code)) {
        const rest = clean.slice(c.dial_code.length).trim();
        return { country: c, number: rest };
      }
    }
    return { country: defaultCountry, number: clean };
  };

  const initial = parsePhone(value);
  const [selectedCountry, setSelectedCountry] = useState(initial.country);
  const [localNumber, setLocalNumber] = useState(initial.number);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Keep internal state in sync if parent value changes externally
  useEffect(() => {
    const parsed = parsePhone(value);
    setSelectedCountry(parsed.country);
    setLocalNumber(parsed.number);
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isDropdownOpen]);

  // Filter countries by name or dial code
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countryCodes;
    const q = searchQuery.toLowerCase().trim();
    return countryCodes.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial_code.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const emitChange = (country, number) => {
    const numClean = (number || '').trim();
    const fullPhone = numClean ? `${country.dial_code} ${numClean}` : '';
    if (onChange) {
      onChange({
        target: {
          name,
          value: fullPhone,
        },
      });
    }
  };

  const handleCountrySelect = (c) => {
    setSelectedCountry(c);
    setIsDropdownOpen(false);
    setSearchQuery('');
    emitChange(c, localNumber);
  };

  const handleNumberChange = (e) => {
    const val = e.target.value;
    setLocalNumber(val);
    emitChange(selectedCountry, val);
  };

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      {label && (
        <label
          htmlFor={id || name}
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#334155',
            display: 'block',
            marginBottom: 4,
          }}
        >
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      {/* Input Group: Country Selector Trigger + Local Phone Number Field */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          width: '100%',
        }}
      >
        {/* Country Code Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsDropdownOpen((prev) => !prev)}
          disabled={disabled}
          title={`${selectedCountry.name} (${selectedCountry.dial_code})`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 0.75rem',
            background: isDropdownOpen ? '#eff6ff' : '#f8fafc',
            border: `1px solid ${isDropdownOpen ? '#2563eb' : 'var(--border-default, #cbd5e1)'}`,
            borderRight: 'none',
            borderTopLeftRadius: 'var(--radius-md, 8px)',
            borderBottomLeftRadius: 'var(--radius-md, 8px)',
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#1e293b',
            cursor: disabled ? 'not-allowed' : 'pointer',
            userSelect: 'none',
            outline: 'none',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '1.125rem', lineHeight: 1 }}>{selectedCountry.flag}</span>
          <span style={{ color: '#334155', fontWeight: 700 }}>{selectedCountry.dial_code}</span>
          <ChevronDown
            size={14}
            style={{
              color: '#64748b',
              transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>

        {/* Local Number Input */}
        <input
          type="text"
          id={id || name}
          name={name}
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={disabled}
          className="input-field"
          style={{
            flex: 1,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            margin: 0,
          }}
        />
      </div>

      {/* Dropdown Menu (Styled matching screenshot 2 with flag, full name, code, hover & scroll) */}
      {isDropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            maxWidth: 380,
            minWidth: 290,
            maxHeight: 280,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search Box Header */}
          <div
            style={{
              padding: '0.5rem 0.65rem',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Search size={14} color="#64748b" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search country or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.8125rem',
                width: '100%',
                color: '#1e293b',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Scrollable Countries List */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '0.2rem 0',
            }}
          >
            {filteredCountries.length === 0 ? (
              <div
                style={{
                  padding: '1rem',
                  fontSize: '0.8125rem',
                  color: '#94a3b8',
                  textAlign: 'center',
                }}
              >
                No countries found
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = selectedCountry.code === c.code;
                return (
                  <button
                    key={`${c.code}-${c.dial_code}`}
                    type="button"
                    onClick={() => handleCountrySelect(c)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.45rem 0.75rem',
                      background: isSelected ? '#3b82f6' : 'transparent',
                      color: isSelected ? '#ffffff' : '#1e293b',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      transition: 'background 0.1s ease',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#f1f5f9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{c.flag}</span>
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      style={{
                        color: isSelected ? '#ffffff' : '#64748b',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}
                    >
                      ({c.dial_code})
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
