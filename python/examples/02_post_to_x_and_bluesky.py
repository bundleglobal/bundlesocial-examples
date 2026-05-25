"""Upload an image from a URL and schedule a post on X + Bluesky.

Usage:
    export BUNDLESOCIAL_API_KEY=...
    # Optional: pin a specific team
    export BUNDLESOCIAL_TEAM_ID=...
    python examples/02_post_to_x_and_bluesky.py

The team must already have TWITTER and BLUESKY social accounts connected.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bundlesocial import BundleSocialClient  # noqa: E402


IMAGE_URL = "https://picsum.photos/1200/630"
CAPTION = "Hello from the bundle.social Python example."


def main() -> None:
    team_id = os.environ.get("BUNDLESOCIAL_TEAM_ID")

    with BundleSocialClient() as client:
        print(f"Uploading image: {IMAGE_URL}")
        upload = client.upload_from_url(team_id=team_id, url=IMAGE_URL)
        upload_id = upload["id"]
        print(f"  upload id: {upload_id} ({upload.get('type')})")

        # Schedule ~5 minutes out so the API has time to process the media.
        post_date = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()

        # `data` is keyed by platform enum.
        # https://docs.bundle.social/api-reference/platform-parameters
        data: dict[str, dict[str, object]] = {
            "TWITTER": {"text": CAPTION, "uploadIds": [upload_id]},
            "BLUESKY": {"text": CAPTION, "uploadIds": [upload_id]},
        }

        print(f"Scheduling post for {post_date}")
        post = client.create_post(
            team_id=team_id,
            title="Python example: X + Bluesky",
            post_date=post_date,
            status="SCHEDULED",
            social_account_types=["TWITTER", "BLUESKY"],
            data=data,
        )

        print("\n=== created post ===")
        print(
            json.dumps(
                {
                    "id": post.get("id"),
                    "status": post.get("status"),
                    "postDate": post.get("postDate"),
                    "socialAccountTypes": post.get("socialAccountTypes"),
                },
                indent=2,
                default=str,
            )
        )


if __name__ == "__main__":
    main()
