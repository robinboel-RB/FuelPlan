"""JSON stdin/stdout adapter for the local FuelPlan Python core."""

from __future__ import annotations

import json
import sys

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
