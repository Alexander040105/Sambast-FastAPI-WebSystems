"""
Seed products + categories from the legacy catalog CSV into the new schema.

Port of legacy_code/seed.py (SQLite → SQLAlchemy/Postgres). Reads
legacy_code/sambast_inventory_list_v2.csv, infers categories, applies
legacy default unit_options, copies matched product images from
static/products/ into backend/uploads/products/, and upserts by
LOWER(name) so re-runs are idempotent.

Usage (from backend/):
    .venv/Scripts/python scripts/seed_products.py [--dry-run] [--skip-existing] [--truncate]
"""

import argparse
import csv
import re
import shutil
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
CSV_PATH = REPO_ROOT / "legacy_code" / "sambast_inventory_list_v2.csv"
LEGACY_PRODUCTS_DIR = REPO_ROOT / "static" / "products"
UPLOADS_PRODUCTS_DIR = BACKEND_DIR / "uploads" / "products"

load_dotenv(BACKEND_DIR / ".env")
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import BigInteger, JSON, func  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402


# ── SQLite compatibility shims (only fire if DATABASE_URL is sqlite) ──
@compiles(JSONB, "sqlite")
def _jsonb_as_json(element, compiler, **kw):
    return "JSON"


@compiles(BigInteger, "sqlite")
def _bigint_as_int(element, compiler, **kw):
    return "INTEGER"


from app.db.session import SessionLocal  # noqa: E402
from app.models import Category, Product  # noqa: E402

CANONICAL_COLUMNS = [
    "name",
    "category",
    "price",
    "stock_status",
    "image_filename",
    "description",
    "purpose",
    "target_species",
    "tags",
]

HEADER_ALIASES = {
    "name": ["name", "product", "product_name", "item_name"],
    "category": ["category", "type"],
    "price": ["price", "unit_price", "srp", "price_per_kg_php"],
    "stock_status": ["stock_status", "stock", "stock_count", "quantity", "qty"],
    "image_filename": ["image_filename", "image", "image_file", "photo"],
    "description": ["description", "desc", "details"],
    "purpose": ["purpose"],
    "target_species": ["target_species", "species", "pet_type", "target_pet_type"],
    "tags": ["tags", "keywords"],
}

# Ported from legacy_code/app.py::_default_category_unit_options —
# shape: [{label, value, multiplier}]
CATEGORY_UNIT_OPTIONS = {
    "Feeds": [
        {"label": "0.5 kg", "value": "0.5 kg", "multiplier": 0.5},
        {"label": "1 kg", "value": "1 kg", "multiplier": 1},
        {"label": "1 pc", "value": "1 pc", "multiplier": 1},
    ],
    "Medicine": [
        {"label": "1 pc", "value": "1 pc", "multiplier": 1},
        {"label": "10 pcs", "value": "10 pcs", "multiplier": 10},
    ],
    "Supplies": [
        {"label": "1 pc", "value": "1 pc", "multiplier": 1},
        {"label": "3 pcs", "value": "3 pcs", "multiplier": 3},
    ],
}
DEFAULT_UNIT_OPTIONS = [{"label": "1 pc", "value": "1 pc", "multiplier": 1}]


def normalize_header(text):
    value = (text or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


# Ported verbatim from legacy_code/seed.py
def infer_category(name, description, target_species):
    text = f"{name} {description} {target_species}".lower()

    medicine_markers = [
        "deworm", "vitamin", "multivitamin", "antibi", "soap",
        "treatment", "parasite", "levamisole", "albendazole", "para-v",
    ]
    supplies_markers = [
        "feeder", "shampoo", "litter", "leash", "collar", "toy", "bowl",
    ]

    if any(marker in text for marker in medicine_markers):
        return "Medicine"
    if any(marker in text for marker in supplies_markers):
        return "Supplies"
    return "Feeds"


def build_header_map(fieldnames):
    normalized_to_actual = {normalize_header(n): n for n in (fieldnames or [])}
    header_map = {}
    for canonical in CANONICAL_COLUMNS:
        actual_name = None
        for alias in HEADER_ALIASES[canonical]:
            if normalize_header(alias) in normalized_to_actual:
                actual_name = normalized_to_actual[normalize_header(alias)]
                break
        header_map[canonical] = actual_name
    return header_map


def csv_get(row, header_map, key, default_value=""):
    actual_name = header_map.get(key)
    if not actual_name:
        return default_value
    value = row.get(actual_name, default_value)
    return value.strip() if isinstance(value, str) else value


def parse_float(value):
    if value is None:
        return None
    text = str(value).strip().replace("₱", "").replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_int(value, default_value=0):
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default_value


def normalize_image_stem(name):
    text = (name or "").strip().lower()
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def resolve_image_file(name, explicit_filename=""):
    """Find the matching legacy image on disk; return its filename or None."""
    extensions = (".png", ".jpg", ".jpeg")

    filename = (explicit_filename or "").strip()
    if (
        filename
        and Path(filename).suffix.lower() in extensions
        and (LEGACY_PRODUCTS_DIR / filename).exists()
    ):
        return filename

    stem = normalize_image_stem(name)
    for ext in extensions:
        if (LEGACY_PRODUCTS_DIR / f"{stem}{ext}").exists():
            return f"{stem}{ext}"
    return None


def get_or_create_category(db, name):
    category = (
        db.query(Category)
        .filter(func.lower(Category.name) == name.lower())
        .first()
    )
    if category:
        return category
    category = Category(
        name=name,
        unit_options=CATEGORY_UNIT_OPTIONS.get(name, DEFAULT_UNIT_OPTIONS),
    )
    db.add(category)
    db.flush()
    return category


def seed_products(csv_path, replace_existing=True, truncate=False, dry_run=False):
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    UPLOADS_PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    inserted = updated = skipped = invalid = images_resolved = images_copied = 0
    seen_names = set()

    try:
        if truncate:
            # order_items.product_id is ON DELETE SET NULL — plain delete is safe
            deleted = db.query(Product).delete(synchronize_session=False)
            print(f"Truncate mode: deleted {deleted} product row(s).")

        with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
            reader = csv.DictReader(csv_file)
            header_map = build_header_map(reader.fieldnames)

            if not header_map.get("name") or not header_map.get("price"):
                raise ValueError("CSV must contain columns for product name and price.")

            for line_number, row in enumerate(reader, start=2):
                name = csv_get(row, header_map, "name")
                price = parse_float(csv_get(row, header_map, "price"))
                if not name or price is None:
                    invalid += 1
                    print(f"Skipping invalid row {line_number}: missing name or price")
                    continue

                description = csv_get(row, header_map, "description")
                target_species = csv_get(row, header_map, "target_species")
                category_name = csv_get(row, header_map, "category") or infer_category(
                    name, description, target_species
                )

                # Resolve image from the ORIGINAL name before any rename.
                image_file = resolve_image_file(
                    name, csv_get(row, header_map, "image_filename")
                )

                # CSV contains a true duplicate name ("Sera Raffy P" is two
                # different products) — disambiguate instead of overwriting.
                if name.lower() in seen_names:
                    species_short = re.split(r"[(/]", target_species)[0].strip()
                    name = f"{name} ({species_short})" if species_short else name
                    print(f"  ! duplicate name on row {line_number} — saving as '{name}'")
                seen_names.add(name.lower())

                per_unit = bool(re.search(r"per\s*unit", description or "", re.I))
                image_url = None
                if image_file:
                    images_resolved += 1
                    dest = UPLOADS_PRODUCTS_DIR / image_file
                    if not dry_run and not dest.exists():
                        shutil.copy2(LEGACY_PRODUCTS_DIR / image_file, dest)
                        images_copied += 1
                    image_url = f"/uploads/products/{image_file}"

                category = get_or_create_category(db, category_name)
                record = {
                    "name": name,
                    "category_id": category.id,
                    "description": description,
                    "base_price": price,
                    "unit": "pc" if per_unit else "kg",
                    "weight_kg_per_unit": None if per_unit else 1.0,
                    "stock_quantity": parse_int(
                        csv_get(row, header_map, "stock_status", 20), 20
                    ),
                    "image_url": image_url,
                    "unit_options": CATEGORY_UNIT_OPTIONS.get(
                        category_name, DEFAULT_UNIT_OPTIONS
                    ),
                    "discounts": [],
                    "purpose": csv_get(row, header_map, "purpose") or None,
                    "target_species": target_species or None,
                    "tags": csv_get(row, header_map, "tags") or None,
                    "is_archived": False,
                }

                existing = (
                    db.query(Product)
                    .filter(func.lower(Product.name) == name.lower())
                    .first()
                )
                if existing:
                    if not replace_existing:
                        skipped += 1
                        continue
                    if not dry_run:
                        for field, value in record.items():
                            setattr(existing, field, value)
                    updated += 1
                else:
                    if not dry_run:
                        db.add(Product(**record))
                    inserted += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()

        total = db.query(func.count(Product.id)).scalar()
        mode = "DRY-RUN" if dry_run else "APPLIED"
        print(f"Seed completed ({mode}).")
        print(f"Inserted: {inserted}")
        print(f"Updated: {updated}")
        print(f"Skipped: {skipped}")
        print(f"Invalid rows: {invalid}")
        print(f"Images resolved: {images_resolved}")
        print(f"Images copied: {images_copied}")
        print(f"Products in table: {total}")
    finally:
        db.close()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Seed products+categories from sambast_inventory_list_v2.csv"
    )
    parser.add_argument("--csv", default=str(CSV_PATH), help="Source CSV path")
    parser.add_argument("--truncate", action="store_true", help="Delete existing products first")
    parser.add_argument("--skip-existing", action="store_true", help="Don't update existing names")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    seed_products(
        csv_path=Path(args.csv),
        replace_existing=not args.skip_existing,
        truncate=args.truncate,
        dry_run=args.dry_run,
    )
