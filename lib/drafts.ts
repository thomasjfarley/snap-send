import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { FilterId, FrameId } from '@/constants/editor';

export type DraftStep = 'editor' | 'message' | 'recipient' | 'preview';

interface StoredDraft {
  id: string;
  userId: string;
  photoName: string;
  filterId: FilterId;
  frameId: FrameId;
  message: string;
  location: string | null;
  recipientId: string | null;
  step: DraftStep;
  updatedAt: number;
}

export interface PostcardDraft extends Omit<StoredDraft, 'photoName'> {
  photoUri: string;
}

export interface DraftInput {
  id?: string | null;
  userId: string;
  photoUri: string;
  filterId: FilterId;
  frameId: FrameId;
  message: string;
  location: string | null;
  recipientId: string | null;
  step: DraftStep;
}

const KEY = 'snapsend.drafts.v1';
export const MAX_DRAFTS = 20;

function draftsDir(): Directory {
  const dir = new Directory(Paths.document, 'drafts');
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

// Only the file name is stored: the app container path can change between app updates on iOS.
function photoFile(name: string): File {
  return new File(draftsDir(), name);
}

function deletePhoto(name: string) {
  try {
    const file = photoFile(name);
    if (file.exists) file.delete();
  } catch {
    // best effort
  }
}

async function readAll(): Promise<StoredDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredDraft[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(drafts: StoredDraft[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(drafts));
}

function toDraft({ photoName, ...rest }: StoredDraft): PostcardDraft {
  return { ...rest, photoUri: photoFile(photoName).uri };
}

export async function listDrafts(userId: string): Promise<PostcardDraft[]> {
  const all = await readAll();
  const keep = all.filter((d) => {
    if (d.userId !== userId) return true;
    try { return photoFile(d.photoName).exists; } catch { return false; }
  });
  if (keep.length !== all.length) await writeAll(keep);
  return keep
    .filter((d) => d.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toDraft);
}

export async function saveDraft(input: DraftInput): Promise<PostcardDraft> {
  const all = await readAll();
  const id = input.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const existing = all.find((d) => d.id === id);

  // Re-copy only when the photo changed; a restored draft's photo already lives in the drafts folder.
  let photoName = existing?.photoName ?? '';
  const currentUri = existing ? photoFile(existing.photoName).uri : null;
  if (!existing || input.photoUri !== currentUri) {
    const ext = /\.(jpe?g|png|heic|webp)(\?|$)/i.exec(input.photoUri)?.[1]?.toLowerCase() ?? 'jpg';
    photoName = `${id}-${Date.now()}.${ext}`;
    new File(input.photoUri).copy(photoFile(photoName));
    if (existing) deletePhoto(existing.photoName);
  }

  const stored: StoredDraft = {
    id,
    userId: input.userId,
    photoName,
    filterId: input.filterId,
    frameId: input.frameId,
    message: input.message,
    location: input.location,
    recipientId: input.recipientId,
    step: input.step,
    updatedAt: Date.now(),
  };

  const rest = all.filter((d) => d.id !== id);
  const mine = [stored, ...rest.filter((d) => d.userId === input.userId)]
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const dropped = mine.slice(MAX_DRAFTS);
  dropped.forEach((d) => deletePhoto(d.photoName));
  const droppedIds = new Set(dropped.map((d) => d.id));

  await writeAll([stored, ...rest].filter((d) => !droppedIds.has(d.id)));
  return toDraft(stored);
}

export async function deleteDraft(id: string) {
  const all = await readAll();
  const target = all.find((d) => d.id === id);
  if (target) deletePhoto(target.photoName);
  await writeAll(all.filter((d) => d.id !== id));
}
