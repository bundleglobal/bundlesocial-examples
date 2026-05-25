"""A tiny synchronous bundle.social client built on httpx.

This is a community-style raw-HTTP wrapper, not an official SDK. For
production Node.js use, prefer the official ``bundlesocial`` npm package.
"""

from __future__ import annotations

import os
from typing import Any, Iterable

import httpx


DEFAULT_BASE_URL = "https://api.bundle.social"
DEFAULT_TIMEOUT = 30.0


class BundleSocialError(Exception):
    """Base error type for the client (configuration, usage, etc.)."""


class BundleSocialApiError(BundleSocialError):
    """Raised when the API returns a non-2xx response.

    Attributes match the bundle.social JSON error envelope:
        { "statusCode": <int>, "message": <str>, "issues": [...] }
    """

    def __init__(
        self,
        status: int,
        code: str | None,
        message: str,
        body: Any = None,
    ) -> None:
        super().__init__(f"[{status}] {message}")
        self.status = status
        self.code = code
        self.message = message
        self.body = body


class BundleSocialClient:
    """Synchronous bundle.social API client.

    Pass ``api_key`` explicitly, or set ``BUNDLESOCIAL_API_KEY`` in the
    environment. The client sends ``x-api-key: <key>`` on every request (the
    auth scheme bundle.social's OpenAPI spec declares) and targets
    ``https://api.bundle.social`` by default.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        key = api_key or os.environ.get("BUNDLESOCIAL_API_KEY")
        if not key:
            raise BundleSocialError(
                "missing api key: pass api_key=... or set BUNDLESOCIAL_API_KEY"
            )

        self._http = httpx.Client(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers={
                "x-api-key": key,
                "Accept": "application/json",
                "User-Agent": "bundlesocial-python-example/0.1",
            },
        )

    # ---- lifecycle -------------------------------------------------------
    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "BundleSocialClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ---- internals -------------------------------------------------------
    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        # Drop None values from params so we don't send `?foo=None`.
        clean_params: dict[str, Any] | None = None
        if params:
            clean_params = {k: v for k, v in params.items() if v is not None}

        resp = self._http.request(method, path, params=clean_params, json=json)
        if resp.status_code >= 400:
            body: Any
            try:
                body = resp.json()
            except ValueError:
                body = resp.text
            message = "request failed"
            code: str | None = None
            if isinstance(body, dict):
                message = str(body.get("message") or message)
                code = body.get("code") or body.get("name")
            raise BundleSocialApiError(resp.status_code, code, message, body)

        if resp.status_code == 204 or not resp.content:
            return {}
        parsed: dict[str, Any] = resp.json()
        return parsed

    def _resolve_team_id(self, team_id: str | None) -> str:
        """Return ``team_id`` if given, else look it up from the organization.

        If the organization has exactly one team, return its id. Otherwise
        raise ``BundleSocialError`` and ask the caller to be explicit.
        """
        if team_id:
            return team_id
        org = self.get_organization()
        teams: list[dict[str, Any]] = org.get("teams") or []
        if len(teams) == 1:
            return str(teams[0]["id"])
        if not teams:
            raise BundleSocialError("organization has no teams")
        raise BundleSocialError("multiple teams; pass team_id explicitly")

    # ---- endpoints -------------------------------------------------------
    def health(self) -> dict[str, Any]:
        """GET /api/v1/ — service + per-platform status."""
        return self._request("GET", "/api/v1/")

    def get_organization(self) -> dict[str, Any]:
        """GET /api/v1/organization/ — current org (resolved from api key)."""
        return self._request("GET", "/api/v1/organization/")

    def get_team(self, team_id: str) -> dict[str, Any]:
        """GET /api/v1/team/{id} — team with social accounts and bots."""
        return self._request("GET", f"/api/v1/team/{team_id}")

    def list_teams(
        self,
        *,
        offset: int | None = None,
        limit: int | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        """GET /api/v1/team/ — paginated team list."""
        return self._request(
            "GET",
            "/api/v1/team/",
            params={"offset": offset, "limit": limit, "search": search},
        )

    def list_posts(
        self,
        team_id: str | None = None,
        **filters: Any,
    ) -> dict[str, Any]:
        """GET /api/v1/post/ — list posts for a team.

        Common filter kwargs: ``status``, ``orderBy``, ``order``, ``q``,
        ``platforms``, ``postDateFrom``, ``postDateTo``, ``offset``, ``limit``.
        """
        params: dict[str, Any] = {"teamId": self._resolve_team_id(team_id)}
        params.update(filters)
        return self._request("GET", "/api/v1/post/", params=params)

    def get_post(self, post_id: str) -> dict[str, Any]:
        """GET /api/v1/post/{id} — single post with platform results."""
        return self._request("GET", f"/api/v1/post/{post_id}")

    def upload_from_url(
        self,
        team_id: str | None = None,
        *,
        url: str,
    ) -> dict[str, Any]:
        """POST /api/v1/upload/from-url — download a remote file into the org.

        Returns the upload object, whose ``id`` you pass into
        ``data[<platform>].uploadIds`` when creating a post.
        """
        body = {"teamId": self._resolve_team_id(team_id), "url": url}
        return self._request("POST", "/api/v1/upload/from-url", json=body)

    def create_post(
        self,
        *,
        title: str,
        post_date: str,
        social_account_types: Iterable[str],
        data: dict[str, Any],
        status: str = "SCHEDULED",
        team_id: str | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/post/ — schedule or draft a post.

        ``data`` is keyed by platform enum (``TWITTER``, ``BLUESKY``, ...).
        See https://docs.bundle.social/api-reference/platform-parameters.
        """
        body: dict[str, Any] = {
            "teamId": self._resolve_team_id(team_id),
            "title": title,
            "postDate": post_date,
            "status": status,
            "socialAccountTypes": list(social_account_types),
            "data": data,
        }
        return self._request("POST", "/api/v1/post/", json=body)

    def list_integrations(self, team_id: str | None = None) -> list[dict[str, Any]]:
        """Connected social accounts for a team.

        The bundle.social API exposes social accounts as part of the team
        payload, so this wraps :meth:`get_team` and returns
        ``team["socialAccounts"]``.
        """
        team = self.get_team(self._resolve_team_id(team_id))
        accounts = team.get("socialAccounts") or []
        return list(accounts)
