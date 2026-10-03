(() => {
  const isMobile=()=>window.matchMedia('(max-width: 720px), (pointer: coarse)').matches;
  const enhanced=new WeakSet();

  function svgViewBox(svg){
    const parts=(svg.getAttribute('viewBox')||'0 0 0 0').trim().split(/\s+/).map(Number);
    return {width:parts[2]||0,height:parts[3]||0};
  }

  function enlargePhaseTargets(svg){
    svg.querySelectorAll('.classic-phase-target:not(.classic-phase-hit)').forEach(target=>{
      const hit=target.cloneNode(false);
      hit.classList.add('classic-phase-hit');
      hit.setAttribute('r','18');
      hit.setAttribute('fill','transparent');
      hit.setAttribute('stroke','transparent');
      hit.setAttribute('stroke-width','0');
      target.parentNode.insertBefore(hit,target);
    });
  }

  function enhanceClassicSolver(card){
    if(!card||enhanced.has(card)) return;
    const frame=card.querySelector('.classic-solver-frame');
    const svg=frame?.querySelector('.classic-cipher-svg');
    const decode=card.querySelector('.classic-decode-panel');
    if(!frame||!svg||!decode) return;
    enhanced.add(card);

    const tools=document.createElement('div');
    tools.className='classic-mobile-tools';
    tools.innerHTML=`
      <div class="classic-zoom-tools" role="group" aria-label="Classic puzzle zoom">
        <button type="button" data-classic-zoom="out" aria-label="Zoom out">−</button>
        <button type="button" data-classic-zoom="fit">Fit</button>
        <span class="classic-zoom-readout" aria-live="polite">100%</span>
        <button type="button" data-classic-zoom="in" aria-label="Zoom in">+</button>
      </div>
      <button type="button" class="classic-focus-button" aria-pressed="false">Focus</button>`;
    frame.parentNode.insertBefore(tools,frame);

    const view=svgViewBox(svg);
    let fitWidth=0;
    let workingWidth=0;
    let zoom=1;

    function calculateWidths(){
      fitWidth=Math.max(280,frame.clientWidth-12);
      // ~20 px per 26-unit Classic cell at the default mobile working scale.
      workingWidth=Math.max(fitWidth,Math.min(1800,view.width*(20/26)));
    }

    function applyZoom(next,{keepCenter=true}={}){
      calculateWidths();
      const oldWidth=parseFloat(svg.style.width)||workingWidth;
      const oldCenterX=frame.scrollLeft+frame.clientWidth/2;
      const oldCenterY=frame.scrollTop+frame.clientHeight/2;
      zoom=Math.max(.55,Math.min(1.8,next));
      const width=workingWidth*zoom;
      svg.style.width=`${Math.round(width)}px`;
      svg.style.maxWidth='none';
      tools.querySelector('.classic-zoom-readout').textContent=`${Math.round(width/workingWidth*100)}%`;
      if(keepCenter&&oldWidth>0){
        const ratio=width/oldWidth;
        requestAnimationFrame(()=>{
          frame.scrollLeft=Math.max(0,oldCenterX*ratio-frame.clientWidth/2);
          frame.scrollTop=Math.max(0,oldCenterY*ratio-frame.clientHeight/2);
        });
      }
    }

    function fit(){
      calculateWidths();
      const oldCenterX=frame.scrollLeft+frame.clientWidth/2;
      const oldWidth=parseFloat(svg.style.width)||workingWidth;
      svg.style.width=`${Math.round(fitWidth)}px`;
      svg.style.maxWidth='none';
      tools.querySelector('.classic-zoom-readout').textContent='Fit';
      if(oldWidth){
        const ratio=fitWidth/oldWidth;
        requestAnimationFrame(()=>{frame.scrollLeft=Math.max(0,oldCenterX*ratio-frame.clientWidth/2);});
      }
    }

    tools.addEventListener('click',event=>{
      const zoomButton=event.target.closest('[data-classic-zoom]');
      if(zoomButton){
        const action=zoomButton.dataset.classicZoom;
        if(action==='fit') fit();
        else applyZoom(zoom+(action==='in'?.2:-.2));
        return;
      }
      const focus=event.target.closest('.classic-focus-button');
      if(focus){
        const on=!card.classList.contains('classic-focus-mode');
        card.classList.toggle('classic-focus-mode',on);
        document.body.classList.toggle('classic-focus-open',on);
        focus.textContent=on?'Done':'Focus';
        focus.setAttribute('aria-pressed',String(on));
        requestAnimationFrame(()=>applyZoom(zoom,{keepCenter:false}));
      }
    });

    enlargePhaseTargets(svg);
    card.classList.add('classic-mobile-enhanced');

    if(isMobile()){
      requestAnimationFrame(()=>{
        applyZoom(1,{keepCenter:false});
        // Start at the data-bearing top-left rather than centered on a huge field.
        frame.scrollLeft=0;
        frame.scrollTop=0;
      });
    }

    const resize=new ResizeObserver(()=>{
      if(!card.isConnected){resize.disconnect();return;}
      if(isMobile()&&!card.classList.contains('classic-focus-mode')) applyZoom(zoom,{keepCenter:false});
    });
    resize.observe(frame);
  }

  function scan(){
    document.querySelectorAll('.classic-solver-card').forEach(enhanceClassicSolver);
  }

  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>setTimeout(scan,0));
  scan();
})();