import { normalizeHex } from './formatting.js';

export const clamp = (value,min,max) => Math.min(max,Math.max(min,value));

export function hexToHsv(value) {
  const hex=normalizeHex(value);
  if(!hex)throw new TypeError('Invalid HEX color');
  const [r,g,b]=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b), delta=max-min;
  let h=0;
  if(delta) h=(max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4)*60;
  return {h:(h+360)%360,s:max?delta/max*100:0,v:max*100};
}

export function hsvToHex(h,s,v) {
  h=((h%360)+360)%360/60;s=clamp(s,0,100)/100;v=clamp(v,0,100)/100;
  const c=v*s, x=c*(1-Math.abs(h%2-1)), m=v-c;
  const channels=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h)];
  return '#'+channels.map(channel=>Math.round((channel+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
}

export function matchingOptions(options,query='') {
  const normalized=query.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').trim();
  return options.filter(option=>!option.hidden && (!normalized || option.label.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').includes(normalized)));
}

export function nextOption(options,current,step) {
  const enabled=options.map((option,index)=>option.disabled?-1:index).filter(index=>index>=0);
  if(!enabled.length)return -1;
  if(step===Infinity)return enabled.at(-1);
  if(step===-Infinity)return enabled[0];
  const at=enabled.indexOf(current);
  return enabled[clamp((at<0?(step<0?enabled.length: -1):at)+step,0,enabled.length-1)];
}

export function popupPosition(anchor,popup,width,height) {
  const margin=8, gap=6;
  const popupWidth=Math.min(popup.width,width-margin*2);
  const below=height-anchor.bottom-gap-margin;
  const above=anchor.top-gap-margin;
  const upward=below<popup.height && above>below;
  const maxHeight=Math.max(80,upward?above:below);
  const popupHeight=Math.min(popup.height,maxHeight);
  return {left:clamp(anchor.left,margin,Math.max(margin,width-popupWidth-margin)),top:clamp(upward?anchor.top-gap-popupHeight:anchor.bottom+gap,margin,Math.max(margin,height-popupHeight-margin)),width:popupWidth,maxHeight};
}
