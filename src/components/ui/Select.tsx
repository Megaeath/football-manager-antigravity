import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  fullWidth?: boolean;
}

/**
 * Select Component - Consistent dropdown styling
 * 
 * @example
 * // Basic select
 * <Select
 *   options={[
 *     { value: '1', label: 'Option 1' },
 *     { value: '2', label: 'Option 2' }
 *   ]}
 * />
 * 
 * @example
 * // Select with label
 * <Select
 *   label="Position"
 *   options={[
 *     { value: 'GK', label: 'Goalkeeper' },
 *     { value: 'DF', label: 'Defender' }
 *   ]}
 * />
 * 
 * @example
 * // Select with placeholder
 * <Select
 *   placeholder="Select an option"
 *   options={[...]}
 * />
 */
export function Select({
  label,
  error,
  options,
  placeholder,
  fullWidth = true,
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <label 
          htmlFor={selectId}
          className="block text-sm font-semibold mb-sm"
          style={{ marginBottom: '0.5rem' }}
        >
          {label}
        </label>
      )}
      
      <select
        id={selectId}
        className={`select ${error ? 'input-error' : ''} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="text-sm text-danger mt-xs" style={{ margin: '4px 0 0 0', color: 'var(--danger)', fontSize: '0.875rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * MultiSelect Component - Multiple selection dropdown
 * Note: Browser native multi-select, for advanced usage consider a library
 */
export function MultiSelect({
  label,
  options,
  className = '',
  ...props
}: {
  label?: string;
  options: { value: string; label: string }[];
  className?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      {label && (
        <label 
          className="block text-sm font-semibold mb-sm"
          style={{ marginBottom: '0.5rem' }}
        >
          {label}
        </label>
      )}
      
      <select
        multiple
        className={`select ${className}`}
        style={{ minHeight: '120px' }}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Select;
