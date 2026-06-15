import { createHash } from 'crypto';

// Meta Conversions API (server-side events). Mirrors the browser Pixel so
// conversions still land when the browser path is blocked (iOS / ad-block).
// Each event carries an `eventId` so Meta dedupes it against the matching
// client-side Pixel event fired with the same eventID.
//
// Config via env (no-op if unset, so it never breaks checkout):
//   META_PIXEL_ID            same id as the browser pixel
//   META_CAPI_ACCESS_TOKEN   Events Manager → Settings → Conversions API token
//   META_CAPI_TEST_CODE      optional, to see events under "Test events"

const GRAPH_VERSION = 'v21.0';

/** SHA-256 hash a normalized identifier (Meta requirement for PII). */
function hashLower(value?: string | null): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  return createHash('sha256').update(v).digest('hex');
}

/** Normalize a TW phone to E.164 digits (886…) before hashing. */
function hashPhone(value?: string | null): string | undefined {
  if (!value) return undefined;
  let digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('0')) digits = '886' + digits.slice(1);
  return createHash('sha256').update(digits).digest('hex');
}

export interface CapiUserData {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

export interface CapiEvent {
  eventName: string; // 'Purchase', 'Lead', …
  eventId: string; // must match the client Pixel eventID for dedup
  user: CapiUserData;
  customData?: Record<string, unknown>;
  eventSourceUrl?: string;
  actionSource?: 'website' | 'physical_store' | 'system_generated' | 'other';
  eventTime?: number; // unix seconds; defaults to now
}

/** Send one event to the Conversions API. Never throws — logs and returns. */
export async function sendCapiEvent(ev: CapiEvent): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return; // not configured → safe no-op

  const userData: Record<string, unknown> = {};
  const em = hashLower(ev.user.email);
  if (em) userData.em = [em];
  const ph = hashPhone(ev.user.phone);
  if (ph) userData.ph = [ph];
  const ext = hashLower(ev.user.externalId);
  if (ext) userData.external_id = [ext];
  if (ev.user.clientIp) userData.client_ip_address = ev.user.clientIp;
  if (ev.user.userAgent) userData.client_user_agent = ev.user.userAgent;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: ev.eventName,
        event_time: ev.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: ev.actionSource ?? 'website',
        ...(ev.eventSourceUrl ? { event_source_url: ev.eventSourceUrl } : {}),
        user_data: userData,
        ...(ev.customData ? { custom_data: ev.customData } : {}),
      },
    ],
  };
  if (process.env.META_CAPI_TEST_CODE) {
    payload.test_event_code = process.env.META_CAPI_TEST_CODE;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      console.error('Meta CAPI error', res.status, await res.text());
    }
  } catch (err) {
    console.error('Meta CAPI request failed', err);
  }
}
