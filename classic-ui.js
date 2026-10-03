(() => {
  const C=window.StitcherClassic;
  if(!C) return;

  const $=sel=>document.querySelector(sel);
  const creatorControls=$('.creator-controls');
  const creatorTitle=$('#creator-title');
  const creatorLines=$('#creator-lines');
  const creatorColors=$('#creator-colors');
  const creatorGrids=$('#creator-grids');
  const creatorStatus=$('#creator-status');
  const previewSummary=$('#preview-summary');
  const shareOutput=$('#share-output');
  const shareUrl=$('#share-url');
  const copyStatus=$('#copy-status');
  const includeTitle=$('#include-title');
  const randomizeButton=$('#randomize-keys');
  const modernDefaults=$('.creator-key-defaults');

  const challengeEmpty=$('#challenge-empty');
  const challengeArea=$('#challenge-area');
  const challengeTitle=$('#challenge-title');
  const challengeGrids=$('#challenge-grids');
  const scoreValue=$('#score-value');
  const lineAnswer=$('#line-answer');
  const colorAnswer=$('#color-answer');
  const lineResult=$('#line-result');
  const colorResult=$('#color-result');
  const finalResult=$('#final-result');
  const resultShare=$('#result-share');
  const shareStatus=$('#share-result-status');
  const annotationToolbar=$('.annotation-toolbar');
  const annotationNote=$('.annotation-note');

  let creatorMode='modern';
  let classicActive=null;
  let classicRendered=null;
  let classicScore=0;
  let classicMax=0;
  let phaseGuesses=[];
  let phaseCounted=[];
  let regionGuesses=[];
  let regionCounted=[];

  const original={
    lineLabel:$('label[for="creator-lines"]')?.textContent||'',
    colorLabel:$('label[for="creator-colors"]')?.textContent||'',
    toolbar:annotationToolbar?.innerHTML||'',
    note:annotationNote?.textContent||''
  };

  function injectCreatorMode(){
    if(!creatorControls||$('#creator-mode-switch')) return;
    const wrap=document.createElement('div');
    wrap.className='field-group creator-mode-field';
    wrap.innerHTML=`
      <label>Puzzle style</label>
      <div id="creator-mode-switch" class="creator-mode-switch" role="group" aria-label="Puzzle style">
        <button type="button" class="active" data-mode="modern" aria-pressed="true">Modern</button>
        <button type="button" data-mode="classic" aria-pressed="false">Classic Hitomezashi</button>
      </div>
      <div class="field-note">Classic uses continuous alternating stitch tracks and shade-coded enclosed regions.</div>`;
    creatorControls.insertBefore(wrap,creatorControls.firstChild);

    const palette=document.createElement('div');
    palette.id='classic-palette-field';
    palette.className='field-group classic-only-field';
    palette.hidden=true;
    const label=document.createElement('label');
    label.htmlFor='classic-palette';
    label.textContent='Classic palette';
    const select=document.createElement('select');
    select.id='classic-palette';
    C.PALETTES.forEach((p,i)=>{
      const option=document.createElement('option');
      option.value=String(i);option.textContent=p.name;
      select.appendChild(option);
    });
    const note=document.createElement('div');
    note.className='field-note';
    note.textContent='Hue is decorative. Only light versus dark stores surface bits.';
    palette.append(label,select,note);
    wrap.insertAdjacentElement('afterend',palette);

    wrap.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>setCreatorMode(button.dataset.mode)));
    select.addEventListener('change',()=>{if(creatorMode==='classic') buildClassicPreview();});
  }

  function setCreatorMode(mode){
    creatorMode=mode==='classic'?'classic':'modern';
    $('#creator-mode-switch')?.querySelectorAll('button').forEach(button=>{
      const active=button.dataset.mode===creatorMode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const palette=$('#classic-palette-field');
    if(palette) palette.hidden=creatorMode!=='classic';
    if(modernDefaults) modernDefaults.hidden=creatorMode==='classic';
    if(randomizeButton) randomizeButton.hidden=creatorMode==='classic';

    const lineLabel=$('label[for="creator-lines"]');
    const colorLabel=$('label[for="creator-colors"]');
    if(creatorMode==='classic'){
      if(lineLabel) lineLabel.textContent='Stitch phase message';
      if(colorLabel) colorLabel.textContent='Enclosed shade message';
      buildClassicPreview();
    }else{
      if(lineLabel) lineLabel.textContent=original.lineLabel;
      if(colorLabel) colorLabel.textContent=original.colorLabel;
      $('#build-puzzle')?.click();
    }
  }

  function classicChallengeFromCreator(){
    return C.buildChallenge(
      creatorTitle?.value||'Stitcher Classic',
      creatorLines?.value||'',
      creatorColors?.value||'',
      Number($('#classic-palette')?.value||0)
    );
  }

  function buildClassicPreview(){
    try{
      const challenge=classicChallengeFromCreator();
      const rendered=C.svgMarkup(challenge);
      creatorGrids.innerHTML='';
      const card=document.createElement('article');
      card.className='cipher-card classic-preview-card';
      card.innerHTML=`<div class="cipher-card-header"><strong>Classic field</strong><span class="key-badge">${C.PALETTES[challenge.palette].name}</span></div><div class="classic-cipher-frame classic-preview-frame">${rendered.svg}</div>`;
      creatorGrids.appendChild(card);
      previewSummary.textContent=`${challenge.hPhases.length} horizontal × ${challenge.vPhases.length} vertical tracks · ${rendered.regions.length} enclosed regions · ${challenge.lineLength} stitch chars · ${challenge.colorLength} shade chars`;
      creatorStatus.textContent='Classic Hitomezashi preview updated.';
      shareOutput.hidden=true;
    }catch(err){
      console.error(err);
      creatorStatus.textContent=err.message||'Could not build this Classic puzzle.';
    }
  }

  function makeClassicLink(){
    try{
      const challenge=classicChallengeFromCreator();
      const encoded=C.encodePayload(challenge,{includeTitle:includeTitle?.checked!==false});
      const base=location.href.split('#')[0];
      shareUrl.value=`${base}#k=${encoded}`;
      shareOutput.hidden=false;
      copyStatus.textContent='';
      creatorStatus.textContent='Classic challenge link generated.';
    }catch(err){
      console.error(err);
      creatorStatus.textContent=err.message||'Could not generate the Classic challenge link.';
    }
  }

  function spendClassicPoint(index,type){
    if(type==='phase'){
      if(index>=classicActive.lineLength*5||phaseCounted[index]) return;
      phaseCounted[index]=true;
    }else{
      if(index>=classicActive.colorLength*5||regionCounted[index]) return;
      regionCounted[index]=true;
    }
    classicScore=Math.max(0,classicScore-1);
    updateClassicScore();
  }

  function updateClassicScore(){
    scoreValue.textContent=`${classicScore} / ${classicMax}`;
  }

  function cycle(value){ return value===null?0:value===0?1:null; }

  function chipSymbol(bits){
    if(bits.some(bit=>bit===null)) return '—';
    return C.textFromBits(bits,1).replace(' ','␠');
  }

  function buildClassicDecodeRow(label,bits,charCount,kind){
    const row=document.createElement('div');
    row.className='classic-decode-row';
    const heading=document.createElement('strong');
    heading.textContent=label;
    const chips=document.createElement('div');
    chips.className='classic-decode-chips';
    for(let i=0;i<charCount;i++){
      const chip=document.createElement('span');
      chip.className='classic-decode-chip';
      chip.dataset.kind=kind;
      chip.dataset.group=String(i);
      chip.textContent=chipSymbol(bits.slice(i*5,i*5+5));
      chips.appendChild(chip);
    }
    row.append(heading,chips);
    return row;
  }

  function refreshClassicDecodeRows(card){
    card.querySelectorAll('.classic-decode-chip').forEach(chip=>{
      const source=chip.dataset.kind==='phase'?phaseGuesses:regionGuesses;
      const i=Number(chip.dataset.group);
      const bits=source.slice(i*5,i*5+5);
      chip.textContent=chipSymbol(bits);
      chip.classList.toggle('complete',bits.length===5&&bits.every(bit=>bit!==null));
    });
  }

  function ensureSvgMark(svg,type,index,x,y){
    let text=svg.querySelector(`.classic-bit-mark[data-mark-kind="${type}"][data-mark-index="${index}"]`);
    if(!text){
      text=document.createElementNS('http://www.w3.org/2000/svg','text');
      text.classList.add('classic-bit-mark');
      text.dataset.markKind=type;
      text.dataset.markIndex=String(index);
      text.setAttribute('x',String(x));
      text.setAttribute('y',String(y));
      text.setAttribute('text-anchor','middle');
      text.setAttribute('pointer-events','none');
      svg.appendChild(text);
    }
    return text;
  }

  function refreshClassicMarks(card){
    const svg=card.querySelector('.classic-cipher-svg');
    if(!svg) return;
    card.querySelectorAll('.classic-phase-target').forEach(target=>{
      const local=Number(target.dataset.index);
      const index=target.dataset.kind==='h'?local:classicActive.hPhases.length+local;
      const value=phaseGuesses[index];
      target.classList.toggle('marked',value!==null);
      const mark=ensureSvgMark(svg,'phase',index,Number(target.getAttribute('cx')),Number(target.getAttribute('cy'))+2.4);
      mark.textContent=value===null?'':String(value);
    });

    classicRendered.regions.forEach((region,index)=>{
      const cells=card.querySelectorAll(`.classic-region-cell[data-region="${index}"]`);
      cells.forEach(cell=>cell.classList.toggle('marked',regionGuesses[index]!==null));
      const anchor=cells[0];
      if(!anchor) return;
      const x=Number(anchor.getAttribute('x'))+Number(anchor.getAttribute('width'))/2;
      const y=Number(anchor.getAttribute('y'))+Number(anchor.getAttribute('height'))/2+3;
      const mark=ensureSvgMark(svg,'region',index,x,y);
      mark.textContent=regionGuesses[index]===null?'':String(regionGuesses[index]);
    });
    refreshClassicDecodeRows(card);
  }

  function renderClassicSolver(){
    classicRendered=C.svgMarkup(classicActive,{interactive:true});
    challengeGrids.innerHTML='';
    const card=document.createElement('article');
    card.className='cipher-card classic-solver-card';
    const header=document.createElement('div');
    header.className='cipher-card-header';
    header.innerHTML=`<strong>Classic field</strong><span class="key-badge">${classicRendered.regions.length} enclosed regions</span>`;
    const frame=document.createElement('div');
    frame.className='classic-cipher-frame classic-solver-frame';
    frame.innerHTML=classicRendered.svg;
    const svg=frame.querySelector('svg');
    const trackMax=Math.max(classicActive.hPhases.length,classicActive.vPhases.length);
    svg.style.width=`${Math.max(340,Math.min(1100,trackMax*12))}px`;
    svg.style.maxWidth='none';

    const note=document.createElement('p');
    note.className='classic-field-note';
    note.textContent=`Read ${classicActive.lineLength*5} track-phase bits (horizontal first, then vertical) and the first ${classicActive.colorLength*5} enclosed regions in top-left reading order. Light = 0, dark = 1. Scroll or pinch to inspect the field.`;

    const decode=document.createElement('div');
    decode.className='classic-decode-panel';
    decode.append(
      buildClassicDecodeRow('Stitches',phaseGuesses,classicActive.lineLength,'phase'),
      buildClassicDecodeRow('Shades',regionGuesses,classicActive.colorLength,'region')
    );

    card.append(header,note,frame,decode);
    challengeGrids.appendChild(card);

    frame.addEventListener('click',event=>{
      const phase=event.target.closest('.classic-phase-target');
      if(phase){
        const local=Number(phase.dataset.index);
        const index=phase.dataset.kind==='h'?local:classicActive.hPhases.length+local;
        spendClassicPoint(index,'phase');
        phaseGuesses[index]=cycle(phaseGuesses[index]);
        refreshClassicMarks(card);
        return;
      }
      const regionCell=event.target.closest('.classic-region-cell');
      if(regionCell){
        const index=Number(regionCell.dataset.region);
        spendClassicPoint(index,'region');
        regionGuesses[index]=cycle(regionGuesses[index]);
        refreshClassicMarks(card);
      }
    });
    refreshClassicMarks(card);
  }

  function configureClassicSolveCopy(){
    const toolbarText=annotationToolbar?.querySelector('div:first-child');
    if(toolbarText){
      toolbarText.innerHTML='<strong>Classic decoding worksheet</strong><p>Tap the small phase markers around the field or tap an enclosed colored region to record a 0/1 bit. Each real message bit costs 1 point the first time you mark it.</p>';
    }
    if(annotationNote) annotationNote.textContent='Classic keeps every stitch track strictly alternating. Track starting phases encode the stitch message; only light/dark shade inside enclosed regions encodes the surface message. Base hue is decorative.';
    const lineLabel=$('label[for="line-answer"]');
    const colorLabel=$('label[for="color-answer"]');
    if(lineLabel) lineLabel.textContent='Stitch phase message';
    if(colorLabel) colorLabel.textContent='Enclosed shade message';
  }

  function loadClassicChallenge(challenge){
    classicActive=challenge;
    classicMax=(challenge.lineLength+challenge.colorLength)*5;
    classicScore=classicMax;
    phaseGuesses=Array(challenge.hPhases.length+challenge.vPhases.length).fill(null);
    phaseCounted=Array(phaseGuesses.length).fill(false);
    classicRendered=C.svgMarkup(challenge);
    regionGuesses=Array(classicRendered.regions.length).fill(null);
    regionCounted=Array(regionGuesses.length).fill(false);

    challengeEmpty.hidden=true;
    challengeArea.hidden=false;
    challengeTitle.textContent=challenge.title||'Stitcher Classic';
    lineAnswer.value='';colorAnswer.value='';
    lineResult.textContent='';colorResult.textContent='';finalResult.textContent='';
    resultShare.hidden=true;shareStatus.textContent='';
    configureClassicSolveCopy();
    updateClassicScore();
    renderClassicSolver();
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.viewPanel==='play'));
    document.querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.view==='play'));
  }

  function clearClassicMarks(){
    if(!classicActive) return;
    phaseGuesses.fill(null);regionGuesses.fill(null);
    const card=$('.classic-solver-card');
    if(card) refreshClassicMarks(card);
  }

  function checkClassicAnswers(){
    const expected=C.expectedMessages(classicActive);
    const lineOK=C.normalize(lineAnswer.value)===expected.line;
    const colorOK=C.normalize(colorAnswer.value)===expected.color;
    lineResult.textContent=lineOK?'Stitch message correct.':'Stitch message does not match yet.';
    lineResult.className='answer-result '+(lineOK?'good':'bad');
    colorResult.textContent=colorOK?'Shade message correct.':'Shade message does not match yet.';
    colorResult.className='answer-result '+(colorOK?'good':'bad');
    if(lineOK&&colorOK){
      const pct=classicMax?Math.round(classicScore/classicMax*100):0;
      finalResult.textContent=`Solved! ${classicScore}/${classicMax} · ${pct}% — Classic Hitomezashi.`;
      finalResult.style.color='var(--good)';
      resultShare.hidden=false;
    }else{
      finalResult.textContent='Keep going — both Classic messages must be correct.';
      finalResult.style.color='';
      resultShare.hidden=true;
    }
  }

  function classicShareText(){
    const pct=classicMax?Math.round(classicScore/classicMax*100):0;
    const phaseUsed=phaseCounted.filter(Boolean).length;
    const regionUsed=regionCounted.filter(Boolean).length;
    return [
      `Stitcher Classic ✣ ${classicScore}/${classicMax} · ${pct}%`,
      `🧵 ${phaseUsed} stitch bit${phaseUsed===1?'':'s'} marked · ◐ ${regionUsed} shade bit${regionUsed===1?'':'s'} marked`,
      '',
      'Can you beat my score?',
      location.href
    ].join('\n');
  }

  async function shareClassicResult(){
    const text=classicShareText();
    shareStatus.textContent='';
    try{
      if(navigator.share){await navigator.share({text});shareStatus.textContent='Shared.';return;}
      if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);shareStatus.textContent='Result copied.';return;}
      const temp=document.createElement('textarea');temp.value=text;document.body.appendChild(temp);temp.select();document.execCommand('copy');temp.remove();shareStatus.textContent='Result copied.';
    }catch(err){if(err?.name!=='AbortError') shareStatus.textContent='Could not share automatically.';}
  }

  function injectClassicRules(){
    if($('#classic-rules')) return;
    const scoring=$('.scoring-rules');
    if(!scoring) return;
    const section=document.createElement('section');
    section.id='classic-rules';
    section.className='panel classic-rules';
    section.innerHTML=`
      <div class="eyebrow">Classic mode</div>
      <h2>Traditional Hitomezashi encoding</h2>
      <div class="classic-rule-grid">
        <div><strong>Alternating tracks</strong><p>Every horizontal and vertical track alternates stitch / gap continuously. Only whether a track starts stitched or starts with a gap is binary data.</p></div>
        <div><strong>Arbitrary field size</strong><p>Five track phases make one character. The generator expands the field in five-track groups until both messages fit and enough enclosed regions exist.</p></div>
        <div><strong>Enclosed color</strong><p>Only genuinely enclosed regions receive the two decorative hues. Hue carries no data; light shade = 0 and dark shade = 1.</p></div>
        <div><strong>Compact alphabet</strong><p>Classic uses A–Z plus SPACE. That is 27 symbols, so five bits is the minimum possible fixed-width alphabet.</p></div>
      </div>`;
    scoring.parentNode.insertBefore(section,scoring);
  }

  document.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target) return;
    if(creatorMode==='classic'&&target.id==='build-puzzle'){
      event.preventDefault();event.stopImmediatePropagation();buildClassicPreview();return;
    }
    if(creatorMode==='classic'&&target.id==='make-link'){
      event.preventDefault();event.stopImmediatePropagation();makeClassicLink();return;
    }
    if(creatorMode==='classic'&&target.id==='randomize-keys'){
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    if(classicActive&&target.id==='check-answer'){
      event.preventDefault();event.stopImmediatePropagation();checkClassicAnswers();return;
    }
    if(classicActive&&target.id==='clear-annotations'){
      event.preventDefault();event.stopImmediatePropagation();clearClassicMarks();return;
    }
    if(classicActive&&target.id==='share-result'){
      event.preventDefault();event.stopImmediatePropagation();shareClassicResult();
    }
  },true);

  function loadClassicHash(){
    if(!location.hash.startsWith('#k=')) return false;
    try{
      loadClassicChallenge(C.decodePayload(location.hash.slice(3)));
      return true;
    }catch(err){
      console.error(err);
      challengeEmpty.hidden=false;challengeArea.hidden=true;
      challengeEmpty.querySelector('h2').textContent='Classic challenge link could not be read';
      challengeEmpty.querySelector('p').textContent='The Classic link may be incomplete or from an incompatible version.';
      return false;
    }
  }

  injectCreatorMode();
  injectClassicRules();
  loadClassicHash();
})();