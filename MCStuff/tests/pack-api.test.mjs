import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBuilderApi } from '../worker/pack-api.js';

const context={type:'mods',mc:'1.21.11',loader:'fabric'};
const rootId='Root0001', depId='Depend01';
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const project=(id=rootId)=>({id,title:id,description:'A real catalog result',loaders:['fabric'],project_type:'mod'});
const version=(id='Version1',projectId=rootId,extra={})=>({id,project_id:projectId,name:id,version_number:id,version_type:'release',date_published:'2026-01-01T00:00:00Z',loaders:['fabric'],game_versions:['1.21.11'],dependencies:[],files:[{filename:'example.jar',url:`https://cdn.modrinth.com/data/${projectId}/versions/${id}/example.jar`,primary:true,size:4,hashes:{}}],...extra});
const get=(path,params={})=>new Request(`https://mcstuff.test/api/builder/${path}?${new URLSearchParams({...context,...params})}`);
const resolve=(extra={},origin)=>new Request('https://mcstuff.test/api/builder/resolve',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({context,source:'modrinth',project:rootId,...extra})});

test('metadata uses current release dates and only reports whether the CurseForge key is configured',async()=>{
  const result=await handleBuilderApi(get('meta'),{},async()=>reply([{version:'1.21.11',version_type:'release',date:'2025-12-01'},{version:'26.3',version_type:'release',date:'2026-09-15'},{version:'snapshot',version_type:'snapshot',date:'2026-11-01'}]));
  const data=await result.json();
  assert.deepEqual(data.versions,['26.3','1.21.11']);
  assert.equal(data.sources.find(source=>source.id==='curseforge').enabled,false);
  assert.equal(JSON.stringify(data).includes('CURSEFORGE_API_KEY='),false);
});

test('search sends exact game version, pack type and loader-family facets to Modrinth',async()=>{
  const response=await handleBuilderApi(get('search',{type:'plugins',loader:'paper',source:'modrinth',q:'permissions'}),{},async(url,options)=>{
    const query=new URL(url).searchParams;
    assert.deepEqual(JSON.parse(query.get('facets')),[['project_type:plugin'],['versions:1.21.11'],['categories:paper','categories:spigot','categories:bukkit']]);
    assert.match(options.headers['User-Agent'],/MCStuff/);
    return reply({hits:[{project_id:rootId,title:'Permissions',description:'description'}],offset:0,total_hits:1});
  });
  assert.equal(response.status,200);
  assert.equal((await response.json()).projects[0].url,`https://modrinth.com/project/${rootId}`);
});

test('one failing catalog leaves the other search results and an explicit source warning',async()=>{
  const response=await handleBuilderApi(get('search',{type:'plugins',loader:'paper'}),{},async url=>url.includes('modrinth.com')?reply({hits:[{project_id:rootId,title:'Example'}],offset:0,total_hits:1}):new Response(null,{status:503}));
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.projects.length,1);
  assert.equal(data.warnings[0].source,'spigot');
});

test('invalid identifiers, filters and cross-origin resolve requests make no upstream calls',async()=>{
  const fetcher=async()=>{throw new Error('Must not fetch');};
  for(const request of [get('search',{source:'other'}),get('versions',{source:'modrinth',project:'../../secrets'}),get('search',{loader:'paper'}),resolve({},'https://evil.example')]) {
    const response=await handleBuilderApi(request,{},fetcher);
    assert.ok([400,403].includes(response.status));
  }
});

test('required dependency versions are resolved and optional dependencies are not silently added',async()=>{
  const calls=[];
  const response=await handleBuilderApi(resolve(),{},async url=>{
    calls.push(url);const path=new URL(url).pathname;
    if(path===`/v2/project/${rootId}`)return reply(project());
    if(path===`/v2/project/${depId}`)return reply(project(depId));
    if(path===`/v2/project/${rootId}/version`)return reply([version('Version1',rootId,{dependencies:[{project_id:depId,version_id:'Version2',dependency_type:'required'},{project_id:'Optional',dependency_type:'optional'}]})]);
    if(path==='/v2/version/Version2')return reply(version('Version2',depId,{files:[{filename:'dependency.jar',url:`https://cdn.modrinth.com/data/${depId}/versions/Version2/dependency.jar`,size:4}]}));
    throw Error('Unexpected URL '+url);
  });
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.deepEqual(data.items.map(item=>item.project.id),[rootId,depId]);
  assert.deepEqual(data.items[1].requiredBy,[`modrinth:${rootId}`]);
  assert.ok(calls.every(url=>!url.includes('Optional')));
});

test('default selection excludes prereleases and refuses files for another game version',async()=>{
  const fetcher=async url=>new URL(url).pathname.endsWith('/version')?reply([version('Beta0001',rootId,{version_type:'beta',date_published:'2026-02-01'}),version(),version('Wrong000',rootId,{game_versions:['1.20.1']})]):reply(project());
  const response=await handleBuilderApi(resolve(),{},fetcher);
  const data=await response.json();
  assert.equal(data.items[0].version.id,'Version1');
  assert.equal(data.items[0].choices.length,1);
  const missing=await handleBuilderApi(resolve({context:{...context,mc:'1.19'}}),{},fetcher);
  assert.equal(missing.status,404);
});

test('Spiget files retain unverified compatibility, and external resources are manual downloads',async()=>{
  const fetcher=async url=>url.endsWith('/versions/latest')?reply({id:20,resource:10,name:'1.0',releaseDate:1700000000}):reply({id:10,name:'Plugin',tag:'description',external:true,premium:false,testedVersions:['1.20'],file:{type:'external'}});
  const response=await handleBuilderApi(resolve({context:{type:'plugins',mc:'26.3',loader:'paper'},source:'spigot',project:'10'}),{},fetcher);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.items[0].version.compatibility,'unverified');
  assert.equal(data.items[0].version.downloadMode,'manual');
  assert.equal(data.warnings.length,1);
});

test('CurseForge refuses searches without a server key and never invents an empty connected catalog',async()=>{
  let calls=0;
  const response=await handleBuilderApi(get('search',{source:'curseforge'}),{},async()=>{calls++;return reply({});});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'source_not_configured');
  assert.equal(calls,0);
});

const cfProject={id:123,gameId:432,classId:6,name:'CF Mod',links:{websiteUrl:'https://www.curseforge.com/minecraft/mc-mods/example'},allowModDistribution:true};
const cfFile={id:456,modId:123,fileName:'example.jar',displayName:'Example 1.0',fileDate:'2026-01-01',releaseType:1,gameVersions:['1.21.11','Fabric'],fileLength:4,downloadUrl:'https://edge.forgecdn.net/files/1234/567/example.jar',hashes:[],dependencies:[]};
function cfFetcher(extra,record=()=>{}) {
  return async(url,options)=>{
    record(url,options);
    const path=new URL(url).pathname;
    if(path==='/v1/categories')return reply({data:[{id:6,slug:'mc-mods',name:'Mods'}]});
    if(path==='/v1/mods/123')return reply({data:{...cfProject,...extra}});
    if(path==='/v1/mods/123/files')return reply({data:[cfFile]});
    if(path==='/v1/mods/123/files/456')return reply({data:cfFile});
    return new Response(new Uint8Array([80,75,3,4]));
  };
}
test('CurseForge class and loader are derived from its API and distribution opt-out stays manual',async()=>{
  const response=await handleBuilderApi(resolve({source:'curseforge',project:'123'}),{CURSEFORGE_API_KEY:'test-key'},cfFetcher({allowModDistribution:false},(url,options)=>{
    assert.equal(options.headers['x-api-key'],'test-key');
    if(new URL(url).pathname==='/v1/mods/123/files')assert.equal(new URL(url).searchParams.get('modLoaderType'),'4');
  }));
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.items[0].version.downloadMode,'manual');
  assert.equal(data.items[0].version.downloadUrl,null);
  assert.equal(JSON.stringify(data).includes('test-key'),false);
});

test('download resolves the canonical file and never forwards the CurseForge key to its CDN',async()=>{
  const calls=[];
  const response=await handleBuilderApi(get('download',{source:'curseforge',project:'123',version:'456'}),{CURSEFORGE_API_KEY:'test-key'},cfFetcher({},(url,options)=>{calls.push(url);if(url.includes('forgecdn.net'))assert.equal(options.headers['x-api-key'],undefined);}));
  assert.equal(response.status,200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array([80,75,3,4]));
  assert.equal(response.headers.get('X-MCStuff-Filename'),'example.jar');
  assert.ok(calls.includes(cfFile.downloadUrl));
});

test('download rejects an external redirect without requesting its host',async()=>{
  const requested=[];
  const response=await handleBuilderApi(get('download',{source:'modrinth',project:rootId,version:'Version1'}),{},async url=>{
    requested.push(url);
    if(url.includes('cdn.modrinth.com'))return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});
    if(new URL(url).pathname===`/v2/project/${rootId}`)return reply(project());
    return reply(version());
  });
  assert.equal(response.status,502);
  assert.ok(requested.every(url=>!url.includes('127.0.0.1')));
});

test('HTML or oversized downloads are errors, never archived as JAR files',async()=>{
  for(const file of [()=>new Response('<html>blocked</html>'),()=>new Response(new Uint8Array([80,75,3,4]),{headers:{'Content-Length':String(65*1024*1024)}})]){
    const response=await handleBuilderApi(get('download',{source:'modrinth',project:rootId,version:'Version1'}),{},async url=>url.includes('cdn.modrinth.com')?file():reply(new URL(url).pathname===`/v2/project/${rootId}`?project():version()));
    assert.ok([502,413].includes(response.status));
  }
});

test('rate limits stop a provider request and API routing preserves HEAD and method restrictions',async()=>{
  let calls=0;
  const limited=await handleBuilderApi(get('search',{source:'modrinth'}),{},async()=>{calls++;return new Response(null,{status:429});});
  assert.equal(limited.status,429);assert.equal(calls,1);
  assert.equal((await handleBuilderApi(new Request('https://mcstuff.test/api/builder/resolve'),{})).status,405);
  const head=await handleBuilderApi(new Request('https://mcstuff.test/api/builder/meta',{method:'HEAD'}),{},async()=>reply([{version:'26.3',version_type:'release',date:'2026-09-15'}]));
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  const missing=await handleBuilderApi(new Request('https://mcstuff.test/api/builder/missing',{method:'HEAD'}));
  assert.equal(missing.status,404);assert.equal(await missing.text(),'');
});
