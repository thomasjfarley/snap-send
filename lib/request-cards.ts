import * as FileSystem from 'expo-file-system/legacy';

// Local copies of the sender's front/back preview for address-request postcards,
// kept on the device until the printed (Lob) version exists.
const DIR = `${FileSystem.documentDirectory}request-cards/`;

const path = (requestId: string, side: 'front' | 'back') => `${DIR}${requestId}-${side}.jpg`;

export async function saveRequestCard(requestId: string, side: 'front' | 'back', base64: string) {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(path(requestId, side), base64, { encoding: FileSystem.EncodingType.Base64 });
}

export async function getRequestCardUri(requestId: string, side: 'front' | 'back'): Promise<string | null> {
  const p = path(requestId, side);
  const info = await FileSystem.getInfoAsync(p);
  return info.exists ? p : null;
}

export async function deleteRequestCards(requestId: string) {
  await FileSystem.deleteAsync(path(requestId, 'front'), { idempotent: true });
  await FileSystem.deleteAsync(path(requestId, 'back'), { idempotent: true });
}
