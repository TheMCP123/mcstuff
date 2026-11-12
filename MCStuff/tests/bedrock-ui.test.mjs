import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { Worker as Thread } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { mountBedrockTool } from '../public/bedrock-tool.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/bedrock-26.3.json',import.meta.url),'utf8')).seeds[3];
const until=async predicate=>{const timeout=Date.now()+4000;while(!predicate()){if(Date.now()>timeout)throw new Error('UI search timed out');await new Promise(resolve=>setTimeout(resolve,5));}};

function setup(t) {
  const window=new Window({url:'http://localhost/'}), active=new Set(), terminations=[];
  let copied='',blocked=false;
  class BrowserWorker {
    constructor(url,options) {
      assert.ok(String(url).endsWith('/public/bedrock-worker.js'));assert.equal(options.type,'module');
      this.thread=new Thread(new URL('../scripts/bedrock-test-worker.mjs',import.meta.url));active.add(this);
      this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',event=>this.onerror?.(event));
    }
    postMessage(message){this.thread.postMessage(message);}
    terminate(){if(this.closed)return;this.closed=true;active.delete(this);terminations.push(this.thread.terminate());}
  }
  const globals={window,document:window.document,navigator:{clipboard:{writeText:async text=>{if(blocked)throw new Error('Clipboard denied');copied=text;}}},Worker:BrowserWorker,AbortController:window.AbortController};
  const previous=new Map();for(const[key,value]of Object.entries(globals)){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  const host=window.document.createElement('main');window.document.body.append(host);
  const dispose=mountBedrockTool(host), find=selector=>host.querySelector(selector);
  t.after(async()=>{dispose();for(const worker of active)worker.terminate();await Promise.all(terminations);window.close();for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const set=(selector,value,type='input')=>{find(selector).value=value;find(selector).dispatchEvent(new window.Event(type,{bubbles:true}));};
  return {window,host,find,set,dispose,active,blockClipboard:()=>{blocked=true;copied='';},get copied(){return copied;}};
}

test('editor provides 100 accessible cells, exact brushes, clear/fill and one keyboard tab stop',t=>{
  const ui=setup(t), cells=[...ui.host.querySelectorAll('[role=gridcell]')];
  assert.equal(cells.length,100);assert.equal(ui.host.querySelectorAll('[role=row]').length,10);
  assert.equal(ui.find('#bedrock-layer').value,'-61');assert.equal(ui.find('#bedrock-find').disabled,true);
  ui.find('#bedrock-fill').click();assert.equal(ui.find('#bedrock-known').textContent,'100 / 100 known');assert.ok(cells.every(cell=>cell.dataset.state==='2'));
  ui.find('#bedrock-clear').click();assert.equal(ui.find('#bedrock-known').textContent,'0 / 100 known');
  ui.find('.bedrock-brush[data-state="1"]').click();cells[0].click();assert.equal(cells[0].dataset.state,'1');assert.match(cells[0].getAttribute('aria-label'),/Row 1, column 1: Bedrock/);
  ui.find('.bedrock-brush[data-state="2"]').click();cells[0].click();assert.equal(cells[0].dataset.state,'2');
  ui.find('.bedrock-brush[data-state="0"]').click();cells[0].click();assert.equal(cells[0].dataset.state,'0');
  cells[0].focus();cells[0].dispatchEvent(new ui.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(ui.window.document.activeElement,cells[1]);assert.equal(cells.filter(cell=>cell.tabIndex===0).length,1);
  cells[1].dispatchEvent(new ui.window.KeyboardEvent('keydown',{key:'End',ctrlKey:true,bubbles:true}));assert.equal(ui.window.document.activeElement,cells[99]);
});

test('painting a vanilla fixture in the editor produces and copies actual Worker coordinates',async t=>{
  const ui=setup(t), cells=[...ui.host.querySelectorAll('.bedrock-cell')];
  ui.find('#bedrock-fill').click();ui.find('.bedrock-brush[data-state="1"]').click();
  for(const[index,value]of fixture.pattern.rows.join('').split('').entries())if(value==='B')cells[index].click();
  ui.set('#bedrock-seed',fixture.seed);ui.set('#bedrock-layer','-61','change');ui.set('#bedrock-x','1036');ui.set('#bedrock-z','-966');ui.set('#bedrock-radius','12');
  assert.equal(ui.find('#bedrock-find').disabled,false);
  ui.find('form').dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(ui.find('#bedrock-seed').disabled,true);assert.equal(ui.find('#bedrock-stop').hidden,false);
  await until(()=>ui.find('#bedrock-status').textContent.startsWith('Search complete.'));
  const rows=ui.host.querySelectorAll('.bedrock-results tbody tr');assert.equal(rows.length,1);
  assert.deepEqual([...rows[0].querySelectorAll('td')].slice(0,4).map(cell=>cell.textContent),['1036','-61','-966','0°']);
  assert.equal(ui.find('#bedrock-seed').disabled,false);assert.equal(ui.active.size,0);
  rows[0].querySelector('button').click();await until(()=>ui.copied.length>0);assert.equal(ui.copied,'1036 -61 -966');
  ui.blockClipboard();rows[0].querySelector('button').click();await until(()=>ui.find('.bedrock-manual-copy'));
  assert.equal(ui.find('.bedrock-manual-copy').value,'1036 -61 -966');assert.equal(ui.find('.bedrock-manual-copy').readOnly,true);assert.match(ui.find('.copy-feedback').textContent,/blocked/);
  ui.set('#bedrock-x','1037');assert.equal(ui.find('.bedrock-results').hidden,true);assert.equal(ui.host.querySelectorAll('.bedrock-results tbody tr').length,0);
});

test('Stop and leaving the tool terminate the Worker and preserve an honest incomplete status',async t=>{
  const ui=setup(t);ui.find('#bedrock-fill').click();ui.set('#bedrock-seed','12345');ui.set('#bedrock-x','0');ui.set('#bedrock-z','0');ui.set('#bedrock-radius','8192');
  ui.find('form').dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(ui.active.size,1);ui.find('#bedrock-stop').click();assert.equal(ui.active.size,0);assert.match(ui.find('#bedrock-status').textContent,/incomplete/);assert.equal(ui.find('#bedrock-seed').disabled,false);
  ui.find('form').dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(ui.active.size,1);ui.dispose();assert.equal(ui.active.size,0);
  const replacement=ui.window.document.createElement('main');ui.window.document.body.replaceChildren(replacement);const disposeAgain=mountBedrockTool(replacement);t.after(disposeAgain);
  assert.match(replacement.querySelector('#bedrock-status').textContent,/Stopped when leaving/);
  await new Promise(resolve=>setTimeout(resolve,25));assert.match(replacement.querySelector('#bedrock-status').textContent,/Stopped when leaving/);
});
