// src/utils/format.js
export const formatCurrency = (amount, currency = 'BDT') => {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formatted = formatter.format(Math.abs(amount || 0));
    const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
    return `${sign} ${formatted} ${currency}`;
  };
  
  export const formatUSD = (amount) => {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formatted = formatter.format(Math.abs(amount || 0));
    const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
    return `${sign} $${formatted}`;
  };
  