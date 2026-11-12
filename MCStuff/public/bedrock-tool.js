import { iconMarkup } from './icons.js';
import { refreshFormControls } from './form-controls.js';
import { GRID_SIZE,CELL_NAMES,MIN_KNOWN,MAX_RADIUS,MAX_MATCHES,normalizeSearch } from './bedrock-data.js';

const state = {seed:'',layer:-61,centerX:'0',centerZ:'0',radius:'512',allRotations:true,brush:1,pattern:Array(100).fill(0),matches:[],report:null};
const number = value=>value.toLocaleString('en-US');
const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};

export function mountBedrockTool(host) {
  const root=node('div','bedrock-tool');
  root.innerHTML=`<form class="bedrock-form" autocomplete="off">
    <div class="bedrock-config">
      <label class="field">World seed<input id="bedrock-seed" type="text" inputmode="numeric" maxlength="21" spellcheck="false" placeholder="Numeric Java seed"></label>
      <label class="field">Layer<select id="bedrock-layer"><option value="-63">Y −63 · 1 above base</option><option value="-62">Y −62 · 2 above base</option><option value="-61">Y −61 · 3 above base</option><option value="-60">Y −60 · 4 above base</option></select></label>
    </div>
    <p class="bedrock-support">Vanilla Java 1.21.11 / 26.3 · Overworld · Flat base at Y −64</p>
    <div class="bedrock-workspace">
      <section class="bedrock-editor" aria-labelledby="bedrock-pattern-title">
        <div class="bedrock-section-heading"><h2 id="bedrock-pattern-title">Pattern <span>10 × 10</span></h2><span id="bedrock-known"></span></div>
        <div class="bedrock-brushes" role="group" aria-label="Paint block type"></div>
        <div class="bedrock-direction" aria-hidden="true"><span>North ↑</span><span>East →</span></div>
        <div class="bedrock-grid" role="grid" aria-label="10 by 10 bedrock pattern" aria-rowcount="10" aria-colcount="10" aria-describedby="bedrock-pattern-help"></div>
        <div class="bedrock-grid-actions"><button type="button" class="text-button" id="bedrock-fill">Fill other</button><button type="button" class="text-button" id="bedrock-clear">Clear pattern</button></div>
        <p class="field-help" id="bedrock-pattern-help">Paint one horizontal layer of unmodified vanilla terrain. Unknown cells are ignored. Mark at least ${MIN_KNOWN} known cells.</p>
      </section>
      <section class="bedrock-search-panel" aria-labelledby="bedrock-area-title">
        <h2 id="bedrock-area-title">Search area</h2>
        <div class="bedrock-center"><label class="field">Center X<input id="bedrock-x" type="text" inputmode="numeric" maxlength="10" spellcheck="false"></label><label class="field">Center Z<input id="bedrock-z" type="text" inputmode="numeric" maxlength="10" spellcheck="false"></label></div>
        <label class="field bedrock-radius">Radius in blocks<input id="bedrock-radius" type="text" inputmode="numeric" maxlength="5" spellcheck="false"></label>
        <p class="field-help">Searches a square around the center. Maximum radius: ${number(MAX_RADIUS)} blocks.</p>
        <label class="bedrock-rotation"><input id="bedrock-rotations" type="checkbox">Check all four rotations</label>
        <div class="bedrock-search-actions"><button type="submit" class="action-button" id="bedrock-find">${iconMarkup('bedrock')}<span>Find coordinates</span></button><button type="button" class="pack-secondary" id="bedrock-stop" hidden>Stop</button></div>
        <p id="bedrock-error" class="field-error" role="alert" hidden></p>
        <div class="bedrock-progress" hidden><progress id="bedrock-progress" max="1" value="0" aria-label="Search progress"></progress><p class="field-help" id="bedrock-progress-text"></p></div>
        <p class="bedrock-search-status" id="bedrock-status" role="status" hidden></p>
      </section>
    </div></form>
    <section class="bedrock-results" aria-labelledby="bedrock-results-title" hidden><div class="bedrock-section-heading"><h2 id="bedrock-results-title">Matches <span id="bedrock-match-count"></span></h2></div><p class="field-help">X/Z mark the northwest corner of the 10 × 10 area. Rotation is clockwise from the grid above.</p><div class="reference-scroll"><table class="bedrock-results-table"><thead><tr><th scope="col">X</th><th scope="col">Y</th><th scope="col">Z</th><th scope="col">Rotation</th><th scope="col"><span class="sr-only">Copy</span></th></tr></thead><tbody></tbody></table></div></section>
    <p class="copy-feedback" role="status" aria-live="polite" hidden></p>`;
  host.append(root);
  const find=selector=>root.querySelector(selector);
  const seed=find('#bedrock-seed'),layer=find('#bedrock-layer'),centerX=find('#bedrock-x'),centerZ=find('#bedrock-z'),radius=find('#bedrock-radius'),rotations=find('#bedrock-rotations');
  const grid=find('.bedrock-grid'), counter=find('#bedrock-known'), submit=find('#bedrock-find'), stop=find('#bedrock-stop'), error=find('#bedrock-error'), status=find('#bedrock-status'), progress=find('.bedrock-progress'), resultSection=find('.bedrock-results'), resultBody=find('.bedrock-results tbody'), feedback=find('.copy-feedback');
  const events=new AbortController();
  let worker=null,running=false,disposed=false,pointer=null,lastPaint=-1,focusCell=0,feedbackTimer,manualCopy=null;
  const cells=[],brushes=[];
  seed.value=state.seed;layer.value=String(state.layer);centerX.value=state.centerX;centerZ.value=state.centerZ;radius.value=state.radius;rotations.checked=state.allRotations;

  function ready() {
    const known=state.pattern.filter(Boolean).length;
    counter.textContent=`${known} / 100 known`;
    submit.disabled=running||known<MIN_KNOWN||!seed.value.trim();
    stop.hidden=!running;
    for(const control of root.querySelectorAll('.bedrock-form input,.bedrock-form select,.bedrock-brush,.bedrock-grid-actions button,.bedrock-cell'))control.disabled=running;
    refreshFormControls(host);
  }
  function showError(message=''){error.textContent=message;error.hidden=!message;}
  function drawCell(index) {
    const button=cells[index],value=state.pattern[index];
    button.dataset.state=String(value);button.textContent=['?','B','·'][value];
    button.setAttribute('aria-label',`Row ${Math.floor(index/GRID_SIZE)+1}, column ${index%GRID_SIZE+1}: ${CELL_NAMES[value]}`);
  }
  function clearResults() {
    manualCopy?.remove();manualCopy=null;
    state.matches=[];state.report=null;resultSection.hidden=true;resultBody.replaceChildren();progress.hidden=true;status.hidden=true;showError();
  }
  function focus(index) {cells[focusCell].tabIndex=-1;focusCell=index;cells[index].tabIndex=0;cells[index].focus({preventScroll:true});}
  function paint(index) {
    if(running||state.pattern[index]===state.brush)return;
    state.pattern[index]=state.brush;drawCell(index);clearResults();ready();
  }
  for(const value of [1,2,0]) {
    const button=node('button','bedrock-brush',CELL_NAMES[value]);button.type='button';button.dataset.state=String(value);button.setAttribute('aria-pressed',String(state.brush===value));
    button.addEventListener('click',()=>{state.brush=value;for(const brush of brushes)brush.setAttribute('aria-pressed',String(Number(brush.dataset.state)===value));},{signal:events.signal});
    find('.bedrock-brushes').append(button);brushes.push(button);
  }
  for(let z=0;z<GRID_SIZE;z++) {
    const row=node('div','bedrock-grid-row');row.setAttribute('role','row');
    for(let x=0;x<GRID_SIZE;x++) {
      const index=z*GRID_SIZE+x,button=node('button','bedrock-cell');button.type='button';button.dataset.cell=String(index);button.tabIndex=index===0?0:-1;button.setAttribute('role','gridcell');button.setAttribute('aria-rowindex',String(z+1));button.setAttribute('aria-colindex',String(x+1));cells.push(button);drawCell(index);row.append(button);
    }
    grid.append(row);
  }
  grid.addEventListener('pointerdown',event=>{
    const button=event.target.closest('.bedrock-cell');if(!button||running||event.button!==0)return;
    event.preventDefault();pointer=event.pointerId;lastPaint=Number(button.dataset.cell);focus(lastPaint);paint(lastPaint);grid.setPointerCapture(pointer);
  },{signal:events.signal});
  grid.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointer||running)return;
    const button=document.elementFromPoint(event.clientX,event.clientY)?.closest('.bedrock-cell');
    if(!button||!grid.contains(button))return;
    const index=Number(button.dataset.cell);if(index!==lastPaint){paint(index);lastPaint=index;}
  },{signal:events.signal});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])grid.addEventListener(type,()=>{pointer=null;lastPaint=-1;},{signal:events.signal});
  grid.addEventListener('click',event=>{const button=event.target.closest('.bedrock-cell');if(button&&event.detail===0)paint(Number(button.dataset.cell));},{signal:events.signal});
  grid.addEventListener('keydown',event=>{
    const button=event.target.closest('.bedrock-cell');if(!button)return;
    const index=Number(button.dataset.cell),x=index%10,z=Math.floor(index/10);
    const targets={ArrowLeft:z*10+Math.max(0,x-1),ArrowRight:z*10+Math.min(9,x+1),ArrowUp:Math.max(0,z-1)*10+x,ArrowDown:Math.min(9,z+1)*10+x,Home:event.ctrlKey?0:z*10,End:event.ctrlKey?99:z*10+9};
    if(Object.hasOwn(targets,event.key)){event.preventDefault();focus(targets[event.key]);}
  },{signal:events.signal});
  for(const [control,key]of [[seed,'seed'],[centerX,'centerX'],[centerZ,'centerZ'],[radius,'radius']])control.addEventListener('input',()=>{state[key]=control.value;clearResults();ready();},{signal:events.signal});
  layer.addEventListener('change',()=>{state.layer=Number(layer.value);clearResults();},{signal:events.signal});
  rotations.addEventListener('change',()=>{state.allRotations=rotations.checked;clearResults();},{signal:events.signal});
  for(const[id,value]of [['#bedrock-fill',2],['#bedrock-clear',0]])find(id).addEventListener('click',()=>{state.pattern.fill(value);cells.forEach((_,index)=>drawCell(index));clearResults();ready();},{signal:events.signal});

  function renderMatches() {
    resultSection.hidden=!state.report;
    find('#bedrock-match-count').textContent=String(state.matches.length);
    resultBody.replaceChildren();
    for(const match of state.matches) {
      const row=node('tr');
      for(const value of [match.x,state.report.layer,match.z,`${match.rotation}°`])row.append(node('td','',String(value)));
      const cell=node('td'),button=node('button','text-button','Copy');button.type='button';button.dataset.coords=`${match.x} ${state.report.layer} ${match.z}`;button.setAttribute('aria-label',`Copy coordinates ${button.dataset.coords}`);cell.append(button);row.append(cell);resultBody.append(row);
    }
  }
  function renderReport() {
    const report=state.report;if(!report)return;
    progress.hidden=false;
    find('#bedrock-progress').max=report.total;find('#bedrock-progress').value=report.checked;
    find('#bedrock-progress-text').textContent=`${number(report.checked)} / ${number(report.total)} positions · ${(report.elapsedMs/1000).toFixed(1)}s`;
    status.hidden=!report.message;status.textContent=report.message||'';
  }
  function finish(message) {
    worker?.terminate();worker=null;running=false;
    if(state.report)state.report.message=message;
    ready();renderMatches();renderReport();
  }
  stop.addEventListener('click',()=>finish('Stopped. The search area is incomplete.'),{signal:events.signal});
  find('.bedrock-form').addEventListener('submit',event=>{
    event.preventDefault();if(running)return;
    let job;
    try {job=normalizeSearch(state);} catch(exception){showError(exception.message);return;}
    if(typeof Worker!=='function'||typeof WebAssembly!=='object'){showError('This browser needs Web Workers and WebAssembly to run the search.');return;}
    clearResults();state.report={layer:job.layer,total:job.total,checked:0,elapsedMs:0,message:'Searching…'};renderMatches();renderReport();
    try {
      const activeWorker=new Worker(new URL('./bedrock-worker.js',import.meta.url),{type:'module'});worker=activeWorker;running=true;ready();
      activeWorker.onmessage=({data})=>{
        if(disposed||worker!==activeWorker)return;
        if(data.type==='error'){showError(data.message);finish('Search failed. Results are incomplete.');return;}
        if(data.type!=='progress'&&data.type!=='done')return;
        state.matches.push(...data.matches);state.report.checked=data.checked;state.report.total=data.total;state.report.elapsedMs=data.elapsedMs;renderMatches();renderReport();
        if(data.type==='done')finish(data.capped?`Stopped at ${MAX_MATCHES} matches. Mark more cells or narrow the area.`:state.matches.length?`Search complete. ${state.matches.length} ${state.matches.length===1?'match':'matches'} found.`:'No matches in this area. Check the layer, seed and pattern, or search another area.');
      };
      activeWorker.onerror=()=>{if(!disposed&&worker===activeWorker){showError('The search engine could not start. Reload and try again.');finish('Search failed. Results are incomplete.');}};
      activeWorker.postMessage({type:'search',input:{seed:job.seed,layer:job.layer,centerX:job.centerX,centerZ:job.centerZ,radius:job.radius,allRotations:state.allRotations,pattern:job.pattern}});
    } catch {showError('The search engine could not start in this browser.');finish('Search failed.');}
  },{signal:events.signal});
  resultBody.addEventListener('click',async event=>{
    const button=event.target.closest('[data-coords]');if(!button)return;
    let message;
    try {if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(button.dataset.coords);manualCopy?.remove();manualCopy=null;message='Copied to clipboard';}
    catch {
      if(disposed)return;
      if(!manualCopy){manualCopy=node('textarea','bedrock-manual-copy');manualCopy.readOnly=true;manualCopy.rows=1;manualCopy.setAttribute('aria-label','Coordinates to copy');resultSection.append(manualCopy);}
      manualCopy.value=button.dataset.coords;manualCopy.focus();manualCopy.select();message='Copy is blocked. Copy the selected coordinates manually.';
    }
    if(disposed)return;clearTimeout(feedbackTimer);feedback.textContent=message;feedback.hidden=false;feedbackTimer=setTimeout(()=>{feedback.hidden=true;},2000);
  },{signal:events.signal});
  ready();renderMatches();renderReport();
  return ()=>{disposed=true;events.abort();clearTimeout(feedbackTimer);if(running&&state.report)state.report.message='Stopped when leaving the tool. The search area is incomplete.';worker?.terminate();worker=null;running=false;};
}
