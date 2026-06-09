import unittest

try:
    from fueling_core import (
        SessionPoint,
        UserStaticInputs,
        calculate_fueling_plan,
    )
except ModuleNotFoundError:
    from .fueling_core import (
        SessionPoint,
        UserStaticInputs,
        calculate_fueling_plan,
    )


class FuelingCoreTests(unittest.TestCase):
    def setUp(self):
        self.user = UserStaticInputs(
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

    def test_time_for_carbs_triggers_on_30g_crossing(self):
        result = calculate_fueling_plan(self.user, self._points(40))

        self.assertIn(16, result["time_for_carbs"])
        self.assertGreater(result["total_carbs_burned_g"], 30)

    def test_carb_reservoir_decreases_with_burn(self):
        result = calculate_fueling_plan(self.user, self._points(2))
        first, second = result["timeline"][:2]

        self.assertLess(first.carb_reservoir_g, result["derived"]["carb_storage_g"])
        self.assertLess(second.carb_reservoir_g, first.carb_reservoir_g)

    def test_carbs_eaten_increases_reservoir_with_eating(self):
        points = self._points(2)
        points[1] = SessionPoint(**{**points[1].__dict__, "carbs_eaten_g": 30})
        result = calculate_fueling_plan(self.user, points)
        second = result["timeline"][1]

        self.assertAlmostEqual(
            second.carb_reservoir_with_eating_g,
            second.carb_reservoir_g + 30,
            places=6,
        )

    def test_rer_never_drops_below_07(self):
        result = calculate_fueling_plan(self.user, self._points(300))

        self.assertTrue(all(point.rer >= 0.7 for point in result["timeline"]))

    def test_dominant_energy_is_max_keytel_minetti(self):
        result = calculate_fueling_plan(self.user, self._points(5))

        for point in result["timeline"]:
            self.assertEqual(
                point.dominant_energy_kj_min,
                max(point.keytel_corrected_kj_min, point.minetti_kj_min),
            )

    def _points(self, count):
        return [
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
            for minute in range(1, count + 1)
        ]


if __name__ == "__main__":
    unittest.main()
