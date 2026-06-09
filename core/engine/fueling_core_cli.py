"""JSON stdin/stdout adapter for the FuelPlan Python core engine."""

from __future__ import annotations

import json
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1] / "app"
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from fueling_core.adapter import calculate_from_payload, to_jsonable


def main() -> int:
    try:
        raw_payload = sys.stdin.read().lstrip("\ufeff")
        payload = json.loads(raw_payload)
        result = calculate_from_payload(payload)
        print(json.dumps(to_jsonable(result), separators=(",", ":")))
        return 0
    except Exception as exc:
        print(f"fueling_core_cli error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
