import { ScatterplotLayer } from '@deck.gl/layers';

export default class DiamondLayer extends ScatterplotLayer {
  static layerName = 'DiamondLayer';

  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      'fs:#main-end': `
      if (bool(picking.isActive)) return;

      // Simple linear function to give pyramid/cone shape
      float z = 1.0 - distToCenter / outerRadiusPixels;
      z = 0.3 * z; // Scale height

      // Compute normal numerically
      vec3 p = vec3(unitPosition, z);
      vec3 normal = normalize(cross(dFdx(p), dFdy(-p)));
      normal.y *= -1.0;

      // Blend to flat normal in center
      normal = mix(normal, vec3(0.0, 0.0, -1.0), smoothstep(0.6, 0.5, length(distToCenter / outerRadiusPixels)));
  
      // Simple lighting
      vec3 lightDirection = vec3(0.5, 0.5, -1.0);
      fragColor.rgb *= dot(normal, lightDirection);
      // fragColor.rgb = 0.5 * normal + 0.5; // Debug view for normal
      `,
    };

    // Modify distance calculation to form diamond rather than circle
    shaders.fs = shaders.fs.replace(
      'float distToCenter = length(unitPosition) * outerRadiusPixels;',
      'float distToCenter = (abs(unitPosition.x) + abs(unitPosition.y)) * outerRadiusPixels;'
    );

    return shaders;
  }
}