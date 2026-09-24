const trimNumber = (value: number) => Number.isInteger(value)
  ? String(value)
  : String(Number(value.toFixed(2)));

export const parseMemberBenefitUnit = (unitName?: string | null) => {
  const raw = String(unitName || '').trim();
  const matched = raw.match(/^(\d+(?:\.\d+)?)\s*(\D.*)$/);
  if (!matched) return { amountPerUnit: 1, label: raw, packaged: false };
  const amountPerUnit = Number(matched[1]);
  if (!(amountPerUnit > 0)) return { amountPerUnit: 1, label: raw, packaged: false };
  return { amountPerUnit, label: matched[2].trim(), packaged: true };
};

export const formatMemberBenefitQuantity = (quantity: any, unitName?: string | null) => {
  const numericQuantity = Number(quantity || 0);
  const unit = parseMemberBenefitUnit(unitName);
  return `${trimNumber(numericQuantity * unit.amountPerUnit)}${unit.label}`;
};

export const formatMemberBenefitInputUnit = (unitName?: string | null) => {
  const unit = parseMemberBenefitUnit(unitName);
  return unit.packaged ? `份（1份=${trimNumber(unit.amountPerUnit)}${unit.label}）` : (unit.label || '份');
};
