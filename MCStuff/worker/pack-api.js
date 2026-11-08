import { PACK_TYPES, SOURCES, MAX_FILE_BYTES, packContext, loadersFor, validProjectId, projectKey, safeFilename, safePageUrl, allowedDownloadUrl, mergePackItems } from '../public/pack-data.js';

const MR = 'https://api.modrinth.com/v2';
const SP = 'https://api.spiget.org/v2';
const CF = 'https://api.curseforge.com/v1';
const AGENT = 'MCStuff/0.1.0 (+https://github.com/TheMCP123/mcstuff)';
const PAGE_SIZE = 12;
const CF_LOADERS = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };

class PackError extends Error {
  constructor(status, message, code = 'builder_error') { super(message); this.status = status; this.code = code; }
}
const fail = (status, message, code) => { throw new PackError(status, message, code); };
const text = (value, length = 250) => typeof value === 'string' ? value.slice(0, length) : '';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });

function iconUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && ['cdn.modrinth.com', 'media.forgecdn.net', 'mediafilez.forgecdn.net'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

function hashValues(value) {
  const hashes = {};
  for (const [key, length] of [['sha1', 40], ['sha512', 128]]) if (typeof value?.[key] === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value[key])) hashes[key] = value[key].toLowerCase();
  return hashes;
}

function compatible(version, context) {
  return version.gameVersions.includes(context.mc) && version.loaders.some(loader => loadersFor(context).includes(loader));
}

function adapter(fetcher, env, signal) {
  let requests = 0;
  let cfClasses;
  const memo = new Map();
  async function get(url, source, ttl = 60) {
    if (source === 'curseforge' && !env.CURSEFORGE_API_KEY) fail(503, 'CurseForge is not connected. An API key is required.', 'source_not_configured');
    if (++requests > 44) fail(422, 'This dependency tree is too large. Add its projects in smaller groups.');
    const key = source + url;
    if (!memo.has(key)) memo.set(key, (async () => {
      let response;
      try { response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': AGENT, ...(source === 'curseforge' ? { 'x-api-key': env.CURSEFORGE_API_KEY } : {}) }, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), redirect: 'manual', cf: { cacheTtl: ttl, cacheEverything: true } }); }
      catch { fail(503, `${SOURCES[source]} could not be reached. Try again.`, 'source_unavailable'); }
      if (response.status === 429) fail(429, `${SOURCES[source]} is rate limiting requests. Wait a minute and try again.`, 'rate_limited');
      if (response.status === 404) fail(404, 'This project or version was not found.', 'project_not_found');
      if ([401, 403].includes(response.status) && source === 'curseforge') fail(503, 'CurseForge rejected the configured API key.', 'source_not_configured');
      if (!response.ok) fail(502, `${SOURCES[source]} could not complete this request.`, 'source_error');
      const body = await response.text();
      if (body.length > 4194304) fail(502, 'The catalog returned too much data. Narrow your search.');
      try { return JSON.parse(body); } catch { fail(502, `${SOURCES[source]} returned an invalid response.`); }
    })());
    return memo.get(key);
  }

  async function curseClass(type) {
    cfClasses ||= get(`${CF}/categories?gameId=432&classesOnly=true`, 'curseforge', 3600);
    const response = await cfClasses;
    if (!Array.isArray(response.data)) fail(502, 'CurseForge returned invalid categories.');
    const aliases = { plugins: ['bukkit-plugins', 'bukkit plugins'], mods: ['mc-mods', 'mods'], resourcepacks: ['texture-packs', 'resource-packs', 'resource packs', 'texture packs'], datapacks: ['data-packs', 'datapacks', 'data packs'] }[type];
    const category = response.data.find(item => aliases.includes(String(item.slug).toLowerCase()) || aliases.includes(String(item.name).toLowerCase()));
    if (!Number.isInteger(category?.id)) fail(503, `CurseForge does not expose a ${PACK_TYPES[type].label.toLowerCase()} catalog.`, 'source_unsupported');
    return category.id;
  }

  function mrProject(data, hit = false) {
    const id = String(hit ? data.project_id : data.id);
    if (!validProjectId('modrinth', id) || !data.title) fail(502, 'Modrinth returned an invalid project.');
    return { id, source: 'modrinth', title: text(data.title, 120), description: text(data.description), author: text(data.author, 80), icon: iconUrl(data.icon_url), downloads: Number(data.downloads) || 0, url: `https://modrinth.com/project/${id}` };
  }
  function spProject(data) {
    const id = String(data.id);
    if (!validProjectId('spigot', id) || !data.name) fail(502, 'SpigotMC returned an invalid project.');
    const png = data.icon?.data;
    const icon = typeof png === 'string' && png.length < 131072 && png.startsWith('iVBORw0KGgo') && /^[A-Za-z0-9+/=\r\n]+$/.test(png) ? `data:image/png;base64,${png.replace(/\s/g, '')}` : null;
    return { id, source: 'spigot', title: text(data.name, 120), description: text(data.tag), author: '', icon, downloads: Number(data.downloads) || 0, url: `https://www.spigotmc.org/resources/${id}/`, testedVersions: (data.testedVersions || []).filter(value => typeof value === 'string').slice(0,60) };
  }
  function cfProject(data) {
    const id = String(data.id);
    const url = safePageUrl('curseforge', data.links?.websiteUrl);
    if (!validProjectId('curseforge', id) || data.gameId !== 432 || !data.name || !url) fail(502, 'CurseForge returned an invalid project.');
    return { id, source: 'curseforge', title: text(data.name,120), description: text(data.summary), author: text(data.authors?.map(author => author.name).join(', '),80), icon: iconUrl(data.logo?.thumbnailUrl || data.logo?.url), downloads: Number(data.downloadCount) || 0, url };
  }

  async function search(source, context, query, page, sort) {
    if (source === 'modrinth') {
      const kind = { plugins: 'plugin', mods: 'mod', resourcepacks: 'resourcepack', datapacks: 'datapack' }[context.type];
      const facets = [[`project_type:${kind}`], [`versions:${context.mc}`], loadersFor(context).map(loader => `categories:${loader}`)];
      const params = new URLSearchParams({ query, facets: JSON.stringify(facets), offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE), index: sort === 'updated' ? 'updated' : sort === 'downloads' || !query ? 'downloads' : 'relevance' });
      const data = await get(`${MR}/search?${params}`, source);
      if (!Array.isArray(data.hits)) fail(502, 'Modrinth returned invalid search results.');
      return { projects: data.hits.map(hit => mrProject(hit, true)), hasMore: data.offset + data.hits.length < data.total_hits };
    }
    if (source === 'spigot') {
      if (context.type !== 'plugins') return { projects: [], hasMore: false };
      const params = new URLSearchParams({ size: String(PAGE_SIZE), page: String(page + 1), sort: sort === 'updated' ? '-updateDate' : '-downloads' });
      const data = await get(`${SP}/${query ? `search/resources/${encodeURIComponent(query)}` : 'resources/free'}?${params}`, source);
      if (!Array.isArray(data)) fail(502, 'Spiget returned invalid search results.');
      return { projects: data.filter(project => !project.premium).map(spProject), hasMore: data.length === PAGE_SIZE };
    }
    const classId = await curseClass(context.type);
    const params = new URLSearchParams({ gameId: '432', classId: String(classId), searchFilter: query, gameVersion: context.mc, index: String(page * PAGE_SIZE), pageSize: String(PAGE_SIZE), sortField: sort === 'updated' ? '3' : query && sort !== 'downloads' ? '1' : '6', sortOrder: 'desc' });
    if (context.type === 'mods') params.set('modLoaderType', CF_LOADERS[context.loader]);
    const data = await get(`${CF}/mods/search?${params}`, source);
    if (!Array.isArray(data.data)) fail(502, 'CurseForge returned invalid search results.');
    return { projects: data.data.map(cfProject), hasMore: (data.pagination?.index || 0) + data.data.length < (data.pagination?.totalCount || 0) };
  }

  async function project(source, id, context) {
    if (!validProjectId(source, id)) fail(400, 'Invalid project identifier.');
    if (source === 'modrinth') {
      const data = await get(`${MR}/project/${encodeURIComponent(id)}`, source);
      if (!Array.isArray(data.loaders) || !data.loaders.some(loader => loadersFor(context).includes(loader))) fail(409, 'This project does not support the selected platform.');
      return { project: mrProject(data), raw: data };
    }
    if (source === 'spigot') {
      if (context.type !== 'plugins') fail(400, 'SpigotMC only supplies plugins.');
      const data = await get(`${SP}/resources/${id}`, source);
      if (data.premium) fail(403, 'Premium SpigotMC resources must be downloaded from their source page.');
      return { project: spProject(data), raw: data };
    }
    const [response, classId] = await Promise.all([get(`${CF}/mods/${id}`, source), curseClass(context.type)]);
    if (response.data?.classId !== classId) fail(409, 'This project belongs to a different pack type.');
    return { project: cfProject(response.data), raw: response.data };
  }

  function mrVersion(raw, context, id) {
    if (String(raw.project_id) !== id || !validProjectId('modrinth', String(raw.id)) || !Array.isArray(raw.game_versions) || !Array.isArray(raw.loaders) || !Array.isArray(raw.files)) fail(502, 'Modrinth returned an invalid version.');
    const extension = ['plugins','mods'].includes(context.type) ? '.jar' : '.zip';
    const files = raw.files.filter(file => typeof file.filename === 'string' && file.filename.toLowerCase().endsWith(extension));
    const file = files.find(item => item.primary) || files[0];
    if (!file || !allowedDownloadUrl('modrinth', file.url)) return null;
    return { id: String(raw.id), number: text(raw.version_number,100), name: text(raw.name,120), release: raw.version_type, published: raw.date_published, gameVersions: raw.game_versions, loaders: raw.loaders, filename: safeFilename(file.filename), size: Number(file.size) || 0, hashes: hashValues(file.hashes), downloadUrl: file.url, downloadMode: 'automatic', compatibility: 'verified', dependencies: (raw.dependencies || []).map(dep => ({ projectId: dep.project_id || null, versionId: dep.version_id || null, type: dep.dependency_type, filename: text(dep.file_name,120) })) };
  }
  function cfVersion(raw, context, id, projectData) {
    if (String(raw.modId) !== id || !Number.isInteger(raw.id) || !Array.isArray(raw.gameVersions)) fail(502, 'CurseForge returned an invalid file.');
    const extension = ['plugins','mods'].includes(context.type) ? '.jar' : '.zip';
    if (!raw.fileName?.toLowerCase().endsWith(extension)) return null;
    const hashes = hashValues({ sha1: raw.hashes?.find(hash => hash.algo === 1)?.value });
    const automatic = projectData.allowModDistribution !== false && allowedDownloadUrl('curseforge', raw.downloadUrl);
    return { id: String(raw.id), number: text(raw.displayName || raw.fileName,100), name: text(raw.displayName || raw.fileName,120), release: ({1:'release',2:'beta',3:'alpha'})[raw.releaseType] || 'alpha', published: raw.fileDate, gameVersions: raw.gameVersions, loaders: context.type === 'mods' ? Object.keys(CF_LOADERS).filter(loader => raw.gameVersions.some(value => value.toLowerCase() === loader)) : [context.loader], filename: safeFilename(raw.fileName), size: Number(raw.fileLength) || 0, hashes, downloadUrl: automatic ? raw.downloadUrl : null, downloadMode: automatic ? 'automatic' : 'manual', compatibility: 'verified', dependencies: (raw.dependencies || []).filter(dep => [3,5].includes(dep.relationType)).map(dep => ({ projectId: String(dep.modId), versionId: null, type: dep.relationType === 3 ? 'required' : 'incompatible' })) };
  }

  async function versions(source, data, context, exact) {
    const id = data.project.id;
    if (exact && !validProjectId(source, exact)) fail(400, 'Invalid version identifier.');
    let result;
    if (source === 'modrinth') {
      const params = new URLSearchParams({ game_versions: JSON.stringify([context.mc]), loaders: JSON.stringify(loadersFor(context)), include_changelog: 'false' });
      const response = await get(exact ? `${MR}/version/${exact}` : `${MR}/project/${id}/version?${params}`, source);
      if (!exact && !Array.isArray(response)) fail(502, 'Modrinth returned invalid versions.');
      result = (exact ? [response] : response).map(raw => mrVersion(raw, context, id)).filter(Boolean);
    } else if (source === 'spigot') {
      const response = await get(`${SP}/resources/${id}/versions/${exact || 'latest'}`, source);
      if (!response.id || String(response.resource) !== id) fail(502, 'Spiget returned an invalid version.');
      const automatic = !data.raw.external && data.raw.file?.type === '.jar';
      result = [{ id: String(response.id), name: text(response.name,120), number: text(response.name,100), release: 'release', published: new Date(Number(response.releaseDate) * 1000).toISOString(), gameVersions: data.project.testedVersions, loaders: [context.loader], filename: safeFilename(`${data.project.title}-${response.name}.jar`), size: 0, hashes: {}, downloadMode: automatic ? 'automatic' : 'manual', downloadUrl: automatic ? `${SP}/resources/${id}/versions/${response.id}/download` : null, compatibility: 'unverified', dependencies: [] }];
    } else {
      const params = new URLSearchParams({ gameVersion: context.mc, pageSize: '50' });
      if (context.type === 'mods') params.set('modLoaderType', CF_LOADERS[context.loader]);
      const response = await get(`${CF}/mods/${id}/files${exact ? `/${exact}` : `?${params}`}`, source);
      if (!exact && !Array.isArray(response.data)) fail(502, 'CurseForge returned invalid files.');
      result = (exact ? [response.data] : response.data).map(raw => cfVersion(raw,context,id,data.raw)).filter(Boolean);
    }
    result = result.filter(version => (version.compatibility === 'unverified' || compatible(version,context)) && (exact || context.prerelease || version.release === 'release')).sort((a,b) => Date.parse(b.published) - Date.parse(a.published));
    if (exact) result = result.filter(version => version.id === exact);
    if (!result.length) fail(404, 'No compatible file was found for this Minecraft version and platform.', 'no_compatible_version');
    return result.slice(0,60);
  }

  return { get, search, project, versions };
}

async function resolve(api, reference, context) {
  const items = new Map();
  const warnings = new Set();
  const visiting = new Set();
  async function visit(source, projectId, versionId, parent = null, depth = 0) {
    if (depth > 8) fail(422, 'This dependency tree is too large. Add its projects in smaller groups.');
    if (!projectId && source === 'modrinth' && versionId) {
      const pinned = await api.get(`${MR}/version/${encodeURIComponent(versionId)}`, source);
      projectId = String(pinned.project_id);
    }
    const data = await api.project(source, projectId, context);
    const key = projectKey(data.project);
    if (items.has(key)) {
      const item = items.get(key);
      if (versionId && item.version.id !== versionId) fail(409, `Conflicting dependency versions for ${data.project.title}.`);
      if (visiting.has(key)) fail(409, `Circular dependency detected for ${data.project.title}.`);
      if (parent) item.requiredBy = [...new Set([...item.requiredBy,parent])];
      return;
    }
    if (items.size >= 16) fail(422, 'This dependency tree is too large. Add its projects in smaller groups.');
    const available = await api.versions(source, data, context, versionId);
    const [version] = available;
    items.set(key, { project: data.project, version, choices: depth === 0 ? available.map(version => ({id:version.id,name:version.name,release:version.release})) : [], requiredBy: parent ? [parent] : [] });
    visiting.add(key);
    if (source === 'spigot') warnings.add('SpigotMC does not provide per-file compatibility or dependency data. Check its source page.');
    for (const dep of version.dependencies) {
      if (dep.type !== 'required') continue;
      if (!dep.projectId && !dep.versionId) fail(422, `${data.project.title} requires an external file${dep.filename ? `: ${dep.filename}` : ''}. Add it manually before using this pack.`);
      await visit(source,dep.projectId,dep.versionId,key,depth+1);
    }
    visiting.delete(key);
  }
  await visit(reference.source,reference.project,reference.version || null);
  return { items: mergePackItems([], [...items.values()]), warnings: [...warnings] };
}

async function binaryDownload(item, fetcher, signal) {
  const { project, version } = item;
  if (version.downloadMode !== 'automatic') fail(409, 'The author requires downloading this file from its source page.', 'manual_download');
  let url = version.downloadUrl;
  let response;
  for (let redirects = 0; redirects <= 4; redirects++) {
    if (!allowedDownloadUrl(project.source,url)) fail(502, 'The source returned an unsupported download host.', 'manual_download');
    try { response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.any([signal,AbortSignal.timeout(30000)]), headers: { 'User-Agent': AGENT, Accept: 'application/octet-stream' } }); }
    catch { fail(503, 'The file could not be downloaded. Open its source page to download it manually.', 'manual_download'); }
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirects === 4) fail(502, 'The download redirected too many times.', 'manual_download');
      url = new URL(location,url).href;
      continue;
    }
    break;
  }
  if (response.status === 429) fail(429, 'The source is rate limiting downloads. Try again later.', 'rate_limited');
  if (!response.ok || !response.body) fail(502, 'The source blocked this download. Open its source page to download it manually.', 'manual_download');
  if (Number(response.headers.get('content-length')) > MAX_FILE_BYTES || version.size > MAX_FILE_BYTES) { await response.body.cancel(); fail(413, 'This file exceeds the 64 MB download limit. Download it from its source page.', 'manual_download'); }
  const reader = response.body.getReader();
  let first = await reader.read();
  while (!first.done && first.value.length < 4) {
    const next = await reader.read();
    if (next.done) break;
    const joined = new Uint8Array(first.value.length + next.value.length);
    joined.set(first.value); joined.set(next.value,first.value.length);
    first = { done: false, value: joined };
  }
  if (first.done || first.value[0] !== 0x50 || first.value[1] !== 0x4b || first.value[2] !== 3 || first.value[3] !== 4) { await reader.cancel(); fail(502, 'The source did not return a JAR or ZIP. Download this item from its source page.', 'manual_download'); }
  let transferred = first.value.length;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(first.value); },
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) { controller.close(); return; }
        transferred += next.value.length;
        if (transferred > MAX_FILE_BYTES) { await reader.cancel(); controller.error(new Error('Download size limit exceeded')); return; }
        controller.enqueue(next.value);
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return new Response(body, { headers: { 'Content-Type': version.filename.endsWith('.jar') ? 'application/java-archive' : 'application/zip', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(version.filename)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-MCStuff-Filename': encodeURIComponent(version.filename), 'X-MCStuff-Size': String(version.size), ...(version.hashes.sha1 ? {'X-MCStuff-SHA1':version.hashes.sha1} : {}), ...(version.hashes.sha512 ? {'X-MCStuff-SHA512':version.hashes.sha512} : {}) } });
}

export async function handleBuilderApi(request, env = {}, fetcher = fetch) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/builder\/?/, '');
  if (!['GET','HEAD','POST'].includes(request.method) || (request.method === 'POST' && path !== 'resolve') || (path === 'resolve' && request.method !== 'POST')) return new Response(null,{status:405,headers:{Allow:path === 'resolve'?'POST':'GET, HEAD'}});
  try {
    const api = adapter(fetcher,env,AbortSignal.any([request.signal,AbortSignal.timeout(45000)]));
    let response;
    if (path === 'meta') {
      const tags = await api.get(`${MR}/tag/game_version`,'modrinth',3600);
      if (!Array.isArray(tags)) fail(502,'The Minecraft version list could not be loaded.');
      const versions = tags.filter(tag=>tag.version_type==='release' && /^[a-zA-Z0-9._+\-]{1,40}$/.test(tag.version)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).map(tag=>tag.version);
      if (!versions.length) fail(502,'No Minecraft versions were returned.');
      response = json({ versions, sources: [{id:'modrinth',enabled:true},{id:'spigot',enabled:true},{id:'curseforge',enabled:Boolean(env.CURSEFORGE_API_KEY),reason:env.CURSEFORGE_API_KEY?null:'API key required'}] });
    } else if (path === 'search') {
      const context = packContext(Object.fromEntries(url.searchParams));
      const query = (url.searchParams.get('q') || '').trim();
      const source = url.searchParams.get('source') || 'all';
      const page = Number(url.searchParams.get('page') || 0);
      const sort = url.searchParams.get('sort') || 'relevance';
      if (query.length>100 || !Number.isInteger(page) || page<0 || page>100 || !['relevance','downloads','updated'].includes(sort) || (source!=='all' && !Object.hasOwn(SOURCES,source))) fail(400,'Invalid search filters.');
      const sources = source === 'all' ? ['modrinth',...(context.type==='plugins'?['spigot']:[]),...(env.CURSEFORGE_API_KEY?['curseforge']:[])] : [source];
      const results = await Promise.allSettled(sources.map(source=>api.search(source,context,query,page,sort)));
      const projects = [];
      const warnings = [];
      let hasMore = false;
      for (const [index,result] of results.entries()) {
        if (result.status==='fulfilled') { result.value.projects.forEach((project,rank)=>projects.push({...project,rank})); hasMore ||= result.value.hasMore; }
        else warnings.push({source:sources[index],message:result.reason.message});
      }
      if (results.every(result=>result.status==='rejected')) throw results[0].reason;
      projects.sort((a,b)=>a.rank-b.rank);
      response = json({projects:projects.map(({rank,...project})=>project),hasMore,warnings,page});
    } else if (path === 'versions' || path === 'download') {
      const context = packContext(Object.fromEntries(url.searchParams));
      const source = url.searchParams.get('source');
      const projectId = url.searchParams.get('project');
      const versionId = url.searchParams.get('version');
      const data = await api.project(source,projectId,context);
      const versions = await api.versions(source,data,context,path==='download'?versionId:null);
      if (path==='download' && !versionId) fail(400,'Choose a file version to download.');
      response = path==='download' ? await binaryDownload({project:data.project,version:versions[0]},fetcher,request.signal) : json({project:data.project,versions,warnings:source==='spigot'?['Spiget provides the latest file only; compatibility and dependencies are not verified.']:[]});
    } else if (path === 'resolve') {
      if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) fail(403,'Cross-origin requests are not supported.');
      if (Number(request.headers.get('content-length'))>16384) fail(413,'The request is too large.');
      const body = await request.text();
      if (body.length>16384) fail(413,'The request is too large.');
      let data;
      try { data=JSON.parse(body); } catch { fail(400,'Invalid pack request.'); }
      const context = packContext(data.context);
      if (!validProjectId(data.source,data.project) || (data.version && !validProjectId(data.source,data.version))) fail(400,'Invalid project or version identifier.');
      response = json(await resolve(api,data,context));
    } else fail(404,'Pack Builder route not found.');
    return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
  } catch (error) {
    const response = json({ error:error.code || 'builder_error',message:error instanceof TypeError?'Choose valid pack filters.':error instanceof PackError?error.message:'The catalog request could not be completed. Try again.' }, error instanceof TypeError?400:error.status || 502);
    return request.method === 'HEAD' ? new Response(null,{status:response.status,headers:response.headers}) : response;
  }
}
