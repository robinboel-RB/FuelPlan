"""JSON payload adapter shared by the CLI and Vercel Python function."""

from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from .engine import SessionPoint, UserStaticInputs, calculate_fueling_plan


def calculate_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("payload must be a JSON object")

    user_payload = payload.get("user")
    session_payload = payload.get("session_points")

    if not isinstance(user_payload, dict):
        raise ValueError("user must be an object")
    if not isinstance(session_payload, list) or not session_payload:
        raise ValueError("session_points must be a non-empty list")

    user = UserStaticInputs(
        gender=to_int(user_payload.get("gender"), "user.gender"),
        age=to_int(user_payload.get("age"), "user.age"),
        weight_kg=to_float(user_payload.get("weight_kg"), "user.weight_kg"),
        height_m=to_float(user_payload.get("height_m"), "user.height_m"),
        resting_hr=to_float(user_payload.get("resting_hr"), "user.resting_hr"),
        max_hr=to_float(user_payload.get("max_hr"), "user.max_hr"),
        body_fat_pct=to_float(user_payload.get("body_fat_pct"), "user.body_fat_pct"),
        vo2max=to_float(user_payload.get("vo2max"), "user.vo2max"),
        running_level=to_int(user_payload.get("running_level"), "user.running_level"),
    )

    session_points = [
        SessionPoint(
            minute=to_int(point.get("minute"), f"session_points[{index}].minute"),
            temperature_c=to_float(
                point.get("temperature_c"),
                f"session_points[{index}].temperature_c",
            ),
            heart_rate=to_float(
                point.get("heart_rate"),
                f"session_points[{index}].heart_rate",
            ),
            pace_min_per_km=to_float(
                point.get("pace_min_per_km"),
                f"session_points[{index}].pace_min_per_km",
            ),
            slope=to_float(point.get("slope"), f"session_points[{index}].slope"),
            terrain_index=to_float(
                point.get("terrain_index"),
                f"session_points[{index}].terrain_index",
            ),
            cumulative_ascent_m=to_float(
                point.get("cumulative_ascent_m"),
                f"session_points[{index}].cumulative_ascent_m",
            ),
            cumulative_descent_m=to_float(
                point.get("cumulative_descent_m"),
                f"session_points[{index}].cumulative_descent_m",
            ),
            carbs_eaten_g=to_float(
                point.get("carbs_eaten_g", 0.0),
                f"session_points[{index}].carbs_eaten_g",
            ),
        )
        for index, point in enumerate(validate_session_points(session_payload))
    ]

    carb_trigger_size_g = to_float(
        payload.get("carb_trigger_size_g", 30.0),
        "carb_trigger_size_g",
    )

    return calculate_fueling_plan(user, session_points, carb_trigger_size_g)


def validate_session_points(points: list[Any]) -> list[dict[str, Any]]:
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            raise ValueError(f"session_points[{index}] must be an object")

    return points


def to_float(value: Any, field_name: str) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{field_name} must be a number")

    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be a number") from exc

    if number != number or number in (float("inf"), float("-inf")):
        raise ValueError(f"{field_name} must be finite")

    return number


def to_int(value: Any, field_name: str) -> int:
    return int(to_float(value, field_name))


def to_jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return asdict(value)

    if isinstance(value, list):
        return [to_jsonable(item) for item in value]

    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}

    return value
