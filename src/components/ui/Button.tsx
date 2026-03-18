import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Button Component - Consistent button styling with variants
 * 
 * @example
 * // Primary button
 * <Button>Click Me</Button>
 * 
 * @example
 * // Secondary button with icon
 * <Button variant="secondary" leftIcon="🔍">Search</Button>
 * 
 * @example
 * // Loading state
 * <Button loading>Loading...</Button>
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  onClick,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantClasses = {
    'primary': 'btn-primary',
    'secondary': 'btn-secondary',
    'accent': 'btn-accent',
    'ghost': 'btn-ghost',
    'danger': 'btn-danger'
  };

  const sizeClasses = {
    'sm': 'btn-sm',
    'md': '',
    'lg': 'btn-lg'
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) return;
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      className={`btn ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'btn-block' : ''} ${className} ${loading || disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="spinner" style={{ marginRight: '4px' }}>
          ⏳
        </span>
      )}
      {leftIcon && !loading && (
        <span style={{ marginRight: '4px' }}>{leftIcon}</span>
      )}
      {children}
      {rightIcon && (
        <span style={{ marginLeft: '4px' }}>{rightIcon}</span>
      )}
    </button>
  );
}

/**
 * Icon Button Component - Square button for icons
 */
export function IconButton({
  children,
  variant = 'ghost',
  size = 'md',
  onClick,
  disabled = false,
  title,
  className = ''
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const sizeStyles = {
    'sm': { width: '32px', height: '32px', padding: '0' },
    'md': { width: '40px', height: '40px', padding: '0' },
    'lg': { width: '48px', height: '48px', padding: '0' }
  };

  return (
    <button
      className={`btn ${variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'text-danger' : 'btn-ghost'} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={sizeStyles[size]}
    >
      {children}
    </button>
  );
}

/**
 * Button Group Component - Group buttons together
 */
export function ButtonGroup({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex gap-sm ${className}`}>
      {children}
    </div>
  );
}

export default Button;
