export const theme = {
  colors: {
    // Base colors
    background: '#0A0A0A',
    surface: '#141414',
    surfaceLight: '#1A1A1A',
    
    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textMuted: '#666666',
    
    // Accent colors
    primary: '#FF6B00',  // Orange accent from the reference
    secondary: '#00A3FF', // Cyan accent for contrast
    
    // Status colors
    success: '#00C853',
    error: '#FF3D00',
    warning: '#FFD600',
    
    // Border colors
    border: '#2A2A2A',
    borderLight: '#333333',
    
    // Overlay colors
    overlay: 'rgba(0, 0, 0, 0.75)',
    modalBackground: '#1A1A1A',
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  
  typography: {
    fontFamily: {
      mono: 'JetBrains Mono, monospace',
      sans: 'Inter, system-ui, sans-serif',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      xxl: '1.5rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.25)',
    md: '0 2px 4px rgba(0, 0, 0, 0.25)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.25)',
    xl: '0 8px 16px rgba(0, 0, 0, 0.25)',
  },
  
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '350ms ease',
  },
} 