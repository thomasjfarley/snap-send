// Shared Google Vision SafeSearch moderation (legal requirement: 18 U.S.C. § 1461).
// Used by submit-postcard and create-address-request.

const LIKELIHOOD_LEVELS = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
const BLOCK_THRESHOLD = 'LIKELY';

export function isBlocked(likelihood: string): boolean {
  return LIKELIHOOD_LEVELS.indexOf(likelihood) >= LIKELIHOOD_LEVELS.indexOf(BLOCK_THRESHOLD);
}

export async function runSafeSearch(imageBase64: string, apiKey: string) {
  let lastStatus = 503;
  let lastData: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{ image: { content: imageBase64 }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }],
          }),
        },
      );
      const visionData = await visionRes.json();
      const safeSearch = visionData.responses?.[0]?.safeSearchAnnotation;
      if (visionRes.ok && safeSearch) {
        return { safeSearch, status: visionRes.status, data: visionData };
      }
      lastStatus = visionRes.status;
      lastData = visionData;
    } catch (error) {
      lastData = { error: String(error) };
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  return { safeSearch: null, status: lastStatus, data: lastData };
}
