import { expect, test } from "@playwright/test";

test("watch integration providers and simulation states", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Demo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Samsung" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Garmin" })).toBeVisible();
  await expect(page.getByRole("button", { name: "COROS" })).toBeVisible();
  await expect(page.getByText("Demo view").first()).toBeVisible();
  await expect(page.getByText("Connection path")).toBeVisible();

  await page.getByRole("button", { name: "Demo" }).click();
  await expect(page.getByText("Demo connected").first()).toBeVisible();
  await expect(page.getByText("Run local simulation")).toBeVisible();

  await page.getByRole("button", { name: "Samsung" }).click();
  await expect(page.getByText("Real integration pending")).toBeVisible();
  await expect(page.getByText("Build Wear OS companion app")).toBeVisible();

  await page.getByRole("button", { name: "Garmin" }).click();
  await expect(page.getByText("Real integration pending")).toBeVisible();
  await expect(page.getByText("Build Connect IQ Data Field")).toBeVisible();

  await page.getByRole("button", { name: "COROS" }).click();
  await expect(page.getByText("COROS sync mode", { exact: true })).toBeVisible();
  await expect(page.getByText("Use sync mode for MVP")).toBeVisible();

  const initialTime = await page.getByTestId("watch-time").innerText();
  const initialDistance = await page.getByTestId("watch-distance").innerText();
  const initialProgress = await page.getByTestId("watch-progress-label").innerText();
  const initialStatus = await page.getByTestId("watch-status").innerText();

  await page.getByRole("button", { name: "Start session" }).click();

  await expect(page.getByText("Session guidance")).toBeVisible();

  // The simulation advances one logical training minute per real second.
  // Expected state sequence:
  // - after start: watch status becomes ON TRACK and progress leaves 0 min;
  // - around minute 17: hydration warning becomes visible;
  // - around minute 20: hydration action becomes due.
  await expect(page.getByTestId("watch-progress-label")).not.toHaveText(
    initialProgress,
    { timeout: 5_000 }
  );
  await expect(page.getByTestId("watch-time")).not.toHaveText(initialTime, {
    timeout: 5_000
  });
  await expect(page.getByTestId("watch-distance")).not.toHaveText(initialDistance, {
    timeout: 5_000
  });
  await expect(page.getByTestId("watch-hr")).toHaveText("125");
  await expect(page.getByTestId("watch-status")).not.toHaveText(initialStatus, {
    timeout: 5_000
  });

  await expect(page.getByTestId("watch-status")).toHaveText(/WARNING|CRITICAL/, {
    timeout: 25_000
  });
  await expect(page.getByTestId("watch-next-action")).toHaveText("Drink", {
    timeout: 25_000
  });
  await expect(page.getByText("Next action", { exact: true })).toBeVisible();
});
