export const formatGuaranies = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '₲ 0';
  
  return `₲ ${Math.round(numValue).toLocaleString('es-PY')}`;
};

export const parseGuaranies = (value: string): number => {
  const cleanValue = value.replace(/[₲\s.]/g, '');
  const numValue = parseInt(cleanValue, 10);
  return isNaN(numValue) ? 0 : numValue;
};

export const formatGuaraniesInput = (value: string): string => {
  const numValue = parseGuaranies(value);
  if (numValue === 0) return '';
  return numValue.toLocaleString('es-PY');
};

export const handleGuaraniesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  const numValue = parseGuaranies(value);
  e.target.value = formatGuaraniesInput(numValue.toString());
  return numValue;
};
