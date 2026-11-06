export const TOOL_CATALOG = [
  { id: 'colors', title: 'Colors & Formatting', detail: 'MiniMessage, Legacy, HEX & JSON', keywords: 'color colour colors colours formatting text chat minimessage mini message legacy hex rgb gradient json code' },
  { id: 'builder', title: 'Pack Builder', detail: '', keywords: 'pack builder modrinth mods plugins minecraft' },
];

export function searchTools(query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return TOOL_CATALOG.filter(tool => words.every(word => `${tool.title} ${tool.detail} ${tool.keywords}`.toLowerCase().includes(word)));
}
