// Original Lucide 1.70.0 paths, vendored in /icons/lucide.svg (ISC / MIT).
const names = {
  package: 'package-plus', palette: 'palette', skin: 'scan-face', waypoint: 'map-pin',
  namecheck: 'user-round-check', menu: 'menu', search: 'search', close: 'x', reset: 'rotate-ccw',
  chevron: 'chevron-down', check: 'check', add: 'plus', download: 'download',
  sun: 'sun', moon: 'moon',
  bedrock: 'scan-search',
};

export function iconMarkup(name) {
  const id = names[name];
  if (!id) throw new TypeError('Unknown icon');
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="/icons/lucide.svg#${id}"></use></svg>`;
}
