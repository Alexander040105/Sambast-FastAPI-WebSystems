"""
services/pricing.py — server-side quote recomputation (BE-A T5).

Port of legacy _build_validated_order_items + the unit/discount helpers
from legacy_code/app.py (~lines 2355-2565, 4740-4835).

Rule per MEGAPLAN §8: NEVER trust client prices. Every line is repriced
from the products/categories rows:

    final_unit_price = base_price x unit_multiplier - per_unit_discount
    line_total       = final_unit_price x qty

Unit options resolve in this order (first non-empty wins):
    1. products.unit_options   (JSONB on the product row)
    2. categories.unit_options (JSONB on the product's category)
    3. built-in default        ([1 pc x1] plus the product's own unit label)

Discounts come from products.discounts (JSONB) — legacy shape
[{"unit": "25kg sack", "type": "percentage", "value": 5}, ...] where "unit"
matches the selected option's value (also accepts "label" for rows written
with the newer schema shape). A "min_quantity" field is honored if present.
"""

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.category import Category
from app.models.products import Product

CENT = Decimal("0.01")


def _money(value) -> Decimal:
    """Round to 2 decimals the way a receipt expects."""
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def _normalize_unit_key(unit_value) -> str:
    return str(unit_value or "").strip().lower().replace(" ", "")


def _normalize_default_unit_label(unit_value) -> str:
    """Port of legacy _normalize_default_unit_label — map a product's base
    unit column to the label used in unit options."""
    normalized = _normalize_unit_key(unit_value)
    aliases = {
        "pc": "1 pc", "pcs": "1 pc", "piece": "1 pc", "pieces": "1 pc",
        "kg": "1kg", "kilo": "1kg", "kilos": "1kg",
        "kilogram": "1kg", "kilograms": "1kg",
        "tablet": "per tablet", "tablets": "per tablet",
        "strip": "per strip", "strips": "per strip",
        "box": "per box", "boxes": "per box",
        "bottle": "per bottle", "bottles": "per bottle",
        "pack": "per pack", "packs": "per pack",
        "pouch": "per pouch", "pouches": "per pouch",
        "sack": "1 sack", "sacks": "1 sack",
    }
    return aliases.get(normalized, str(unit_value or "").strip())


def _normalize_unit_options(raw_options) -> list:
    """Port of legacy _normalize_unit_options — accept loose JSON rows and
    emit [{label, value, multiplier}] with defaults filled in."""
    if not isinstance(raw_options, list):
        return []

    normalized = []
    seen_values = set()

    for option in raw_options:
        if not isinstance(option, dict):
            continue

        label = str(option.get("label") or "").strip()
        value = str(option.get("value") or "").strip()
        if not label:
            label = value
        if not value:
            value = label
        if not label or not value:
            continue

        try:
            multiplier = float(option.get("multiplier") or 1)
        except (TypeError, ValueError):
            multiplier = 1.0
        if multiplier <= 0:
            multiplier = 1.0

        value_key = _normalize_unit_key(value)
        if not value_key or value_key in seen_values:
            continue

        seen_values.add(value_key)
        normalized.append({
            "label": label,
            "value": value,
            "multiplier": multiplier,
        })

    return normalized


def _normalize_discounts(raw_discounts) -> list:
    """Port of legacy _normalize_discounts — [{unit, type, value}] only.
    "unit" may also arrive as "label" in newer rows; min_quantity optional."""
    if not isinstance(raw_discounts, list):
        return []

    normalized = []
    seen_units = set()

    for discount in raw_discounts:
        if not isinstance(discount, dict):
            continue

        unit = str(discount.get("unit") or discount.get("label") or "").strip()
        discount_type = str(discount.get("type") or "").strip().lower()

        if not unit or discount_type not in ("percentage", "fixed"):
            continue

        try:
            value = float(discount.get("value"))
        except (TypeError, ValueError):
            continue
        if value < 0:
            continue

        unit_key = _normalize_unit_key(unit)
        if unit_key in seen_units:
            continue
        seen_units.add(unit_key)

        try:
            min_qty = int(discount.get("min_quantity") or 1)
        except (TypeError, ValueError):
            min_qty = 1

        normalized.append({
            "unit": unit,
            "type": discount_type,
            "value": value,
            "min_quantity": max(1, min_qty),
        })

    return normalized


def _default_unit_options(default_unit) -> list:
    """Fallback when neither product nor category defines unit options —
    legacy returned [1 pc x1] plus the product's own base unit."""
    options = [{"label": "1 pc", "value": "1 pc", "multiplier": 1.0}]
    normalized_default = _normalize_default_unit_label(default_unit)
    if normalized_default and _normalize_unit_key(normalized_default) != "1pc":
        options.insert(0, {
            "label": normalized_default,
            "value": normalized_default,
            "multiplier": 1.0,
        })
    return options


def _get_unit_options(db: Session, product: Product) -> list:
    options = _normalize_unit_options(product.unit_options)
    if options:
        return options

    if product.category_id:
        category = db.query(Category).filter(
            Category.id == product.category_id
        ).first()
        if category:
            options = _normalize_unit_options(category.unit_options)
            if options:
                return options

    return _default_unit_options(product.unit)


def _find_unit_option(options, requested_unit):
    requested_key = _normalize_unit_key(
        _normalize_default_unit_label(requested_unit)
    )
    if not requested_key:
        return None
    for option in options:
        if _normalize_unit_key(option["value"]) == requested_key:
            return option
    return None


def _find_discount_for_unit(discounts, selected_unit, qty):
    selected_key = _normalize_unit_key(selected_unit)
    for discount in discounts:
        if _normalize_unit_key(discount["unit"]) != selected_key:
            continue
        if qty < discount["min_quantity"]:
            return None
        return discount
    return None


def _compute_discounted_unit_price(base_price, unit_multiplier, discount_entry) -> dict:
    """Port of legacy _compute_discounted_unit_price — discount can never
    exceed the unit price."""
    original = _money(Decimal(str(base_price)) * Decimal(str(unit_multiplier)))
    if not discount_entry:
        return {
            "original_unit_price": original,
            "discount_amount_per_unit": Decimal("0.00"),
            "final_unit_price": original,
        }

    value = Decimal(str(discount_entry["value"]))
    if discount_entry["type"] == "percentage":
        discount_amount = original * (value / Decimal("100"))
    else:
        discount_amount = value

    discount_amount = max(Decimal("0"), min(discount_amount, original))
    discount_amount = _money(discount_amount)
    final_unit_price = _money(original - discount_amount)

    return {
        "original_unit_price": original,
        "discount_amount_per_unit": discount_amount,
        "final_unit_price": final_unit_price,
    }


def build_validated_order_items(db: Session, items: list) -> dict:
    """Port of legacy _build_validated_order_items.

    items: [{"product_id": int, "quantity": int, "unit": str?}, ...]

    Returns {"items": [...], "summary": {subtotal, discount_total, total}}.
    Each item carries the *_at_time snapshot fields order_items expects.
    Raises HTTPException (envelope) on the first invalid line.
    """
    if not items:
        raise api_error(400, "BAD_REQUEST", "No items in order.")

    validated_items = []
    total_subtotal = Decimal("0")
    total_discount = Decimal("0")
    total_final = Decimal("0")

    for item in items:
        product_id = item.get("product_id")
        qty = item.get("quantity", item.get("qty"))
        requested_unit = str(item.get("unit") or "").strip()

        try:
            qty = int(qty)
        except (TypeError, ValueError):
            raise api_error(400, "BAD_REQUEST", "Invalid quantity provided.")
        if qty <= 0:
            raise api_error(400, "BAD_REQUEST", "Quantity must be greater than zero.")

        if product_id is None:
            raise api_error(
                400, "BAD_REQUEST", "Each item must include a product_id."
            )

        product = db.query(Product).filter(
            Product.id == product_id,
            Product.is_archived.is_(False),
        ).first()
        if not product:
            raise api_error(
                400, "BAD_REQUEST",
                f"Product {product_id} does not exist or is archived.",
            )

        unit_options = _get_unit_options(db, product)

        if requested_unit:
            selected_option = _find_unit_option(unit_options, requested_unit)
            if not selected_option:
                raise api_error(
                    400, "BAD_REQUEST",
                    f"Invalid unit '{requested_unit}' for product '{product.name}'.",
                )
        else:
            default_label = _normalize_default_unit_label(product.unit)
            selected_option = _find_unit_option(unit_options, default_label)
            if not selected_option:
                selected_option = unit_options[0]

        base_price = _money(product.base_price)
        unit_multiplier = Decimal(str(selected_option["multiplier"]))

        discounts = _normalize_discounts(product.discounts)
        discount_entry = _find_discount_for_unit(
            discounts, selected_option["value"], qty
        )
        pricing = _compute_discounted_unit_price(
            base_price, unit_multiplier, discount_entry
        )

        line_subtotal = _money(pricing["original_unit_price"] * qty)
        line_discount = _money(pricing["discount_amount_per_unit"] * qty)
        line_total = _money(pricing["final_unit_price"] * qty)

        total_subtotal += line_subtotal
        total_discount += line_discount
        total_final += line_total

        validated_items.append({
            "product_id": product.id,
            "name": product.name,
            "quantity": qty,
            "selected_unit": selected_option["value"],
            "unit_multiplier": unit_multiplier,
            "base_price_at_time": base_price,
            "discount_amount_at_time": pricing["discount_amount_per_unit"],
            "unit_price": pricing["final_unit_price"],
            "line_total": line_total,
        })

    return {
        "items": validated_items,
        "summary": {
            "subtotal": _money(total_subtotal),
            "discount_total": _money(total_discount),
            "total": _money(total_final),
        },
    }
