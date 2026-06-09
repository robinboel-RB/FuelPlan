"""Pure Python fueling engine translated from Energy_calculator.xlsx.

The formulas come from the "Uurlijkse calc" worksheet. The module has no Excel
runtime dependency and keeps each spreadsheet formula as a named function so the
sport-science assumptions are visible and testable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


MINUTES_PER_DAY = 1440.0
CM_PER_M = 100.0
KJ_PER_KCAL = 4.184
RESTING_RER_KCAL_PER_LITER_O2 = 4.82

MALE = 1
FEMALE = 0

MIN_BODY_FAT_FRACTION = 0.0
MAX_BODY_FAT_FRACTION = 0.6

MIN_RER = 0.7
RER_SPAN = 0.3
CARB_ENERGY_KJ_PER_G = 17.6
DEFAULT_CARB_TRIGGER_SIZE_G = 30.0

BMR_KATCH_BASE_KCAL_DAY = 370.0
BMR_KATCH_LBM_FACTOR = 21.6
BMR_MIFFLIN_WEIGHT_FACTOR = 10.0
BMR_MIFFLIN_HEIGHT_FACTOR = 6.25
BMR_MIFFLIN_AGE_FACTOR = 5.0
BMR_MIFFLIN_MALE_OFFSET = 5.0
BMR_MIFFLIN_FEMALE_OFFSET = -161.0

KEYTEL_MALE_BASE = -95.7735
KEYTEL_MALE_HR = 0.634
KEYTEL_MALE_VO2 = 0.404
KEYTEL_MALE_WEIGHT = 0.394
KEYTEL_MALE_AGE = 0.271

KEYTEL_FEMALE_BASE = -59.3954
KEYTEL_FEMALE_HR = 0.45
KEYTEL_FEMALE_VO2 = 0.38
KEYTEL_FEMALE_WEIGHT = 0.103
KEYTEL_FEMALE_AGE = 0.274

HR_TEMP_THRESHOLD_C = 24.0
HR_TEMP_CORRECTION_PER_C = 0.0015

ECONOMY_TIME_TAX_FIRST_12H = 0.005
ECONOMY_TIME_TAX_AFTER_12H = 0.0025
ECONOMY_TIME_TAX_CAP = 0.1
ECONOMY_TOTAL_TAX_CAP = 0.25
ECONOMY_ASCENT_TAX_PER_300M = 0.01
ECONOMY_DESCENT_TAX_PER_300M = 0.02
ECONOMY_VERTICAL_REFERENCE_M = 300.0

MINETTI_P5 = 155.4
MINETTI_P4 = -30.4
MINETTI_P3 = -43.3
MINETTI_P2 = 46.3
MINETTI_P1 = 19.5

WEIR_RER_FACTOR = 1.106
WEIR_BASE = 3.941

LEVEL_CARB_STORAGE_FACTORS = {
    1: 12.0,
    2: 15.0,
    3: 18.0,
    4: 23.0,
}
DEFAULT_RUNNING_LEVEL = 1


@dataclass(frozen=True)
class UserStaticInputs:
    gender: int  # 1 = male, 0 = female
    age: int
    weight_kg: float
    height_m: float
    resting_hr: float
    max_hr: float
    body_fat_pct: float  # fraction, e.g. 0.12
    vo2max: float
    running_level: int  # 1, 2, 3, 4


@dataclass(frozen=True)
class SessionPoint:
    minute: int
    temperature_c: float
    heart_rate: float
    pace_min_per_km: float
    slope: float
    terrain_index: float
    cumulative_ascent_m: float
    cumulative_descent_m: float
    carbs_eaten_g: float = 0.0


@dataclass(frozen=True)
class FuelingResultPoint:
    minute: int
    hr_adjusted: float
    speed_m_per_min: float
    economy_decay: float
    minetti_base: float
    fuel_factor: float
    keytel_kj_min: float
    minetti_kj_min: float
    keytel_corrected_kj_min: float
    dominant_energy_kj_min: float
    rer: float
    carbs_g_per_min: float
    cumulative_carbs_g: float
    carb_reservoir_g: float
    carb_reservoir_with_eating_g: float
    cumulative_kcal: float


def calculate_lean_body_mass(inputs: UserStaticInputs) -> float:
    """Excel C25: fat-free mass available for metabolism; output unit: kg."""
    return inputs.weight_kg * (1.0 - inputs.body_fat_pct)


def calculate_bmr_active_katch(inputs: UserStaticInputs) -> float:
    """Excel C27: Katch-McArdle BMR anchored on lean mass; output unit: kcal/day."""
    lean_body_mass_kg = calculate_lean_body_mass(inputs)
    return BMR_KATCH_BASE_KCAL_DAY + BMR_KATCH_LBM_FACTOR * lean_body_mass_kg


def calculate_bmr_base_mifflin(inputs: UserStaticInputs) -> float:
    """Excel C28: Mifflin-St Jeor resting baseline; output unit: kcal/day."""
    gender_offset = (
        BMR_MIFFLIN_MALE_OFFSET
        if inputs.gender == MALE
        else BMR_MIFFLIN_FEMALE_OFFSET
    )
    height_cm = inputs.height_m * CM_PER_M
    return (
        BMR_MIFFLIN_WEIGHT_FACTOR * inputs.weight_kg
        + BMR_MIFFLIN_HEIGHT_FACTOR * height_cm
        - BMR_MIFFLIN_AGE_FACTOR * inputs.age
        + gender_offset
    )


def calculate_carb_storage(inputs: UserStaticInputs) -> float:
    """Excel C29: estimated glycogen/carbohydrate storage; output unit: g."""
    lean_body_mass_kg = calculate_lean_body_mass(inputs)
    level_factor = LEVEL_CARB_STORAGE_FACTORS.get(
        inputs.running_level,
        LEVEL_CARB_STORAGE_FACTORS[DEFAULT_RUNNING_LEVEL],
    )
    return lean_body_mass_kg * 0.55 * level_factor


def calculate_composition_gap(inputs: UserStaticInputs) -> float:
    """Excel C30: aligns Keytel rest energy to personal BMR; output unit: kJ/min."""
    bmr_active_kcal_day = calculate_bmr_active_katch(inputs)
    personal_resting_kj_min = bmr_active_kcal_day / MINUTES_PER_DAY * KJ_PER_KCAL
    return personal_resting_kj_min - calculate_keytel_at_rest(inputs)


def calculate_personal_1_met(inputs: UserStaticInputs) -> float:
    """Excel C31: athlete-specific 1 MET oxygen cost; output unit: ml/kg/min."""
    bmr_active_kcal_day = calculate_bmr_active_katch(inputs)
    return (
        bmr_active_kcal_day
        / MINUTES_PER_DAY
        / RESTING_RER_KCAL_PER_LITER_O2
        * 1000.0
        / inputs.weight_kg
    )


def calculate_hr_adjusted(point: SessionPoint) -> float:
    """Excel N: removes heat-driven HR inflation above 24 C; output unit: bpm."""
    heat_delta_c = max(0.0, point.temperature_c - HR_TEMP_THRESHOLD_C)
    return point.heart_rate * (1.0 - HR_TEMP_CORRECTION_PER_C * heat_delta_c)


def calculate_speed_m_per_min(point: SessionPoint) -> float:
    """Excel O: converts pace to running speed; output unit: m/min."""
    return 1000.0 / point.pace_min_per_km


def calculate_economy_decay(point: SessionPoint) -> float:
    """Excel P: fatigue and vertical-load cost multiplier; output unit: factor."""
    hour = point.minute / 60.0

    if hour < 12.0:
        time_tax = ECONOMY_TIME_TAX_FIRST_12H * hour
    elif hour < 24.0:
        time_tax = min(
            ECONOMY_TIME_TAX_CAP,
            ECONOMY_TIME_TAX_FIRST_12H * hour
            + ECONOMY_TIME_TAX_AFTER_12H * hour,
        )
    else:
        time_tax = ECONOMY_TIME_TAX_CAP

    ascent_tax = (
        point.cumulative_ascent_m
        / ECONOMY_VERTICAL_REFERENCE_M
        * ECONOMY_ASCENT_TAX_PER_300M
    )
    descent_tax = (
        point.cumulative_descent_m
        / ECONOMY_VERTICAL_REFERENCE_M
        * ECONOMY_DESCENT_TAX_PER_300M
    )

    return 1.0 + min(ECONOMY_TOTAL_TAX_CAP, time_tax + ascent_tax + descent_tax)


def calculate_minetti_base(
    point: SessionPoint,
    personal_1_met: float,
    economy_decay: float,
) -> float:
    """Excel R: slope/terrain transport cost before speed scaling; output unit: J/kg/m."""
    slope = point.slope
    return (
        MINETTI_P5 * slope**5
        + MINETTI_P4 * slope**4
        + MINETTI_P3 * slope**3
        + MINETTI_P2 * slope**2
        + MINETTI_P1 * slope
        + personal_1_met
    ) * point.terrain_index * economy_decay


def calculate_rer_base(inputs: UserStaticInputs, heart_rate: float) -> float:
    """Excel X base term: HR reserve maps intensity to RER; output unit: ratio."""
    return max(
        MIN_RER,
        MIN_RER
        + RER_SPAN
        * (heart_rate - inputs.resting_hr)
        / (inputs.max_hr - inputs.resting_hr),
    )


def calculate_rer_dynamic(
    inputs: UserStaticInputs,
    point: SessionPoint,
    previous_carb_reservoir_with_eating: float | None,
) -> float:
    """Excel X: glycogen pressure lowers carbohydrate share; output unit: ratio."""
    rer_base = calculate_rer_base(inputs, point.heart_rate)

    if previous_carb_reservoir_with_eating is None:
        return rer_base

    carb_storage_g = calculate_carb_storage(inputs)
    glycogen_used_g = carb_storage_g - previous_carb_reservoir_with_eating
    return max(
        MIN_RER,
        rer_base - RER_SPAN * glycogen_used_g / carb_storage_g,
    )


def calculate_fuel_factor(rer_dynamic: float, rer_base: float) -> float:
    """Excel S: adjusts Keytel for current substrate mix; output unit: factor."""
    return (WEIR_RER_FACTOR * rer_dynamic + WEIR_BASE) / (
        WEIR_RER_FACTOR * rer_base + WEIR_BASE
    )


def calculate_keytel(
    inputs: UserStaticInputs,
    hr_adjusted: float,
    composition_gap: float,
) -> float:
    """Excel T: HR/VO2 biometric energy estimate; output unit: kJ/min."""
    if inputs.gender == MALE:
        keytel = (
            KEYTEL_MALE_BASE
            + KEYTEL_MALE_HR * hr_adjusted
            + KEYTEL_MALE_VO2 * inputs.vo2max
            + KEYTEL_MALE_WEIGHT * inputs.weight_kg
            + KEYTEL_MALE_AGE * inputs.age
        )
    else:
        keytel = (
            KEYTEL_FEMALE_BASE
            + KEYTEL_FEMALE_HR * hr_adjusted
            + KEYTEL_FEMALE_VO2 * inputs.vo2max
            + KEYTEL_FEMALE_WEIGHT * inputs.weight_kg
            + KEYTEL_FEMALE_AGE * inputs.age
        )

    return keytel + composition_gap


def calculate_minetti_corrected(
    point: SessionPoint,
    speed_m_per_min: float,
    minetti_base: float,
    weight_kg: float,
) -> float:
    """Excel V: external running cost scaled by speed/body mass; output unit: kJ/min."""
    _ = point
    return speed_m_per_min * minetti_base * weight_kg / 1000.0


def calculate_keytel_corrected(fuel_factor: float, keytel: float) -> float:
    """Excel W: Keytel after RER fuel-factor correction; output unit: kJ/min."""
    return fuel_factor * keytel


def calculate_carbs_per_min(dominant_energy_kj_min: float, rer: float) -> float:
    """Excel Y: carbohydrate burn from dominant engine and RER; output unit: g/min."""
    carb_share = (rer - MIN_RER) / RER_SPAN
    return dominant_energy_kj_min * carb_share / CARB_ENERGY_KJ_PER_G


def calculate_kcal_per_min(dominant_energy_kj_min: float) -> float:
    """Excel AC increment: converts dominant kJ to kcal; output unit: kcal/min."""
    return dominant_energy_kj_min / KJ_PER_KCAL


def calculate_fueling_plan(
    user_inputs: UserStaticInputs,
    session_points: list[SessionPoint],
    carb_trigger_size_g: float = DEFAULT_CARB_TRIGGER_SIZE_G,
) -> dict[str, Any]:
    """Excel rows 3+: runs the minute chain and AF carb triggers; output unit: dict."""
    inputs = validate_user_inputs(user_inputs)

    if carb_trigger_size_g <= 0:
        raise ValueError("carb_trigger_size_g must be > 0")

    derived = {
        "lean_body_mass_kg": calculate_lean_body_mass(inputs),
        "bmr_active": calculate_bmr_active_katch(inputs),
        "bmr_base": calculate_bmr_base_mifflin(inputs),
        "carb_storage_g": calculate_carb_storage(inputs),
        "composition_gap": calculate_composition_gap(inputs),
        "personal_1_met": calculate_personal_1_met(inputs),
    }

    timeline: list[FuelingResultPoint] = []
    time_for_carbs: list[int] = []

    previous_cumulative_carbs_g = 0.0
    previous_carb_reservoir_g = derived["carb_storage_g"]
    previous_carb_reservoir_with_eating_g = derived["carb_storage_g"]
    cumulative_kcal = 0.0

    for index, point in enumerate(session_points):
        validate_session_point(point)

        hr_adjusted = calculate_hr_adjusted(point)
        speed_m_per_min = calculate_speed_m_per_min(point)
        economy_decay = calculate_economy_decay(point)
        minetti_base = calculate_minetti_base(
            point,
            derived["personal_1_met"],
            economy_decay,
        )
        rer_base = calculate_rer_base(inputs, point.heart_rate)
        rer = calculate_rer_dynamic(
            inputs,
            point,
            None if index == 0 else previous_carb_reservoir_with_eating_g,
        )
        fuel_factor = calculate_fuel_factor(rer, rer_base)
        keytel_kj_min = calculate_keytel(inputs, hr_adjusted, derived["composition_gap"])
        minetti_kj_min = calculate_minetti_corrected(
            point,
            speed_m_per_min,
            minetti_base,
            inputs.weight_kg,
        )
        keytel_corrected_kj_min = calculate_keytel_corrected(
            fuel_factor,
            keytel_kj_min,
        )
        dominant_energy_kj_min = max(minetti_kj_min, keytel_corrected_kj_min)
        carbs_g_per_min = calculate_carbs_per_min(dominant_energy_kj_min, rer)
        current_cumulative_carbs_g = previous_cumulative_carbs_g + carbs_g_per_min

        # Excel AE/AF: compare MOD(previous cumulative, 30) to MOD(current, 30).
        previous_modulo = previous_cumulative_carbs_g % carb_trigger_size_g
        current_modulo = current_cumulative_carbs_g % carb_trigger_size_g
        if previous_modulo > current_modulo:
            time_for_carbs.append(point.minute)

        if index == 0:
            carb_reservoir_g = derived["carb_storage_g"] - carbs_g_per_min
            carb_reservoir_with_eating_g = (
                derived["carb_storage_g"] - carbs_g_per_min + point.carbs_eaten_g
            )
        else:
            carb_reservoir_g = previous_carb_reservoir_g - carbs_g_per_min
            carb_reservoir_with_eating_g = (
                previous_carb_reservoir_with_eating_g
                - carbs_g_per_min
                + point.carbs_eaten_g
            )

        cumulative_kcal += calculate_kcal_per_min(dominant_energy_kj_min)

        timeline.append(
            FuelingResultPoint(
                minute=point.minute,
                hr_adjusted=hr_adjusted,
                speed_m_per_min=speed_m_per_min,
                economy_decay=economy_decay,
                minetti_base=minetti_base,
                fuel_factor=fuel_factor,
                keytel_kj_min=keytel_kj_min,
                minetti_kj_min=minetti_kj_min,
                keytel_corrected_kj_min=keytel_corrected_kj_min,
                dominant_energy_kj_min=dominant_energy_kj_min,
                rer=rer,
                carbs_g_per_min=carbs_g_per_min,
                cumulative_carbs_g=current_cumulative_carbs_g,
                carb_reservoir_g=carb_reservoir_g,
                carb_reservoir_with_eating_g=carb_reservoir_with_eating_g,
                cumulative_kcal=cumulative_kcal,
            )
        )

        previous_cumulative_carbs_g = current_cumulative_carbs_g
        previous_carb_reservoir_g = carb_reservoir_g
        previous_carb_reservoir_with_eating_g = carb_reservoir_with_eating_g

    return {
        "derived": derived,
        "timeline": timeline,
        "time_for_carbs": time_for_carbs,
        "total_carbs_burned_g": previous_cumulative_carbs_g,
        "total_kcal": cumulative_kcal,
    }


def calculate_keytel_at_rest(inputs: UserStaticInputs) -> float:
    """Excel C30 rest term: Keytel at resting HR; output unit: kJ/min."""
    if inputs.gender == MALE:
        return (
            KEYTEL_MALE_BASE
            + KEYTEL_MALE_HR * inputs.resting_hr
            + KEYTEL_MALE_VO2 * inputs.vo2max
            + KEYTEL_MALE_WEIGHT * inputs.weight_kg
            + KEYTEL_MALE_AGE * inputs.age
        )

    return (
        KEYTEL_FEMALE_BASE
        + KEYTEL_FEMALE_HR * inputs.resting_hr
        + KEYTEL_FEMALE_VO2 * inputs.vo2max
        + KEYTEL_FEMALE_WEIGHT * inputs.weight_kg
        + KEYTEL_FEMALE_AGE * inputs.age
    )


def validate_user_inputs(inputs: UserStaticInputs) -> UserStaticInputs:
    """Excel Section 1: validates static athlete inputs; output unit: UserStaticInputs."""
    if inputs.weight_kg <= 0:
        raise ValueError("weight_kg must be > 0")
    if inputs.height_m <= 0:
        raise ValueError("height_m must be > 0")
    if inputs.max_hr <= inputs.resting_hr:
        raise ValueError("max_hr must be greater than resting_hr")
    if not MIN_BODY_FAT_FRACTION <= inputs.body_fat_pct <= MAX_BODY_FAT_FRACTION:
        raise ValueError("body_fat_pct must be between 0 and 0.6")
    if inputs.gender not in (FEMALE, MALE):
        raise ValueError("gender must be 1 for male or 0 for female")

    running_level = (
        inputs.running_level
        if inputs.running_level in LEVEL_CARB_STORAGE_FACTORS
        else DEFAULT_RUNNING_LEVEL
    )

    if running_level == inputs.running_level:
        return inputs

    return UserStaticInputs(
        gender=inputs.gender,
        age=inputs.age,
        weight_kg=inputs.weight_kg,
        height_m=inputs.height_m,
        resting_hr=inputs.resting_hr,
        max_hr=inputs.max_hr,
        body_fat_pct=inputs.body_fat_pct,
        vo2max=inputs.vo2max,
        running_level=running_level,
    )


def validate_session_point(point: SessionPoint) -> None:
    """Excel dynamic rows: validates watch/session inputs; output unit: None."""
    if point.pace_min_per_km <= 0:
        raise ValueError(f"pace_min_per_km must be > 0 at minute {point.minute}")


if __name__ == "__main__":
    user = UserStaticInputs(
        gender=1,
        age=26,
        weight_kg=70,
        height_m=1.8,
        resting_hr=53,
        max_hr=193,
        body_fat_pct=0.12,
        vo2max=60,
        running_level=1,
    )

    session = [
        SessionPoint(
            minute=minute,
            temperature_c=20,
            heart_rate=140,
            pace_min_per_km=5.5,
            slope=(140 + 143) / 16000,
            terrain_index=1.05,
            cumulative_ascent_m=0,
            cumulative_descent_m=0,
        )
        for minute in range(1, 121)
    ]

    result = calculate_fueling_plan(user, session)

    print("derived values")
    for key, value in result["derived"].items():
        print(f"{key}: {value:.4f}")

    print(f"time_for_carbs: {result['time_for_carbs']}")
    print(f"total_carbs_burned_g: {result['total_carbs_burned_g']:.4f}")
    print(f"total_kcal: {result['total_kcal']:.4f}")
