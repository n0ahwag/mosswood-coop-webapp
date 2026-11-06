// Stil-Regler für alle Three.js-Materialien: wird einmal beim Laden ausgeführt und
// verändert die eingebauten Shader-Bausteine, bevor das erste Material kompiliert wird.
//
// - Randlicht: Kanten leuchten leicht, oben stärker als unten (wirkt rund und spielzeughaft).
// - Farbanhebung: blasse Töne werden satter, kräftige bleiben, wie sie sind.
//
// Für den flachen, matten Low-Poly-Look stehen beide Regler auf 0.
//
// Eigene Shader (Himmel, Wolkenmeer) bekommen die Farbanhebung über
// #include <tonemapping_fragment> automatisch mit.

import * as THREE from 'three';

/** Stärke des Randlichts (0 = aus). */
const RIM = 0.0;
/** Wie stark blasse Farben angehoben werden (0 = aus). */
const VIBRANCE = 0.0;

const MARK = '/* mosswood-stylize */';

function patch() {
  const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
  if (chunks.lights_fragment_end.includes(MARK)) return;

  chunks.lights_fragment_end += `
${MARK}
#if defined( RE_IndirectDiffuse ) && !defined( MW_NO_RIM )
{
  vec3 mwUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  float mwFacing = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
  float mwTop = 0.35 + 0.65 * saturate( dot( geometryNormal, mwUp ) + 0.45 );
  float mwRim = pow( mwFacing, 3.2 ) * mwTop * ${RIM.toFixed(3)};
  reflectedLight.indirectDiffuse += material.diffuseColor * vec3( 1.0, 0.95, 0.82 ) * mwRim;
}
#endif
`;

  chunks.tonemapping_fragment = `
${MARK}
{
  vec3 mwC = max( gl_FragColor.rgb, 0.0 );
  float mwHi = max( mwC.r, max( mwC.g, mwC.b ) );
  float mwLo = min( mwC.r, min( mwC.g, mwC.b ) );
  float mwSat = ( mwHi - mwLo ) / ( mwHi + 1e-4 );
  float mwLum = dot( mwC, vec3( 0.2126, 0.7152, 0.0722 ) );
  gl_FragColor.rgb = max( mix( vec3( mwLum ), mwC, 1.0 + ${VIBRANCE.toFixed(3)} * ( 1.0 - mwSat ) ), 0.0 );
}
${chunks.tonemapping_fragment}`;
}

patch();

/** Gemeinsame Renderer-Einstellungen für Dorf und Tal. */
export function setupRenderer(gl: THREE.WebGLRenderer) {
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.toneMappingExposure = 1.0;
}
