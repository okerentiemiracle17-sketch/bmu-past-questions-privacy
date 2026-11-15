/* Nexus experience layer: presentation + announcements; does not alter CBT logic */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const fmt=d=>new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});
const isDash=()=>!$('dashboard')?.classList.contains('hidden');
let notices=[];
let currentUser=null;
function item(n,cls){const el=document.createElement('article');el.className=cls;const h=document.createElement('h3');h.textContent=n.title||'Announcement';const p=document.createElement('p');p.textContent=n.message||'';const t=document.createElement('time');t.dateTime=n.created_at||'';t.textContent=n.created_at?fmt(n.created_at):'';el.append(h,p,t);return el}
function themeButtons(){document.querySelectorAll('.nexus-theme-switch').forEach(b=>{const dark=document.body.classList.contains('dark');b.textContent=dark?'☀':'☾';b.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode')})}
document.querySelectorAll('.nexus-theme-switch').forEach(b=>b.addEventListener('click',()=>{if(typeof applyTheme==='function')applyTheme(document.body.classList.contains('dark')?'light':'dark');themeButtons()}));themeButtons();
const themeObserver=new MutationObserver(themeButtons);themeObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
async function publicNews(){const target=$('nexusPublicNewsItems');if(!target)return;try{const {data,error}=await supabaseClient.rpc('get_public_nexus_announcements');if(error)throw error;target.replaceChildren();if(!data?.length){const p=document.createElement('p');p.textContent='No public announcements yet. Check back for updates.';target.append(p);return}data.forEach(n=>target.append(item(n,'nexus-news-card')))}catch(e){console.warn('Public notices',e);target.textContent='Announcements are temporarily unavailable.'}}
function seenKey(){return 'nexus-notices-seen-'+(currentUser?.id||'guest')}
function unread(){const seen=Number(localStorage.getItem(seenKey())||0);return notices.filter(n=>new Date(n.created_at).getTime()>seen).length}
function redrawBell(){const list=$('nexusBellItems'),count=$('nexusUnreadCount');if(!list||!count)return;list.replaceChildren();notices.forEach(n=>list.append(item(n,'nexus-bell-item')));if(!notices.length)list.textContent='No notifications yet.';const size=unread();count.textContent=size>99?'99+':String(size);count.classList.toggle('hidden',size===0)}
async function loadDashboardNotices(){if(!currentUser)return;const {data,error}=await supabaseClient.from('app_notifications').select('id,title,message,created_at').eq('published',true).order('created_at',{ascending:false}).limit(30);if(error){console.warn('Student notifications',error);return}notices=data||[];redrawBell()}
function markRead(){localStorage.setItem(seenKey(),String(Date.now()));redrawBell()}
$('nexusBell')?.addEventListener('click',()=>{const panel=$('nexusBellPanel');const opened=!panel.classList.toggle('hidden');$('nexusBell').setAttribute('aria-expanded',String(opened));if(opened)markRead()});
$('nexusMarkRead')?.addEventListener('click',markRead);
document.addEventListener('click',e=>{if(!e.target.closest('.nexus-bell-wrap')){$('nexusBellPanel')?.classList.add('hidden');$('nexusBell')?.setAttribute('aria-expanded','false')}});
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
