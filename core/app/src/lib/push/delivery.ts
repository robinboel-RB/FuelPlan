import type {
  PushSubscriptionStore,
  StoredPushSubscription
} from "@/lib/push/subscriptions";
import {
  isExpiredPushStatus,
  sendPushToStoredSubscription,
  type FuelPlanPushPayload,
  type PushSendSummary
} from "@/lib/push/webpush";
import { recordPushTelemetry } from "@/lib/push/telemetry";

export async function sendPushRecordsWithStore(
  records: StoredPushSubscription[],
  payload: FuelPlanPushPayload,
  store: PushSubscriptionStore
) {
  const summary: PushSendSummary = {
    total: records.length,
    successful: 0,
    failed: 0,
    removed: 0,
    errors: []
  };

  await Promise.all(
    records.map(async (record) => {
      const result = await sendPushToStoredSubscription(record, payload);

      summary.successful += result.successful;
      summary.failed += result.failed;
      summary.removed += result.removed;
      summary.errors.push(...result.errors);

      if (result.successful > 0) {
        await store.markSuccess(record.installId, record.deviceId);
        recordPushTelemetry("send_success", {
          installId: record.installId,
          deviceId: record.deviceId
        });
        return;
      }

      const statusCode = result.errors[0]?.statusCode;

      if (isExpiredPushStatus(statusCode)) {
        await store.removeByEndpoint(record.endpoint);
        recordPushTelemetry("cleanup_404_410", {
          installId: record.installId,
          deviceId: record.deviceId,
          statusCode
        });
        return;
      }

      await store.markFailure(record.installId, record.deviceId);
      recordPushTelemetry("send_failure", {
        installId: record.installId,
        deviceId: record.deviceId,
        statusCode
      });
    })
  );

  return summary;
}
