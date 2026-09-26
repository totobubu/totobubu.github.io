from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Iterable

from ..models import DistributionEvent, SourceDocument


class NoDataError(ValueError):
    """The official source responded normally but had no matching announcement."""


class CollectionError(RuntimeError):
    """A classified source-collection failure suitable for operator reporting."""

    def __init__(self, message: str, *, code: str = "fetch_failed", retryable: bool = True):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


@dataclass(frozen=True)
class SourceCandidate:
    url: str
    source_type: str = "html"
    published_at: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FetchOutcome:
    candidate: SourceCandidate
    document: SourceDocument | None = None
    error: CollectionError | None = None


class ProviderAdapter(ABC):
    """Contract implemented by each official distribution source."""

    slug: str
    display_name: str
    official_homepage: str
    parser_version: str = "1"
    fetch_mode: str = "http"

    @abstractmethod
    def discover(self) -> Iterable[SourceCandidate]:
        """Return newly discoverable official source candidates."""

    @abstractmethod
    def fetch(self, candidate: SourceCandidate) -> SourceDocument:
        """Fetch and preserve an immutable representation of the official source."""

    def fetch_many(self, candidates: Iterable[SourceCandidate]) -> list[FetchOutcome]:
        """Fetch candidates while keeping individual failures isolated."""
        outcomes = []
        for candidate in candidates:
            try:
                outcomes.append(FetchOutcome(candidate, document=self.fetch(candidate)))
            except CollectionError as exc:
                outcomes.append(FetchOutcome(candidate, error=exc))
            except Exception as exc:
                outcomes.append(
                    FetchOutcome(candidate, error=CollectionError(str(exc)))
                )
        return outcomes

    @abstractmethod
    def parse(self, document: SourceDocument) -> list[DistributionEvent]:
        """Parse one source document into provider-neutral distribution events."""
