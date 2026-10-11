import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@6.1.0';

type Platform = 'ios' | 'android';

interface StoreCandidate {
  platform: Platform;
  version: string;
  buildNumber: number;
}

interface Observation {
  platform: Platform;
  candidate_version: string | null;
  candidate_build_number: number | null;
  first_observed_at: string | null;
  observation_count: number;
  checked_at: string | null;
}

class StoreApiError extends Error {
  status: number | null;
  transient: boolean;

  constructor(message: string, status: number | null, transient: boolean) {
    super(message);
    this.name = 'StoreApiError';
    this.status = status;
    this.transient = transient;
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APPLE_APP_ID = Deno.env.get('APPLE_APP_ID') ?? '';
const APPLE_ISSUER_ID = Deno.env.get('APPLE_ISSUER_ID') ?? '';
const APPLE_KEY_ID = Deno.env.get('APPLE_KEY_ID') ?? '';
const APPLE_PRIVATE_KEY = (Deno.env.get('APPLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? '';
const GOOGLE_QUOTA_PROJECT = Deno.env.get('GOOGLE_QUOTA_PROJECT') ?? '';
const GOOGLE_PACKAGE_NAME = Deno.env.get('GOOGLE_PACKAGE_NAME') ?? '';

const CONFIRMATION_DELAY_MS = 30 * 60 * 1000;
const ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TRANSIENT_ALERT_THRESHOLD = 3;
const RETRY_DELAYS_MS = [1000, 3000];
const RELEASED_APPLE_STATES = new Set(['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION']);
const VERSION_PATTERN = /^\d+(?:\.\d+)*$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function assertConfiguration(required: Record<string, string>) {
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) throw new Error(`Missing required secrets: ${missing.join(', ')}`);
}

function isTransientStatus(status: number) {
  return status === 429 || status >= 500;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(
  label: string,
  input: string,
  init: RequestInit = {},
): Promise<any> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const text = await response.text();
      let body: any = null;

      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new StoreApiError(
            `${label} ${response.status} returned invalid JSON`,
            response.status,
            response.ok || isTransientStatus(response.status),
          );
        }
      }

      if (!response.ok) {
        throw new StoreApiError(
          `${label} ${response.status}: ${JSON.stringify(body)}`,
          response.status,
          isTransientStatus(response.status),
        );
      }

      return body;
    } catch (error) {
      const storeError =
        error instanceof StoreApiError
          ? error
          : new StoreApiError(
              `${label} network failure: ${
                error instanceof Error ? error.message : String(error)
              }`,
              null,
              true,
            );

      if (!storeError.transient || attempt === RETRY_DELAYS_MS.length) {
        throw storeError;
      }

      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new StoreApiError(`${label} request failed`, null, true);
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

async function appleToken() {
  const key = await importPKCS8(APPLE_PRIVATE_KEY, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: APPLE_KEY_ID, typ: 'JWT' })
    .setIssuer(APPLE_ISSUER_ID)
    .setAudience('appstoreconnect-v1')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);
}

async function appleRequest(path: string, token: string) {
  return fetchJson('Apple API', `https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getAppleCandidate(): Promise<StoreCandidate> {
  assertConfiguration({
    APPLE_APP_ID,
    APPLE_ISSUER_ID,
    APPLE_KEY_ID,
    APPLE_PRIVATE_KEY,
  });
  const token = await appleToken();
  const versions = await appleRequest(
    `/v1/apps/${APPLE_APP_ID}/appStoreVersions?filter%5Bplatform%5D=IOS&limit=50`,
    token,
  );
  const released = versions.data
    .filter((item: any) => RELEASED_APPLE_STATES.has(item.attributes.appStoreState))
    .filter((item: any) => VERSION_PATTERN.test(item.attributes.versionString))
    .sort((left: any, right: any) =>
      compareVersions(right.attributes.versionString, left.attributes.versionString)
    );
  const version = released[0];
  if (!version) throw new Error('Apple has no released iOS version');

  const publicListing = await fetchJson(
    'Apple public lookup',
    `https://itunes.apple.com/lookup?id=${APPLE_APP_ID}&country=us`,
  );
  const publicVersion = publicListing.results?.[0]?.version;
  if (publicVersion !== version.attributes.versionString) {
    throw new StoreApiError(
      `Apple release ${version.attributes.versionString} is not publicly propagated (public: ${
        publicVersion ?? 'none'
      })`,
      null,
      true,
    );
  }

  const build = await appleRequest(`/v1/appStoreVersions/${version.id}/build`, token);
  const buildNumber = Number(build.data?.attributes?.version);
  if (!Number.isSafeInteger(buildNumber) || buildNumber <= 0) {
    throw new Error(`Apple returned an invalid build number: ${build.data?.attributes?.version}`);
  }

  return {
    platform: 'ios',
    version: version.attributes.versionString,
    buildNumber,
  };
}

async function googleAccessToken() {
  const body = await fetchJson('Google OAuth', 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!body?.access_token) {
    throw new Error('Google OAuth returned no access token');
  }
  return body.access_token as string;
}

async function googleRequest(path: string, token: string, init: RequestInit = {}) {
  return fetchJson('Google Play API', `https://androidpublisher.googleapis.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': GOOGLE_QUOTA_PROJECT,
      ...init.headers,
    },
  });
}

async function getGoogleCandidate(): Promise<StoreCandidate> {
  assertConfiguration({
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    GOOGLE_QUOTA_PROJECT,
    GOOGLE_PACKAGE_NAME,
  });
  const token = await googleAccessToken();
  const packagePath = `/androidpublisher/v3/applications/${GOOGLE_PACKAGE_NAME}`;
  const edit = await googleRequest(`${packagePath}/edits`, token, {
    method: 'POST',
    body: '{}',
  });

  try {
    const track = await googleRequest(
      `${packagePath}/edits/${edit.id}/tracks/production`,
      token,
    );
    const releases = (track.releases ?? [])
      .filter((release: any) => release.status === 'completed')
      .map((release: any) => ({
        version: release.name,
        buildNumber: Math.max(...(release.versionCodes ?? []).map(Number)),
      }))
      .filter(
        (release: any) =>
          VERSION_PATTERN.test(release.version ?? '') &&
          Number.isSafeInteger(release.buildNumber) &&
          release.buildNumber > 0,
      )
      .sort((left: any, right: any) => right.buildNumber - left.buildNumber);
    const release = releases[0];
    if (!release) throw new Error('Google Play has no completed production release');

    return {
      platform: 'android',
      version: release.version,
      buildNumber: release.buildNumber,
    };
  } finally {
    await googleRequest(`${packagePath}/edits/${edit.id}`, token, { method: 'DELETE' });
  }
}

async function recordError(
  supabase: ReturnType<typeof createClient>,
  platform: Platform,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  const transient = error instanceof StoreApiError && error.transient;
  const now = new Date();
  const { data: previous, error: previousError } = await supabase
    .from('store_release_observations')
    .select('last_error,last_alerted_at,consecutive_error_count')
    .eq('platform', platform)
    .single();
  if (previousError) throw previousError;

  const consecutiveErrorCount = (previous?.consecutive_error_count ?? 0) + 1;
  const alertIntervalElapsed =
    !previous?.last_alerted_at ||
    now.getTime() - new Date(previous.last_alerted_at).getTime() >= ALERT_INTERVAL_MS;
  const shouldAlert = transient
    ? consecutiveErrorCount >= TRANSIENT_ALERT_THRESHOLD && alertIntervalElapsed
    : previous?.last_error !== message || alertIntervalElapsed;

  const { error: updateError } = await supabase
    .from('store_release_observations')
    .update({
      checked_at: now.toISOString(),
      last_error: message.slice(0, 2000),
      consecutive_error_count: consecutiveErrorCount,
    })
    .eq('platform', platform);
  if (updateError) throw updateError;

  let alerted = false;
  if (shouldAlert) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/report-error`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'monitor-store-releases',
          title: `${platform} store release check failed`,
          severity: 'error',
          details: message,
        }),
      });
      if (!response.ok) {
        throw new Error(`report-error returned ${response.status}`);
      }
      const { error: alertUpdateError } = await supabase
        .from('store_release_observations')
        .update({ last_alerted_at: now.toISOString() })
        .eq('platform', platform);
      if (alertUpdateError) throw alertUpdateError;
      alerted = true;
    } catch (alertError) {
      console.error(`Failed to alert for ${platform} monitor error`, alertError);
    }
  }

  return {
    platform,
    status: 'error',
    error: message,
    transient,
    consecutiveErrorCount,
    alerted,
  };
}

async function processCandidate(
  supabase: ReturnType<typeof createClient>,
  candidate: StoreCandidate,
) {
  const now = new Date();
  const { data: policy, error: policyError } = await supabase
    .from('app_version_policy')
    .select('*')
    .eq('platform', candidate.platform)
    .single();
  if (policyError) throw policyError;

  const { data, error } = await supabase
    .from('store_release_observations')
    .select('*')
    .eq('platform', candidate.platform)
    .single();
  if (error) throw error;
  const observation = data as Observation;

  if (candidate.buildNumber <= policy.minimum_build_number) {
    const { error: updateError } = await supabase
      .from('store_release_observations')
      .update({
        checked_at: now.toISOString(),
        last_observed_at: now.toISOString(),
        last_error: null,
        last_alerted_at: null,
        consecutive_error_count: 0,
      })
      .eq('platform', candidate.platform);
    if (updateError) throw updateError;
    return { platform: candidate.platform, status: 'current', candidate };
  }

  const sameCandidate =
    observation.candidate_build_number === candidate.buildNumber &&
    observation.candidate_version === candidate.version;

  if (!sameCandidate) {
    const { error: updateError } = await supabase
      .from('store_release_observations')
      .update({
        candidate_version: candidate.version,
        candidate_build_number: candidate.buildNumber,
        first_observed_at: now.toISOString(),
        last_observed_at: now.toISOString(),
        observation_count: 1,
        enforced_at: null,
        checked_at: now.toISOString(),
        last_error: null,
        last_alerted_at: null,
        consecutive_error_count: 0,
      })
      .eq('platform', candidate.platform);
    if (updateError) throw updateError;
    return { platform: candidate.platform, status: 'observing', candidate, observationCount: 1 };
  }

  const observationCount = observation.observation_count + 1;
  const firstObservedAt = new Date(observation.first_observed_at ?? now).getTime();
  const delaySatisfied = now.getTime() - firstObservedAt >= CONFIRMATION_DELAY_MS;

  if (!delaySatisfied || observationCount < 2) {
    const { error: updateError } = await supabase
      .from('store_release_observations')
      .update({
        last_observed_at: now.toISOString(),
        observation_count: observationCount,
        checked_at: now.toISOString(),
        last_error: null,
        last_alerted_at: null,
        consecutive_error_count: 0,
      })
      .eq('platform', candidate.platform);
    if (updateError) throw updateError;
    return {
      platform: candidate.platform,
      status: 'confirming',
      candidate,
      observationCount,
    };
  }

  const { error: policyUpdateError } = await supabase
    .from('app_version_policy')
    .update({
      minimum_version: candidate.version,
      latest_version: candidate.version,
      minimum_build_number: candidate.buildNumber,
      latest_build_number: candidate.buildNumber,
      updated_at: now.toISOString(),
    })
    .eq('platform', candidate.platform);
  if (policyUpdateError) throw policyUpdateError;

  const { error: observationUpdateError } = await supabase
    .from('store_release_observations')
    .update({
      last_observed_at: now.toISOString(),
      observation_count: observationCount,
      enforced_at: now.toISOString(),
      checked_at: now.toISOString(),
      last_error: null,
      last_alerted_at: null,
      consecutive_error_count: 0,
    })
    .eq('platform', candidate.platform);
  if (observationUpdateError) throw observationUpdateError;

  return { platform: candidate.platform, status: 'enforced', candidate, observationCount };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    assertConfiguration({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: claimed, error: claimError } = await supabase.rpc(
      'claim_store_release_monitor_run',
    );
    if (claimError) throw claimError;
    if (!claimed) return json({ status: 'rate_limited' });

    const results = await Promise.all([
      getAppleCandidate()
        .then((candidate) => processCandidate(supabase, candidate))
        .catch((error) => recordError(supabase, 'ios', error)),
      getGoogleCandidate()
        .then((candidate) => processCandidate(supabase, candidate))
        .catch((error) => recordError(supabase, 'android', error)),
    ]);

    return json({ results });
  } catch (error) {
    console.error('Store release monitor failed', error);
    return json(
      { error: error instanceof Error ? error.message : 'Store release monitor failed' },
      500,
    );
  }
});
