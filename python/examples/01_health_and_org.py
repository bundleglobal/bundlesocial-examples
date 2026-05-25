"""Print API health and the current organization.

Usage:
    export BUNDLESOCIAL_API_KEY=...
    python examples/01_health_and_org.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Make the sibling `bundlesocial/` package importable when running the
# example directly from the repo (no install required).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bundlesocial import BundleSocialClient  # noqa: E402


def main() -> None:
    with BundleSocialClient() as client:
        health = client.health()
        print("=== health ===")
        print(json.dumps(health, indent=2, default=str))

        org = client.get_organization()
        print("\n=== organization ===")
        # Trim the giant org object down to the interesting bits.
        summary = {
            "id": org.get("id"),
            "name": org.get("name"),
            "apiAccess": org.get("apiAccess"),
            "teams": [
                {"id": t.get("id"), "name": t.get("name")}
                for t in (org.get("teams") or [])
            ],
        }
        print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
