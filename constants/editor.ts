export const FRAMES = [
  { id: 'none', label: 'None', borderWidth: 0, borderColor: 'transparent', padding: 0 },
  { id: 'classic', label: 'Classic', borderWidth: 14, borderColor: '#FFFFFF', padding: 0 },
  { id: 'vintage', label: 'Vintage', borderWidth: 14, borderColor: '#D4B896', padding: 3 },
  { id: 'polaroid', label: 'Polaroid', borderWidth: 6, borderColor: '#F5F5F0', padding: 0 },
  { id: 'minimal', label: 'Minimal', borderWidth: 3, borderColor: '#222222', padding: 0 },
  { id: 'travel', label: 'Travel', borderWidth: 10, borderColor: '#2D6A4F', padding: 2 },
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
