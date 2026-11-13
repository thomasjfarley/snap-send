import * as FileSystem from 'expo-file-system/legacy';

// Permanent on-device copies of postcard images. Lob deletes its images after a while,
// so once we have a Lob render we keep our own copy and never fetch from Lob again.
const DIR = `${FileSystem.documentDirectory}postcard-images/`;

export type Side = 'front' | 'back';

const path = (postcardId: string, side: Side) => `${DIR}${postcardId}-${side}.jpg`;

export async function getLocalPostcardImage(postcardId: string, side: Side): Promise<string | null> {
  const p = path(postcardId, side);
  const info = await FileSystem.getInfoAsync(p);
  return info.exists ? p : null;
}

// Returns the local file URI, downloading the Lob image first if we don't have it yet.
export async function cachePostcardImage(
  postcardId: string,
  side: Side,
  remoteUrl: string | null | undefined,
): Promise<string | null> {
  const existing = await getLocalPostcardImage(postcardId, side);
  if (existing) return existing;
  if (!remoteUrl) return null;
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    const tmp = `${path(postcardId, side)}.part`;
    const res = await FileSystem.downloadAsync(remoteUrl, tmp);
    if (res.status !== 200) {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
      return null;
    }
    await FileSystem.moveAsync({ from: tmp, to: path(postcardId, side) });
    return path(postcardId, side);
  } catch {
    return null;
  }
}
