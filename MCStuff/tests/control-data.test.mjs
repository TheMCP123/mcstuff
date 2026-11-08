import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsv,hsvToHex,matchingOptions,nextOption,popupPosition } from '../public/control-data.js';

test('color picker converts the primary colors and clamps saturation / brightness',()=>{
  for(const[hex,h]of[['#FF0000',0],['#FFFF00',60],['#00FF00',120],['#00FFFF',180],['#0000FF',240],['#FF00FF',300]]){
    const value=hexToHsv(hex);assert.equal(value.h,h);assert.equal(value.s,100);assert.equal(value.v,100);assert.equal(hsvToHex(h,100,100),hex);
  }
  assert.equal(hsvToHex(360,200,100),'#FF0000');assert.equal(hsvToHex(-60,100,100),'#FF00FF');assert.equal(hsvToHex(120,100,-10),'#000000');
});

test('color picker preserves arbitrary RGB colors through HSV round trips',()=>{
  for(const hex of ['#000000','#FFFFFF','#808080','#123456','#55FF55','#FFAA33','#4B91FF','#A970FF']){const value=hexToHsv(hex);assert.equal(hsvToHex(value.h,value.s,value.v),hex);}
  assert.deepEqual(hexToHsv('#000'),{h:0,s:0,v:0});assert.throws(()=>hexToHsv('oops'));
});

test('custom option filtering normalizes case and accents, and never exposes hidden options',()=>{
  const options=[{label:'Café',value:'a'},{label:'1.21.11',value:'b'},{label:'Fabric',hidden:true,value:'c'}];
  assert.deepEqual(matchingOptions(options,'CAFE').map(option=>option.value),['a']);
  assert.deepEqual(matchingOptions(options,'1.21').map(option=>option.value),['b']);assert.equal(matchingOptions(options).length,2);
});

test('keyboard option navigation skips disabled choices and stops at list boundaries',()=>{
  const options=[{label:'A'},{label:'Unavailable',disabled:true},{label:'C'},{label:'D'}];
  assert.equal(nextOption(options,0,1),2);assert.equal(nextOption(options,2,-1),0);assert.equal(nextOption(options,3,1),3);
  assert.equal(nextOption(options,-1,1),0);assert.equal(nextOption(options,-1,-1),3);assert.equal(nextOption(options,0,Infinity),3);assert.equal(nextOption(options,3,-Infinity),0);
  assert.equal(nextOption([{disabled:true}],0,1),-1);
});

test('dropdown positioning fits narrow screens and opens upward when the lower edge is close',()=>{
  const position=popupPosition({left:220,top:600,bottom:644},{width:300,height:280},320,720);
  assert.ok(position.left>=8);assert.ok(position.left+position.width<=312);assert.ok(position.top<600);assert.ok(position.top+280<=720);
  const wide=popupPosition({left:200,top:100,bottom:144},{width:220,height:180},1280,720);assert.equal(wide.left,200);assert.equal(wide.top,150);
  const middle=popupPosition({left:100,top:440,bottom:484},{width:300,height:320},1280,720);assert.ok(middle.top<440);assert.ok(middle.top+320<440);
});
