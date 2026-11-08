import { iconMarkup } from './icons.js';
import { normalizeHex } from './formatting.js';
import { clamp, hexToHsv, hsvToHex, matchingOptions, nextOption, popupPosition } from './control-data.js';

let sequence=0;
let activePopup=null;
const widgets=new WeakMap();
const managers=new WeakMap();
let tooltip=null, tooltipTarget=null, tooltipTimer;
const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};

export function hideControlTooltip(){clearTimeout(tooltipTimer);tooltip?.remove();tooltip=null;tooltipTarget=null;}

export function installControlTooltips(){
  function enter(event){
    const target=event.target.closest?.('[title],[data-control-tooltip]');
    if(!target || target===tooltipTarget)return;
    hideControlTooltip();
    const title=target.getAttribute('title') || target.dataset.controlTooltip;
    if(!title)return;
    target.dataset.controlTooltip=title;target.removeAttribute('title');tooltipTarget=target;
    tooltipTimer=setTimeout(()=>{
      if(!target.isConnected || !target.getClientRects().length)return;
      tooltip=node('div','control-tooltip',title);tooltip.setAttribute('role','tooltip');document.body.append(tooltip);
      const anchor=target.getBoundingClientRect(),bounds=tooltip.getBoundingClientRect();
      const width=document.documentElement.clientWidth;
      tooltip.style.left=`${clamp(anchor.left+anchor.width/2-bounds.width/2,8,Math.max(8,width-bounds.width-8))}px`;
      tooltip.style.top=`${anchor.top>bounds.height+14?anchor.top-bounds.height-7:anchor.bottom+7}px`;
    },event.type==='focusin'?250:450);
  }
  document.addEventListener('pointerover',enter);
  document.addEventListener('focusin',enter);
  document.addEventListener('pointerout',event=>{if(tooltipTarget?.contains(event.target)&&!tooltipTarget.contains(event.relatedTarget))hideControlTooltip();});
  document.addEventListener('focusout',()=>hideControlTooltip());
  document.addEventListener('pointerdown',()=>hideControlTooltip(),{capture:true});
  document.addEventListener('scroll',()=>hideControlTooltip(),{capture:true});
  document.addEventListener('keydown',()=>hideControlTooltip());
}

function fieldLabel(input) {
  if(input.getAttribute('aria-label'))return input.getAttribute('aria-label');
  if(input.getAttribute('aria-labelledby'))return input.getAttribute('aria-labelledby').split(/\s+/).map(id=>document.getElementById(id)?.textContent || '').join(' ').trim();
  return [...(input.labels || [])].map(label=>{const clone=label.cloneNode(true);clone.querySelectorAll('select,input,button,textarea').forEach(child=>child.remove());return clone.textContent.trim();}).join(' ') || 'Choose an option';
}

function nextTabStop(anchor,backward) {
  const controls=[...document.querySelectorAll('a[href],button,input,textarea,select,[tabindex]')];
  const index=controls.indexOf(anchor);
  for(let at=index+(backward?-1:1);at>=0&&at<controls.length;at+=backward?-1:1){const control=controls[at];if(!control.disabled&&control.tabIndex>=0&&!control.closest('[hidden],[inert]')&&control.getClientRects().length){control.focus();break;}}
}

function attachPopup(trigger,popup,onClose) {
  activePopup?.close(false);
  const events=new AbortController();
  document.body.append(popup);
  const handle={popup,close(refocus=false){if(!popup.isConnected)return;events.abort();popup.remove();if(activePopup===handle)activePopup=null;onClose();if(refocus&&trigger.isConnected&&!trigger.disabled)trigger.focus();}};
  activePopup=handle;
  function position() {
    const anchor=trigger.getBoundingClientRect();
    const viewport=window.visualViewport;
    const width=Math.min(document.documentElement.clientWidth,viewport?.width || innerWidth);
    const height=viewport?.height || innerHeight;
    if(!trigger.isConnected || !trigger.getClientRects().length || anchor.bottom<0 || anchor.top>height){handle.close(false);return;}
    const isColor=popup.classList.contains('color-popover');
    const desired=isColor?280:Math.max(Number(popup.dataset.minWidth) || 220,anchor.width);
    popup.style.width=`${Math.min(desired,width-16)}px`;
    popup.style.maxHeight='';
    const bounds=popupPosition(anchor,{width:desired,height:popup.getBoundingClientRect().height},width,height);
    if(isColor){const fullHeight=Math.min(popup.getBoundingClientRect().height,height-16);bounds.top=clamp(anchor.bottom+6,8,Math.max(8,height-fullHeight-8));bounds.maxHeight=height-16;}
    Object.assign(popup.style,{left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,maxHeight:`${bounds.maxHeight}px`});
  }
  document.addEventListener('pointerdown',event=>{if(!popup.contains(event.target)&&!trigger.contains(event.target))handle.close(false);},{capture:true,signal:events.signal});
  document.addEventListener('scroll',event=>{if(!popup.contains(event.target))position();},{capture:true,signal:events.signal});
  window.addEventListener('resize',position,{signal:events.signal});
  window.visualViewport?.addEventListener('resize',position,{signal:events.signal});
  popup.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();handle.close(true);}},{signal:events.signal});
  handle.position=position;position();return handle;
}

function selectControl(select) {
  const id=`control-${++sequence}`;
  const initialLabel=fieldLabel(select);
  const label=()=>select.getAttribute('aria-label') || initialLabel;
  const originalHidden=select.hidden;
  const labels=[...(select.labels || [])].map(label=>({element:label,for:label.getAttribute('for')}));
  const wrapper=node('span',`form-select${select.classList.contains('pack-version')?' form-select-compact':''}`);
  const trigger=node('button','select-trigger');trigger.type='button';trigger.id=id;trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',`${id}-list`);
  const value=node('span','select-value');trigger.append(value);trigger.insertAdjacentHTML('beforeend',iconMarkup('chevron'));wrapper.append(trigger);select.after(wrapper);select.hidden=true;select.classList.add('native-control');
  for(const label of labels)label.element.htmlFor=id;
  const events=new AbortController();
  let popup,handle,list,search,options=[],visible=[],active=-1,optionNodes=[],signature='',typed='',typedAt=0;
  function readOptions(){return [...select.options].map(option=>{const group=option.parentElement?.tagName==='OPTGROUP'?option.parentElement:null;return {value:option.value,label:option.label,disabled:option.disabled || Boolean(group?.disabled),hidden:option.hidden || Boolean(group?.hidden)};});}
  function activate(index,scroll=true) {
    active=index;
    for(const [at,option] of optionNodes.entries())option.classList.toggle('is-active',at===active);
    const target=optionNodes[active];
    const focus=search || trigger;
    if(target){focus.setAttribute('aria-activedescendant',target.id);if(scroll)target.scrollIntoView({block:'nearest'});}else focus.removeAttribute('aria-activedescendant');
  }
  function choose(index) {
    const option=visible[index];if(!option || option.disabled)return;
    const changed=select.value!==option.value;
    select.value=option.value;sync();handle?.close(true);
    if(changed){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  function renderOptions() {
    visible=matchingOptions(options,search?.value || '');list.replaceChildren();optionNodes=[];
    for(const [index,option] of visible.entries()) {
      const entry=node('div','select-option');entry.id=`${id}-option-${index}`;entry.setAttribute('role','option');entry.setAttribute('aria-selected',String(option.value===select.value));entry.setAttribute('aria-disabled',String(option.disabled));entry.append(node('span','',option.label));entry.insertAdjacentHTML('beforeend',iconMarkup('check'));
      entry.addEventListener('pointerdown',event=>event.preventDefault());entry.addEventListener('pointermove',()=>{if(!option.disabled)activate(index,false);});entry.addEventListener('click',event=>{event.preventDefault();choose(index);});
      list.append(entry);optionNodes.push(entry);
    }
    if(!visible.length)list.append(node('p','control-empty','No matches'));
    const selected=visible.findIndex(option=>option.value===select.value&&!option.disabled);
    activate(selected>=0?selected:nextOption(visible,-1,1),false);
  }
  function open() {
    if(trigger.disabled || handle)return;
    sync();popup=node('div','control-popover select-popover');popup.dataset.minWidth=options.some(option=>option.label.length>22)?'300':'220';
    if(options.filter(option=>!option.hidden).length>8){const field=node('div','select-search');field.innerHTML=iconMarkup('search');search=node('input');search.type='text';search.autocomplete='off';search.spellcheck=false;search.placeholder='Search…';search.setAttribute('aria-label',`Search ${label()} options`);search.setAttribute('aria-controls',`${id}-list`);field.append(search);popup.append(field);search.addEventListener('input',()=>{renderOptions();handle?.position();});search.addEventListener('keydown',keys);}
    list=node('div','select-options');list.id=`${id}-list`;list.setAttribute('role','listbox');list.setAttribute('aria-label',label());popup.append(list);
    handle=attachPopup(trigger,popup,()=>{handle=null;popup=null;list=null;search=null;trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');typed='';});
    trigger.setAttribute('aria-expanded','true');renderOptions();handle.position();
    if(search)search.focus({preventScroll:true});else trigger.focus({preventScroll:true});activate(active);
  }
  function keys(event) {
    if(event.ctrlKey || event.metaKey)return;
    const key=event.key;
    if(event.altKey&&key==='ArrowUp'&&handle){event.preventDefault();choose(active);return;}
    if(key==='Escape'&&handle){event.preventDefault();event.stopPropagation();handle.close(true);return;}
    if(key==='Tab'&&handle){event.preventDefault();const backward=event.shiftKey;if(active>=0)choose(active);else handle.close(true);nextTabStop(trigger,backward);return;}
    if(['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(key)){
      event.preventDefault();const wasOpen=Boolean(handle);open();if(!handle)return;
      if(!wasOpen && key==='ArrowDown')return;
      activate(nextOption(visible,active,key==='Home'?-Infinity:key==='End'?Infinity:key==='PageDown'?10:key==='PageUp'?-10:key==='ArrowDown'?1:-1));return;
    }
    if(key==='Enter' || key===' '&&event.target!==search){event.preventDefault();if(handle)choose(active);else open();return;}
    if(key.length===1 && !event.altKey && event.target!==search){event.preventDefault();const now=Date.now();typed=now-typedAt>800?'':typed;typed+=key.toLowerCase();typedAt=now;open();if(!handle)return;if(search){search.value=typed;renderOptions();handle.position();return;}const repeated=[...typed].every(char=>char===typed[0]);const query=repeated?typed[0]:typed;const from=repeated?active+1:0;const candidates=[...visible.keys()].slice(from).concat([...visible.keys()].slice(0,from));const found=candidates.find(index=>!visible[index].disabled&&visible[index].label.toLowerCase().startsWith(query));if(found!==undefined)activate(found);}
  }
  function sync() {
    const selected=select.selectedOptions[0];
    const selectedLabel=selected?.label || 'Choose…';if(value.textContent!==selectedLabel)value.textContent=selectedLabel;
    if(trigger.disabled!==select.disabled)trigger.disabled=select.disabled;
    const name=label();if(trigger.getAttribute('aria-label')!==name)trigger.setAttribute('aria-label',name);
    options=readOptions();const next=JSON.stringify(options)+select.value;
    if(handle && (trigger.disabled || !wrapper.getClientRects().length)){handle.close(false);return;}
    if(handle&&signature!==next){renderOptions();handle.position();}signature=next;
  }
  trigger.addEventListener('click',event=>{event.preventDefault();if(handle)handle.close(true);else open();},{signal:events.signal});
  trigger.addEventListener('keydown',keys,{signal:events.signal});select.addEventListener('input',sync,{signal:events.signal});select.addEventListener('change',sync,{signal:events.signal});sync();
  return {sync,dispose(){handle?.close(false);events.abort();wrapper.remove();select.hidden=originalHidden;select.classList.remove('native-control');for(const label of labels){if(label.for===null)label.element.removeAttribute('for');else label.element.setAttribute('for',label.for);}}};
}

function colorControl(input) {
  const id=`color-control-${++sequence}`;
  const hidden=input.hidden;
  const trigger=node('button','color-trigger');trigger.type='button';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
  const swatch=node('span','color-trigger-swatch');trigger.append(swatch);input.after(trigger);input.hidden=true;input.classList.add('native-control');
  const events=new AbortController();
  let handle,popup,plane,marker,hexField,feedback,hsv=hexToHsv(input.value),lastHex='',sliders={};
  function paint() {
    if(!popup)return;
    plane.style.setProperty('--picker-hue',hsvToHex(hsv.h,100,100));marker.style.left=`${hsv.s}%`;marker.style.top=`${100-hsv.v}%`;
    for(const key of ['h','s','v']){sliders[key].value=String(Math.round(hsv[key]));sliders[key].parentElement.querySelector('output').textContent=key==='h'?`${Math.round(hsv[key])}°`:`${Math.round(hsv[key])}%`;}
    if(document.activeElement!==hexField){hexField.value=input.value.toUpperCase();hexField.removeAttribute('aria-invalid');feedback.hidden=true;}
    popup.querySelector('.control-done').disabled=!normalizeHex(hexField.value);
    handle?.position();
  }
  function commit() {lastHex=hsvToHex(hsv.h,hsv.s,hsv.v);input.value=lastHex;swatch.style.backgroundColor=lastHex;paint();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  function open() {
    if(trigger.disabled || handle)return;
    sync();popup=node('div','control-popover color-popover');popup.setAttribute('role','dialog');popup.setAttribute('aria-label',trigger.getAttribute('aria-label'));
    const header=node('div','color-picker-heading');header.append(node('span','','Color'));const close=node('button','control-close');close.type='button';close.setAttribute('aria-label','Close color picker');close.innerHTML=iconMarkup('close');header.append(close);popup.append(header);
    plane=node('div','color-plane');plane.setAttribute('aria-hidden','true');marker=node('i','color-plane-marker');plane.append(marker);popup.append(plane);
    for(const [key,label,max] of [['h','Hue',359],['s','Saturation',100],['v','Brightness',100]]){const row=node('label','color-slider-row');const title=node('span','');title.append(node('span','',label),node('output'));const slider=node('input',`control-range range-${key}`);slider.type='range';slider.min='0';slider.max=String(max);slider.step='1';slider.setAttribute('aria-label',label);sliders[key]=slider;row.append(title,slider);popup.append(row);slider.addEventListener('input',()=>{hsv[key]=Number(slider.value);commit();});}
    const hexLabel=node('label','color-hex-label','HEX');hexLabel.htmlFor=`${id}-hex`;hexField=node('input','color-hex-input');hexField.type='text';hexField.id=hexLabel.htmlFor;hexField.maxLength=7;hexField.spellcheck=false;hexField.autocomplete='off';hexField.setAttribute('aria-describedby',`${id}-error`);popup.append(hexLabel,hexField);feedback=node('p','field-error','Enter a valid HEX color.');feedback.id=`${id}-error`;feedback.hidden=true;popup.append(feedback);
    const done=node('button','control-done','Done');done.type='button';popup.append(done);
    handle=attachPopup(trigger,popup,()=>{handle=null;popup=null;trigger.setAttribute('aria-expanded','false');sliders={};});trigger.setAttribute('aria-expanded','true');
    let dragging=false;
    function point(event){const bounds=plane.getBoundingClientRect();hsv.s=clamp((event.clientX-bounds.left)/bounds.width*100,0,100);hsv.v=clamp(100-(event.clientY-bounds.top)/bounds.height*100,0,100);commit();}
    plane.addEventListener('pointerdown',event=>{event.preventDefault();dragging=true;plane.setPointerCapture(event.pointerId);point(event);});plane.addEventListener('pointermove',event=>{if(dragging)point(event);});plane.addEventListener('pointerup',()=>{dragging=false;});plane.addEventListener('pointercancel',()=>{dragging=false;});
    hexField.addEventListener('input',()=>{const hex=normalizeHex(hexField.value);feedback.hidden=Boolean(hex);hexField.setAttribute('aria-invalid',String(!hex));done.disabled=!hex;if(hex){hsv=hexToHsv(hex);commit();}else handle.position();});
    hexField.addEventListener('blur',()=>{if(normalizeHex(hexField.value))hexField.value=input.value.toUpperCase();});
    done.addEventListener('click',()=>handle.close(true));close.addEventListener('click',()=>handle.close(true));
    popup.addEventListener('keydown',event=>{if(event.key==='Tab'){const controls=[...popup.querySelectorAll('button,input')].filter(control=>!control.disabled);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();handle.close(true);}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();handle.close(true);nextTabStop(trigger,false);}}});
    paint();handle.position();sliders.h.focus({preventScroll:true});
  }
  function sync(){const color=input.value.toUpperCase();if(color!==lastHex){const next=hexToHsv(color);if(next.s===0)next.h=hsv.h;hsv=next;lastHex=color;}swatch.style.backgroundColor=color;trigger.setAttribute('aria-label',input.getAttribute('aria-label') || 'Choose color');trigger.title=color;if(trigger.disabled!==input.disabled)trigger.disabled=input.disabled;if(handle&&(input.disabled||!trigger.getClientRects().length))handle.close(false);else paint();}
  trigger.addEventListener('click',event=>{event.preventDefault();if(handle)handle.close(true);else open();},{signal:events.signal});input.addEventListener('input',sync,{signal:events.signal});sync();
  return {sync,dispose(){handle?.close(false);events.abort();trigger.remove();input.hidden=hidden;input.classList.remove('native-control');}};
}

export function refreshFormControls(root) {managers.get(root)?.refresh();}

export function enhanceFormControls(root) {
  const controls=new Map();
  const disclosures=new Map();
  let disposed=false;
  function refresh() {
    if(disposed)return;
    for(const input of root.querySelectorAll('select,input[type="color"]'))if(!controls.has(input)){const widget=input.tagName==='SELECT'?selectControl(input):colorControl(input);controls.set(input,widget);widgets.set(input,widget);}
    for(const [input,widget]of controls){if(!root.contains(input)){widget.dispose();controls.delete(input);widgets.delete(input);}else widget.sync();}
    for(const[summary,icon]of disclosures)if(!root.contains(summary)){icon.remove();disclosures.delete(summary);}
    for(const summary of root.querySelectorAll('summary'))if(!disclosures.has(summary)){const icon=node('span','disclosure-icon');icon.innerHTML=iconMarkup('chevron');summary.append(icon);summary.classList.add('custom-summary');disclosures.set(summary,icon);}
  }
  const observer=new MutationObserver(records=>{if(records.some(record=>record.type==='childList'||record.target.matches('select,option,input[type="color"]')))refresh();});
  managers.set(root,{refresh});refresh();observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','selected','aria-label','value']});
  return ()=>{disposed=true;observer.disconnect();managers.delete(root);for(const[input,widget]of controls){widget.dispose();widgets.delete(input);}for(const[summary,icon]of disclosures){icon.remove();summary.classList.remove('custom-summary');}controls.clear();disclosures.clear();};
}
