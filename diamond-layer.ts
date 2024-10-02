import { ScatterplotLayer } from '@deck.gl/layers';

export default class DiamondLayer extends ScatterplotLayer {
  static layerName = 'DiamondLayer';

  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      'fs:#main-end': `
      if (bool(picking.isActive)) return;

      // fragColor = vec4(1.0, 0.0, 0.0, 1.0);
      //fragColor = vec4(vec3(distToCenter / outerRadiusPixels), 1.0);
      // fragColor = vec4(vec2(unitPosition), 0.0, 1.0);
      // fragColor = vec4(vec2(inCircle), 0.0, 1.0);

      vec3 p = vec3(unitPosition, 0.3 * (1.0 - distToCenter / outerRadiusPixels));
      vec3 normal = normalize(cross(dFdx(p), dFdy(-p)));
  normal.y *= -1.0;

      normal = mix(normal, vec3(0.0, 0.0, -1.0), smoothstep(0.6, 0.4, length(distToCenter / outerRadiusPixels)));
      // normal = mix(normal, normal * vec3(-0.93, -0.93, 1.0), smoothstep(0.8, 0.6, length(distToCenter / outerRadiusPixels)));
  fragColor.rgb *= dot(normal, vec3(1.0, 0.5, -1.0));
      // fragColor.rgb = 0.5 * normal + 0.5;
      `,
    };

    // TODO breaks picking
    shaders.fs = shaders.fs.replace(
      'float distToCenter = length(unitPosition) * outerRadiusPixels;',
      'float distToCenter = (abs(unitPosition.x) + abs(unitPosition.y)) * outerRadiusPixels;'
    );

    return shaders;
  }
}
