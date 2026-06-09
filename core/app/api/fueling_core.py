"""Vercel Python Function for the FuelPlan core engine."""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

APP_ROOT = Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from fueling_core.adapter import calculate_from_payload, to_jsonable


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        self._send_json(200, {"ok": True, "service": "fueling-core"})

    def do_POST(self) -> None:
        try:
            payload = self._read_json_body()
            result = calculate_from_payload(payload)
            self._send_json(200, {"ok": True, "result": to_jsonable(result)})
        except ValueError as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self.log_error("fueling-core failed: %s", exc)
            self._send_json(500, {"ok": False, "error": "Fueling calculation failed"})

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("content-length") or "0")
        raw_body = self.rfile.read(content_length).decode("utf-8")
        payload = json.loads(raw_body.lstrip("\ufeff"))

        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object")

        return payload

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
