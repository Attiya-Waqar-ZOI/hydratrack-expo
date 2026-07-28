// Droplet wordmark from the design: a small drop with a water line inside,
// outlined in deep accent. Static (the header keeps quiet; the intro and
// the goal glass carry the motion).
import React from 'react';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';

import { C } from './theme';

const DROP = 'M12 1.5C12 1.5 3.5 13 3.5 21a8.5 8.5 0 0 0 17 0c0-8-8.5-19.5-8.5-19.5Z';

export function Droplet({ width = 20 }: { width?: number }) {
  return (
    <Svg width={width} height={width * (26 / 20)} viewBox="0 0 24 32">
      <Defs>
        <ClipPath id="drop"><Path d={DROP} /></ClipPath>
      </Defs>
      <Path d={DROP} fill={C.accent200} />
      <G clipPath="url(#drop)">
        <Path
          d="M-12 15 C-6 11.5 0 18.5 6 15 C12 11.5 18 18.5 24 15 C30 11.5 36 18.5 42 15 V34 H-12 Z"
          fill={C.accent}
        />
      </G>
      <Path d={DROP} fill="none" stroke={C.accentDeep} strokeWidth={1.3} />
    </Svg>
  );
}
