/* Nexus experience layer: presentation + announcements; does not alter CBT logic */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const fmt=d=>new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});
const isDash=()=>!$('dashboard')?.classList.contains('hidden');
let notices=[];
let currentUser=null;
function item(n,cls){
 const el=document.createElement('article');el.className=cls;
 const h=document.createElement('h3');h.textContent=n.title||'Announcement';
 const p=document.createElement('p');p.textContent=n.message||'';
 const t=document.createElement('time');t.dateTime=n.created_at||'';
 t.textContent=n.created_at?fmt(n.created_at):'';
 el.append(h,p);
 const urls=Array.isArray(n.attachment_urls)&&n.attachment_urls.length?n.attachment_urls:(n.attachment_url?[n.attachment_url]:[]);
 if(urls.length){
  const gallery=document.createElement('div');gallery.className='nexus-notice-gallery';
  urls.slice(0,6).forEach(url=>{
   try{const u=new URL(url,location.origin);if(u.protocol!=='https:')return;
    const link=document.createElement('a');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Open announcement image');
    const img=document.createElement('img');img.src=u.href;img.alt='Announcement attachment';img.loading='lazy';link.appendChild(img);gallery.appendChild(link)
   }catch(_){}
  });
  if(gallery.childElementCount)el.appendChild(gallery);
 }
 el.append(t);return el
}
function themeButtons(){document.querySelectorAll('.nexus-theme-switch').forEach(b=>{const dark=document.body.classList.contains('dark');b.textContent=dark?'☀':'☾';b.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode')})}
document.querySelectorAll('.nexus-theme-switch').forEach(b=>b.addEventListener('click',()=>{if(typeof applyTheme==='function')applyTheme(document.body.classList.contains('dark')?'light':'dark');themeButtons()}));themeButtons();
const themeObserver=new MutationObserver(themeButtons);themeObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
async function publicNews(){const target=$('nexusPublicNewsItems');if(!target)return;try{const {data,error}=await supabaseClient.rpc('get_public_nexus_announcements_v3');if(error)throw error;target.replaceChildren();if(!data?.length){const p=document.createElement('p');p.textContent='No public announcements yet. Check back for updates.';target.append(p);return}data.forEach(n=>target.append(item(n,'nexus-news-card')))}catch(e){console.warn('Public notices',e);target.textContent='Announcements are temporarily unavailable.'}}
function seenKey(){return 'nexus-notices-seen-'+(currentUser?.id||'guest')}
function unread(){const seen=Number(localStorage.getItem(seenKey())||0);return notices.filter(n=>new Date(n.created_at).getTime()>seen).length}

const NOTICES_PER_PAGE=5;
let noticePage=0;
const bellButton=$('nexusBell');
const bellPanel=$('nexusBellPanel');
// A floating panel must not be clipped by the dashboard, animated header or sidebar.
if(bellPanel){document.body.appendChild(bellPanel);bellPanel.classList.add('nexus-notice-popover')}
function panelPosition(){
 if(!bellPanel||bellPanel.classList.contains('hidden')||!bellButton)return;
 const r=bellButton.getBoundingClientRect();
 const gap=10,pad=12,w=Math.min(420,window.innerWidth-pad*2);
 const left=Math.max(pad,Math.min(window.innerWidth-w-pad,r.right-w));
 const below=window.innerHeight-r.bottom,above=r.top;
 const placeAbove=below<260&&above>below;
 bellPanel.style.setProperty('width',w+'px','important');
 bellPanel.style.setProperty('max-width',w+'px','important');
 bellPanel.style.setProperty('left',left+'px','important');
 bellPanel.style.setProperty('right','auto','important');
 bellPanel.style.setProperty('top',placeAbove?'auto':Math.max(pad,r.bottom+gap)+'px','important');
 bellPanel.style.setProperty('bottom',placeAbove?Math.max(pad,window.innerHeight-r.top+gap)+'px':'auto','important');
 bellPanel.style.setProperty('max-height',Math.max(160,(placeAbove?above:below)-gap-pad)+'px','important');
}
function closeBell(){
 if(!bellPanel)return;
 bellPanel.classList.add('hidden');
 bellButton?.setAttribute('aria-expanded','false');
}
function redrawBell(){
 const list=$('nexusBellItems'),count=$('nexusUnreadCount');
 if(!list||!count)return;
 const pages=Math.max(1,Math.ceil(notices.length/NOTICES_PER_PAGE));
 noticePage=Math.min(Math.max(0,noticePage),pages-1);
 list.replaceChildren();
 const portion=notices.slice(noticePage*NOTICES_PER_PAGE,(noticePage+1)*NOTICES_PER_PAGE);
 if(!portion.length){const empty=document.createElement('p');empty.className='nexus-notice-empty';empty.textContent='No notifications yet.';list.appendChild(empty)}
 else portion.forEach(n=>list.appendChild(item(n,'nexus-bell-item')));
 let nav=bellPanel?.querySelector('.nexus-notice-pagination');
 if(!nav&&bellPanel){
  nav=document.createElement('nav');nav.className='nexus-notice-pagination';nav.setAttribute('aria-label','Notification pages');
  const prev=document.createElement('button');prev.type='button';prev.className='nexus-notice-page-arrow';prev.textContent='←';prev.setAttribute('aria-label','Previous five notifications');
  const label=document.createElement('span');label.className='nexus-notice-page-label';label.setAttribute('aria-live','polite');
  const next=document.createElement('button');next.type='button';next.className='nexus-notice-page-arrow';next.textContent='→';next.setAttribute('aria-label','Next five notifications');
  prev.addEventListener('click',()=>{noticePage--;redrawBell()});
  next.addEventListener('click',()=>{noticePage++;redrawBell()});
  nav.append(prev,label,next);bellPanel.appendChild(nav);
 }
 if(nav){
  nav.hidden=notices.length<=NOTICES_PER_PAGE;
  const [prev,label,next]=nav.children;
  prev.disabled=noticePage===0;
  next.disabled=noticePage>=pages-1;
  label.textContent='Page '+(noticePage+1)+' of '+pages;
 }
 const size=unread();count.textContent=size>99?'99+':String(size);count.classList.toggle('hidden',size===0);
 if(!bellPanel?.classList.contains('hidden'))panelPosition();
}
async function loadDashboardNotices(){
 if(!currentUser)return;
 const {data,error}=await supabaseClient.from('app_notifications')
 .select('id,title,message,created_at,attachment_url,attachment_urls')
 .eq('published',true).order('created_at',{ascending:false}).limit(100);
 if(error){console.warn('Student notifications',error);return}
 notices=data||[];redrawBell();
}
function markRead(){localStorage.setItem(seenKey(),String(Date.now()));redrawBell()}
bellButton?.addEventListener('click',()=>{
 if(!bellPanel)return;
 const open=bellPanel.classList.contains('hidden');
 bellPanel.classList.toggle('hidden',!open);
 bellButton.setAttribute('aria-expanded',String(open));
 if(open){noticePage=0;redrawBell();panelPosition();markRead()}
});
$('nexusMarkRead')?.addEventListener('click',markRead);
document.addEventListener('pointerdown',e=>{
 if(!bellPanel?.classList.contains('hidden')&&!bellPanel.contains(e.target)&&!bellButton?.contains(e.target))closeBell();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBell()});
window.addEventListener('resize',panelPosition,{passive:true});
window.addEventListener('scroll',panelPosition,{passive:true,capture:true});
async function syncAdmin(){const publisher=$('nexusAdminPublisher');if(!publisher)return;publisher.classList.add('hidden');try{const {data,error}=await supabaseClient.rpc('is_app_admin');if(!error&&data===true)publisher.classList.remove('hidden')}catch(e){console.warn('Admin status unavailable',e)}}
$('nexusPublishForm')?.addEventListener('submit',async e=>{e.preventDefault();const status=$('nexusPublishStatus');const btn=$('nexusPublishButton');btn.disabled=true;status.textContent='Publishing…';try{
const check=await supabaseClient.rpc('is_app_admin');if(check.error||check.data!==true)throw new Error('Only authorized administrators can publish announcements.');
const title=$('nexusPostTitle').value.trim(),message=$('nexusPostMessage').value.trim();if(!title||!message)throw new Error('Title and message are required.');
const {error}=await supabaseClient.from('app_notifications').insert({title,message,category:'school',published:true,target_level:null});if(error)throw error;
$('nexusPublishForm').reset();status.textContent='Announcement published to the website and student dashboard.';await Promise.all([publicNews(),loadDashboardNotices()]);if(typeof loadNotices==='function')loadNotices();
}catch(err){status.textContent=err.message||'Publishing failed.'}finally{btn.disabled=false}});
let lastId='';async function checkAuth(){if(!isDash()){currentUser=null;lastId='';return}try{const {data:{user},error}=await supabaseClient.auth.getUser();if(error||!user)return;currentUser=user;if(lastId===user.id)return;lastId=user.id;await Promise.all([loadDashboardNotices(),syncAdmin()]);}catch(e){console.warn('Notification load',e)}}
new MutationObserver(checkAuth).observe($('dashboard'),{attributes:true,attributeFilter:['class']});
supabaseClient.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){currentUser=null;lastId='';notices=[];redrawBell();$('nexusAdminPublisher')?.classList.add('hidden')}else if(event==='SIGNED_IN')setTimeout(checkAuth,0)});
publicNews();checkAuth();
// Refresh notice data while tab is visible; don't interfere with quizzes.
let lastRefresh=0;document.addEventListener('visibilitychange',()=>{if(document.hidden||Date.now()-lastRefresh<45000)return;lastRefresh=Date.now();publicNews();if(currentUser)loadDashboardNotices()});
})();
