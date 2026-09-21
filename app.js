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
  const annotateHue = $('#annotate-hue');
  const annotateShade = $('#annotate-shade');
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
      rotationRevealed:false,
      shiftRevealed:false,
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
    annotateHue.classList.toggle('active',annotationMode==='hue');
    annotateShade.classList.toggle('active',annotationMode==='shade');
    annotateHue.setAttribute('aria-pressed',String(annotationMode==='hue'));
    annotateShade.setAttribute('aria-pressed',String(annotationMode==='shade'));
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
      assists.className='grid-assists';
      const state=annotationState[index];

      const rotationControl=document.createElement('div');
      rotationControl.className='grid-assist-control';
      const rotationLabel=document.createElement('label');
      rotationLabel.textContent='Rotate view';
      const rotationSelect=document.createElement('select');
      [
        [0,'No turn'],
        [90,'90° clockwise'],
        [180,'180°'],
        [270,'90° counterclockwise']
      ].forEach(([value,label])=>{
        const option=document.createElement('option');
        option.value=String(value);
        option.textContent=label;
        rotationSelect.appendChild(option);
      });
      rotationSelect.value=String(state.rotationGuess);
      rotationSelect.addEventListener('change',()=>{
        if(state.rotationRevealed) return;
        state.rotationGuess=Number(rotationSelect.value);
        visual.innerHTML=C.svgMarkup(grid,C.mod(rotation+state.rotationGuess,360),{interactive:true});
        syncAnnotationCard(card,index);
      });
      const rotationButton=document.createElement('button');
      rotationButton.type='button';
      rotationButton.className='grid-assist-button';
      rotationButton.textContent=`Reveal orientation · −${ASSIST_COSTS.rotation}`;
      rotationButton.addEventListener('click',()=>{
        if(state.rotationRevealed) return;
        if(!confirm(`Spend ${ASSIST_COSTS.rotation} points to reveal Grid ${index+1}'s correct orientation?`)) return;
        state.rotationRevealed=true;
        state.rotationGuess=C.mod(-rotation,360);
        spendPoints(ASSIST_COSTS.rotation);
        rotationSelect.value=String(state.rotationGuess);
        rotationSelect.disabled=true;
        visual.innerHTML=C.svgMarkup(grid,0,{interactive:true});
        rotationButton.textContent='Orientation revealed';
        rotationButton.disabled=true;
        syncAnnotationCard(card,index);
      });
      rotationControl.append(rotationLabel,rotationSelect,rotationButton);

      const shiftControl=document.createElement('div');
      shiftControl.className='grid-assist-control';
      const shiftLabel=document.createElement('label');
      shiftLabel.textContent='Color shift';
      const shiftSelect=document.createElement('select');
      C.SHIFTS.forEach(value=>{
        const option=document.createElement('option');
        option.value=String(value);
        option.textContent=`${value>=0?'+':''}${value} · ${C.hue0(value).name}/${C.hue1(value).name}`;
        shiftSelect.appendChild(option);
      });
      shiftSelect.value=String(state.shiftGuess);
      shiftSelect.addEventListener('change',()=>{
        if(state.shiftRevealed) return;
        state.shiftGuess=Number(shiftSelect.value);
        syncAnnotationCard(card,index);
      });
      const shiftButton=document.createElement('button');
      shiftButton.type='button';
      shiftButton.className='grid-assist-button';
      shiftButton.textContent=`Reveal shift · −${ASSIST_COSTS.shift}`;
      shiftButton.addEventListener('click',()=>{
        if(state.shiftRevealed) return;
        if(!confirm(`Spend ${ASSIST_COSTS.shift} points to reveal Grid ${index+1}'s color shift?`)) return;
        state.shiftRevealed=true;
        state.shiftGuess=grid.shift;
        spendPoints(ASSIST_COSTS.shift);
        shiftSelect.value=String(grid.shift);
        shiftSelect.disabled=true;
        shiftButton.textContent=`Shift ${grid.shift>=0?'+':''}${grid.shift} revealed`;
        shiftButton.disabled=true;
        syncAnnotationCard(card,index);
      });
      shiftControl.append(shiftLabel,shiftSelect,shiftButton);

      assists.append(rotationControl,shiftControl);
      card.insertBefore(assists,visual);

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
      if(state.rotationRevealed) rotations++;
      if(state.shiftRevealed) shifts++;
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
      `↻ ${assists.rotations} rotation${assists.rotations===1?'':'s'} · 🌈 ${assists.shifts} shift${assists.shifts===1?'':'s'}`,
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

  annotateHue.addEventListener('click',()=>setAnnotationMode('hue'));
  annotateShade.addEventListener('click',()=>setAnnotationMode('shade'));
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