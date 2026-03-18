import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Input Component - Consistent input field styling
 * 
 * @example
 * // Basic input
 * <Input placeholder="Enter text..." />
 * 
 * @example
 * // Input with label
 * <Input label="Email" type="email" />
 * 
 * @example
 * // Input with error
 * <Input label="Username" error="Username is required" />
 * 
 * @example
 * // Input with left element
 * <Input leftElement="🔍" placeholder="Search..." />
 */
export function Input({
  label,
  error,
  leftElement,
  rightElement,
  fullWidth = true,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-semibold mb-sm"
          style={{ marginBottom: '0.5rem' }}
        >
          {label}
        </label>
      )}
      
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {leftElement && (
          <div style={{
            position: 'absolute',
            left: '12px',
            zIndex: 1,
            color: 'var(--muted)'
          }}>
            {leftElement}
          </div>
        )}
        
        <input
          id={inputId}
          className={`input ${leftElement ? 'pl-md' : ''} ${rightElement ? 'pr-md' : ''} ${error ? 'input-error' : ''} ${className}`}
          {...props}
        />
        
        {rightElement && (
          <div style={{
            position: 'absolute',
            right: '12px',
            zIndex: 1
          }}>
            {rightElement}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-danger mt-xs" style={{ margin: '4px 0 0 0', color: 'var(--danger)', fontSize: '0.875rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * TextArea Component - Multi-line input field
 */
export function TextArea({
  label,
  error,
  rows = 4,
  fullWidth = true,
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  rows?: number;
  fullWidth?: boolean;
}) {
  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <label 
          className="block text-sm font-semibold mb-sm"
          style={{ marginBottom: '0.5rem' }}
        >
          {label}
        </label>
      )}
      
      <textarea
        rows={rows}
        className={`input ${error ? 'input-error' : ''} ${className}`}
        style={{ resize: 'vertical', minHeight: '80px' }}
        {...props}
      />
      
      {error && (
        <p className="text-sm text-danger mt-xs" style={{ margin: '4px 0 0 0', color: 'var(--danger)', fontSize: '0.875rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Checkbox Component - Styled checkbox with label
 */
export function Checkbox({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
}) {
  return (
    <label className={`flex items-center gap-sm cursor-pointer ${className}`}>
      <input
        type="checkbox"
        className="w-5 h-5 rounded"
        style={{
          width: '20px',
          height: '20px',
          cursor: 'pointer',
          accentColor: 'var(--primary)'
        }}
        {...props}
      />
      {label && (
        <span className="text-sm font-medium">{label}</span>
      )}
    </label>
  );
}

/**
 * Radio Component - Styled radio button with label
 */
export function Radio({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
}) {
  return (
    <label className={`flex items-center gap-sm cursor-pointer ${className}`}>
      <input
        type="radio"
        className="w-5 h-5 rounded-full"
        style={{
          width: '20px',
          height: '20px',
          cursor: 'pointer',
          accentColor: 'var(--primary)'
        }}
        {...props}
      />
      {label && (
        <span className="text-sm font-medium">{label}</span>
      )}
    </label>
  );
}

export default Input;
