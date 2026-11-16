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
// Admin announcements: keep all uploads restricted by Supabase admin policies.
const MAX_NOTICE_PHOTOS=6, MAX_NOTICE_BYTES=5*1024*1024;
let noticePreviewUrls=[];
function releaseNoticePreviews(){
 noticePreviewUrls.forEach(url=>URL.revokeObjectURL(url));noticePreviewUrls=[];
 const box=$('nexusPostImagePreview');if(box){box.replaceChildren();box.classList.add('hidden')}
 const count=$('nexusPostImageCount');if(count)count.textContent='No photos selected';
}
function validateNoticePhotos(files){
 if(files.length>MAX_NOTICE_PHOTOS)throw new Error('Choose no more than 6 pictures.');
 for(const file of files){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Only JPG, PNG or WebP photos are supported.');
  if(file.size>MAX_NOTICE_BYTES)throw new Error('Each photo must be 5 MB or smaller: '+file.name);
 }
}
$('nexusPostImage')?.addEventListener('change',()=>{
 releaseNoticePreviews();const input=$('nexusPostImage'),files=[...(input?.files||[])];
 try{validateNoticePhotos(files)}catch(e){input.value='';const status=$('nexusPublishStatus');if(status)status.textContent=e.message;return}
 const box=$('nexusPostImagePreview');if(!box||!files.length)return;
 box.classList.remove('hidden');$('nexusPostImageCount').textContent=files.length+' photo'+(files.length===1?'':'s')+' selected';
 files.forEach((file,i)=>{
  const url=URL.createObjectURL(file);noticePreviewUrls.push(url);
  const card=document.createElement('div');card.className='nexus-photo-preview';
  const img=document.createElement('img');img.src=url;img.alt='Selected photo '+(i+1);
  const caption=document.createElement('small');caption.textContent=file.name;
  card.append(img,caption);box.appendChild(card)
 });
});
async function ensureNoticeAdmin(){
 const {data,error}=await supabaseClient.rpc('is_app_admin');
 if(error||data!==true)throw new Error('Only authorized administrators may manage announcements.');
}
async function listAdminNotices(){
 const box=$('nexusAdminNotices');if(!box)return;
 box.textContent='Loading announcements…';
 const {data,error}=await supabaseClient.from('app_notifications').select('id,title,created_at,published,attachment_path,attachment_paths').order('created_at',{ascending:false}).limit(60);
 if(error){box.textContent='Cannot load announcements: '+error.message;return}
 box.replaceChildren();
 if(!data?.length){box.textContent='No announcements yet.';return}
 for(const record of data){
  const row=document.createElement('div');row.className='nexus-admin-notice-row';
  const description=document.createElement('div'),name=document.createElement('strong'),date=document.createElement('small');
  name.textContent=record.title||'Untitled';
  date.textContent=(record.created_at?fmt(record.created_at):'')+' • '+(record.published?'Published':'Unpublished');
  description.append(name,date);
  const del=document.createElement('button');del.type='button';del.className='nexus-admin-delete';del.textContent='Delete';
  del.addEventListener('click',async()=>{
   if(!confirm('Permanently delete announcement: '+(record.title||'Untitled')+'?'))return;
   del.disabled=true;
   try{
    await ensureNoticeAdmin();
    const {error:deleteError}=await supabaseClient.from('app_notifications').delete().eq('id',record.id);
    if(deleteError)throw deleteError;
    const paths=[...new Set([...(Array.isArray(record.attachment_paths)?record.attachment_paths:[]),record.attachment_path].filter(Boolean))];
    if(paths.length){const result=await supabaseClient.storage.from('notification-attachments').remove(paths);if(result.error)console.warn('Announcement storage cleanup:',result.error.message)}
    await Promise.all([listAdminNotices(),publicNews(),loadDashboardNotices()]);
    if(typeof loadNotices==='function')loadNotices();
   }catch(err){alert(err.message||'Could not delete announcement.');del.disabled=false}
  });
  row.append(description,del);box.append(row);
 }
}
async function syncAdmin(){
 const panel=$('nexusAdminPublisher');if(!panel)return;panel.classList.add('hidden');
 try{await ensureNoticeAdmin();panel.classList.remove('hidden');await listAdminNotices()}
 catch(error){console.warn('Admin access unavailable:',error.message)}
}
$('nexusPublishForm')?.addEventListener('submit',async event=>{
 event.preventDefault();
 const status=$('nexusPublishStatus'),button=$('nexusPublishButton'),files=[...($('nexusPostImage')?.files||[])],paths=[];
 button.disabled=true;status.textContent='Publishing…';let inserted=false;
 try{
  await ensureNoticeAdmin();validateNoticePhotos(files);
  const title=$('nexusPostTitle').value.trim(),message=$('nexusPostMessage').value.trim();
  if(!title||!message)throw new Error('Enter a title and announcement message.');
  const urls=[];
  for(let i=0;i<files.length;i++){
   const file=files[i],suffix=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
   const path='nexus-announcements/'+crypto.randomUUID()+'.'+suffix;
   status.textContent='Uploading image '+(i+1)+' of '+files.length+'…';
   const {error:uploadError}=await supabaseClient.storage.from('notification-attachments').upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError)throw uploadError;
   paths.push(path);
   urls.push(supabaseClient.storage.from('notification-attachments').getPublicUrl(path).data.publicUrl);
  }
  const first=files[0];
  const {error:insertError}=await supabaseClient.from('app_notifications').insert({
    title,message,category:'school',published:true,target_level:null,
    attachment_url:urls[0]||null,attachment_urls:urls,
    attachment_path:paths[0]||null,attachment_paths:paths,
    attachment_name:first?.name||null,attachment_type:first?'image':null,attachment_mime:first?.type||null
  });
  if(insertError)throw insertError;inserted=true;
  $('nexusPublishForm').reset();releaseNoticePreviews();
  status.textContent='Announcement published successfully.';
  await Promise.all([publicNews(),loadDashboardNotices(),listAdminNotices()]);
  if(typeof loadNotices==='function')loadNotices();
 }catch(err){
  if(!inserted&&paths.length){
   const cleanup=await supabaseClient.storage.from('notification-attachments').remove(paths);
   if(cleanup.error)console.warn('Unable to clean up unpublished attachments:',cleanup.error.message);
  }
  status.textContent=err.message||'Publishing failed.';
 }finally{button.disabled=false}
});
let lastId='';async function checkAuth(){if(!isDash()){currentUser=null;lastId='';return}try{const {data:{user},error}=await supabaseClient.auth.getUser();if(error||!user)return;currentUser=user;if(lastId===user.id)return;lastId=user.id;await Promise.all([loadDashboardNotices(),syncAdmin()]);}catch(e){console.warn('Notification load',e)}}
new MutationObserver(checkAuth).observe($('dashboard'),{attributes:true,attributeFilter:['class']});
supabaseClient.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){currentUser=null;lastId='';notices=[];redrawBell();$('nexusAdminPublisher')?.classList.add('hidden')}else if(event==='SIGNED_IN')setTimeout(checkAuth,0)});
publicNews();checkAuth();
// Refresh notice data while tab is visible; don't interfere with quizzes.
let lastRefresh=0;document.addEventListener('visibilitychange',()=>{if(document.hidden||Date.now()-lastRefresh<45000)return;lastRefresh=Date.now();publicNews();if(currentUser)loadDashboardNotices()});
})();
