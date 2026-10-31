import { geoConicConformal, type GeoProjection } from 'd3-geo';

/**
 * Map projection shared by the browser app and the build scripts
 * (scripts/build_relief.mjs imports this file directly).
 *
 * Lambert conformal conic, standard parallels 38°N / 62°N, central meridian 20°E.
 * Conformal → shapes stay true when zooming into an operational area.
 * Output is in "world units" (1 rad = SCALE units); the zoom transform maps
 * world units to screen pixels.
 */
export const PROJECTION = {
  parallels: [38, 62] as [number, number],
  rotate: [-20, 0, 0] as [number, number, number],
  center: [0, 50] as [number, number],
  scale: 3200,
};

/** lon/lat bounds covered by the base data (W, S, E, N). */
export const AOI_BOUNDS: [number, number, number, number] = [-14, 24, 62, 72.5];

export function createProjection(): GeoProjection {
  return geoConicConformal()
    .parallels(PROJECTION.parallels)
    .rotate(PROJECTION.rotate)
    .center(PROJECTION.center)
    .scale(PROJECTION.scale)
    .translate([0, 0])
    .precision(0.3);
}
