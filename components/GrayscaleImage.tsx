import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Image as SvgImage, Defs, Filter, FeColorMatrix } from 'react-native-svg';

interface Props {
  uri: string;
  grayscale?: boolean;
}

/**
 * Renders an image that fills its parent absolutely.
 * When grayscale=true, uses an SVG feColorMatrix filter to desaturate the image.
 * This is the only reliable way to achieve grayscale on iOS in React Native,
 * since CSS `filter` on native views doesn't apply to child image layers.
 */
export function GrayscaleImage({ uri, grayscale = false }: Props) {
  // react-native-svg filters render black on Android; a saturation blend layer over the photo
  // gives the same grayscale there without touching the iOS path.
  if (grayscale && Platform.OS === 'android') {
    return (
      <View style={[StyleSheet.absoluteFill, { isolation: 'isolate' }]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#808080', mixBlendMode: 'saturation' }]} />
      </View>
    );
  }
  if (grayscale) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <Filter id="bw">
              <FeColorMatrix type="saturate" values="0" />
            </Filter>
          </Defs>
          <SvgImage
            href={uri}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            filter="url(#bw)"
          />
        </Svg>
      </View>
    );
  }

  return (
    <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
  );
}
