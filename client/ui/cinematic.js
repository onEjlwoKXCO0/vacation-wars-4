// Cinematics are films (see film.js): image slots with in-engine pixel-art fallbacks.
import { playFilm, filmLength, preloadFilm, FILMS } from './film.js';

export const CINEMATICS = FILMS;
export const cinematicLength = filmLength;
export { preloadFilm };

/** Play the named film over `root`. Options: offsetMs, maxMs, skippable, crew (sprite specs). */
export function playCinematic(root, name, opts = {}) {
  return playFilm(root, name, opts);
}
