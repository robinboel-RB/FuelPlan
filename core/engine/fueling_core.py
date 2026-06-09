"""Compatibility wrapper for the deployable FuelPlan Python core package."""

from __future__ import annotations

import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1] / "app"
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from fueling_core.engine import *  # noqa: F401,F403
