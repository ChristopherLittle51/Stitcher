(() => {
  const C = window.StitcherCipher;
  if(!C) throw new Error('Stitcher cipher engine failed to load.');

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const navButtons = $$('.nav-button');
  const views = $$('.view');
  const challengeEmpty = $('#challenge-empty');
  const challengeArea = $('#challenge-area');
  const challengeTitle = $('#challenge-title');
  const challengeGrids = $('#challenge-grids');
  const scoreValue = $('#score-value');
  const pointsLeft = $('#points-left');
  const hintList = $('#hint-list');
  const lineAnswer = $('#line-answer');
  const colorAnswer = $('#color-answer');
  const lineResult = $('#line-result');
  const colorResult = $('#color-result');
  const finalResult = $('#final-result');
  const resultShare = $('#result-share');
  const shareResultButton = $('#share-result');
  const shareResultStatus = $('#share-result-status');
  const clearAnnotations = $('#clear-annotations');
  const colorblindToggle = $('#colorblind-mode');

  const creatorTitle = $('#creator-title');
  const includeTitle = $('#include-title');
  const creatorLines = $('#creator-lines');
  const creatorColors = $('#creator-colors');
  const defaultShift = $('#default-shift');
  const defaultRotation = $('#default-rotation');
  const creatorGrids = $('#creator-grids');
  const creatorStatus = $('#creator-status');
  const previewSummary = $('#preview-summary');
  const shareOutput = $('#share-output');
  const shareUrl = $('#share-url');
  const copyStatus = $('#copy-status');

  let activeChallenge = null;
  let usedHints = new Set();
  let score = 0;
  let maxScore = 0;
  let challengeLengths = {line:0,color:0};
  let creatorKeys = [];
  let annotationMode = 'hue';
  let annotationState = [];
  const ASSIST_COSTS = {bit:1,rotation:2,shift:4};

  function setColorblindMode(enabled){
    const on=Boolean(enabled);
    document.body.classList.toggle('colorblind-mode',on);
    colorblindToggle.checked=on;
    try{ localStorage.setItem('stitcher-colorblind-mode',on?'1':'0'); }catch{}
  }

  function initialColorblindMode(){
    try{ return localStorage.getItem('stitcher-colorblind-mode')==='1'; }catch{ return false; }
  }

  function switchView(name){
    views.forEach(v=>v.classList.toggle('active',v.dataset.viewPanel===name));
    navButtons.forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  navButtons.forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  $$('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.jump)));

  function displayChar(ch){ return ch===' ' ? 'SPACE' : ch; }

  function fillReference(){
    const alpha = $('#alphabet-table');
    C.ALPHABET.forEach((ch,i)=>{
      const row=document.createElement('div');
      row.className='alpha-row';
      row.innerHTML=`<span>${displayChar(ch)}</span><strong>${i.toString(2).padStart(5,'0')}</strong>`;
      alpha.appendChild(row);
    });

    const wheel = $('#wheel-key');
    C.SHIFTS.forEach(s=>{
      const row=document.createElement('div');
      row.className='wheel-row';
      const q=C.shiftAngle(s)*Math.PI/180;
      const pipX=14+Math.cos(q)*10;
      const pipY=14+Math.sin(q)*10;
      row.innerHTML=`
        <span class="swatch-pair">
          <span class="swatch" style="background:${C.hue0(s).hex}"></span>
          <span class="swatch" style="background:${C.hue1(s).hex}"></span>
        </span>
        <svg class="shift-clock" viewBox="0 0 28 28" role="img" aria-label="Shift ${s>=0?'+':''}${s} accessibility marker">
          <circle cx="14" cy="14" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="${pipX.toFixed(2)}" cy="${pipY.toFixed(2)}" r="2.5" fill="currentColor"/>
        </svg>
        <span><strong>${s>=0?'+':''}${s}</strong> — ${C.hue0(s).name} / ${C.hue1(s).name}</span>`;
      wheel.appendChild(row);
    });

    const hintTable = $('#rules-hint-table');
    C.HINTS.forEach(h=>{
      const row=document.createElement('div');
      row.className='rules-hint-row';
      row.innerHTML=`<span>#${h.id}</span><strong>${h.title}</strong><strong>Free</strong>`;
      hintTable.appendChild(row);
    });

    C.SHIFTS.forEach(s=>{
      const option=document.createElement('option');
      option.value=String(s);
      option.textContent=`${s>=0?'+':''}${s} — ${C.hue0(s).name} / ${C.hue1(s).name}`;
      if(s===0) option.selected=true;
      defaultShift.appendChild(option);
    });
  }

  function makeMatrix(rows,cols){
    return Array.from({length:rows},()=>Array(cols).fill(null));
  }

  function createBoolMatrix(rows,cols){
    return Array.from({length:rows},()=>Array(cols).fill(false));
  }

  function createAnnotationState(){
    return {
      h:makeMatrix(6,5),
      v:makeMatrix(6,5),
      hue:makeMatrix(5,5),
      shade:makeMatrix(5,5),
      counted:{
        h:createBoolMatrix(6,5),
        v:createBoolMatrix(6,5),
        hue:createBoolMatrix(5,5),
        shade:createBoolMatrix(5,5)
      },
      rotationUsed:false,
      shiftUsed:false,
      rotationGuess:0,
      shiftGuess:0
    };
  }

  function calculateMaximumScore(lineLength,colorLength,gridCount){
    return Math.max(0,(Number(lineLength)||0)*5+(Number(colorLength)||0)*5+(Number(gridCount)||0)*(ASSIST_COSTS.rotation+ASSIST_COSTS.shift));
  }

  function bitBelongsToMessage(index,kind,r,c){
    let charIndex=-1;
    let length=0;
    if(kind==='h'){
      charIndex=index*12+r;
      length=challengeLengths.line;
    }else if(kind==='v'){
      charIndex=index*12+6+c;
      length=challengeLengths.line;
    }else if(kind==='hue'){
      charIndex=index*10+r;
      length=challengeLengths.color;
    }else if(kind==='shade'){
      charIndex=index*10+5+c;
      length=challengeLengths.color;
    }
    return charIndex>=0 && charIndex<length;
  }

  function spendPoints(cost){
    score=Math.max(0,score-cost);
    updateScore();
  }


  function cycleBit(value){
    return value===null ? 0 : value===0 ? 1 : null;
  }

  function rawSymbol(bits){
    if(bits.some(bit=>bit===null)) return null;
    const value=parseInt(bits.join(''),2);
    return C.ALPHABET[value] ?? null;
  }

  function symbolLabel(symbol){
    if(symbol===null) return '—';
    if(symbol===' ') return '␠';
    return symbol;
  }

  function correctedSymbol(bits,shiftGuess){
    if(bits.some(bit=>bit===null)) return null;
    const raw=parseInt(bits.join(''),2);
    return C.ALPHABET[C.mod(raw-Number(shiftGuess||0),32)] ?? null;
  }

  function groupBits(state,kind,index){
    if(kind==='h') return state.h[index];
    if(kind==='v') return state.v[index];
    if(kind==='hue') return state.hue[index];
    if(kind==='shade') return Array.from({length:5},(_,r)=>state.shade[r][index]);
    return [];
  }

  function createAnnotationWorksheet(index){
    const wrap=document.createElement('section');
    wrap.className='annotation-worksheet';
    wrap.dataset.gridIndex=String(index);
    const groups=[
      ['h','Horizontal',6],
      ['v','Vertical',6],
      ['hue','Hue rows',5],
      ['shade','Shade cols',5]
    ];
    groups.forEach(([kind,label,count])=>{
      const row=document.createElement('div');
      row.className='decoded-group';
      const title=document.createElement('span');
      title.className='decoded-group-label';
      title.textContent=label;
      const symbols=document.createElement('div');
      symbols.className='decoded-symbols';
      for(let i=0;i<count;i++){
        const chip=document.createElement('span');
        chip.className='decoded-symbol';
        chip.dataset.kind=kind;
        chip.dataset.group=String(i);
        chip.textContent='—';
        chip.title='Complete all five bits to reveal this raw symbol';
        symbols.appendChild(chip);
      }
      row.append(title,symbols);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function syncAnnotationCard(card,index){
    const state=annotationState[index];
    if(!state) return;

    card.querySelectorAll('.line-annotation-target').forEach(target=>{
      const kind=target.dataset.kind;
      const r=Number(target.dataset.r);
      const c=Number(target.dataset.c);
      const value=kind==='h' ? state.h[r][c] : state.v[c][r];
      const bg=target.querySelector('.annotation-bit-bg');
      const text=target.querySelector('.annotation-bit-text');
      text.textContent=value===null?'':String(value);
      bg.setAttribute('visibility',value===null?'hidden':'visible');
      target.classList.toggle('marked',value!==null);
    });

    card.querySelectorAll('.cell-annotation-target').forEach(target=>{
      const r=Number(target.dataset.r);
      const c=Number(target.dataset.c);
      const hue=state.hue[r][c];
      const shade=state.shade[r][c];
      const hueLabel=target.querySelector('[data-role="hue"]');
      const shadeLabel=target.querySelector('[data-role="shade"]');
      hueLabel.textContent=hue===null?'':`H${hue}`;
      shadeLabel.textContent=shade===null?'':`S${shade}`;
      target.classList.toggle('has-hue-mark',hue!==null);
      target.classList.toggle('has-shade-mark',shade!==null);
    });

    card.querySelectorAll('.decoded-symbol').forEach(chip=>{
      const bits=groupBits(state,chip.dataset.kind,Number(chip.dataset.group));
      const raw=rawSymbol(bits);
      const symbol=correctedSymbol(bits,state.shiftGuess);
      chip.textContent=symbolLabel(symbol);
      chip.classList.toggle('complete',symbol!==null);
      chip.title=symbol===null
        ? 'Complete all five bits to reveal this symbol'
        : state.shiftGuess===0
          ? `${bits.join('')} → ${raw===' ' ? 'SPACE' : raw}`
          : `${bits.join('')} → raw ${raw===' ' ? 'SPACE' : raw} → shift ${state.shiftGuess>=0?'+':''}${state.shiftGuess} → ${symbol===' ' ? 'SPACE' : symbol}`;
    });
  }

  function attachAnnotationInteractions(card,index){
    card.addEventListener('click',event=>{
      const lineTarget=event.target.closest('.line-annotation-target');
      if(lineTarget && card.contains(lineTarget)){
        const kind=lineTarget.dataset.kind;
        const r=Number(lineTarget.dataset.r);
        const c=Number(lineTarget.dataset.c);
        const state=annotationState[index];
        const counted=kind==='h' ? state.counted.h[r][c] : state.counted.v[c][r];

        if(!counted && bitBelongsToMessage(index,kind,r,c)){
          if(kind==='h') state.counted.h[r][c]=true;
          else state.counted.v[c][r]=true;
          spendPoints(ASSIST_COSTS.bit);
        }

        if(kind==='h') state.h[r][c]=cycleBit(state.h[r][c]);
        else state.v[c][r]=cycleBit(state.v[c][r]);

        syncAnnotationCard(card,index);
        return;
      }

      const cellTarget=event.target.closest('.cell-annotation-target');
      if(cellTarget && card.contains(cellTarget)){
        const r=Number(cellTarget.dataset.r);
        const c=Number(cellTarget.dataset.c);
        const kind=annotationMode==='shade'?'shade':'hue';
        const state=annotationState[index];
        const bucket=kind==='shade'?state.shade:state.hue;

        if(!state.counted[kind][r][c] && bitBelongsToMessage(index,kind,r,c)){
          state.counted[kind][r][c]=true;
          spendPoints(ASSIST_COSTS.bit);
        }

        bucket[r][c]=cycleBit(bucket[r][c]);
        syncAnnotationCard(card,index);
      }
    });
  }


  function setAnnotationMode(mode){
    annotationMode=mode==='shade'?'shade':'hue';
    challengeGrids.querySelectorAll('.grid-annotation-mode-button').forEach(button=>{
      const active=button.dataset.mode===annotationMode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    challengeGrids.dataset.annotationMode=annotationMode;
  }

  function clearAllAnnotations(){
    annotationState.forEach(state=>{
      ['h','v','hue','shade'].forEach(kind=>{
        for(let r=0;r<state[kind].length;r++){
          for(let c=0;c<state[kind][r].length;c++){
            state[kind][r][c]=null;
          }
        }
      });
    });
    challengeGrids.querySelectorAll('.cipher-card').forEach((card,index)=>syncAnnotationCard(card,index));
  }

  function signedWheelShift(index){
    const i=C.mod(index,12);
    return i<=6 ? i : i-12;
  }

  function polarPoint(cx,cy,r,degrees){
    const q=degrees*Math.PI/180;
    return {x:cx+Math.cos(q)*r,y:cy+Math.sin(q)*r};
  }

  function wheelSectorPath(cx,cy,innerR,outerR,startDeg,endDeg){
    const a=polarPoint(cx,cy,outerR,startDeg);
    const b=polarPoint(cx,cy,outerR,endDeg);
    const c=polarPoint(cx,cy,innerR,endDeg);
    const d=polarPoint(cx,cy,innerR,startDeg);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${outerR} ${outerR} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} A ${innerR} ${innerR} 0 0 0 ${d.x.toFixed(2)} ${d.y.toFixed(2)} Z`;
  }

  function createCipherCard(grid,index,rotation,{creator=false,key=null,interactive=false}={}){
    const card=document.createElement('article');
    card.className='cipher-card';

    const header=document.createElement('div');
    header.className='cipher-card-header';
    header.innerHTML=`<strong>Grid ${index+1}</strong>`;
    card.appendChild(header);

    const visual=document.createElement('div');
    visual.innerHTML=C.svgMarkup(grid,rotation,{interactive});
    card.appendChild(visual);

    if(interactive){
      const assists=document.createElement('div');
      assists.className='grid-assists visual-grid-controls';
      const state=annotationState[index];

      const currentDisplayRotation=()=>C.mod(rotation+state.rotationGuess,360);
      const renderPuzzle=()=>{
        visual.innerHTML=C.svgMarkup(grid,currentDisplayRotation(),{
          interactive:true,
          colorOffset:state.shiftGuess
        });
        syncAnnotationCard(card,index);
      };

      const modeControl=document.createElement('div');
      modeControl.className='compact-mode-control';
      modeControl.setAttribute('role','group');
      modeControl.setAttribute('aria-label','Color cell bit mode');

      const hueButton=document.createElement('button');
      hueButton.type='button';
      hueButton.className='grid-annotation-mode-button';
      hueButton.dataset.mode='hue';
      hueButton.textContent='Hue';
      hueButton.setAttribute('aria-pressed',String(annotationMode==='hue'));
      hueButton.classList.toggle('active',annotationMode==='hue');
      hueButton.addEventListener('click',()=>setAnnotationMode('hue'));

      const shadeButton=document.createElement('button');
      shadeButton.type='button';
      shadeButton.className='grid-annotation-mode-button';
      shadeButton.dataset.mode='shade';
      shadeButton.textContent='Shade';
      shadeButton.setAttribute('aria-pressed',String(annotationMode==='shade'));
      shadeButton.classList.toggle('active',annotationMode==='shade');
      shadeButton.addEventListener('click',()=>setAnnotationMode('shade'));

      modeControl.append(hueButton,shadeButton);

      const rotationControl=document.createElement('div');
      rotationControl.className='grid-assist-control rotation-control';

      const rotationStage=document.createElement('div');
      rotationStage.className='rotation-stage';

      const rotateLeft=document.createElement('button');
      rotateLeft.type='button';
      rotateLeft.className='rotation-step-button';
      rotateLeft.setAttribute('aria-label','Rotate puzzle 90 degrees counterclockwise');
      rotateLeft.textContent='↺';

      const rotationPreview=document.createElement('div');
      rotationPreview.className='rotation-preview';
      rotationPreview.innerHTML='<span class="rotation-preview-dot"></span><span class="rotation-readout">0°</span>';

      const rotateRight=document.createElement('button');
      rotateRight.type='button';
      rotateRight.className='rotation-step-button';
      rotateRight.setAttribute('aria-label','Rotate puzzle 90 degrees clockwise');
      rotateRight.textContent='↻';

      const updateRotationControl=()=>{
        const displayRotation=currentDisplayRotation();
        rotationPreview.dataset.rotation=String(displayRotation);
        rotationPreview.querySelector('.rotation-readout').textContent=`${state.rotationGuess}°`;
        rotateLeft.disabled=false;
        rotateRight.disabled=false;
      };

      const turnRotation=delta=>{
        if(!state.rotationUsed){
          state.rotationUsed=true;
          spendPoints(ASSIST_COSTS.rotation);
        }
        state.rotationGuess=C.mod(state.rotationGuess+delta,360);
        updateRotationControl();
        renderPuzzle();
      };
      rotateLeft.addEventListener('click',()=>turnRotation(-90));
      rotateRight.addEventListener('click',()=>turnRotation(90));
      rotationStage.append(rotateLeft,rotationPreview,rotateRight);

      rotationControl.append(rotationStage);

      const shiftControl=document.createElement('div');
      shiftControl.className='grid-assist-control color-wheel-control';

      const wheelWrap=document.createElement('div');
      wheelWrap.className='solver-color-wheel-wrap';
      const wheel=document.createElementNS('http://www.w3.org/2000/svg','svg');
      wheel.setAttribute('viewBox','0 0 180 180');
      wheel.setAttribute('class','solver-color-wheel');
      wheel.setAttribute('role','group');
      wheel.setAttribute('aria-label','Choose color offset');

      const selectedLine=document.createElementNS('http://www.w3.org/2000/svg','line');
      selectedLine.setAttribute('class','color-wheel-diameter');
      wheel.appendChild(selectedLine);

      const sectorEls=[];
      for(let i=0;i<12;i++){
        const value=signedWheelShift(i);
        const angle=-90+i*30;
        const sector=document.createElementNS('http://www.w3.org/2000/svg','path');
        sector.setAttribute('d',wheelSectorPath(90,90,46,78,angle-14.5,angle+14.5));
        sector.setAttribute('fill',C.hue0(value).hex);
        sector.setAttribute('class','color-wheel-sector');
        sector.dataset.shift=String(value);
        sector.setAttribute('tabindex','0');
        sector.setAttribute('role','button');
        sector.setAttribute('aria-label',`Use color offset ${value>=0?'+':''}${value}`);
        sectorEls.push(sector);
        wheel.appendChild(sector);

        const labelPoint=polarPoint(90,90,84,angle);
        const label=document.createElementNS('http://www.w3.org/2000/svg','text');
        label.setAttribute('x',labelPoint.x.toFixed(2));
        label.setAttribute('y',(labelPoint.y+3.5).toFixed(2));
        label.setAttribute('text-anchor','middle');
        label.setAttribute('class','color-wheel-label');
        label.textContent=value>0?`+${value}`:String(value);
        wheel.appendChild(label);
      }

      const center=document.createElementNS('http://www.w3.org/2000/svg','circle');
      center.setAttribute('cx','90');
      center.setAttribute('cy','90');
      center.setAttribute('r','39');
      center.setAttribute('class','color-wheel-center');
      wheel.appendChild(center);

      const centerTop=document.createElementNS('http://www.w3.org/2000/svg','text');
      centerTop.setAttribute('x','90');
      centerTop.setAttribute('y','86');
      centerTop.setAttribute('text-anchor','middle');
      centerTop.setAttribute('class','color-wheel-center-label');
      centerTop.textContent='OFFSET';
      wheel.appendChild(centerTop);

      const centerValue=document.createElementNS('http://www.w3.org/2000/svg','text');
      centerValue.setAttribute('x','90');
      centerValue.setAttribute('y','103');
      centerValue.setAttribute('text-anchor','middle');
      centerValue.setAttribute('class','color-wheel-center-value');
      wheel.appendChild(centerValue);

      const setShiftGuess=value=>{
        const next=Number(value);
        if(next===state.shiftGuess) return;
        if(!state.shiftUsed){
          state.shiftUsed=true;
          spendPoints(ASSIST_COSTS.shift);
        }
        state.shiftGuess=next;
        updateWheelControl();
        renderPuzzle();
      };

      const updateWheelControl=()=>{
        sectorEls.forEach(sector=>{
          const selected=Number(sector.dataset.shift)===state.shiftGuess;
          sector.classList.toggle('selected',selected);
          sector.setAttribute('aria-pressed',String(selected));
          sector.style.pointerEvents='';
        });
        centerValue.textContent=state.shiftGuess>=0?`+${state.shiftGuess}`:String(state.shiftGuess);
        const angle=C.shiftAngle(state.shiftGuess);
        const p1=polarPoint(90,90,75,angle);
        const p2=polarPoint(90,90,75,angle+180);
        selectedLine.setAttribute('x1',p1.x.toFixed(2));
        selectedLine.setAttribute('y1',p1.y.toFixed(2));
        selectedLine.setAttribute('x2',p2.x.toFixed(2));
        selectedLine.setAttribute('y2',p2.y.toFixed(2));
      };

      sectorEls.forEach(sector=>{
        sector.addEventListener('click',()=>setShiftGuess(sector.dataset.shift));
        sector.addEventListener('keydown',event=>{
          if(event.key==='Enter' || event.key===' '){
            event.preventDefault();
            setShiftGuess(sector.dataset.shift);
          }
        });
      });

      wheelWrap.appendChild(wheel);

      shiftControl.append(wheelWrap);

      assists.append(modeControl,rotationControl,shiftControl);
      card.insertBefore(assists,visual);
      updateRotationControl();
      updateWheelControl();
      renderPuzzle();

      const worksheet=createAnnotationWorksheet(index);
      card.appendChild(worksheet);
      attachAnnotationInteractions(card,index);
      syncAnnotationCard(card,index);
    }

    if(creator && key){
      const badges=document.createElement('div');
      badges.className='key-badges';
      badges.innerHTML=`<span class="key-badge">${key.shift>=0?'+':''}${key.shift} · ${C.hue0(key.shift).name}</span><span class="key-badge">${key.rotation}°</span>`;
      header.appendChild(badges);

      const controls=document.createElement('div');
      controls.className='grid-control-row';

      const shiftWrap=document.createElement('label');
      shiftWrap.textContent='Color shift';
      const shiftSelect=document.createElement('select');
      C.SHIFTS.forEach(s=>{
        const option=document.createElement('option');
        option.value=String(s);
        option.textContent=`${s>=0?'+':''}${s} — ${C.hue0(s).name} / ${C.hue1(s).name}`;
        if(s===key.shift) option.selected=true;
        shiftSelect.appendChild(option);
      });
      shiftSelect.addEventListener('change',()=>{
        creatorKeys[index].shift=Number(shiftSelect.value);
        buildCreator(false);
      });
      shiftWrap.appendChild(shiftSelect);

      const rotationWrap=document.createElement('label');
      rotationWrap.textContent='Rotation';
      const rotationSelect=document.createElement('select');
      const labels={0:'0° · top-left',90:'90° · top-right',180:'180° · bottom-right',270:'270° · bottom-left'};
      C.ROTATIONS.forEach(r=>{
        const option=document.createElement('option');
        option.value=String(r);
        option.textContent=labels[r];
        if(r===key.rotation) option.selected=true;
        rotationSelect.appendChild(option);
      });
      rotationSelect.addEventListener('change',()=>{
        creatorKeys[index].rotation=Number(rotationSelect.value);
        buildCreator(false);
      });
      rotationWrap.appendChild(rotationSelect);

      controls.append(shiftWrap,rotationWrap);
      card.appendChild(controls);
    }

    return card;
  }

  function ensureCreatorKeys(count,reset=false){
    if(reset) creatorKeys=[];
    const ds=Number(defaultShift.value||0);
    const dr=Number(defaultRotation.value||0);
    while(creatorKeys.length<count) creatorKeys.push({shift:ds,rotation:dr});
    creatorKeys=creatorKeys.slice(0,count);
  }

  function buildCreator(resetKeys=true){
    const line=C.normalizeAnswer(creatorLines.value);
    const color=C.normalizeAnswer(creatorColors.value);
    const count=C.requiredGridCount(line,color);
    ensureCreatorKeys(count,resetKeys);
    creatorGrids.innerHTML='';

    for(let i=0;i<count;i++){
      const line12=C.segment(line,i*12,12);
      const color10=C.segment(color,i*10,10);
      const key=creatorKeys[i];
      const grid=C.encodeGrid(line12,color10,key.shift);
      creatorGrids.appendChild(createCipherCard(grid,i,key.rotation,{creator:true,key}));
    }

    const theoreticalMax=calculateMaximumScore(line.length,color.length,count);
    previewSummary.textContent=`${count} grid${count===1?'':'s'} · line capacity ${count*12} · color capacity ${count*10} · max score ${theoreticalMax}`;
    creatorStatus.textContent='Puzzle preview updated.';
    shareOutput.hidden=true;
  }

  function randomizeCreatorKeys(){
    const line=C.normalizeAnswer(creatorLines.value);
    const color=C.normalizeAnswer(creatorColors.value);
    const count=C.requiredGridCount(line,color);
    creatorKeys=Array.from({length:count},()=>({
      shift:C.SHIFTS[Math.floor(Math.random()*C.SHIFTS.length)],
      rotation:C.ROTATIONS[Math.floor(Math.random()*C.ROTATIONS.length)]
    }));
    buildCreator(false);
    creatorStatus.textContent='Every grid received an independent random color shift and rotation.';
  }

  async function makeChallengeLink(){
    try{
      buildCreator(false);
      const payload=await C.buildChallenge(creatorTitle.value,creatorLines.value,creatorColors.value,creatorKeys);
      const encoded=C.encodePayload(payload,{includeTitle:includeTitle.checked});
      const base=location.href.split('#')[0];
      shareUrl.value=`${base}#c=${encoded}`;
      shareOutput.hidden=false;
      copyStatus.textContent='';
      creatorStatus.textContent=includeTitle.checked
        ? 'Challenge link generated with title.'
        : 'Challenge link generated without title for minimum length.';
    }catch(err){
      console.error(err);
      creatorStatus.textContent='Could not generate the challenge link in this browser.';
    }
  }

  async function copyChallengeLink(){
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(shareUrl.value);
      }else{
        shareUrl.focus();
        shareUrl.select();
        document.execCommand('copy');
      }
      copyStatus.textContent='Copied.';
    }catch{
      copyStatus.textContent='Select the URL above and copy it manually.';
    }
  }

  function rankForScore(value,maximum){
    const pct=maximum>0 ? value/maximum*100 : 0;
    if(pct>=90) return 'Master Decoder';
    if(pct>=75) return 'Codebreaker';
    if(pct>=50) return 'Pattern Hunter';
    if(pct>=25) return 'Persistent Solver';
    if(value>0) return 'Made It Out Alive';
    return 'Tutorial Complete';
  }

  function updateScore(){
    scoreValue.textContent=`${score} / ${maxScore}`;
    pointsLeft.textContent='Free';
  }

  function renderAlphabetHint(body,h){
    const intro=document.createElement('p');
    intro.className='alphabet-hint-intro';
    intro.textContent=h.text;
    body.appendChild(intro);

    const grid=document.createElement('div');
    grid.className='hint-alphabet-grid';
    C.ALPHABET.forEach((ch,i)=>{
      const cell=document.createElement('div');
      cell.className='hint-alphabet-cell';
      cell.innerHTML=`<span>${displayChar(ch)}</span><strong>${i.toString(2).padStart(5,'0')}</strong>`;
      grid.appendChild(cell);
    });
    body.appendChild(grid);
  }

  function renderHints(){
    hintList.innerHTML='';
    C.HINTS.forEach(h=>{
      const used=usedHints.has(h.id);
      const item=document.createElement('div');
      item.className='hint-item'+(used?' used':'');
      const trigger=document.createElement('button');
      trigger.className='hint-trigger';
      trigger.type='button';
      trigger.innerHTML=`<span><strong>Hint ${h.id}: ${h.title}</strong></span><span class="hint-cost">${used?'shown':'Free'}</span>`;
      const body=document.createElement('div');
      body.className='hint-body';
      if(h.id===10) renderAlphabetHint(body,h);
      else body.textContent=h.text;
      trigger.addEventListener('click',()=>{
        if(!usedHints.has(h.id)){
          usedHints.add(h.id);
          renderHints();
        }
      });
      item.append(trigger,body);
      hintList.appendChild(item);
    });
  }

  function loadChallenge(payload){
    if(!payload || payload.v!==1 || !Array.isArray(payload.grids)) throw new Error('Unsupported challenge data.');
    activeChallenge=payload;
    usedHints=new Set();
    const decoded=C.decodeChallengeMessages(payload);
    challengeLengths={
      line:Number.isFinite(Number(payload.lineLength))?Number(payload.lineLength):decoded.line.length,
      color:Number.isFinite(Number(payload.colorLength))?Number(payload.colorLength):decoded.color.length
    };
    maxScore=calculateMaximumScore(challengeLengths.line,challengeLengths.color,payload.grids.length);
    score=maxScore;
    annotationState=payload.grids.map(()=>createAnnotationState());
    setAnnotationMode('hue');
    updateScore();
    renderHints();

    challengeEmpty.hidden=true;
    challengeArea.hidden=false;
    challengeTitle.textContent=payload.title || 'Untitled puzzle';
    challengeGrids.innerHTML='';
    lineAnswer.value='';
    colorAnswer.value='';
    lineResult.textContent='';
    colorResult.textContent='';
    finalResult.textContent='';
    resultShare.hidden=true;
    shareResultStatus.textContent='';

    payload.grids.forEach((g,i)=>{
      const grid=C.gridFromPayloadGrid(g);
      challengeGrids.appendChild(createCipherCard(grid,i,Number(g.o||0),{interactive:true}));
    });

    switchView('play');
  }

  async function checkAnswers(){
    if(!activeChallenge) return;
    let lineOK=false;
    let colorOK=false;

    if(activeChallenge.lineHash && activeChallenge.colorHash){
      [lineOK,colorOK]=await Promise.all([
        C.checkAnswer(lineAnswer.value,activeChallenge.lineHash),
        C.checkAnswer(colorAnswer.value,activeChallenge.colorHash)
      ]);
    }else{
      const expected=C.decodeChallengeMessages(activeChallenge);
      lineOK=C.normalizeAnswer(lineAnswer.value)===expected.line;
      colorOK=C.normalizeAnswer(colorAnswer.value)===expected.color;
    }

    lineResult.textContent=lineOK?'Line message correct.':'Line message does not match yet.';
    lineResult.className='answer-result '+(lineOK?'good':'bad');
    colorResult.textContent=colorOK?'Color message correct.':'Color message does not match yet.';
    colorResult.className='answer-result '+(colorOK?'good':'bad');

    if(lineOK && colorOK){
      finalResult.textContent=`Solved! ${score}/${maxScore} — ${rankForScore(score,maxScore)}.`;
      finalResult.style.color='var(--good)';
      resultShare.hidden=false;
    }else{
      finalResult.textContent='Keep going — both messages must be correct to finish.';
      finalResult.style.color='';
      resultShare.hidden=true;
    }
  }

  function assistSummary(){
    let lineBits=0;
    let colorBits=0;
    let rotations=0;
    let shifts=0;

    annotationState.forEach((state,index)=>{
      for(let r=0;r<6;r++){
        for(let c=0;c<5;c++){
          if(state.counted.h[r][c] && bitBelongsToMessage(index,'h',r,c)) lineBits++;
        }
      }
      for(let c=0;c<6;c++){
        for(let r=0;r<5;r++){
          if(state.counted.v[c][r] && bitBelongsToMessage(index,'v',r,c)) lineBits++;
        }
      }
      for(let r=0;r<5;r++){
        for(let c=0;c<5;c++){
          if(state.counted.hue[r][c] && bitBelongsToMessage(index,'hue',r,c)) colorBits++;
          if(state.counted.shade[r][c] && bitBelongsToMessage(index,'shade',r,c)) colorBits++;
        }
      }
      if(state.rotationUsed) rotations++;
      if(state.shiftUsed) shifts++;
    });

    return {lineBits,colorBits,rotations,shifts};
  }

  function currentPuzzleUrl(){
    const base=location.href.split('#')[0];
    const hash=location.hash && (location.hash.startsWith('#c=') || location.hash.startsWith('#challenge='))
      ? location.hash
      : '';
    return base+hash;
  }

  function buildResultShareText(){
    const assists=assistSummary();
    const pct=maxScore>0 ? Math.round(score/maxScore*100) : 0;
    return [
      `Stitcher ✣ ${score}/${maxScore} · ${pct}%`,
      `🧵 ${assists.lineBits} line bit${assists.lineBits===1?'':'s'} marked · 🎨 ${assists.colorBits} color bit${assists.colorBits===1?'':'s'} marked`,
      `↻ ${assists.rotations} rotation control${assists.rotations===1?'':'s'} used · 🌈 ${assists.shifts} color wheel${assists.shifts===1?'':'s'} used`,
      '',
      'Can you beat my score?',
      currentPuzzleUrl()
    ].join('\n');
  }

  async function shareResult(){
    const text=buildResultShareText();
    shareResultStatus.textContent='';
    try{
      if(navigator.share){
        await navigator.share({text});
        shareResultStatus.textContent='Shared.';
        return;
      }
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(text);
        shareResultStatus.textContent='Result copied.';
        return;
      }
      const temp=document.createElement('textarea');
      temp.value=text;
      temp.setAttribute('readonly','');
      temp.style.position='absolute';
      temp.style.left='-9999px';
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      temp.remove();
      shareResultStatus.textContent='Result copied.';
    }catch(err){
      if(err && err.name==='AbortError') return;
      shareResultStatus.textContent='Could not share automatically. Try again or copy the puzzle link.';
    }
  }

  function readChallengeFromHash(){
    const prefixes=['#c=','#challenge='];
    const prefix=prefixes.find(value=>location.hash.startsWith(value));
    if(!prefix) return false;
    try{
      const payload=C.decodePayload(location.hash.slice(prefix.length));
      loadChallenge(payload);
      return true;
    }catch(err){
      console.error(err);
      challengeEmpty.hidden=false;
      challengeArea.hidden=true;
      challengeEmpty.querySelector('h2').textContent='Challenge link could not be read';
      challengeEmpty.querySelector('p').textContent='The link may be incomplete or from an incompatible version of Stitcher.';
      return false;
    }
  }

  colorblindToggle.addEventListener('change',()=>setColorblindMode(colorblindToggle.checked));

  clearAnnotations.addEventListener('click',clearAllAnnotations);

  $('#build-puzzle').addEventListener('click',()=>buildCreator(true));
  $('#randomize-keys').addEventListener('click',randomizeCreatorKeys);
  $('#make-link').addEventListener('click',makeChallengeLink);
  $('#copy-link').addEventListener('click',copyChallengeLink);
  $('#check-answer').addEventListener('click',checkAnswers);
  shareResultButton.addEventListener('click',shareResult);

  defaultShift.addEventListener('change',()=>buildCreator(true));
  defaultRotation.addEventListener('change',()=>buildCreator(true));

  setColorblindMode(initialColorblindMode());
  setAnnotationMode('hue');
  fillReference();
  renderHints();
  updateScore();
  buildCreator(true);
  readChallengeFromHash();
})();