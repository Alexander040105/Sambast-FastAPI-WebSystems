// Cart price estimates — mirror backend/app/services/pricing.py:
//   unit_price = base_price x unit_multiplier - per_unit_discount
// Discounts are applied server-side only, so the estimate uses the
// undiscounted unit price (base_price x multiplier).

export function getUnitMultiplier(unit) {
  const multiplier = Number(unit?.multiplier ?? 1);
  return multiplier > 0 ? multiplier : 1;
}

export function getItemPrice(item) {
  const basePrice = Number(item.product?.base_price ?? 0);
  return basePrice * getUnitMultiplier(item.unit);
}
