"""
/api/v1/analytics — admin dashboard metrics (BE-A T9), ported from the
legacy /api/admin/* endpoints to SQLAlchemy/Postgres.

Status enums changed with the migration: legacy counted 'Completed';
here FULFILLED = COMPLETED and ACTIVE = the whole live pipeline.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, literal_column
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.category import Category
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.products import Product
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

FULFILLED = ("COMPLETED",)
ACTIVE = ("PENDING", "CONFIRMED", "READY_FOR_DISPATCH", "ASSIGNED", "OUT_FOR_DELIVERY")

# legacy low-stock tiers
LOW_STOCK_CRITICAL_MAX = 2
LOW_STOCK_WARNING_MAX = 5
LOW_STOCK_WATCH_MAX = 9


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "ops_manager")),
):
    revenue = db.query(func.coalesce(func.sum(Order.total_price), 0)).filter(
        Order.status.in_(FULFILLED)
    ).scalar()
    completed_orders = db.query(func.count(Order.id)).filter(
        Order.status.in_(FULFILLED)
    ).scalar()
    active_orders = db.query(func.count(Order.id)).filter(
        Order.status.in_(ACTIVE)
    ).scalar()

    avg_value = float(revenue) / completed_orders if completed_orders else 0.0

    low_stock_tiers = {"critical": [], "warning": [], "watch": []}
    low_stock = db.query(Product).filter(
        Product.stock_quantity <= LOW_STOCK_WATCH_MAX,
        Product.is_archived.is_(False),
    ).order_by(Product.stock_quantity.asc(), Product.name.asc()).all()

    for product in low_stock:
        stock = int(product.stock_quantity or 0)
        entry = {"name": product.name, "stock": stock}
        if stock <= LOW_STOCK_CRITICAL_MAX:
            low_stock_tiers["critical"].append(entry)
        elif stock <= LOW_STOCK_WARNING_MAX:
            low_stock_tiers["warning"].append(entry)
        else:
            low_stock_tiers["watch"].append(entry)

    return {
        "revenue": float(revenue),
        "order_count": completed_orders,
        "completed_order_count": completed_orders,
        "active_order_count": active_orders,
        "avg_value": avg_value,
        "low_stock": [p.name for p in low_stock],
        "low_stock_tiers": low_stock_tiers,
    }


@router.get("/top-products")
def top_products(
    limit: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "ops_manager")),
):
    rows = db.query(
        Product.name,
        func.coalesce(func.sum(OrderItem.quantity), 0).label("count"),
        func.coalesce(
            func.sum(OrderItem.quantity * OrderItem.price_at_time), 0
        ).label("revenue"),
    ).join(
        OrderItem, OrderItem.product_id == Product.id
    ).join(
        Order, OrderItem.order_id == Order.id
    ).filter(
        Order.status.in_(FULFILLED)
    ).group_by(
        Product.id
    ).order_by(
        func.sum(OrderItem.quantity * OrderItem.price_at_time).desc(),
        func.sum(OrderItem.quantity).desc(),
        Product.name.asc(),
    ).limit(limit).all()

    return {
        "data": [
            {"name": r.name, "count": int(r.count), "revenue": float(r.revenue)}
            for r in rows
        ]
    }


@router.get("/least-selling")
def least_selling(
    limit: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "ops_manager")),
):
    fulfilled_qty = case(
        (Order.status.in_(FULFILLED), OrderItem.quantity), else_=0
    )
    fulfilled_revenue = case(
        (Order.status.in_(FULFILLED),
         OrderItem.quantity * OrderItem.price_at_time), else_=0
    )

    rows = db.query(
        Product.id,
        Product.name,
        func.coalesce(func.sum(fulfilled_qty), 0).label("count"),
        func.coalesce(func.sum(fulfilled_revenue), 0).label("revenue"),
    ).select_from(
        Product
    ).outerjoin(
        OrderItem, OrderItem.product_id == Product.id
    ).outerjoin(
        Order, OrderItem.order_id == Order.id
    ).filter(
        Product.is_archived.is_(False)
    ).group_by(
        Product.id
    ).order_by(
        func.sum(fulfilled_qty).asc(),
        func.sum(fulfilled_revenue).asc(),
        Product.name.asc(),
    ).limit(limit).all()

    return {
        "data": [
            {
                "product_id": r.id,
                "name": r.name,
                "count": int(r.count),
                "revenue": float(r.revenue),
            }
            for r in rows
        ]
    }


@router.get("/revenue-trend")
def revenue_trend(
    daily_points: int = Query(14, ge=1, le=90),
    weekly_points: int = Query(12, ge=1, le=52),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "ops_manager")),
):
    today = datetime.now().date()
    start_day = today - timedelta(days=daily_points - 1)

    # one row per day with sales; gaps get zero-filled below
    daily_rows = db.query(
        func.date(Order.created_at).label("period"),
        func.coalesce(func.sum(Order.total_price), 0).label("revenue"),
    ).filter(
        Order.status.in_(FULFILLED),
        func.date(Order.created_at) >= start_day,
    ).group_by(
        literal_column("1")   # GROUP BY ordinal — Postgres treats bound
    ).all()                 # params in func.* as different expressions

    revenue_by_day = {str(r.period): float(r.revenue) for r in daily_rows}
    daily = []
    for offset in range(daily_points):
        day = start_day + timedelta(days=offset)
        daily.append({
            "period": day.isoformat(),
            "revenue": revenue_by_day.get(day.isoformat(), 0.0),
        })

    week_start = today - timedelta(days=(weekly_points * 7) - 1)
    weekly_rows = db.query(
        func.to_char(Order.created_at, "IYYY-IW").label("period"),
        func.coalesce(func.sum(Order.total_price), 0).label("revenue"),
    ).filter(
        Order.status.in_(FULFILLED),
        func.date(Order.created_at) >= week_start,
    ).group_by(
        literal_column("1")
    ).order_by(
        literal_column("1").asc()
    ).all()

    weekly = [
        {"period": r.period, "revenue": float(r.revenue)}
        for r in weekly_rows
    ]

    return {"daily": daily, "weekly": weekly}


@router.get("/order-status-distribution")
def order_status_distribution(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "ops_manager")),
):
    rows = db.query(
        Order.status.label("status"),
        func.count(Order.id).label("count"),
    ).group_by(Order.status).order_by(
        func.count(Order.id).desc(), Order.status.asc()
    ).all()

    return {
        "data": [{"status": r.status, "count": int(r.count)} for r in rows]
    }


@router.get("/category-performance")
def category_performance(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "ops_manager")),
):
    fulfilled_qty = case(
        (Order.status.in_(FULFILLED), OrderItem.quantity), else_=0
    )
    fulfilled_revenue = case(
        (Order.status.in_(FULFILLED),
         OrderItem.quantity * OrderItem.price_at_time), else_=0
    )

    rows = db.query(
        func.coalesce(Category.name, "Uncategorized").label("category"),
        func.count(func.distinct(Product.id)).label("product_count"),
        func.coalesce(func.sum(fulfilled_qty), 0).label("quantity_sold"),
        func.coalesce(func.sum(fulfilled_revenue), 0).label("revenue"),
    ).select_from(
        Product
    ).outerjoin(
        OrderItem, OrderItem.product_id == Product.id
    ).outerjoin(
        Order, OrderItem.order_id == Order.id
    ).outerjoin(
        Category, Product.category_id == Category.id
    ).group_by(
        Category.id, Category.name   # explicit cols — products with no
    ).order_by(                      # category land in one NULL group
        func.sum(fulfilled_revenue).desc(),
        func.sum(fulfilled_qty).desc(),
    ).all()

    return {
        "data": [
            {
                "category": r.category,
                "product_count": int(r.product_count),
                "quantity_sold": int(r.quantity_sold),
                "revenue": float(r.revenue),
            }
            for r in rows
        ]
    }
