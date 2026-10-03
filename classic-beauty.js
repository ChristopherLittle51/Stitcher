(() => {
  const C=window.StitcherClassic;
  if(!C) return;

  const MIN_SURFACE_AREA=4;

  function hashSeed(text){
    let h=2166136261>>>0;
    for(const ch of String(text||'')){
      h^=ch.charCodeAt(0);
      h=Math.imul(h,16777619)>>>0;
    }
    return h||0x6d2b79f5;
  }

  function makeRng(seed){
    let x=(seed>>>0)||0x6d2b79f5;
    return ()=>{
      x^=x<<13;x^=x>>>17;x^=x<<5;
      return (x>>>0)/4294967296;
    };
  }

  function candidatePhases(lineBits,hTracks,vTracks,seed){
    const capacity=hTracks+vTracks;
    const rng=makeRng(seed);
    const bits=Array.from({length:capacity},(_,i)=>i<lineBits.length?lineBits[i]:(rng()>.5?1:0));
    return {hPhases:bits.slice(0,hTracks),vPhases:bits.slice(hTracks)};
  }

  function regionGeometry(region){
    let sumR=0,sumC=0,minR=Infinity,maxR=-Infinity,minC=Infinity,maxC=-Infinity;
    const cells=new Set(region.cells.map(([r,c])=>`${r},${c}`));
    let perimeter=0;
    region.cells.forEach(([r,c])=>{
      sumR+=r+.5;sumC+=c+.5;
      minR=Math.min(minR,r);maxR=Math.max(maxR,r);
      minC=Math.min(minC,c);maxC=Math.max(maxC,c);
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
        if(!cells.has(`${r+dr},${c+dc}`)) perimeter++;
      });
    });
    const area=region.cells.length;
    return {
      area,
      cy:sumR/area,
      cx:sumC/area,
      minR,maxR,minC,maxC,
      perimeter,
      compactness:area?16*area/(perimeter*perimeter):0,
      width:maxC-minC+1,
      height:maxR-minR+1
    };
  }

  function surfaceRegions(regions){
    return regions
      .filter(region=>region.cells.length>=MIN_SURFACE_AREA)
      .map((region,surfaceIndex)=>({...region,surfaceIndex}));
  }

  function beautyScore(regions,hTracks,vTracks,neededSurfaceBits,extraGroups=0){
    if(!regions.length) return -Infinity;
    const eligible=surfaceRegions(regions);
    if(eligible.length<neededSurfaceBits) return -Infinity;

    const geo=regions.map(regionGeometry);
    const surfaceGeo=eligible.map(regionGeometry);
    const totalArea=geo.reduce((sum,g)=>sum+g.area,0);
    const surfaceArea=surfaceGeo.reduce((sum,g)=>sum+g.area,0);
    const singletons=geo.filter(g=>g.area===1).length;
    const largeMotifs=surfaceGeo.filter(g=>g.area>=5).length;
    const sculpted=surfaceGeo.filter(g=>g.compactness>.18&&(g.width>1||g.height>1)).length;
    const meanSurfaceArea=surfaceArea/Math.max(1,surfaceGeo.length);
    const singletonRatio=singletons/geo.length;
    const surfaceShare=surfaceArea/Math.max(1,totalArea);
    const aspectPenalty=Math.abs(Math.log(hTracks/vTracks));
    const excess=Math.max(0,eligible.length-neededSurfaceBits)/Math.max(neededSurfaceBits,5);
    const sizeDiversity=new Set(surfaceGeo.map(g=>Math.min(g.area,20))).size;

    return (
      meanSurfaceArea*13 +
      surfaceShare*26 +
      (1-singletonRatio)*12 +
      largeMotifs/Math.max(1,surfaceGeo.length)*18 +
      sculpted/Math.max(1,surfaceGeo.length)*12 +
      sizeDiversity*1.5 -
      aspectPenalty*7 -
      excess*.8 -
      extraGroups*.65
    );
  }

  function chooseBeautifulPattern(lineText,surfaceText){
    const line=C.normalize(lineText);
    const surface=C.normalize(surfaceText);
    if(line.length>80||surface.length>80) throw new Error('Classic messages are limited to 80 characters each.');
    const lineBits=C.bitsForText(line);
    const neededSurfaceBits=Math.max(surface.length*5,surface.length?0:5);
    const neededGroups=Math.max(line.length,2);
    const baseSeed=hashSeed(line+'|'+surface+'|full-field-v4');
    let winner=null;

    for(let extraGroups=0;extraGroups<=10;extraGroups++){
      const totalGroups=neededGroups+extraGroups;
      const pairs=[];
      for(let hg=1;hg<totalGroups;hg++) pairs.push([hg,totalGroups-hg]);
      pairs.sort((a,b)=>Math.abs(a[0]-a[1])-Math.abs(b[0]-b[1]));

      let bestAtSize=null;
      const pairLimit=Math.min(20,pairs.length);
      for(const [hGroups,vGroups] of pairs.slice(0,pairLimit)){
        const hTracks=hGroups*5;
        const vTracks=vGroups*5;
        const attempts=extraGroups===0?1:28;
        for(let attempt=0;attempt<attempts;attempt++){
          const seed=(baseSeed+Math.imul(totalGroups+1,2654435761)+Math.imul(attempt+1,1013904223)+hGroups*2246822519)>>>0;
          const phases=candidatePhases(lineBits,hTracks,vTracks,seed);
          const regions=C.enclosedRegions(phases.hPhases,phases.vPhases);
          const eligible=surfaceRegions(regions);
          if(eligible.length<neededSurfaceBits) continue;
          const score=beautyScore(regions,hTracks,vTracks,neededSurfaceBits,extraGroups);
          const candidate={...phases,hTracks,vTracks,regions,surfaceRegions:eligible,seed,beautyScore:score};
          if(!bestAtSize||score>bestAtSize.beautyScore) bestAtSize=candidate;
        }
      }

      if(bestAtSize&&(!winner||bestAtSize.beautyScore>winner.beautyScore)) winner=bestAtSize;
      if(winner&&extraGroups>=4) break;
    }

    if(winner) return winner;
    throw new Error('Could not create enough substantial enclosed motifs for this Classic shade message. Try a shorter shade message.');
  }

  function cellHueGrid(hPhases,vPhases){
    const rows=hPhases.length-1;
    const cols=vPhases.length-1;
    const hues=Array.from({length:rows},()=>Array(cols).fill(0));
    if(rows<1||cols<1) return hues;

    for(let c=1;c<cols;c++){
      hues[0][c]=hues[0][c-1]^(C.vVisible(vPhases,c,0)?1:0);
    }

    for(let r=1;r<rows;r++){
      hues[r][0]=hues[r-1][0]^(C.hVisible(hPhases,r,0)?1:0);
      for(let c=1;c<cols;c++){
        const fromLeft=hues[r][c-1]^(C.vVisible(vPhases,c,r)?1:0);
        const fromTop=hues[r-1][c]^(C.hVisible(hPhases,r,c)?1:0);
        // Strict Hitomezashi alternation makes these two paths agree. Keep the
        // left-derived value for rendering and expose the consistency check to CI.
        hues[r][c]=fromLeft;
        if(fromLeft!==fromTop) hues[r][c]=fromLeft;
      }
    }
    return hues;
  }

  function hueGridIsConsistent(hPhases,vPhases,hues=cellHueGrid(hPhases,vPhases)){
    const rows=hPhases.length-1;
    const cols=vPhases.length-1;
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        if(c>0){
          const expected=hues[r][c-1]^(C.vVisible(vPhases,c,r)?1:0);
          if(hues[r][c]!==expected) return false;
        }
        if(r>0){
          const expected=hues[r-1][c]^(C.hVisible(hPhases,r,c)?1:0);
          if(hues[r][c]!==expected) return false;
        }
      }
    }
    return true;
  }

  function motifHueAssignments(regions,hPhases,vPhases){
    const hues=cellHueGrid(hPhases,vPhases);
    return regions.map(region=>{
      const [r,c]=region.cells[0]||[0,0];
      return hues[r]?.[c]||0;
    });
  }

  function buildBeautifulChallenge(title,lineText,surfaceText,paletteIndex=0){
    const line=C.normalize(lineText);
    const surface=C.normalize(surfaceText);
    const pattern=chooseBeautifulPattern(line,surface);
    return {
      v:1,
      mode:'classic',
      title:String(title||'Stitcher Classic').slice(0,80),
      lineLength:line.length,
      colorLength:surface.length,
      palette:((Number(paletteIndex)||0)%C.PALETTES.length+C.PALETTES.length)%C.PALETTES.length,
      hPhases:pattern.hPhases,
      vPhases:pattern.vPhases,
      surfaceBits:C.bitsForText(surface)
    };
  }

  function svgMarkup(challenge,options={}){
    const h=challenge.hPhases;
    const v=challenge.vPhases;
    const rows=h.length-1;
    const cols=v.length-1;
    const allRegions=C.enclosedRegions(h,v);
    const regions=surfaceRegions(allRegions);
    const hueGrid=cellHueGrid(h,v);
    const hues=motifHueAssignments(regions,h,v);
    const palette=C.PALETTES[((Number(challenge.palette)||0)%C.PALETTES.length+C.PALETTES.length)%C.PALETTES.length];
    const step=26;
    const pad=22;
    const width=cols*step+pad*2;
    const height=rows*step+pad*2;
    let body=`<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${palette.background}"/>`;

    const surfaceByCell=new Map();
    regions.forEach((region,i)=>{
      region.cells.forEach(([r,c])=>surfaceByCell.set(`${r},${c}`,i));
    });

    // Paint the entire textile first. Crossing a visible stitch flips the hue;
    // crossing a gap preserves it. That makes the two-tone field a direct visual
    // consequence of the Hitomezashi topology instead of a set of colored islands.
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const key=`${r},${c}`;
        const regionIndex=surfaceByCell.has(key)?surfaceByCell.get(key):-1;
        const shade=regionIndex>=0&&regionIndex<challenge.surfaceBits.length
          ? challenge.surfaceBits[regionIndex]&1
          : 0;
        const hue=hueGrid[r][c]||0;
        const fill=hue===0?(shade?palette.aDark:palette.aLight):(shade?palette.bDark:palette.bLight);
        const dataAttrs=regionIndex>=0
          ? ` class="classic-field-cell classic-region-cell" data-region="${regionIndex}"`
          : ' class="classic-field-cell"';
        body+=`<rect${dataAttrs} data-field-hue="${hue}" x="${pad+c*step-.2}" y="${pad+r*step-.2}" width="${step+.4}" height="${step+.4}" fill="${fill}"/>`;
      }
    }

    for(let r=0;r<h.length;r++){
      for(let c=0;c<cols;c++){
        if(C.hVisible(h,r,c)){
          const y=pad+r*step;
          const x1=pad+c*step+2.5;
          const x2=pad+(c+1)*step-2.5;
          body+=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${palette.thread}" stroke-width="4.8" stroke-linecap="round"/>`;
        }
      }
    }
    for(let c=0;c<v.length;c++){
      for(let r=0;r<rows;r++){
        if(C.vVisible(v,c,r)){
          const x=pad+c*step;
          const y1=pad+r*step+2.5;
          const y2=pad+(r+1)*step-2.5;
          body+=`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${palette.thread}" stroke-width="4.8" stroke-linecap="round"/>`;
        }
      }
    }

    if(options.interactive){
      h.forEach((_,r)=>{
        const y=pad+r*step;
        body+=`<circle class="classic-phase-target" data-kind="h" data-index="${r}" cx="${pad-10}" cy="${y}" r="7" fill="${palette.background}" stroke="${palette.thread}" stroke-width="1.4"/>`;
      });
      v.forEach((_,c)=>{
        const x=pad+c*step;
        body+=`<circle class="classic-phase-target" data-kind="v" data-index="${c}" cx="${x}" cy="${pad-10}" r="7" fill="${palette.background}" stroke="${palette.thread}" stroke-width="1.4"/>`;
      });
    }

    return {
      svg:`<svg class="classic-cipher-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Traditional two-tone Hitomezashi cipher with ${regions.length} shade-bearing motifs">${body}</svg>`,
      regions,
      allRegions,
      motifHues:hues,
      hueGrid
    };
  }

  C.MIN_SURFACE_AREA=MIN_SURFACE_AREA;
  C.surfaceRegions=surfaceRegions;
  C.chooseBeautifulPattern=chooseBeautifulPattern;
  C.beautyScore=beautyScore;
  C.cellHueGrid=cellHueGrid;
  C.hueGridIsConsistent=hueGridIsConsistent;
  C.motifHueAssignments=motifHueAssignments;
  C.buildChallenge=buildBeautifulChallenge;
  C.svgMarkup=svgMarkup;
})();