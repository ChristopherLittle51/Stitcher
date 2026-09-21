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

  const creatorTitle = $('#creator-title');
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
  let score = 100;
  let creatorKeys = [];

  function switchView(name, options={}){
    if(name==='rules' && activeChallenge && score>0 && !options.force){
      const ok = confirm('The Rules page contains the full cipher key. Opening it will set this challenge score to 0. Continue?');
      if(!ok) return;
      usedHints = new Set(C.HINTS.map(h=>h.id));
      score = 0;
      updateScore();
      renderHints();
    }
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
      row.innerHTML=`
        <span class="swatch-pair">
          <span class="swatch" style="background:${C.hue0(s).hex}"></span>
          <span class="swatch" style="background:${C.hue1(s).hex}"></span>
        </span>
        <span><strong>${s>=0?'+':''}${s}</strong> — ${C.hue0(s).name} / ${C.hue1(s).name}</span>`;
      wheel.appendChild(row);
    });

    const hintTable = $('#rules-hint-table');
    C.HINTS.forEach(h=>{
      const row=document.createElement('div');
      row.className='rules-hint-row';
      row.innerHTML=`<span>#${h.id}</span><strong>${h.title}</strong><strong>−${h.cost}</strong>`;
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

  function createCipherCard(grid,index,rotation,{creator=false,key=null}={}){
    const card=document.createElement('article');
    card.className='cipher-card';

    const header=document.createElement('div');
    header.className='cipher-card-header';
    header.innerHTML=`<strong>Grid ${index+1}</strong>`;
    card.appendChild(header);

    const visual=document.createElement('div');
    visual.innerHTML=C.svgMarkup(grid,rotation);
    card.appendChild(visual);

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

    previewSummary.textContent=`${count} grid${count===1?'':'s'} · line capacity ${count*12} · color capacity ${count*10}`;
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
      const encoded=C.encodePayload(payload);
      const base=location.href.split('#')[0];
      shareUrl.value=`${base}#challenge=${encoded}`;
      shareOutput.hidden=false;
      copyStatus.textContent='';
      creatorStatus.textContent='Challenge link generated.';
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

  function updateScore(){
    scoreValue.textContent=String(score);
    pointsLeft.textContent=`${score} pts`;
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
      trigger.innerHTML=`<span><strong>Hint ${h.id}: ${h.title}</strong></span><span class="hint-cost">${used?'used':'−'+h.cost+' pts'}</span>`;
      const body=document.createElement('div');
      body.className='hint-body';
      body.textContent=h.text;
      trigger.addEventListener('click',()=>{
        if(!usedHints.has(h.id)){
          const ok=confirm(`Reveal “${h.title}” for ${h.cost} points?`);
          if(!ok) return;
          usedHints.add(h.id);
          score=Math.max(0,score-h.cost);
          updateScore();
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
    score=100;
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

    payload.grids.forEach((g,i)=>{
      const grid=C.gridFromPayloadGrid(g);
      challengeGrids.appendChild(createCipherCard(grid,i,Number(g.o||0)));
    });

    switchView('play',{force:true});
  }

  async function checkAnswers(){
    if(!activeChallenge) return;
    const [lineOK,colorOK]=await Promise.all([
      C.checkAnswer(lineAnswer.value,activeChallenge.lineHash),
      C.checkAnswer(colorAnswer.value,activeChallenge.colorHash)
    ]);

    lineResult.textContent=lineOK?'Line message correct.':'Line message does not match yet.';
    lineResult.className='answer-result '+(lineOK?'good':'bad');
    colorResult.textContent=colorOK?'Color message correct.':'Color message does not match yet.';
    colorResult.className='answer-result '+(colorOK?'good':'bad');

    if(lineOK && colorOK){
      finalResult.textContent=`Solved! Final score: ${score}/100.`;
      finalResult.style.color='var(--good)';
    }else{
      finalResult.textContent='Keep going — both messages must be correct to finish.';
      finalResult.style.color='';
    }
  }

  function readChallengeFromHash(){
    const prefix='#challenge=';
    if(!location.hash.startsWith(prefix)) return false;
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

  $('#build-puzzle').addEventListener('click',()=>buildCreator(true));
  $('#randomize-keys').addEventListener('click',randomizeCreatorKeys);
  $('#make-link').addEventListener('click',makeChallengeLink);
  $('#copy-link').addEventListener('click',copyChallengeLink);
  $('#check-answer').addEventListener('click',checkAnswers);

  defaultShift.addEventListener('change',()=>buildCreator(true));
  defaultRotation.addEventListener('change',()=>buildCreator(true));

  fillReference();
  renderHints();
  updateScore();
  buildCreator(true);
  readChallengeFromHash();
})();
