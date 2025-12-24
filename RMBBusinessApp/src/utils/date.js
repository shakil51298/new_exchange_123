// src/utils/date.js
export const getTodayDate = () => new Date().toISOString().split('T')[0];
