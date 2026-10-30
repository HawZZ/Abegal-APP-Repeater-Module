import {source,pages,specs} from './content.js';
import {icons} from './icons.js';
import {createViews} from './views.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>`<svg aria-hidden="true" viewBox="0 0 24 24">${(icons[n]||icons.info).map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).filter(([k])=>k!=='key').map(([k,v])=>`${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${esc(v)}"`).join(' ')} />`).join('')}</svg>`;
const btn=(act,label,ic='',cls='iconbtn',extra='')=>`<button type="button" data-act="${act}" class="${cls}" aria-label="${esc(label)}" ${extra}>${ic?icon(ic):''}${['iconbtn','eventmore','unbind-button'].includes(cls)?'':esc(label)}</button>`;
const defaultHubs=()=>[1,2,3].map((id,i)=>({id,name:['客厅中继','玄关中继','二楼中继'][i],volume:55,ring:'default',used:456,free:123,devices:[{id:id*10+1,name:i?'Cam 1':'客厅 · Cam 1',type:'camera',image:'living',online:true},{id:id*10+2,name:i?'DB 2':'家门口 · DB 2',type:'bell',image:'entrance',online:true}]}));
const defaultEvents=()=>[1,2,3].flatMap(id=>Array.from({length:8},(_,i)=>({id:id*100+i,hub:id,device:id*10+1+i%2,type:['PIR 移动侦测','设备来电','PIR 移动侦测','设备上电'][i%4],date:'2026-10-30',time:`${String(11-Math.floor(i/3)).padStart(2,'0')}:${String(56-i*3).padStart(2,'0')}`,image:i%2?'entrance':'living'})));
let saved;try{saved=JSON.parse(sessionStorage.getItem('abegal-v2'))}catch{}
let state={hubs:saved?.hubs||defaultHubs(),events:saved?.events||defaultEvents(),hub:1,page:'home',pane:'app',category:'中继',bottom:'设备',scenario:'normal',modal:null,from:'home',layout:'list',fullFrom:'live',selected:null,filter:'全部',deviceFilter:'all',date:'',time:'',muted:true,recording:false,playback:null,playing:true,progress:0,toolsVisible:true,manage:false,immersive:new URLSearchParams(location.search).get('view')==='app',inspect:false,theme:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'};
let toastTimer,pairTimer,longTimer,renderTimer,feedClickTimer;
let lastPage='',bodyScroll=0;
const hub=()=>state.hubs.find(h=>h.id===state.hub)||state.hubs[0];
const offline=()=>state.scenario==='offline';
function persist(){try{sessionStorage.setItem('abegal-v2',JSON.stringify({hubs:state.hubs,events:state.events}))}catch{}}
function toast(msg){clearTimeout(toastTimer);$('.toast')?.remove();$('.appscreen').insertAdjacentHTML('beforeend',`<div class="toast" role="status">${esc(msg)}</div>`);toastTimer=setTimeout(()=>$('.toast')?.remove(),3000)}
function guard(){if(offline()){toast('中继已离线，请检查电源与网络后重试');return false}return true}
function go(page,from){clearTimeout(pairTimer);clearTimeout(feedClickTimer);state.modal=null;state.manage=false;state.inspect=false;if(from)state.from=from;state.page=page;state.pane='app';if(page==='landscape'){state.immersive=true;state.layout='grid';state.toolsVisible=true}if(page==='live'){state.layout='list';state.toolsVisible=true}state.recording=false;state.muted=true;state.playback=null;render()}
function hubArt(){return '<img class="hub-product" src="assets/hub.png" alt="中继外观示意">'}
function appnav(title,right='',back='back',dark=false){return `<header class="appnav ${dark?'dark':''}">${btn(back,'返回','back')}<h2>${esc(title)}</h2><div class="navright">${right||'<span style="width:38px"></span>'}</div></header>`}
function home(){return views.home()}
function settings(){return views.settings()}
function selectedEvents(){return state.events.filter(e=>e.hub===hub()?.id&&(state.filter==='全部'||e.type===state.filter)&&(state.deviceFilter==='all'||e.device===Number(state.deviceFilter))&&(!state.date||e.date===state.date)&&(!state.time||e.time<=state.time)).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time))}
function events(){return views.events()}
function feed(d){if(offline()||!d.online)return `<div class="feed offline"><div>${esc(d.name)}<br>设备离线</div></div>`;return `<div class="feed" data-feed="${d.id}" tabindex="0" aria-label="${esc(d.name)}画面，双击全屏"><img src="assets/${d.image}.jpg" alt="${esc(d.name)}静态直播演示"><div class="feedtop">${esc(d.name)}<span class="livebadge">● Live</span></div><div class="feedbottom"><span>2026/10/30 11:56:08</span>${btn(`full:${d.id}`,'全屏 '+d.name,'expand')}</div></div>`}
function live(){return views.live()}
function full(){return views.full()}
function renderModal(){let m=state.modal;if(!m)return '';const h=hub();let c='';const cancel=btn('cancel','取消','','secondary');if(m.type==='rename')c=`<h3>修改中继名称</h3><p>为你的中继取一个容易识别的名字。</p><label class="fieldlabel" for="hubname">中继名称</label><input id="hubname" type="text" maxlength="24" value="${esc(h.name)}" autocomplete="off"><div id="name-error" class="validation" role="alert"></div>${btn('save-name','保存名称','','primary')}${cancel}`;
if(m.type==='unbind'){let d=h.devices.find(d=>d.id===m.id);c=`<h3>解除设备配对？</h3><p>将解除「${esc(d?.name)}」与 ${esc(h.name)} 的配对关系，该设备将从中继列表移除。</p>${btn('confirm-unbind','解除配对','','primary destructive')}${cancel}`}
if(m.type==='format')c=`<h3>格式化存储卡？</h3><p>将清空 ${esc(h.name)} 存储卡中的全部事件与录像，清空后无法恢复。</p>${btn('confirm-format','确认格式化','','primary destructive')}${cancel}`;
if(m.type==='formatting')c=`<div class="pairart pulse">${icon('download')}</div><h3>正在格式化…</h3><p>请保持中继通电，等待操作完成。</p>`;
if(m.type==='remove')c=`<h3>移除 ${esc(h.name)}？</h3><p>将从你的家庭移除中继，并同时解除其 ${h.devices.length} 台关联设备的配对关系。</p>${btn('confirm-remove','移除中继及配对关系','','primary destructive')}${cancel}`;
if(m.type==='pair')c=`<div class="pairart pulse">${icon('wifi')}</div><h3>正在寻找设备</h3><p>中继已进入配对状态，请让设备进入配网状态并靠近中继。</p><div class="group"><div class="row"><div class="deviceicon">${icon('camera')}</div><div class="devicename">Cam ${h.devices.length+1}<small>附近设备 · 可配对</small></div><span class="online">已发现</span></div></div>${btn('confirm-pair','配对这台设备','','primary')}${btn('pair-timeout','模拟配对超时','','secondary')}${cancel}`;
if(m.type==='pairing')c=`<div class="pairart pulse">${icon('wifi')}</div><h3>正在配对…</h3><p>正在建立设备与中继的连接。</p>${cancel}`;
if(m.type==='timeout')c=`<div class="pairart">${icon('wifi')}</div><h3>未能完成配对</h3><p>请检查设备是否处于配网状态，并靠近中继后重试。</p>${btn('pair','重新配对','','primary')}${cancel}`;
if(m.type==='ring')c=`<h3>选择叮咚铃声</h3><p>选择后试听，再保存到中继。</p>${['default','经典叮咚','轻柔和弦','清晨鸟鸣'].map((r,i)=>`<label class="radioline"><input type="radio" name="ringtone" value="${r}" ${(m.value||h.ring)===r?'checked':''}>${icon('music')}${r}</label>`).join('')}${btn('preview-ring','试听铃声','','secondary')}${btn('save-ring','保存铃声','','primary')}${cancel}`;
if(m.type==='event'){const e=state.events.find(e=>e.id===m.id);c=`<h3>${esc(e.type)}</h3><p>${e.date} ${e.time} · 演示事件</p><div class="smallactions">${btn('download-event','下载关键帧','download','')}${btn('share-event','转发','share','')}</div>${btn('delete-event','删除事件','','primary destructive')}${cancel}`}
if(m.type==='delete')c=`<h3>删除这条事件？</h3><p>删除后将从当前中继的事件列表移除。</p>${btn('confirm-delete','确认删除','','primary destructive')}${cancel}`;
if(m.type==='home-more')c=`<h3>我的家</h3><p>管理中继和关联设备。</p>${state.hubs.map(x=>`<button class="sheet-device-row" data-act="hub:${x.id}:settings">${hubArt()}<span>${esc(x.name)}<small>${x.devices.length} 台连接设备</small></span>${icon('chevron')}</button>`).join('')}${cancel}`;
if(m.type==='choose-hub')c=`<h3>连接到哪个中继？</h3><p>选择设备附近的中继，最多可连接 4 台。</p>${state.hubs.map(x=>`<button class="sheet-device-row" data-act="add-to:${x.id}" ${x.devices.length>=4?'disabled':''}>${hubArt()}<span>${esc(x.name)}<small>${x.devices.length}/4 台${x.devices.length>=4?'，已满':''}</small></span>${icon('chevron')}</button>`).join('')}${cancel}`;
if(m.type==='pair-intro')c=`<div class="pair-visual">${hubArt()}<span>${icon('wifi')}</span></div><h3>连接一台新设备</h3><p>将设备放在「${esc(h.name)}」附近，并让设备进入配网状态。</p><div class="pair-checklist"><span>${icon('check')}设备已接通电源</span><span>${icon('check')}指示灯正在闪烁</span></div>${btn('start-search','准备好了，开始搜索','','primary')}${cancel}`;
if(m.type==='searching')c=`<div class="pair-visual searching">${hubArt()}<span>${icon('wifi')}</span></div><h3>正在寻找附近设备</h3><p>请将设备靠近中继，并保持配网状态。</p>${cancel}`;
if(m.type==='pair')c=`<div class="pair-success-symbol">${icon('check')}</div><h3>发现一台新摄像机</h3><p>附近设备已准备就绪，连接后即可在此中继查看。</p><div class="found-device">${icon('camera')}<div><strong>Cam ${h.devices.length+1}</strong><small>附近设备 · 等待连接</small></div></div>${btn('confirm-pair','连接这台设备','','primary')}${cancel}`;
if(m.type==='pair-success')c=`<div class="pair-success-symbol">${icon('check')}</div><h3>连接成功</h3><p>设备已添加到「${esc(h.name)}」，现在可以查看画面和接收事件。</p><div class="found-device">${icon('camera')}<div><strong>${esc(m.name)}</strong><small>已连接 · ${h.devices.length}/4 台</small></div></div>${btn('pair-done','完成','','primary')}`;
if(m.type==='storage')c=`<h3>存储卡管理</h3><p>「${esc(h.name)}」的事件和录像保存在本地存储卡。</p><div class="storage-stats"><div><strong>${h.used}<small> MB</small></strong><span>已使用</span></div><div><strong>${h.free}<small> MB</small></strong><span>剩余空间</span></div></div><p class="storage-warning">格式化会清空这张卡中的全部事件和录像，请谨慎操作。</p>${btn('format','格式化存储卡','','secondary danger')}${cancel}`;
if(m.type==='filters'){let f=m.draft;c=`<div class="sheet-title"><h3>筛选事件</h3>${btn('cancel','关闭筛选','close')}</div><label class="fieldlabel" for="filter-source">设备来源</label><select id="filter-source"><option value="all">全部来源</option>${h.devices.map(d=>`<option value="${d.id}" ${f.deviceFilter==d.id?'selected':''}>${esc(d.name.split(' · ')[0])}</option>`).join('')}</select><div class="date-time-grid"><div><label class="fieldlabel" for="filter-date">日期</label><input id="filter-date" type="date" value="${f.date}" aria-label="筛选日期"></div><div><label class="fieldlabel" for="filter-time">此时间之前</label><input id="filter-time" type="time" value="${f.time}" aria-label="筛选时间"></div></div><div class="filter-sheet-actions">${btn('reset-draft','重置','','secondary')}${btn('apply-filters','应用筛选','','primary')}</div>`}
return `<div class="overlay"><section class="sheet" role="dialog" aria-modal="true" aria-label="${({rename:'修改中继名称',pair:'配对新设备',event:'事件操作',ring:'选择叮咚铃声'})[m.type]||'操作确认'}"><div class="sheethandle"></div>${c}</section></div>`}
function specPanel(){let p=specs[state.page]||specs.home;const modalText={'pair-intro':'准备配对：确认设备上电并进入配网状态后开始搜索。',searching:'搜索附近设备：可取消；评审场景可验证搜索超时。','pair-success':'连接成功：显示结果与当前连接数，点击完成关闭。',filters:'筛选草稿：点击应用才生效，取消保留原筛选条件。',storage:'存储卡管理：先查看容量，再选择格式化，需再次确认。',rename:'名称编辑：非空且最多 24 字。保存生效；取消保留原值。',unbind:'解除配对：确认后更新连接数与直播设备；取消不变。',format:'格式化确认：说明清空事件与录像，仅确认后执行。',formatting:'格式化处理中：完成后更新容量并清空事件。',remove:'移除确认：同时解绑所有关联设备，完成后回到首页。',pair:'配对：设备进入配网状态，点击确认演示成功，也可进入超时分支。',pairing:'正在配对：可取消，取消后不会添加设备。',timeout:'配对超时：保留现有连接，允许重试。',ring:'铃声选择：单选、试听、保存。取消不提交。',event:'事件操作：长按或更多按钮触发下载、转发、删除。',delete:'事件删除：二次确认后移除，取消保留。'};
return `<p class="specmeta">ABEGAL / REPEATER MODULE</p><h2>${p.title}</h2><p class="specsub">页面规格 · 与手机当前页面同步<br>交互与视觉重设计 · 2026.10.30</p><div class="flowline">${p.flow}</div>${state.modal?`<div class="assumption"><b>当前弹窗 / 状态</b><br>${modalText[state.modal.type]||''}</div>`:''}${p.sections.map(([title,desc,rules],i)=>`<section class="speccard"><h3><span class="letter">${String.fromCharCode(65+i)}</span>${title}</h3><p>${desc}</p><ul>${rules.map(t=>`<li>${t}</li>`).join('')}</ul></section>`).join('')}<div class="assumption"><b>原型备注 · 待确认</b><br>${p.assumption}</div><div class="scenario"><label for="scenario">评审场景 · 不属于 APP 功能</label><select id="scenario">${[['normal','正常连接'],['offline','中继离线'],['loading','首页加载中'],['error','首页加载失败'],['pairerror','配对搜索超时']].map(([id,t])=>`<option value="${id}" ${state.scenario===id?'selected':''}>${t}</option>`).join('')}</select>${btn('reset','重置演示数据','','reset')}</div><div class="specfooter"><a href="${source}" target="_blank" rel="noopener">查看原始 Axure ↗</a><span>仅本地演示数据</span></div>`}
function render(){clearTimeout(renderTimer);if(lastPage===state.page&&$('.appbody'))bodyScroll=$('.appbody').scrollTop;else bodyScroll=0;lastPage=state.page;const livePage=['live','landscape','full'].includes(state.page),dark=state.theme==='dark'||livePage,landscape=state.page==='landscape';
$('#root').innerHTML=`<div class="shell ${state.immersive?'immersive':''}" data-pane="${state.pane}" data-inspect="${state.inspect}"><nav class="compacttabs" aria-label="原型视图">${[['menu','页面'],['app','APP'],['spec','规格']].map(([p,t])=>`<button data-act="pane:${p}" aria-pressed="${state.pane===p}" class="${state.pane===p?'active':''}">${t}</button>`).join('')}</nav><aside class="sidebar"><div class="brand"><strong>abegal<span>®</span></strong><small>你的家，始终相连。</small></div><p class="navhead">中继模块</p><nav class="navlist" aria-label="原型页面">${pages.map(([id,t,i])=>`<button data-act="page:${id}" class="navitem ${state.page===id?'active':''}" ${state.page===id?'aria-current="page"':''}>${icon(i)}<span>${t}</span></button>`).join('')}</nav><div class="sidefoot"><a href="${source}" target="_blank" rel="noopener">原始 Axure ↗</a><span>交互与视觉重设计 / 2026.10</span></div></aside><main class="stage"><div class="stagehead"><span>APP 体验</span><div>${btn('theme',state.theme==='light'?'深色外观':'浅色外观',state.theme==='light'?'moon':'sun','stage-button')}${state.immersive?btn('inspect',state.inspect?'关闭规格':'查看规格','','stage-button'):''}${btn('immersive',state.immersive?'返回评审':'沉浸体验','expand','stage-button')}</div></div><div class="phonewrap"><div class="phone ${dark?'dark':''} ${landscape?'landscape':''}" data-theme="${dark?'dark':'light'}"><div class="island"></div><div class="statusbar ${dark?'dark':''}"><span>9:41</span><span class="statusicons">${icon('signal')}${icon('wifi')}${icon('battery')}</span></div><div class="appscreen">${state.page==='home'?home():state.page==='settings'?settings():state.page==='events'?events():state.page==='full'?full():live()}${renderModal()}</div><div class="homebar"></div></div></div></main><aside class="spec" aria-label="页面规格">${specPanel()}</aside></div>`;if($('.appbody'))$('.appbody').scrollTop=bodyScroll;bind();if(state.modal){$('.sheet button,.sheet input,.sheet select')?.focus({preventScroll:true})}}
function modal(type,extra={}){state.modal={type,...extra};render()}
function downloadText(name,text,type='text/plain'){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function downloadFrame(label){downloadText(`Abegal-demo-${Date.now()}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#19392a"/><text x="60" y="220" fill="white" font-family="sans-serif" font-size="38">Abegal · DEMO FRAME</text><text x="60" y="290" fill="#a5c1ad" font-family="sans-serif" font-size="22">${esc(label)}</text><text x="60" y="380" fill="#a5c1ad" font-family="sans-serif" font-size="20">Static prototype sample · Not a camera recording</text></svg>`,'image/svg+xml')}
async function action(act){let [a,b,c]=act.split(':');let h=hub();switch(a){
case 'pane':state.pane=b;render();break;
case 'page':if(!state.hubs.length&&b!=='home'){go('home');toast('请先恢复演示设备');break}if(b==='full'){if(!h.devices.length){go('live');toast('请先为中继配对设备');break}state.selected=h.devices[0]?.id;state.fullFrom='live'}go(b);break;
case 'category':state.category=b;state.bottom='设备';render();break;
case 'theme':state.theme=state.theme==='light'?'dark':'light';render();break;
case 'immersive':state.immersive=!state.immersive;state.inspect=false;render();break;
case 'inspect':state.inspect=!state.inspect;render();break;
case 'home-add':if(state.hubs.length===1){state.hub=state.hubs[0].id;action('pair')}else if(state.hubs.length)modal('choose-hub');else toast('请先恢复演示中继');break;
case 'home-more':modal('home-more');break;
case 'add-to':state.hub=Number(b);go('settings','home');action('pair');break;
case 'manage-devices':state.manage=!state.manage;render();break;
case 'storage':modal('storage');break;
case 'filters':modal('filters',{draft:{deviceFilter:state.deviceFilter,date:state.date,time:state.time}});break;
case 'reset-draft':state.modal.draft={deviceFilter:'all',date:'',time:''};render();break;
case 'apply-filters':Object.assign(state,state.modal.draft);state.modal=null;render();break;
case 'type':state.filter=b;render();break;
case 'switchcam':state.selected=Number(b);state.muted=true;state.recording=false;render();break;
case 'home':state.bottom='设备';go('home');break;
case 'bottom':state.bottom=b;if(b==='消息'&&h){state.deviceFilter='all';go('events','home')}else go('home');break;
case 'hub':state.hub=Number(b);state.filter='全部';state.deviceFilter='all';state.date='';state.time='';if(c!=='settings'&&!guard())break;go(c,'home');break;
case 'direct':state.hub=Number(b);if(!guard())break;state.selected=Number(c);state.fullFrom='home';go('full');break;
case 'back':if(state.modal){state.modal=null;render();break}if(state.page==='full'){go(state.playback?'events':state.fullFrom);break}if(state.page==='settings'&&['live','landscape'].includes(state.from)){go(state.from,'home');break}state.bottom='设备';go('home');break;
case 'live-settings':go('settings',state.page);break;
case 'rename':if(guard())modal('rename');break;
case 'save-name':{let name=$('#hubname').value.trim();if(!name||name.length>24){$('#name-error').textContent='请输入 1–24 个字的中继名称';break}h.name=name;persist();state.modal=null;render();toast('中继名称已更新');break}
case 'unbind':if(guard())modal('unbind',{id:Number(b)});break;
case 'confirm-unbind':if(!guard())break;h.devices=h.devices.filter(d=>d.id!==state.modal.id);persist();state.modal=null;render();toast('已解除设备配对');break;
case 'pair':if(!guard())break;if(h.devices.length>=4){toast('最多连接 4 台设备');break}modal('pair-intro');break;
case 'start-search':{const target=h;modal('searching');clearTimeout(pairTimer);pairTimer=setTimeout(()=>{if(state.modal?.type==='searching'&&hub()?.id===target.id)modal(state.scenario==='pairerror'?'timeout':'pair')},1000);break;}
case 'pair-done':state.modal=null;render();break;
case 'confirm-pair':{if(!guard()||h.devices.length>=4)break;const target=h;modal('pairing');clearTimeout(pairTimer);pairTimer=setTimeout(()=>{if(state.modal?.type!=='pairing'||hub()?.id!==target.id)return;const id=Math.max(target.id*10,...target.devices.map(d=>d.id))+1;target.devices.push({id,name:'Cam '+(target.devices.length+1),type:'camera',image:'living',online:true});persist();modal('pair-success',{name:target.devices.at(-1).name})},1200);break}
case 'pair-timeout':clearTimeout(pairTimer);modal('timeout');break;
case 'ring':if(guard())modal('ring');break;
case 'save-ring':h.ring=$('input[name=ringtone]:checked').value;persist();state.modal=null;render();toast('铃声已更新');break;
case 'preview-ring':try{let Audio=window.AudioContext||window.webkitAudioContext;const ctx=new Audio();await ctx.resume();({'default':[659,523],'经典叮咚':[784,659],'轻柔和弦':[523,440],'清晨鸟鸣':[1047,1319]}[$('input[name=ringtone]:checked').value]||[659,523]).forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=f;g.gain.setValueAtTime(.08,ctx.currentTime+i*.24);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.24+.4);o.start(ctx.currentTime+i*.24);o.stop(ctx.currentTime+i*.24+.45)});setTimeout(()=>ctx.close(),1100);toast('正在试听所选铃声')}catch{toast('当前浏览器不支持试听，请尝试其他浏览器')}break;
case 'format':if(guard())modal('format');break;
case 'confirm-format':{if(!guard())break;let target=h;modal('formatting');clearTimeout(pairTimer);pairTimer=setTimeout(()=>{target.used=0;target.free=579;state.events=state.events.filter(e=>e.hub!==target.id);persist();state.modal=null;render();toast('格式化完成，存储卡已清空')},1200);break}
case 'remove':if(guard())modal('remove');break;
case 'confirm-remove':state.hubs=state.hubs.filter(x=>x.id!==h.id);state.events=state.events.filter(e=>e.hub!==h.id);persist();go('home');toast('中继及其设备配对已移除');break;
case 'cancel':clearTimeout(pairTimer);state.modal=null;render();break;
case 'retry':state.scenario='normal';render();toast('设备已重新加载');break;
case 'restore':case 'reset':clearTimeout(pairTimer);state.hubs=defaultHubs();state.events=defaultEvents();state.hub=1;state.scenario='normal';state.filter='全部';state.deviceFilter='all';state.date='';state.time='';state.bottom='设备';state.category='中继';persist();go('home');toast('演示数据已恢复');break;
case 'latest':state.date='';state.time='';render();break;
case 'clearfilters':state.filter='全部';state.deviceFilter='all';state.date='';state.time='';render();break;
case 'event':modal('event',{id:Number(b)});break;
case 'delete-event':modal('delete',{id:state.modal.id});break;
case 'confirm-delete':state.events=state.events.filter(e=>e.id!==state.modal.id);persist();state.modal=null;render();toast('事件已删除');break;
case 'download-event':{let e=state.events.find(e=>e.id===state.modal.id);downloadFrame(`${e.type} / ${e.date} ${e.time}`);toast('已导出演示关键帧 SVG');break}
case 'share-event':{let e=state.events.find(e=>e.id===state.modal.id);let msg=`Abegal 演示事件：${e.type}，${e.date} ${e.time}（静态示例，非真实录像）`;if(navigator.share){try{await navigator.share({title:'Abegal 演示事件',text:msg});toast('已打开系统分享')}catch(err){if(err.name!=='AbortError')toast('分享暂不可用，请下载演示关键帧')}}else{downloadText('Abegal-demo-event.txt',msg);toast('已导出事件信息，可自行转发')}break}
case 'layout':go(state.page==='landscape'?'live':'landscape');break;
case 'showtools':state.toolsVisible=true;render();break;
case 'full':if(!guard())break;state.selected=Number(b);state.fullFrom=state.page;go('full');break;
case 'full-layout':state.fullWide=!state.fullWide;render();break;
case 'sound':if(!guard())break;state.muted=!state.muted;render();toast(state.muted?'已静音':'声音已开启 · 当前为静态演示，无实时音轨');break;
case 'snapshot':downloadFrame(h.devices.find(d=>d.id===state.selected)?.name||'示例画面');toast('已导出演示截图 SVG');break;
case 'record':if(!guard())break;state.recording=!state.recording;render();toast(state.recording?'录制状态演示已开始':'录制状态演示已结束 · 不生成视频');break;
case 'playback':{let e=state.events.find(e=>e.id===Number(b));state.selected=e.device;state.page='full';state.playback=e;state.fullFrom='events';state.playing=true;state.progress=0;render();break}
case 'playing':state.playing=!state.playing;render();break;
case 'returnlive':go(state.playback?'events':state.fullFrom);break;
}}
function bind(){$('#root').onclick=e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled){action(b.dataset.act);return}if(e.target.classList.contains('overlay')&&state.modal?.type!=='formatting'){action('cancel');return}if(state.page==='landscape'&&e.target.closest('.feed')){clearTimeout(feedClickTimer);feedClickTimer=setTimeout(()=>{if(state.page==='landscape'){state.toolsVisible=!state.toolsVisible;render()}},280)}};
$('#scenario').onchange=e=>{clearTimeout(pairTimer);state.scenario=e.target.value;state.modal=null;if(['loading','error'].includes(state.scenario))go('home');else render()};
const vol=$('[aria-label="叮咚音量"]');if(vol)vol.oninput=e=>{hub().volume=Number(e.target.value);$('#volumeValue').textContent=e.target.value+'%';persist()};
const filterSheet=$('#filter-source');if(filterSheet){filterSheet.onchange=e=>state.modal.draft.deviceFilter=e.target.value;$('#filter-date').onchange=e=>state.modal.draft.date=e.target.value;$('#filter-time').onchange=e=>state.modal.draft.time=e.target.value}
const ring=$('.sheet');if(ring&&state.modal?.type==='ring')ring.onchange=e=>{if(e.target.name==='ringtone')state.modal.value=e.target.value};
[['事件来源','deviceFilter'],['事件分类','filter'],['筛选日期','date'],['筛选时间','time']].forEach(([label,key])=>{const el=$(`[aria-label="${label}"]`);if(el&&!state.modal)el.onchange=e=>{state[key]=e.target.value;render()}});
document.querySelectorAll('[data-feed]').forEach(el=>{el.ondblclick=()=>{clearTimeout(feedClickTimer);action('full:'+el.dataset.feed)};el.onkeydown=e=>{if(e.key==='Enter')action('full:'+el.dataset.feed)}});
document.querySelectorAll('[data-event]').forEach(el=>{el.onpointerdown=e=>{if(e.target.closest('.eventmore'))return;clearTimeout(longTimer);longTimer=setTimeout(()=>{modal('event',{id:Number(el.dataset.event)})},600)};el.onpointerup=el.onpointercancel=el.onpointerleave=()=>clearTimeout(longTimer);el.oncontextmenu=e=>{e.preventDefault();modal('event',{id:Number(el.dataset.event)})};el.onkeydown=e=>{if(e.key==='Enter')modal('event',{id:Number(el.dataset.event)})}});
const prog=$('[aria-label="回放进度"]');if(prog)prog.oninput=e=>{state.progress=Number(e.target.value);$('#elapsed').textContent='00:'+String(state.progress).padStart(2,'0')};
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.modal?.type!=='formatting'&&state.modal)action('cancel');if(e.key==='Tab'&&state.modal){const els=[...document.querySelectorAll('.sheet button:not(:disabled),.sheet input,.sheet select')];if(!els.length)return;let first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault()}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault()}}});
window.addEventListener('resize',()=>{clearTimeout(renderTimer);renderTimer=setTimeout(()=>{if(['live','landscape'].includes(state.page)){const wide=window.innerWidth>window.innerHeight;if(wide&&window.innerWidth<900&&state.page==='live')go('landscape');else if(!wide&&state.page==='landscape'&&window.innerWidth<900)go('live')}},150)});
setInterval(()=>{if(state.page==='full'&&state.playback&&state.playing&&!state.modal){state.progress=Math.min(30,state.progress+1);const prog=$('[aria-label="回放进度"]');if(prog){prog.value=state.progress;$('#elapsed').textContent='00:'+String(state.progress).padStart(2,'0')}if(state.progress===30){state.playing=false;render()}}},1000);
const views=createViews({state,hub,esc,icon,btn,selectedEvents,feed,appnav});
render();
