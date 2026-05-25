"""List the 10 most recent posts as a small table.

Usage:
    export BUNDLESOCIAL_API_KEY=...
    # Optional: pin a specific team
    export BUNDLESOCIAL_TEAM_ID=...
    python examples/03_list_recent_posts.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bundlesocial import BundleSocialClient  # noqa: E402


def _print_plain(rows: list[dict[str, object]]) -> None:
    """Plain stdout fallback when `rich` isn't installed."""
    cols = [("id", 36), ("status", 12), ("postDate", 25), ("title", 0)]
    header = "  ".join(name.ljust(width) if width else name for name, width in cols)
    print(header)
    print("-" * max(len(header), 60))
    for r in rows:
        line_parts: list[str] = []
        for name, width in cols:
            value = str(r.get(name, "") or "")
            line_parts.append(value.ljust(width) if width else value)
        print("  ".join(line_parts))


def _print_rich(rows: list[dict[str, object]]) -> None:
    from rich.console import Console
    from rich.table import Table

    table = Table(title="Recent posts")
    table.add_column("id", style="cyan", no_wrap=True)
    table.add_column("status", style="magenta")
    table.add_column("postDate", style="green")
    table.add_column("title")
    for r in rows:
        table.add_row(
            str(r.get("id", "")),
            str(r.get("status", "")),
            str(r.get("postDate", "") or ""),
            str(r.get("title", "") or ""),
        )
    Console().print(table)


def main() -> None:
    team_id = os.environ.get("BUNDLESOCIAL_TEAM_ID")

    with BundleSocialClient() as client:
        result = client.list_posts(
            team_id=team_id,
            limit=10,
            orderBy="createdAt",
            order="DESC",
        )

    items = result.get("items") or []
    if not items:
        print("No posts found.")
        return

    try:
        _print_rich(items)
    except ImportError:
        _print_plain(items)


if __name__ == "__main__":
    main()
