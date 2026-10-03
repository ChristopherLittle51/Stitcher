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
    const baseSeed=hashSeed(line+'|'+surface+'|major-motifs-v3');
    let winner=null;

    // Classic surface data now lives only in substantial enclosed motifs.
    // Allow more decorative padding than the old generator so it can grow the
    // textile until it has enough crosses/diamonds/islands rather than using
    // tiny one-cell pockets as data carriers.
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
      // Once a viable field exists, inspect one additional size before stopping.
      // This gives the search room to trade a little field area for much nicer motifs.
      if(winner&&extraGroups>=2){
        const nextAllowance=extraGroups>=4;
        if(nextAllowance) break;
      }
    }

    if(winner) return winner;
    throw new Error('Could not create enough substantial enclosed motifs for this Classic shade message. Try a shorter shade message.');
  }

  function motifHueAssignments(regions){
    if(!regions.length) return [];
    const geo=regions.map((region,index)=>({...regionGeometry(region),index}));
    const hues=Array(regions.length).fill(0);

    // Assign color in broad spatial rhythm rather than by message order. Nearby
    // motifs tend to share a hue family until the field crosses a coarse band,
    // which makes the textile read as a composed pattern rather than confetti.
    geo.forEach(g=>{
      const bandR=Math.floor(g.cy/8);
      const bandC=Math.floor(g.cx/8);
      hues[g.index]=(bandR+bandC)&1;
    });

    // Avoid long same-color runs in reading order without randomizing geometry.
    for(let i=2;i<geo.length;i++){
      const a=geo[i-2],b=geo[i-1],c=geo[i];
      if(hues[a.index]===hues[b.index]&&hues[b.index]===hues[c.index]){
        hues[c.index]=1-hues[c.index];
      }
    }
    return hues;
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
    const hues=motifHueAssignments(regions);
    const palette=C.PALETTES[((Number(challenge.palette)||0)%C.PALETTES.length+C.PALETTES.length)%C.PALETTES.length];
    const step=26;
    const pad=22;
    const width=cols*step+pad*2;
    const height=rows*step+pad*2;
    let body=`<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${palette.background}"/>`;

    // Only substantial motifs receive color. Small enclosed pockets remain the
    // fabric color and are not part of the shade-bit stream.
    regions.forEach((region,i)=>{
      const shade=i<challenge.surfaceBits.length?(challenge.surfaceBits[i]&1):((i+Math.floor(i/3))&1);
      const hue=hues[i]||0;
      const fill=hue===0?(shade?palette.aDark:palette.aLight):(shade?palette.bDark:palette.bLight);
      region.cells.forEach(([r,c])=>{
        body+=`<rect class="classic-region-cell" data-region="${i}" data-motif-hue="${hue}" x="${pad+c*step-.2}" y="${pad+r*step-.2}" width="${step+.4}" height="${step+.4}" fill="${fill}"/>`;
      });
    });

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
      svg:`<svg class="classic-cipher-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Traditional Hitomezashi cipher with ${regions.length} substantial surface motifs">${body}</svg>`,
      regions,
      allRegions,
      motifHues:hues
    };
  }

  C.MIN_SURFACE_AREA=MIN_SURFACE_AREA;
  C.surfaceRegions=surfaceRegions;
  C.chooseBeautifulPattern=chooseBeautifulPattern;
  C.beautyScore=beautyScore;
  C.motifHueAssignments=motifHueAssignments;
  C.buildChallenge=buildBeautifulChallenge;
  C.svgMarkup=svgMarkup;
})();