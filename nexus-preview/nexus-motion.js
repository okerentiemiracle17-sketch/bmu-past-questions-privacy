/* Optional public-site animations. This file does not access authentication,
 * Supabase, subscriptions, quiz answers, or study-room state. */
(()=>{
  'use strict';
  const root=document.getElementById('publicWebsite');
  if(!root)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const progress=document.createElement('div');
  progress.className='nexus-scroll-progress';
  progress.setAttribute('aria-hidden','true');
  document.body.appendChild(progress);
  let scheduled=false;
  function updateProgress(){
    scheduled=false;
    // Only show progress when viewing the public site, not during CBT.
    const visible=!root.classList.contains('hidden') && getComputedStyle(root).display!=='none';
    progress.style.display=visible?'block':'none';
    if(!visible)return;
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    progress.style.transform=`scaleX(${Math.min(1,Math.max(0,scrollY/max))})`;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(updateProgress)}
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  const observerChange=new MutationObserver(schedule);
  observerChange.observe(root,{attributes:true,attributeFilter:['class','style']});
  schedule();
  if(reduced.matches)return;
  const cards=[...root.querySelectorAll('#features .feature-card')];
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver((entries)=>{
      for(const e of entries){
        if(!e.isIntersecting)continue;
        e.target.classList.add('nexus-motion-in');
        io.unobserve(e.target);
      }
    },{threshold:.08,rootMargin:'0px 0px 70px 0px'});
    cards.forEach((card,i)=>{
      card.style.setProperty('--nexus-stagger',`${(i%3)*90}ms`);
      card.classList.add('nexus-motion-entry');
      io.observe(card);
    });
  }
  // Animate only this static marketing title; preserve its text and accessibility.
  const title=root.querySelector('.hero-content h2');
  if(title){
    let index=0;
    [...title.childNodes].forEach(node=>{
      if(node.nodeType!==Node.TEXT_NODE && node.nodeType!==Node.ELEMENT_NODE)return;
      if(node.nodeType===Node.ELEMENT_NODE && node.children.length)return;
      const value=node.textContent||'';
      if(!value.trim())return;
      const holder=document.createElement('span');
      holder.setAttribute('aria-hidden','true');
      value.split(/(\s+)/).forEach(part=>{
        if(!part)return;
        if(/^\s+$/.test(part)){holder.appendChild(document.createTextNode(part));return;}
        const word=document.createElement('span');
        word.className='nexus-animated-word nexus-word-in';
        word.style.setProperty('--nexus-word-delay',`${Math.min(index++,8)*110}ms`);
        word.textContent=part;
        holder.appendChild(word);
      });
      if(node.nodeType===Node.ELEMENT_NODE){holder.className=node.className;node.replaceWith(holder)}
      else node.replaceWith(holder);
    });
    title.setAttribute('aria-label','Study smarter. Prepare better.');
  }
})();
