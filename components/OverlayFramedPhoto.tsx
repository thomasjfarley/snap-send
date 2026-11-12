import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { GrayscaleImage } from '@/components/GrayscaleImage';
import type { OverlayFrame } from '@/constants/editor';

interface Props {
  frame: OverlayFrame;
  width: number;
  height: number;
  uri: string;
  grayscale?: boolean;
  tint?: { color: string; opacity: number } | null;
  children?: React.ReactNode;
}

// Draws the photo inside the frame's window (cover-cropped) with the transparent frame art on top.
export function OverlayFramedPhoto({ frame, width, height, uri, grayscale = false, tint, children }: Props) {
  const win = frame.window ?? { x: 0, y: 0, w: 1, h: 1 };
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#fff' }}>
      <View
        style={{
          position: 'absolute',
          left: win.x * width,
          top: win.y * height,
          width: win.w * width,
          height: win.h * height,
          overflow: 'hidden',
        }}
      >
        <GrayscaleImage uri={uri} grayscale={grayscale} />
        {tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint.color, opacity: tint.opacity }]} />}
      </View>
      <Image
        source={frame.overlay}
        style={{ position: 'absolute', left: 0, top: 0, width, height }}
        resizeMode="stretch"
        resizeMethod="scale"
      />
      {children}
    </View>
  );
}
