"""Tiny community-style Python wrapper around the bundle.social REST API.

bundle.social only ships an official Node SDK; this module wraps the raw
HTTP endpoints with `httpx` for Python users. See ``client.py`` for the
``BundleSocialClient`` class and the error types.
"""

from .client import (
    BundleSocialClient,
    BundleSocialError,
    BundleSocialApiError,
)

__all__ = [
    "BundleSocialClient",
    "BundleSocialError",
    "BundleSocialApiError",
]
