export const PACK_TYPES = {
  plugins: { label: 'Plugins', folder: 'plugins', loaders: ['paper', 'purpur', 'spigot', 'bukkit', 'folia', 'velocity', 'bungeecord'] },
  mods: { label: 'Mods', folder: 'mods', loaders: ['fabric', 'neoforge', 'forge', 'quilt'] },
  resourcepacks: { label: 'Resource packs', folder: 'resourcepacks', loaders: ['minecraft'] },
  datapacks: { label: 'Data packs', folder: 'datapacks', loaders: ['datapack'] },
};
export const LOADERS = { paper: 'Paper', purpur: 'Purpur', spigot: 'Spigot', bukkit: 'Bukkit', folia: 'Folia', velocity: 'Velocity', bungeecord: 'BungeeCord', fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt', minecraft: 'Vanilla', datapack: 'Vanilla' };
export const SOURCES = { modrinth: 'Modrinth', spigot: 'SpigotMC', curseforge: 'CurseForge' };
export const MAX_PACK_ITEMS = 50;
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_PACK_BYTES = 128 * 1024 * 1024;

export function packContext(input) {
  const type = input?.type;
  const mc = String(input?.mc || '');
  const loader = String(input?.loader || '');
  if (!Object.hasOwn(PACK_TYPES, type) || !/^[a-zA-Z0-9][a-zA-Z0-9._+\-]{0,39}$/.test(mc) || !PACK_TYPES[type].loaders.includes(loader)) throw new TypeError('Choose a pack type, Minecraft version and platform.');
  return { type, mc, loader, prerelease: input.prerelease === true || input.prerelease === '1' };
}

export function loadersFor(context) {
  return ({ paper: ['paper', 'spigot', 'bukkit'], purpur: ['purpur', 'paper', 'spigot', 'bukkit'], spigot: ['spigot', 'bukkit'] })[context.loader] || [context.loader];
}

export function validProjectId(source, id) {
  return Object.hasOwn(SOURCES, source) && typeof id === 'string' && (source === 'modrinth' ? /^[A-Za-z0-9_-]{1,80}$/.test(id) : /^[1-9]\d{0,9}$/.test(id));
}

export function projectKey(project) { return `${project.source}:${project.id}`; }

export function safeFilename(value) {
  const name = String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]/g, '_').replace(/\.{2,}/g, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0,180) || 'file';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}

export function safePageUrl(source, value) {
  try {
    const url = new URL(value);
    const hosts = { modrinth: ['modrinth.com'], spigot: ['www.spigotmc.org', 'spigotmc.org'], curseforge: ['www.curseforge.com', 'curseforge.com'] };
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts[source]?.includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export function allowedDownloadUrl(source, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (source === 'modrinth') return url.hostname === 'cdn.modrinth.com' && url.pathname.startsWith('/data/');
    if (source === 'curseforge') return ['edge.forgecdn.net', 'mediafilez.forgecdn.net', 'media.forgecdn.net'].includes(url.hostname) && /^\/files\//.test(url.pathname);
    return source === 'spigot' && ((url.hostname === 'api.spiget.org' && /^\/v2\/resources\/\d+\/versions\/\d+\/download$/.test(url.pathname)) || (url.hostname === 'cdn.spiget.org') || (['spigotmc.org', 'www.spigotmc.org'].includes(url.hostname) && /^\/resources\/(?:[A-Za-z0-9_-]+\.)?\d+\/download$/.test(url.pathname)));
  } catch { return false; }
}

export function mergePackItems(current, incoming) {
  const items = current.map(item => ({ ...item, requiredBy: [...(item.requiredBy || [])] }));
  for (const item of incoming) {
    const existing = items.find(entry => projectKey(entry.project) === projectKey(item.project));
    if (existing && existing.version.id !== item.version.id) throw new Error(`${item.project.title} requires a different version. Remove it before changing versions.`);
    if (existing) { existing.requiredBy = [...new Set([...existing.requiredBy, ...(item.requiredBy || [])])]; existing.direct ||= item.direct; }
    else {
      const sameName = items.find(entry => entry.project.source !== item.project.source && entry.project.title.normalize('NFKC').toLowerCase().trim() === item.project.title.normalize('NFKC').toLowerCase().trim());
      if (sameName) throw new Error(`${item.project.title} is already selected from ${SOURCES[sameName.project.source]}. Use one catalog for this project.`);
      items.push({ ...item, requiredBy: [...(item.requiredBy || [])] });
    }
  }
  if (items.length > MAX_PACK_ITEMS) throw new Error(`A pack can contain up to ${MAX_PACK_ITEMS} projects.`);
  const names = new Set();
  for (const item of items) {
    if (!item.version.filename || item.version.downloadMode === 'manual') continue;
    const name = safeFilename(item.version.filename).toLowerCase();
    if (names.has(name)) throw new Error(`Duplicate filename: ${item.version.filename}. Remove one of the projects.`);
    names.add(name);
  }
  const selected = new Set(items.map(item => projectKey(item.project)));
  for (const item of items) for (const dependency of item.version.dependencies || []) {
    if (dependency.type === 'incompatible' && selected.has(`${item.project.source}:${dependency.projectId}`)) throw new Error(`${item.project.title} conflicts with another selected project.`);
  }
  return items;
}

export function removePackItem(items, key) {
  const target = items.find(item => projectKey(item.project) === key);
  if (!target) return items;
  const dependants = items.filter(item => (target.requiredBy || []).includes(projectKey(item.project)));
  if (dependants.length) throw new Error(`Required by ${dependants.map(item => item.project.title).join(', ')}. Remove those projects first.`);
  let remaining = items.filter(item => projectKey(item.project) !== key);
  let removed = new Set([key]);
  while (removed.size) {
    remaining = remaining.map(item => ({ ...item, requiredBy: (item.requiredBy || []).filter(parent => !removed.has(parent)) }));
    removed = new Set(remaining.filter(item => item.direct === false && !item.requiredBy.length).map(item => projectKey(item.project)));
    remaining = remaining.filter(item => !removed.has(projectKey(item.project)));
  }
  return remaining;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unknown';
  return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

export function downloadPath(item, context) {
  return `/api/builder/download?${new URLSearchParams({ source: item.project.source, project: item.project.id, version: item.version.id, type: context.type, mc: context.mc, loader: context.loader, prerelease: '1' })}`;
}

export function packManifest(name, context, items, outcomes = []) {
  return { format: 'mcstuff-pack', formatVersion: 1, name: name.trim() || 'My Pack', minecraft: context.mc, type: context.type, platform: context.loader, createdAt: new Date().toISOString(), projects: items.map(item => ({ source: item.project.source, projectId: item.project.id, versionId: item.version.id, title: item.project.title, version: item.version.number, filename: item.version.filename, hashes: item.version.hashes, page: item.project.url, requiredBy: item.requiredBy || [], compatibility: item.version.compatibility, ...outcomes.find(outcome => outcome.key === projectKey(item.project)) })) };
}

export function restorePackDraft(value) {
  if (typeof value !== 'string' || value.length > 524288) return null;
  try {
    const draft = JSON.parse(value);
    const context = packContext(draft.context);
    if (draft.schema !== 1 || !Array.isArray(draft.items) || draft.items.length > MAX_PACK_ITEMS || typeof draft.name !== 'string') return null;
    for (const item of draft.items) {
      if (!validProjectId(item.project?.source, item.project?.id) || !validProjectId(item.project.source, item.version?.id) || typeof item.project.title !== 'string' || !safePageUrl(item.project.source, item.project.url) || typeof item.version.filename !== 'string' || !['automatic', 'manual'].includes(item.version.downloadMode) || !Array.isArray(item.requiredBy) || !Array.isArray(item.version.dependencies)) return null;
    }
    return { context, name: draft.name.slice(0,100), items: mergePackItems([], draft.items) };
  } catch { return null; }
}
