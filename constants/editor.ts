export const FRAMES = [
  { id: 'none', label: 'None', file: null },
  { id: 'classic', label: 'Classic', file: require('../assets/frames/classic.png') },
  { id: 'vintage', label: 'Vintage', file: require('../assets/frames/vintage.png') },
  { id: 'polaroid', label: 'Polaroid', file: require('../assets/frames/polaroid.png') },
  { id: 'minimal', label: 'Minimal', file: require('../assets/frames/minimal.png') },
  { id: 'travel', label: 'Travel', file: require('../assets/frames/travel.png') },
] as const;

export type FrameId = (typeof FRAMES)[number]['id'];

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
