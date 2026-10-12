/* V25.2 first-run welcome, presentation only. Boot/storage/onboarding actions untouched. */
(function(){
  'use strict';
  const root=document.getElementById('onboard');
  if(!root||root.dataset.v25EntryReady==='yes')return;
  const paths=[
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9z"/>',
    '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
    '<path d="M3 3v18h18M7 17v-5M12 17V8M17 17V5"/>'
  ];
  const slides=[...root.querySelectorAll('.ob-slide')];
  slides.forEach((slide,i)=>{
    const mark=slide.querySelector('.em');
    if(!mark)return;
    mark.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[i]||paths[0])+'</svg>';
    mark.setAttribute('aria-hidden','true');
    const title=slide.querySelector('h2');
    if(title)title.classList.add('r25-intro-title');
    const desc=slide.querySelector('p');
    if(desc)desc.classList.add('r25-intro-description');
  });
  const brand=document.createElement('div');
  brand.className='r25-welcome-brand';
  brand.innerHTML='<img src="img/sanad-v25-original-logo.webp" alt="" width="48" height="48"><div><strong>سند</strong><span>SANAD</span></div>';
  root.insertBefore(brand,root.firstChild);
  const badge=document.createElement('div');
  badge.className='r25-welcome-label';
  badge.textContent='أموالك، بوضوح وأمان';
  const bottom=root.querySelector('.ob-bottom');
  if(bottom)bottom.insertBefore(badge,bottom.firstChild);
  const next=root.querySelector('[onclick="onboardNext()"]');
  if(next){next.classList.add('r25-welcome-next');next.setAttribute('aria-label','التالي');}
  const skip=root.querySelector('[onclick="onboardSkip()"]');
  if(skip){skip.classList.add('r25-welcome-skip');skip.setAttribute('aria-label','تخطي التعريف');}
  root.dataset.v25EntryReady='yes';
})();
