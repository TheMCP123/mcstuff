import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { packContext, safeFilename, allowedDownloadUrl, mergePackItems, removePackItem, restorePackDraft, projectKey } from '../public/pack-data.js';
import { crc32, createPackZip, verifyFile } from '../public/pack-zip.js';
import { exportPackZip } from '../public/pack-export.js';

const context={type:'mods',mc:'1.21.11',loader:'fabric'};
const bytes=new Uint8Array([80,75,3,4,1,2,3,4]);
const item=(id,extra={})=>({project:{id,source:'modrinth',title:id,url:`https://modrinth.com/project/${id}`},version:{id:'Version1',number:'1.0',release:'release',filename:`${id}.jar`,size:bytes.length,hashes:{},dependencies:[],downloadMode:'automatic',compatibility:'verified'},direct:true,requiredBy:[],...extra});
function zipEntries(bytes) {
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const entries=[];let offset=0;
  while(data.getUint32(offset,true)===0x04034b50){
    const size=data.getUint32(offset+18,true),nameSize=data.getUint16(offset+26,true),extraSize=data.getUint16(offset+28,true);
    const name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+nameSize));
    const start=offset+30+nameSize+extraSize;
    const content=bytes.slice(start,start+size);
    assert.equal(data.getUint16(offset+6,true),0x800);
    assert.equal(data.getUint32(offset+14,true),crc32(content));
    entries.push({name,content});offset=start+size;
  }
  assert.equal(data.getUint32(offset,true),0x02014b50);
  assert.equal(data.getUint32(bytes.length-22,true),0x06054b50);
  assert.equal(data.getUint16(bytes.length-12,true),entries.length);
  return entries;
}

test('pack filters reject mixed types and filenames stay portable without traversal or device names',()=>{
  assert.deepEqual(packContext(context),{...context,prerelease:false});
  assert.throws(()=>packContext({...context,loader:'paper'}));
  assert.throws(()=>packContext({...context,mc:'../../private'}));
  assert.doesNotMatch(safeFilename('../folder\\file.jar'),/[\\/]|^\./);
  assert.equal(safeFilename('CON.jar'),'_CON.jar');
  assert.equal(safeFilename('мод.jar'),'мод.jar');
});

test('download hosts are limited by source and reject credentials, ports, insecure URLs and private hosts',()=>{
  assert.equal(allowedDownloadUrl('modrinth','https://cdn.modrinth.com/data/abc/file.jar'),true);
  assert.equal(allowedDownloadUrl('curseforge','https://edge.forgecdn.net/files/1/2/file.jar'),true);
  for(const url of ['http://cdn.modrinth.com/data/a.jar','https://cdn.modrinth.com.evil.example/data/a.jar','https://name@cdn.modrinth.com/data/a.jar','https://cdn.modrinth.com:444/data/a.jar','http://127.0.0.1/file.jar'])assert.equal(allowedDownloadUrl('modrinth',url),false,url);
});

test('merging deduplicates dependencies, preserves inputs and rejects version or filename conflicts',()=>{
  const one=item('Root0001'), dep=item('Depend01',{direct:false,requiredBy:['modrinth:Root0001']});
  const items=mergePackItems([one],[dep,{...dep,requiredBy:['modrinth:Another1']}]);
  assert.equal(items.length,2);assert.equal(dep.requiredBy.length,1);assert.equal(items[1].requiredBy.length,2);
  assert.throws(()=>mergePackItems([one],[{...one,version:{...one.version,id:'Version2'}}]),/different version/);
  assert.throws(()=>mergePackItems([one],[{...item('Another1'),version:{...one.version}}]),/Duplicate filename/);
  assert.throws(()=>mergePackItems([one],[{...dep,version:{...dep.version,dependencies:[{type:'incompatible',projectId:'Root0001'}]}}]),/conflicts/);
});

test('dependencies cannot be removed while required and removing a root prunes only orphan automatic dependencies',()=>{
  const root=item('Root0001'), dep=item('Depend01',{direct:false,requiredBy:[projectKey(root.project)]}), explicit=item('Explicit');
  assert.throws(()=>removePackItem([root,dep],projectKey(dep.project)),/Required by/);
  assert.deepEqual(removePackItem([root,dep,explicit],projectKey(root.project)).map(item=>item.project.id),['Explicit']);
});

test('the same project name cannot be silently installed twice from different catalogs',()=>{
  const original=item('Root0001');
  const duplicate=item('123',{project:{id:'123',source:'spigot',title:'root0001',url:'https://www.spigotmc.org/resources/123/'}});
  assert.throws(()=>mergePackItems([original],[duplicate]),/already selected from Modrinth/);
});

test('drafts validate pack context and source URLs instead of restoring arbitrary download links',()=>{
  const draft={schema:1,context,name:'Pack',items:[item('Root0001')]};
  assert.equal(restorePackDraft(JSON.stringify(draft)).items.length,1);
  assert.equal(restorePackDraft(JSON.stringify({...draft,context:{...context,loader:'paper'}})),null);
  assert.equal(restorePackDraft(JSON.stringify({...draft,items:[{...draft.items[0],project:{...draft.items[0].project,url:'javascript:alert(1)'}}]})),null);
});

test('ZIP encoding preserves binary files, UTF-8 names, CRC-32 and central directory counts',()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const archive=createPackZip([{path:'mods/мод.jar',data:bytes},{path:'mcstuff-pack.json',data:'{"ok":true}'}]);
  const entries=zipEntries(archive);
  assert.equal(entries[0].name,'mods/мод.jar');assert.deepEqual(entries[0].content,bytes);
  assert.equal(new TextDecoder().decode(entries[1].content),'{"ok":true}');
});

test('ZIP rejects duplicate paths, traversal, absolute paths and backslashes',()=>{
  for(const path of ['../evil.jar','mods/../evil.jar','/evil.jar','C:/evil.jar','mods\\evil.jar'])assert.throws(()=>createPackZip([{path,data:bytes}]));
  assert.throws(()=>createPackZip([{path:'mods/A.jar',data:bytes},{path:'mods/a.jar',data:bytes}]),/Duplicate/);
});

test('file verification checks real bytes, size and the official hash, rejecting HTML and corruption',async()=>{
  const sha512=crypto.createHash('sha512').update(bytes).digest('hex');
  await verifyFile(bytes,{sha512},bytes.length);
  await assert.rejects(()=>verifyFile(bytes,{sha512:'0'.repeat(128)}),/integrity/);
  await assert.rejects(()=>verifyFile(bytes,{},99),/size/);
  await assert.rejects(()=>verifyFile(new TextEncoder().encode('<html>blocked</html>')),/JAR or ZIP/);
});

test('export includes downloaded files unchanged and lists every missing file instead of claiming a complete pack',async()=>{
  const first=item('Root0001'), manual=item('Manual01',{version:{...item('Manual01').version,downloadMode:'manual'}}), broken=item('Broken01');
  const result=await exportPackZip('Example',context,[first,manual,broken],{fetcher:async url=>url.includes('Broken01')?new Response(JSON.stringify({message:'Blocked'}),{status:403}):new Response(bytes)});
  assert.equal(result.downloaded,1);assert.equal(result.missing.length,2);
  const entries=zipEntries(result.archive);
  assert.deepEqual(entries.find(entry=>entry.name==='mods/Root0001.jar').content,bytes);
  const manifest=JSON.parse(new TextDecoder().decode(entries.find(entry=>entry.name==='mcstuff-pack.json').content));
  assert.deepEqual(manifest.projects.map(project=>project.included),[true,false,false]);
  const instructions=new TextDecoder().decode(entries.find(entry=>entry.name==='MANUAL_DOWNLOADS.txt').content);
  assert.match(instructions,/Manual01/);assert.match(instructions,/Broken01/);assert.match(instructions,/https:\/\/modrinth.com/);
});

test('export cancellation discards pending data and returns no partial archive',async()=>{
  const controller=new AbortController();
  await assert.rejects(()=>exportPackZip('Example',context,[item('Root0001')],{signal:controller.signal,fetcher:async()=>{controller.abort();return new Response(bytes);}}),/abort/i);
});
