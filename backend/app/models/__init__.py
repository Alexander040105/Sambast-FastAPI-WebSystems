"""
Package-level imports — so `from app.models import Base` works, and Alembic
picks up every model via a single `import app.models`.
"""

from app.db.session import Base  # noqa: F401 — re-export for Alembic

# Import every model here so Alembic's `target_metadata = Base.metadata`
# sees all tables.
from app.models.user import User  # noqa: F401
from app.models.customer import Customer  # noqa: F401
from app.models.driver import Driver  # noqa: F401
from app.models.vehicle import Vehicle  # noqa: F401
from app.models.driver_shift import DriverShift  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.products import Product  # noqa: F401
from app.models.location import Location  # noqa: F401
from app.models.customer_address import CustomerAddress  # noqa: F401
from app.models.order import Order  # noqa: F401
from app.models.order_item import OrderItem  # noqa: F401
from app.models.payment import Payment  # noqa: F401
from app.models.route import Route  # noqa: F401
from app.models.delivery import Delivery  # noqa: F401
from app.models.delivery_stop import DeliveryStop  # noqa: F401
from app.models.delivery_status import DeliveryStatus  # noqa: F401
from app.models.proof_of_delivery import ProofOfDelivery  # noqa: F401
from app.models.notification import Notification  # noqa: F401
