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

      float fromCenter = abs(geometry.uv.y);
      float glow = smoothstep(0.05, 0.1, fromCenter);
      fragColor.rgb = mix(vec3(1.0), fragColor.rgb, glow);

      float sigma = 1.0 / 3.0;
      float a = -0.5 / (sigma * sigma);
      float w0 = 0.3989422804014327 / sigma;
      float weight = w0 * exp(a * fromCenter * fromCenter);   
      fragColor.a *= weight;
      fragColor.a = mix(1.0, 0.5 * fragColor.a, smoothstep(0.2, 0.3, fromCenter));
      `,
    };

    return shaders;
  }
}