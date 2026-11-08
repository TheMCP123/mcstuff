import { iconMarkup } from './icons.js';
import { PACK_TYPES, LOADERS, SOURCES, MAX_PACK_ITEMS, packContext, projectKey, safeFilename, safePageUrl, mergePackItems, removePackItem, formatBytes, packManifest, restorePackDraft } from './pack-data.js';
import { exportPackZip, fetchPackFile } from './pack-export.js';
import { refreshFormControls } from './form-controls.js';

const STORAGE = 'mcstuff-pack-v1';
const state = { type:'plugins', mc:'', loader:'paper', prerelease:false, source:'all', query:'', sort:'relevance', name:'My Pack', items:[], results:[], page:0, hasMore:false, warnings:[], meta:null };
const drafts = new Map();
try {
  const saved = restorePackDraft(localStorage.getItem(STORAGE));
  if (saved) Object.assign(state,saved.context,{name:saved.name,items:saved.items});
} catch { /* A blocked browser store does not prevent building a pack. */ }
const contextKey = () => `${state.type}:${state.mc}:${state.loader}`;

function element(tag,className,text) {
  const node=document.createElement(tag);
  if (className) node.className=className;
  if (text!==undefined) node.textContent=text;
  return node;
}
function sourceLink(project, label) {
  const link=element('a','pack-source-link',label || project.title);
  link.href=safePageUrl(project.source,project.url) || '#builder';
  link.target='_blank'; link.rel='noopener noreferrer';
  return link;
}

export function mountPackBuilder(host) {
  const root=element('section','pack-builder');
  root.innerHTML=`<div class="pack-filters">
    <label class="field">Pack type<select id="pack-type"></select></label>
    <label class="field">Minecraft<select id="pack-minecraft" disabled><option>Loading…</option></select></label>
    <label class="field" id="pack-platform-field">Platform<select id="pack-platform"></select></label>
    <label class="field">Catalog<select id="pack-source"><option value="all">All catalogs</option><option value="modrinth">Modrinth</option><option value="spigot">SpigotMC · Spiget</option><option value="curseforge" disabled>CurseForge · API key required</option></select></label>
  </div>
  <div class="pack-layout">
    <div class="pack-catalog">
      <form class="pack-search" role="search"><div class="pack-search-input">${iconMarkup('search')}<input id="pack-query" type="search" maxlength="100" autocomplete="off" spellcheck="false" aria-label="Search projects" placeholder="Search plugins"><button id="pack-query-clear" type="button" class="control-close" aria-label="Clear project search" hidden>${iconMarkup('close')}</button><button class="action-button" type="submit">Search</button></div>
      <div class="pack-search-options"><label class="pack-prerelease"><input id="pack-prerelease" type="checkbox">Pre-release files</label><label class="pack-sort-label">Sort<select id="pack-sort"><option value="relevance">Relevance</option><option value="downloads">Downloads</option><option value="updated">Recently updated</option></select></label></div></form>
      <div class="pack-catalog-notices" role="status" hidden></div><div id="pack-results" class="pack-results" aria-label="Project results"></div><button id="pack-more" type="button" class="pack-secondary" hidden>Load more</button>
    </div>
    <aside id="pack-selection" class="pack-selection"><button type="button" class="pack-selection-toggle" aria-expanded="true" aria-controls="pack-selection-body"><span>Your pack <span id="pack-count">0</span></span><span id="pack-total"></span>${iconMarkup('chevron')}</button><div id="pack-selection-body" class="pack-selection-body">
      <div class="pack-name-field"><label class="field-label" for="pack-name">Pack name</label><input id="pack-name" type="text" maxlength="100" placeholder="My Pack"></div>
      <p id="pack-empty" class="field-help">Add projects from the catalog.</p><ul id="pack-items"></ul><p id="pack-notes" class="field-help" hidden></p>
      <div class="pack-selection-footer"><div class="pack-actions"><button id="pack-download" type="button" class="action-button" disabled>${iconMarkup('download')}<span>Download ZIP</span></button><div class="pack-export-actions"><button id="pack-export-list" type="button" class="pack-secondary" disabled>Export list</button><button id="pack-clear" class="text-button" type="button" hidden>Clear pack</button></div></div>
      <div id="pack-progress" hidden><progress value="0" max="1" aria-label="Pack download progress"></progress><span class="field-help" role="status"></span><button id="pack-cancel" type="button" class="text-button">Cancel download</button></div><div id="pack-download-result" role="status" hidden></div>
      <p id="pack-status" class="checker-status" role="status" hidden></p></div>
    </div></aside>
  </div>`;
  host.append(root);
  const find=selector=>root.querySelector(selector);
  const type=find('#pack-type'), minecraft=find('#pack-minecraft'), platform=find('#pack-platform'), source=find('#pack-source');
  const query=find('#pack-query'), sort=find('#pack-sort'), prerelease=find('#pack-prerelease'), name=find('#pack-name');
  const status=find('#pack-status'), results=find('#pack-results'), more=find('#pack-more'), selection=find('#pack-selection'), list=find('#pack-items');
  const download=find('#pack-download'), exportList=find('#pack-export-list'), clear=find('#pack-clear'), progress=find('#pack-progress'), outcome=find('#pack-download-result');
  let disposed=false, ready=false, searching=false, adding=false, exporting=false;
  let searchController, addController, downloadController;
  let searchId=0, debounce;
  const urls=new Map();
  const selectionToggle=find('.pack-selection-toggle'), selectionBody=find('#pack-selection-body');
  function expandSelection(expanded){selectionToggle.setAttribute('aria-expanded',String(expanded));selectionBody.hidden=!expanded;selection.classList.toggle('is-collapsed',!expanded);}
  expandSelection(!window.matchMedia('(max-width: 1050px)').matches);
  selectionToggle.addEventListener('click',()=>expandSelection(selectionToggle.getAttribute('aria-expanded')!=='true'));
  for (const [value,config] of Object.entries(PACK_TYPES)) type.append(new Option(config.label,value));
  type.value=state.type; source.value=state.source; query.value=state.query; sort.value=state.sort; prerelease.checked=state.prerelease; name.value=state.name;

  function report(message,error=false) { status.textContent=message; status.hidden=!message; status.classList.toggle('is-error',error);if(message&&error)expandSelection(true); }
  function context() { return packContext(state); }
  function save() {
    if (!state.mc) return;
    drafts.set(contextKey(),state.items);
    try {
      const items=state.items.map(item=>({...item,project:{...item.project,icon:null},version:{...item.version,downloadUrl:undefined,gameVersions:undefined,loaders:undefined}}));
      localStorage.setItem(STORAGE,JSON.stringify({schema:1,context:context(),name:state.name,items}));
    } catch { report('This browser could not save the draft. Export the list to keep a copy.',true); }
  }
  function setAvailability() {
    for (const control of [type,minecraft,platform,prerelease]) control.disabled=!ready || adding || exporting;
    name.disabled=exporting;
    source.disabled=!ready;
    root.querySelector('.pack-search button[type="submit"]').disabled=!ready || searching;
    more.disabled=searching || !ready;
    download.disabled=!state.items.length || !ready || adding || exporting;
    exportList.disabled=!state.items.length || !ready || adding || exporting;
    clear.disabled=adding || exporting;
    for (const button of root.querySelectorAll('.pack-add,.pack-remove,.pack-file-download')) button.disabled=adding || exporting || (button.classList.contains('pack-add') && button.dataset.added==='true');
    for (const select of root.querySelectorAll('.pack-version')) select.disabled=adding || exporting;
    refreshFormControls(host);
  }
  function updateSources() {
    source.querySelector('[value="spigot"]').hidden=state.type!=='plugins';
    const cf=state.meta?.sources.find(item=>item.id==='curseforge');
    const option=source.querySelector('[value="curseforge"]');
    option.disabled=!cf?.enabled;
    option.textContent=cf?.enabled?'CurseForge':'CurseForge · API key required';
    if ((state.source==='spigot' && state.type!=='plugins') || (state.source==='curseforge' && !cf?.enabled)) state.source='all';
    source.value=state.source;
  }
  function updatePlatforms() {
    platform.replaceChildren(...PACK_TYPES[state.type].loaders.map(loader=>new Option(LOADERS[loader],loader)));
    if (!PACK_TYPES[state.type].loaders.includes(state.loader)) state.loader=PACK_TYPES[state.type].loaders[0];
    platform.value=state.loader;
    find('#pack-platform-field').hidden=PACK_TYPES[state.type].loaders.length===1;
    query.placeholder=`Search ${PACK_TYPES[state.type].label.toLowerCase()}`;
    updateSources();
  }
  async function api(path,{signal,body}={}) {
    let response;
    try { response=await fetch(`/api/builder/${path}`,{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},signal:AbortSignal.any([signal || new AbortController().signal,AbortSignal.timeout(60000)]),cache:'no-store',credentials:'omit'}); }
    catch(error) { if (signal?.aborted) throw error; throw new Error('The catalog could not be reached. Try again.'); }
    let data;
    try { data=await response.json(); } catch { throw new Error('The catalog returned an invalid response.'); }
    if (!response.ok) throw new Error(data.message || 'This request could not be completed.');
    return data;
  }
  function showImage(project) {
    if (!project.icon) return null;
    const img=element('img','pack-project-icon');
    img.src=project.icon; img.alt=''; img.loading='lazy'; img.referrerPolicy='no-referrer';
    img.addEventListener('error',()=>img.remove(),{once:true});
    return img;
  }
  function renderResults() {
    results.replaceChildren();
    results.setAttribute('aria-busy',String(searching));
    if (!state.results.length) results.append(element('p','pack-empty-results',searching?'Searching…':ready?'No projects found. Try another Minecraft version or search.':'Loading catalogs…'));
    for (const project of state.results) {
      const article=element('article','pack-result');
      const image=showImage(project);
      if (image) article.append(image);
      const info=element('div','pack-project-info');
      const title=element('h2'); title.append(sourceLink(project)); info.append(title);
      if (project.description) info.append(element('p','pack-description',project.description));
      info.append(element('span','pack-source-name',project.source==='spigot'?'SpigotMC · Spiget':SOURCES[project.source]));
      article.append(info);
      const added=state.items.some(item=>projectKey(item.project)===projectKey(project));
      const button=element('button','pack-add pack-secondary');button.innerHTML=iconMarkup(added?'check':'add');button.append(element('span','',added?'Added':'Add')); button.type='button'; button.dataset.added=String(added); button.setAttribute('aria-label',`${added?'Added':'Add'} ${project.title}`);
      button.addEventListener('click',()=>addProject(project)); article.append(button); results.append(article);
    }
    more.hidden=!state.hasMore;
    const notices=find('.pack-catalog-notices');
    notices.replaceChildren(...state.warnings.map(warning=>element('p','field-help',typeof warning==='string'?warning:`${SOURCES[warning.source]}: ${warning.message}`)));
    notices.hidden=!state.warnings.length;
    setAvailability();
  }
  function renderPack() {
    find('#pack-count').textContent=state.items.length;
    const total=state.items.reduce((sum,item)=>sum+item.version.size,0);
    find('#pack-total').textContent=total?formatBytes(total):'';
    find('#pack-empty').hidden=Boolean(state.items.length);
    list.replaceChildren();
    for (const item of state.items) {
      const row=element('li','pack-item');
      const title=element('div','pack-item-title');
      title.append(sourceLink(item.project));
      const remove=element('button','pack-remove'); remove.innerHTML=iconMarkup('close'); remove.type='button'; remove.setAttribute('aria-label',`Remove ${item.project.title}`);
      remove.addEventListener('click',()=> {try {state.items=removePackItem(state.items,projectKey(item.project)); save(); outcome.hidden=true; renderPack(); renderResults();}catch(error){report(error.message,true);} });
      title.append(remove); row.append(title);
      const choices=Array.isArray(item.choices)?item.choices:[];
      if (choices.length>1 && !(item.requiredBy || []).length) {
        const select=element('select','pack-version'); select.setAttribute('aria-label',`${item.project.title} version`);
        for (const choice of choices) select.append(new Option(`${choice.name}${choice.release!=='release'?` · ${choice.release}`:''}`,choice.id));
        select.value=item.version.id; select.addEventListener('change',()=>addProject(item.project,select.value,item)); row.append(select);
      } else row.append(element('span','pack-item-version',`${item.version.number}${item.version.release!=='release'?` · ${item.version.release}`:''}`));
      const details=element('div','pack-item-meta');
      details.append(element('span','',SOURCES[item.project.source]));
      if (item.version.size) details.append(element('span','',formatBytes(item.version.size)));
      if (!item.direct && item.requiredBy?.length) details.append(element('span','pack-dependency','Required dependency'));
      if (item.version.compatibility==='unverified') details.append(element('span','pack-unverified','Compatibility unverified'));
      row.append(details);
      if (item.version.downloadMode==='manual') row.append(sourceLink(item.project,'Manual download ↗'));
      else { const file=element('button','text-button pack-file-download','Download file'); file.type='button'; file.addEventListener('click',()=>downloadSingle(item)); row.append(file); }
      list.append(row);
    }
    const manual=state.items.filter(item=>item.version.downloadMode==='manual').length;
    const notes=[];
    if (manual) notes.push(`${manual} ${manual===1?'file requires':'files require'} a manual download. Source links are included in the ZIP.`);
    if (state.items.some(item=>item.version.compatibility==='unverified')) notes.push('SpigotMC compatibility and dependencies need manual checking.');
    find('#pack-notes').textContent=notes.join(' '); find('#pack-notes').hidden=!notes.length;
    download.hidden=Boolean(state.items.length && manual===state.items.length);
    clear.hidden=!state.items.length;
    setAvailability();
  }
  async function search(append=false) {
    if (!ready) return;
    clearTimeout(debounce); searchController?.abort();
    searchController=new AbortController();
    const active=++searchId;
    searching=true;
    if (!append) { state.page=0; state.results=[]; state.hasMore=false; state.warnings=[]; }
    report(''); renderResults();
    try {
      const params=new URLSearchParams({...context(),prerelease:state.prerelease?'1':'0',source:state.source,q:state.query,sort:state.sort,page:String(state.page)});
      const data=await api(`search?${params}`,{signal:searchController.signal});
      if (disposed || active!==searchId) return;
      if (!Array.isArray(data.projects)) throw new Error('The catalog returned invalid results.');
      const projects=new Map((append?state.results:[]).map(project=>[projectKey(project),project]));
      for (const project of data.projects) if (safePageUrl(project.source,project.url)) projects.set(projectKey(project),project);
      state.results=[...projects.values()]; state.hasMore=Boolean(data.hasMore); state.warnings=data.warnings || [];
    } catch(error) { if (!disposed && active===searchId && !searchController.signal.aborted) {report(error.message,true); if(append)state.page--; } }
    finally { if (!disposed && active===searchId) {searching=false;renderResults();} }
  }
  async function addProject(project,version,previous) {
    if (adding || exporting) return;
    if (state.items.length>=MAX_PACK_ITEMS && !previous) { report(`A pack can contain up to ${MAX_PACK_ITEMS} projects.`,true);return; }
    adding=true; addController=new AbortController(); report(`Finding files for ${project.title}…`); setAvailability();
    try {
      const data=await api('resolve',{signal:addController.signal,body:{context:context(),source:project.source,project:project.id,version}});
      if (disposed) return;
      if (!Array.isArray(data.items) || !data.items.length) throw new Error('No compatible files were returned.');
      const incoming=data.items.map((item,index)=>({...item,direct:index===0}));
      if (previous) incoming[0].choices=previous.choices;
      const base=previous?removePackItem(state.items,projectKey(previous.project)):state.items;
      state.items=mergePackItems(base,incoming);
      save(); report((data.warnings || []).filter(warning=>!warning.startsWith('SpigotMC')).join(' ')); outcome.hidden=true; renderPack();renderResults();
    } catch(error) { if(!disposed && !addController.signal.aborted) {report(error.message,true);renderPack();} }
    finally {adding=false;if(!disposed)setAvailability();}
  }
  function saveBlob(blob,filename) {
    const url=URL.createObjectURL(blob); const link=element('a'); link.href=url;link.download=filename;link.hidden=true;root.append(link);link.click();link.remove();
    urls.set(url,setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},60000));
  }
  function beginDownload() {
    exporting=true;downloadController=new AbortController();outcome.hidden=true;progress.hidden=false;progress.querySelector('progress').value=0;progress.querySelector('progress').max=1;progress.querySelector('span').textContent='Preparing download…';setAvailability();
  }
  function finishDownload() { exporting=false;if(!disposed){progress.hidden=true;setAvailability();} }
  async function downloadSingle(item) {
    if(exporting || adding) return;
    beginDownload();
    try {
      const file=await fetchPackFile(item,context(),{signal:downloadController.signal});
      if(disposed) return;
      saveBlob(new Blob([file.bytes],{type:'application/octet-stream'}),file.filename);
      outcome.replaceChildren(element('p','field-help',`Download started: ${file.filename}`));outcome.hidden=false;
    } catch(error) {if(!disposed)report(downloadController.signal.aborted?'Download cancelled.':error.message,true);} finally {finishDownload();}
  }
  download.addEventListener('click',async()=> {
    if(exporting || adding || !state.items.length) return;
    beginDownload(); report('');
    try {
      const result=await exportPackZip(state.name,context(),state.items,{signal:downloadController.signal,onProgress:({completed,total,title})=>{if(disposed)return;progress.querySelector('progress').max=total;progress.querySelector('progress').value=completed;progress.querySelector('span').textContent=`${completed} / ${total} · ${title}`;}});
      if(disposed) return;
      outcome.replaceChildren();
      if(result.downloaded) {saveBlob(new Blob([result.archive],{type:'application/zip'}),`${safeFilename(state.name || 'My Pack')}.zip`);outcome.append(element('p','field-help',`ZIP ready: ${result.downloaded} ${result.downloaded===1?'file':'files'} included${result.missing.length?`, ${result.missing.length} need manual downloading`:''}.`));}
      else outcome.append(element('p','field-help','No files could be downloaded. Export the list and use the source links.'));
      for(const item of result.missing) {const row=element('div','pack-missing');row.append(sourceLink(item.project,`${item.project.title} ↗`));outcome.append(row);}
      outcome.hidden=false;
    } catch(error) {if(!disposed)report(downloadController.signal.aborted?'Download cancelled.':error.message,true);} finally {finishDownload();}
  });
  exportList.addEventListener('click',()=>saveBlob(new Blob([JSON.stringify(packManifest(state.name,context(),state.items),null,2)],{type:'application/json'}),`${safeFilename(state.name || 'My Pack')}.json`));
  find('#pack-cancel').addEventListener('click',()=>downloadController?.abort());
  clear.addEventListener('click',()=>{state.items=[];save();report('');outcome.hidden=true;renderPack();renderResults();});
  name.addEventListener('input',()=>{state.name=name.value;save();});
  function changeContext() {
    drafts.set(contextKey(),state.items);
    state.type=type.value; state.mc=minecraft.value;state.loader=platform.value;state.prerelease=prerelease.checked;
    updatePlatforms(); state.items=drafts.get(contextKey()) || []; save();outcome.hidden=true;renderPack();search();
  }
  for(const input of [type,minecraft,platform])input.addEventListener('change',changeContext);
  prerelease.addEventListener('change',()=>{state.prerelease=prerelease.checked;save();search();});
  source.addEventListener('change',()=>{state.source=source.value;search();});
  sort.addEventListener('change',()=>{state.sort=sort.value;search();});
  root.querySelector('.pack-search').addEventListener('submit',event=>{event.preventDefault();state.query=query.value.trim();search();});
  query.addEventListener('input',event=>{state.query=query.value.trim();clearTimeout(debounce);if(!event.isComposing)debounce=setTimeout(()=>search(),350);});
  const clearQuery=find('#pack-query-clear');clearQuery.hidden=!query.value;
  query.addEventListener('input',()=>{clearQuery.hidden=!query.value;});
  clearQuery.addEventListener('click',()=>{query.value='';state.query='';clearQuery.hidden=true;query.focus();search();});
  query.addEventListener('compositionend',()=>{clearTimeout(debounce);debounce=setTimeout(()=>search(),350);});
  more.addEventListener('click',()=>{state.page++;search(true);});
  updatePlatforms();renderPack();renderResults();
  const init=new AbortController();
  async function initialize(){
    try {
      state.meta ||= await api('meta',{signal:init.signal});
      if(disposed) return;
      if(!Array.isArray(state.meta.versions) || !state.meta.versions.length)throw new Error('Minecraft versions could not be loaded.');
      minecraft.replaceChildren(...state.meta.versions.map(version=>new Option(version,version)));
      if(!state.meta.versions.includes(state.mc)) {state.mc=state.meta.versions[0];state.items=[];}
      minecraft.value=state.mc;ready=true;updateSources();renderPack();setAvailability();await search();
    }catch(error){if(!disposed&&!init.signal.aborted){state.meta=null;report(error.message,true);const retry=element('button','pack-secondary','Retry loading catalogs');retry.type='button';retry.addEventListener('click',()=>{report('');results.replaceChildren(element('p','pack-empty-results','Loading catalogs…'));initialize();});results.replaceChildren(retry);}}
  }
  initialize();
  return ()=>{disposed=true;clearTimeout(debounce);init.abort();searchController?.abort();addController?.abort();downloadController?.abort();for(const[url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();};
}
