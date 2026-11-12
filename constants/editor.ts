import type { ImageSourcePropType } from 'react-native';

const BASIC_FRAMES = [
  { id: 'none', label: 'None', borderWidth: 0, borderColor: 'transparent', padding: 0 },
  { id: 'classic', label: 'Classic', borderWidth: 14, borderColor: '#FFFFFF', padding: 0 },
  { id: 'vintage', label: 'Vintage', borderWidth: 14, borderColor: '#D4B896', padding: 3 },
  { id: 'polaroid', label: 'Polaroid', borderWidth: 6, borderColor: '#F5F5F0', padding: 0 },
  { id: 'minimal', label: 'Minimal', borderWidth: 3, borderColor: '#222222', padding: 0 },
  { id: 'travel', label: 'Travel', borderWidth: 10, borderColor: '#2D6A4F', padding: 2 },
] as const;

// Seasonal frames are transparent PNG overlays drawn over the photo. `window` is the photo area
// as fractions of the overlay; null = photo fills the card and the art sits on top of it.
// `expiresAt` is local midnight on the first day the frame is NO LONGER selectable.
// Keep ids, windows and overlay files in sync with OVERLAY_FRAMES in
// supabase/functions/submit-postcard/index.ts and the `frames` Storage bucket.
const FALL_END = new Date(2026, 11, 1).getTime();       // gone Dec 1
const CHRISTMAS_END = new Date(2026, 11, 26).getTime(); // available through Dec 25
const NEW_YEAR_END = new Date(2027, 0, 2).getTime();    // available through Jan 1
const WINTER_END = new Date(2027, 1, 1).getTime();      // gone Feb 1

const HOLIDAY_FRAMES = [
  { id: 'fall-turkey', label: 'Turkey', overlay: require('../assets/frames/fall-turkey.png'), window: { x: 0.0228, y: 0.127, w: 0.9538, h: 0.8203 }, expiresAt: FALL_END },
  { id: 'fall-thanksgiving-pumpkins', label: 'Thanksgiving', overlay: require('../assets/frames/fall-thanksgiving-pumpkins.png'), window: { x: 0.0267, y: 0.0879, w: 0.9414, h: 0.8457 }, expiresAt: FALL_END },
  { id: 'fall-cornucopia', label: 'Cornucopia', overlay: require('../assets/frames/fall-cornucopia.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-pumpkin-vines', label: 'Pumpkins', overlay: require('../assets/frames/fall-pumpkin-vines.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-orchard-apples', label: 'Apples', overlay: require('../assets/frames/fall-orchard-apples.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-woodland', label: 'Woodland', overlay: require('../assets/frames/fall-woodland.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-harvest-leaves', label: 'Harvest', overlay: require('../assets/frames/fall-harvest-leaves.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-maple-corners', label: 'Maple', overlay: require('../assets/frames/fall-maple-corners.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-wheat-trim', label: 'Wheat', overlay: require('../assets/frames/fall-wheat-trim.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-acorn-trim', label: 'Acorns', overlay: require('../assets/frames/fall-acorn-trim.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-pumpkin-trim', label: 'Pumpkin Trim', overlay: require('../assets/frames/fall-pumpkin-trim.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-maple-dots', label: 'Leaf Dots', overlay: require('../assets/frames/fall-maple-dots.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-wish-you-were-here', label: 'Gobble Gobble', overlay: require('../assets/frames/fall-wish-you-were-here.png'), window: { x: 0.0879, y: 0.1328, w: 0.8385, h: 0.7637 }, expiresAt: FALL_END },
  { id: 'fall-kids-table', label: 'Kids\' Table', overlay: require('../assets/frames/fall-kids-table.png'), window: { x: 0.0299, y: 0.1221, w: 0.9355, h: 0.7451 }, expiresAt: FALL_END },
  { id: 'fall-thankful-for-you', label: 'Thankful for You', overlay: require('../assets/frames/fall-thankful-for-you.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-happy-thanksgiving', label: 'Happy Thanksgiving', overlay: require('../assets/frames/fall-happy-thanksgiving.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-incident-report', label: 'Incident Report', overlay: require('../assets/frames/fall-incident-report.png'), window: { x: 0.028, y: 0.1699, w: 0.944, h: 0.707 }, expiresAt: FALL_END },
  { id: 'fall-we-got-one', label: 'We Got One', overlay: require('../assets/frames/fall-we-got-one.png'), window: { x: 0.0221, y: 0.0889, w: 0.9557, h: 0.7783 }, expiresAt: FALL_END },
  { id: 'fall-wanted-turkey', label: 'Wanted Turkey', overlay: require('../assets/frames/fall-wanted-turkey.png'), window: { x: 0.0404, y: 0.2061, w: 0.7858, h: 0.7051 }, expiresAt: FALL_END },
  { id: 'fall-pie-inspector', label: 'Pie Inspector', overlay: require('../assets/frames/fall-pie-inspector.png'), window: { x: 0.2038, y: 0.1445, w: 0.5436, h: 0.7979 }, expiresAt: FALL_END },
  { id: 'fall-elastic-waistband', label: 'Waistband Season', overlay: require('../assets/frames/fall-elastic-waistband.png'), window: { x: 0.0859, y: 0.1445, w: 0.8242, h: 0.7217 }, expiresAt: FALL_END },
  { id: 'fall-mashed-potato', label: 'Mashed Potato', overlay: require('../assets/frames/fall-mashed-potato.png'), window: { x: 0.0592, y: 0.1387, w: 0.8776, h: 0.7471 }, expiresAt: FALL_END },
  { id: 'fall-corner-cornucopia', label: 'Corner Cornucopia', overlay: require('../assets/frames/fall-corner-cornucopia.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-first-thanksgiving', label: 'First Thanksgiving', overlay: require('../assets/frames/fall-first-thanksgiving.png'), window: null, expiresAt: FALL_END },
  { id: 'fall-stuffing', label: 'Stuffing', overlay: require('../assets/frames/fall-stuffing.png'), window: { x: 0.084, y: 0.1416, w: 0.8281, h: 0.7344 }, expiresAt: FALL_END },
  { id: 'christmas-holly-vine', label: 'Holly Vine', overlay: require('../assets/frames/christmas-holly-vine.png'), window: null, expiresAt: CHRISTMAS_END },
  { id: 'christmas-holly-ribbon', label: 'Holly', overlay: require('../assets/frames/christmas-holly-ribbon.png'), window: { x: 0.0449, y: 0.0986, w: 0.9199, h: 0.8467 }, expiresAt: CHRISTMAS_END },
  { id: 'christmas-gingerbread', label: 'Gingerbread', overlay: require('../assets/frames/christmas-gingerbread.png'), window: { x: 0.1152, y: 0.1084, w: 0.7904, h: 0.8193 }, expiresAt: CHRISTMAS_END },
  { id: 'newyear-gold-silver', label: 'New Year', overlay: require('../assets/frames/newyear-gold-silver.png'), window: { x: 0.0638, y: 0.0811, w: 0.873, h: 0.8496 }, expiresAt: NEW_YEAR_END },
  { id: 'christmas-snowy-pines', label: 'Snowy Pines', overlay: require('../assets/frames/christmas-snowy-pines.png'), window: { x: 0.0658, y: 0.0889, w: 0.8685, h: 0.8447 }, expiresAt: CHRISTMAS_END },
  { id: 'christmas-happy-holidays', label: 'Happy Holidays', overlay: require('../assets/frames/christmas-happy-holidays.png'), window: { x: 0.0339, y: 0.1943, w: 0.9323, h: 0.7578 }, expiresAt: CHRISTMAS_END },
  { id: 'christmas-merry-lantern', label: 'Merry Christmas', overlay: require('../assets/frames/christmas-merry-lantern.png'), window: { x: 0.0449, y: 0.2178, w: 0.9089, h: 0.7461 }, expiresAt: CHRISTMAS_END },
  { id: 'newyear-navy-gold', label: 'Navy & Gold', overlay: require('../assets/frames/newyear-navy-gold.png'), window: { x: 0.0234, y: 0.1953, w: 0.9499, h: 0.7598 }, expiresAt: NEW_YEAR_END },
  { id: 'winter-icy-silver', label: 'Icy Silver', overlay: require('../assets/frames/winter-icy-silver.png'), window: { x: 0.0423, y: 0.0645, w: 0.916, h: 0.8477 }, expiresAt: WINTER_END },
  { id: 'winter-snowflake-wonderland', label: 'Snowflakes', overlay: require('../assets/frames/winter-snowflake-wonderland.png'), window: null, expiresAt: WINTER_END },
  { id: 'winter-scarf-mittens', label: 'Scarf & Mittens', overlay: require('../assets/frames/winter-scarf-mittens.png'), window: { x: 0.0658, y: 0.1084, w: 0.8698, h: 0.7871 }, expiresAt: WINTER_END },
] as const;

export type BorderFrame = (typeof BASIC_FRAMES)[number] & { overlay?: undefined; window?: undefined; expiresAt?: undefined };
export type OverlayFrame = {
  id: string;
  label: string;
  overlay: ImageSourcePropType;
  window: { x: number; y: number; w: number; h: number } | null;
  expiresAt: number;
  borderWidth?: undefined;
  borderColor?: undefined;
  padding?: undefined;
};
export type Frame = BorderFrame | OverlayFrame;

export type FrameId = (typeof BASIC_FRAMES)[number]['id'] | (typeof HOLIDAY_FRAMES)[number]['id'];

export const FRAMES: readonly Frame[] = [...BASIC_FRAMES, ...HOLIDAY_FRAMES];

export function isOverlayFrame(frame: Frame): frame is OverlayFrame {
  return frame.overlay !== undefined;
}

export function isFrameAvailable(frame: Frame, now: number = Date.now()): boolean {
  return frame.expiresAt === undefined || now < frame.expiresAt;
}

// Frames the user may pick right now; expired seasonal frames are hidden.
export function getSelectableFrames(now: number = Date.now()): readonly Frame[] {
  return FRAMES.filter((f) => isFrameAvailable(f, now));
}

// Looks up any frame (including expired) so an in-progress postcard never crashes; unknown ids fall back to 'none'.
export function getFrame(id: string): Frame {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

export const FILTERS = [
  { id: 'none', label: 'None', matrix: null },
  {
    id: 'warm',
    label: 'Warm',
    // Boost reds, reduce blues
    matrix: [1.2, 0.1, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'cool',
    label: 'Cool',
    // Boost blues, reduce reds
    matrix: [0.8, 0, 0, 0, 0, 0, 1.0, 0.1, 0, 0, 0, 0, 1.2, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'bw',
    label: 'B&W',
    // Desaturate to grayscale
    matrix: [0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'fade',
    label: 'Fade',
    // Low contrast, washed-out
    matrix: [0.8, 0, 0, 0, 0.1, 0, 0.8, 0, 0, 0.1, 0, 0, 0.8, 0, 0.1, 0, 0, 0, 1, 0],
  },
  {
    id: 'vivid',
    label: 'Vivid',
    // Boost saturation + contrast
    matrix: [1.4, -0.2, -0.2, 0, 0, -0.2, 1.4, -0.2, 0, 0, -0.2, -0.2, 1.4, 0, 0, 0, 0, 0, 1, 0],
  },
] as const;

export type FilterId = (typeof FILTERS)[number]['id'];
