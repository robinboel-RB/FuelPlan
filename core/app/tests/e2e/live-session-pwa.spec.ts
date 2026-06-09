import { expect, test } from "@playwright/test";

test("live session renders PWA controls", async ({ page }) => {
  await page.goto("/live-session");

  await expect(page.getByRole("heading", { name: "Live Fuel Coach" })).toBeVisible();
  await expect(page.getByText("PWA install", { exact: true })).toBeVisible();
  await expect(page.getByText("Phone", { exact: true })).toBeVisible();
  await expect(page.getByText("Niveau 2 Web Push status", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Prepare Web Push|Enable Web Push/ })).toBeVisible();
  await expect(page.getByText("Geen actieve sessie", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Ga naar dashboard en start een sessie.", { exact: true })
  ).toBeVisible();
  await expect(page.getByText(["Start ", "demo", " session"].join(""))).toHaveCount(0);
});

test("permission denied state is shown after explicit permission action", async ({ page }) => {
  await page.addInitScript(() => {
    class MockNotification {
      static permission: NotificationPermission = "default";

      static async requestPermission() {
        MockNotification.permission = "denied";
        return MockNotification.permission;
      }
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification
    });
  });

  await page.goto("/live-session");

  await page.getByRole("button", { name: "Prepare Web Push" }).click();
  await page.getByRole("button", { name: "Enable Web Push" }).click();

  await expect(page.getByText("permission denied")).toBeVisible();
  await expect(
    page.getByText("Notifications zijn geblokkeerd. Pas dit aan in je browserinstellingen.")
  ).toBeVisible();
});

test("service worker registers on live session", async ({ page }) => {
  await page.goto("/live-session");

  await expect
    .poll(async () =>
      page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) {
          return false;
        }

        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration);
      })
    )
    .toBe(true);
});

test("dashboard stores fueling plan and opens live session with real carb trigger", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByText("Python core engine")).toBeVisible();
  await expect(page.getByText("ready", { exact: true })).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("button", { name: "Start live PWA coach" }).first().click();

  await expect(page).toHaveURL(/\/live-session/);
  await expect(page.getByRole("button", { name: "Start live session" })).toBeVisible();
  await expect(page.getByText("Neem 30g carbs").first()).toBeVisible();
  await expect(page.getByText(/fuelplan-carb-/).first()).toBeVisible();
});

test("service worker shows offline fallback for uncached navigation", async ({
  context,
  page
}) => {
  await page.goto("/live-session");
  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) {
      return false;
    }

    await navigator.serviceWorker.ready;
    return Boolean(await navigator.serviceWorker.getRegistration());
  });
  await page.reload();

  await context.setOffline(true);
  await page.goto("/offline-check-route");

  await expect(page.getByRole("heading", { name: "Offline" })).toBeVisible();

  await context.setOffline(false);
});

test("push API routes reject unauthenticated public requests", async ({ request }) => {
  const subscribe = await request.post("/api/push/subscribe", {
    data: {
      endpoint: "https://push.example.test/subscription",
      keys: { p256dh: "public-key", auth: "auth-secret" }
    }
  });
  const testPush = await request.post("/api/push/test", { data: {} });
  const send = await request.post("/api/push/send", {
    data: {
      eventType: "carb",
      title: "Fuel now",
      body: "Neem 30g carbs",
      tag: "fuelplan-carb-45",
      url: "/live-session"
    }
  });
  const status = await request.post("/api/push/status", { data: {} });

  expect(subscribe.status()).toBe(401);
  expect(testPush.status()).toBe(401);
  expect(send.status()).toBe(401);
  expect(status.status()).toBe(401);
});
