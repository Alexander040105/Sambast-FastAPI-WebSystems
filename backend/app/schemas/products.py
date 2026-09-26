from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Nested structures
# ---------------------------------------------------------------------------

"""
Product Table postgres Schema reference
CREATE TABLE "products" (
	"id" bigserial PRIMARY KEY,
	"category_id" bigint,
	"name" varchar(255) NOT NULL,
	"description" text,
	"base_price" numeric(12, 2) NOT NULL,
	"unit" varchar(50),
	"unit_options" jsonb,
	"discounts" jsonb,
	"weight_kg_per_unit" numeric(10, 3),
	"stock_quantity" bigint,
	"image_url" text,
	"is_archived" boolean NOT NULL,
	"purpose" varchar(100),
	"target_species" varchar(100),
	"tags" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "ix_products_category_id" ON "products" ("category_id");
CREATE UNIQUE INDEX "products_pkey" ON "products" ("id");
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL;
"""


class UnitOption(BaseModel):
    label: str
    value: str
    multiplier: float = Field(..., gt=0)


class Discount(BaseModel):
    label: Optional[str] = None
    type: Optional[str] = None      
    value: Optional[float] = None
    min_quantity: Optional[float] = None


class ProductBase(BaseModel):
    category_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    base_price: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    unit: Optional[str] = None
    unit_options: Optional[List[UnitOption]] = None
    discounts: Optional[List[Discount]] = None
    weight_kg_per_unit: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=10, decimal_places=3
    )
    stock_quantity: int = Field(default=0, ge=0)
    image_url: Optional[str] = None
    is_archived: bool = False
    purpose: Optional[str] = None
    target_species: Optional[str] = None
    tags: Optional[str] = None


class ProductCreate(BaseModel):
    category_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    base_price: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    unit: Optional[str] = None
    unit_options: Optional[List[UnitOption]] = None
    discounts: Optional[List[Discount]] = None
    weight_kg_per_unit: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=10, decimal_places=3
    )
    stock_quantity: int = Field(default=0, ge=0)
    image_url: Optional[str] = None
    is_archived: bool = False
    purpose: Optional[str] = None
    target_species: Optional[str] = None
    tags: Optional[str] = None



class ProductUpdate(BaseModel):
    """Payload for PATCH /products/{id} — every field optional."""
    category_id: Optional[int] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    base_price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    unit: Optional[str] = None
    unit_options: Optional[List[UnitOption]] = None
    discounts: Optional[List[Discount]] = None
    weight_kg_per_unit: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=10, decimal_places=3
    )
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    image_url: Optional[str] = None
    is_archived: Optional[bool] = None
    purpose: Optional[str] = None
    target_species: Optional[str] = None
    tags: Optional[str] = None


class ProductOut(ProductBase):
    """Response schema, e.g. GET /products/{id}"""
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)  # allows ORM objects (SQLAlchemy rows) in
