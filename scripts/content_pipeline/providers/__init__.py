"""Official distribution source adapters."""

from .base import CollectionError, FetchOutcome, NoDataError, ProviderAdapter, SourceCandidate
from .amplify import AmplifyAdapter
from .defiance import DefianceAdapter
from .globalx import GlobalXAdapter
from .jpmorgan import JPMorganAdapter
from .neos import NeosAdapter
from .rex import RexAdapter
from .roundhill import RoundhillAdapter
from .schwab import SchwabAdapter
from .yieldmax import YieldMaxAdapter

PROVIDERS = {
    "amplify": AmplifyAdapter,
    "yieldmax": YieldMaxAdapter,
    "roundhill": RoundhillAdapter,
    "rex": RexAdapter,
    "jpmorgan": JPMorganAdapter,
    "schwab": SchwabAdapter,
    "neos": NeosAdapter,
    "defiance": DefianceAdapter,
    "globalx": GlobalXAdapter,
}

__all__ = [
    "ProviderAdapter",
    "CollectionError",
    "FetchOutcome",
    "NoDataError",
    "SourceCandidate",
    "AmplifyAdapter",
    "YieldMaxAdapter",
    "RoundhillAdapter",
    "RexAdapter",
    "JPMorganAdapter",
    "SchwabAdapter",
    "NeosAdapter",
    "DefianceAdapter",
    "GlobalXAdapter",
    "PROVIDERS",
]
