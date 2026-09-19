"""Official distribution source adapters."""

from .base import ProviderAdapter, SourceCandidate
from .defiance import DefianceAdapter
from .jpmorgan import JPMorganAdapter
from .neos import NeosAdapter
from .rex import RexAdapter
from .roundhill import RoundhillAdapter
from .schwab import SchwabAdapter
from .yieldmax import YieldMaxAdapter

PROVIDERS = {
    "yieldmax": YieldMaxAdapter,
    "roundhill": RoundhillAdapter,
    "rex": RexAdapter,
    "jpmorgan": JPMorganAdapter,
    "schwab": SchwabAdapter,
    "neos": NeosAdapter,
    "defiance": DefianceAdapter,
}

__all__ = [
    "ProviderAdapter",
    "SourceCandidate",
    "YieldMaxAdapter",
    "RoundhillAdapter",
    "RexAdapter",
    "JPMorganAdapter",
    "SchwabAdapter",
    "NeosAdapter",
    "DefianceAdapter",
    "PROVIDERS",
]
