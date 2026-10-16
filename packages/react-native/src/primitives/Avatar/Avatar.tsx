import { useState } from 'react';

import type { ImageStyle } from 'react-native';
import { Image, Text, View } from 'react-native';

import { useThemeStyles } from '../../theme';

import { createStyles } from './Avatar.styles';
import type { AvatarProps } from './types';

export function Avatar({ fallback, name, size = 'md', source }: AvatarProps) {
  const styles = useThemeStyles(createStyles);
  const imageSource = typeof source === 'string' ? { uri: source } : source;
  const sourceKey =
    typeof source === 'string' ? `uri:${source}` : `asset:${String(source)}`;

  return (
    <View
      accessibilityRole='image'
      accessibilityLabel={name}
      style={[styles.root, styles[size]]}
    >
      {imageSource ? (
        <AvatarImage
          key={sourceKey}
          fallback={fallback}
          source={imageSource}
          styles={styles}
        />
      ) : (
        <Text style={styles.fallback} accessible={false}>
          {fallback}
        </Text>
      )}
    </View>
  );
}

type AvatarImageProps = {
  fallback: string;
  source: number | { uri: string };
  styles: ReturnType<typeof createStyles>;
};

function AvatarImage({ fallback, source, styles }: AvatarImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && (
        <Text style={styles.fallback} accessible={false}>
          {fallback}
        </Text>
      )}
      <Image
        source={source}
        style={styles.image as ImageStyle}
        accessible={false}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </>
  );
}
