import { ArcLayer, ArcLayerProps } from '@deck.gl/layers';

export const ADDITIVE_BLEND_PARAMETERS = {
  blendColorSrcFactor: 'src-alpha',
  blendAlphaSrcFactor: 'src-alpha',
  blendColorDstFactor: 'dst-alpha',
  blendAlphaDstFactor: 'dst-alpha',
  blendColorOperation: 'add',
  blendAlphaOperation: 'add',
  depthTest: false,
};

export default class GlowingArcLayer extends ArcLayer {
  static layerName = 'GlowingArcLayer';

  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      'fs:#main-end': `
      if (bool(picking.isActive)) return;

      // Imitate light segments
      float along = 0.5 * (sin(100.0 * geometry.uv.x) + 1.0);
      float join = smoothstep(0.5, 0.99, pow(along, 100.0));
      along = 1.0 - pow(along, 10.0);
      along *= 0.25;

      // Highlight middle of tube
      float fromCenter = abs(geometry.uv.y);
      float glow = smoothstep(0.05, 0.1, fromCenter);
      fragColor.rgb = mix(vec3(1.0), fragColor.rgb, glow - along);
      fragColor.rgb = mix(fragColor.rgb, vec3(0.0), 0.5 * join);

      // Gaussian blur edge for glow
      float sigma = 1.0 / 3.0;
      float a = -0.5 / (sigma * sigma);
      float w0 = 0.3989422804014327 / sigma;
      float t = fromCenter - along;
      float weight = w0 * exp(a * t * t);   
      fragColor.a *= weight;
      fragColor.a = mix(1.0, 0.5 * fragColor.a, smoothstep(0.2, 0.3, fromCenter));
      `,
    };

    return shaders;
  }
}