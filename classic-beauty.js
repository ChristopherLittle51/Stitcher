(() => {
  const C=window.StitcherClassic;
  if(!C) return;

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
      compactness:area?16*area/(perimeter*perimeter):0
    };
  }

  function beautyScore(regions,hTracks,vTracks,neededRegions,extraGroups=0){
    if(regions.length<neededRegions) return -Infinity;
    if(!regions.length) return -Infinity;
    const geo=regions.map(regionGeometry);
    const totalArea=geo.reduce((sum,g)=>sum+g.area,0);
    const singletons=geo.filter(g=>g.area===1).length;
    const largeArea=geo.filter(g=>g.area>=4).reduce((sum,g)=>sum+g.area,0);
    const sculpted=geo.filter(g=>g.area>=3&&g.compactness>.22).length;
    const meanArea=totalArea/geo.length;
    const singletonRatio=singletons/geo.length;
    const largeShare=largeArea/Math.max(1,totalArea);
    const density=totalArea/Math.max(1,(hTracks-1)*(vTracks-1));
    const aspectPenalty=Math.abs(Math.log(hTracks/vTracks));
    const excessRatio=Math.max(0,regions.length-neededRegions)/Math.max(neededRegions,5);
    const sizeDiversity=new Set(geo.map(g=>Math.min(g.area,12))).size;

    return (
      meanArea*9 +
      largeShare*30 +
      (1-singletonRatio)*18 +
      sculpted/geo.length*10 +
      sizeDiversity*1.25 -
      Math.abs(density-.30)*14 -
      aspectPenalty*8 -
      excessRatio*1.5 -
      extraGroups*1.2
    );
  }

  function chooseBeautifulPattern(lineText,surfaceText){
    const line=C.normalize(lineText);
    const surface=C.normalize(surfaceText);
    if(line.length>80||surface.length>80) throw new Error('Classic messages are limited to 80 characters each.');
    const lineBits=C.bitsForText(line);
    const neededRegions=Math.max(surface.length*5,surface.length?0:5);
    const neededGroups=Math.max(line.length,2);
    const baseSeed=hashSeed(line+'|'+surface+'|motif-v2');
    let winner=null;

    // Search the smallest few viable field sizes. A small amount of decorative
    // phase padding gives the generator room to create larger, cleaner motifs.
    for(let extraGroups=0;extraGroups<=4;extraGroups++){
      const totalGroups=neededGroups+extraGroups;
      const pairs=[];
      for(let hg=1;hg<totalGroups;hg++) pairs.push([hg,totalGroups-hg]);
      pairs.sort((a,b)=>Math.abs(a[0]-a[1])-Math.abs(b[0]-b[1]));

      let bestAtSize=null;
      for(const [hGroups,vGroups] of pairs.slice(0,Math.min(16,pairs.length))){
        const hTracks=hGroups*5;
        const vTracks=vGroups*5;
        const attempts=extraGroups===0?1:20;
        for(let attempt=0;attempt<attempts;attempt++){
          const seed=(baseSeed+Math.imul(totalGroups+1,2654435761)+Math.imul(attempt+1,1013904223)+hGroups*2246822519)>>>0;
          const phases=candidatePhases(lineBits,hTracks,vTracks,seed);
          const regions=C.enclosedRegions(phases.hPhases,phases.vPhases);
          if(regions.length<neededRegions) continue;
          const score=beautyScore(regions,hTracks,vTracks,neededRegions,extraGroups);
          const candidate={...phases,hTracks,vTracks,regions,seed,beautyScore:score};
          if(!bestAtSize||score>bestAtSize.beautyScore) bestAtSize=candidate;
        }
      }

      if(bestAtSize&&(!winner||bestAtSize.beautyScore>winner.beautyScore)) winner=bestAtSize;
      // Once the current size produces a strong motif field, avoid making an
      // already-large Classic puzzle grow just for a marginal aesthetic gain.
      if(bestAtSize&&extraGroups>=1) break;
    }

    if(winner) return winner;
    // Keep compatibility with the original exhaustive fallback for unusual inputs.
    return C.choosePattern(line,surface);
  }

  function motifHueAssignments(regions){
    if(!regions.length) return [];
    const geo=regions.map((region,index)=>({...regionGeometry(region),index}));
    const majors=geo.filter(g=>g.area>1).sort((a,b)=>a.cy-b.cy||a.cx-b.cx||b.area-a.area);
    const hues=Array(regions.length).fill(0);

    if(majors.length){
      // Large motifs establish the visual rhythm. Alternate them in reading order.
      majors.forEach((g,i)=>{hues[g.index]=i&1;});

      // Tiny pockets become accents belonging to the nearest larger motif rather
      // than receiving effectively random colors of their own.
      geo.filter(g=>g.area===1).forEach(g=>{
        let nearest=majors[0],best=Infinity;
        majors.forEach(m=>{
          const dr=g.cy-m.cy,dc=g.cx-m.cx;
          const distance=dr*dr+dc*dc;
          if(distance<best){best=distance;nearest=m;}
        });
        hues[g.index]=1-hues[nearest.index];
      });
    }else{
      // Rare all-singleton fields use broad spatial bands instead of per-cell noise.
      geo.forEach(g=>{
        hues[g.index]=(Math.floor(g.cy/6)+Math.floor(g.cx/6))&1;
      });
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
    const regions=C.enclosedRegions(h,v);
    const hues=motifHueAssignments(regions);
    const palette=C.PALETTES[((Number(challenge.palette)||0)%C.PALETTES.length+C.PALETTES.length)%C.PALETTES.length];
    const step=26;
    const pad=22;
    const width=cols*step+pad*2;
    const height=rows*step+pad*2;
    let body=`<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${palette.background}"/>`;

    regions.forEach((region,i)=>{
      const shade=C.regionShadeBit(challenge,i);
      const hue=hues[i]||0;
      const fill=hue===0?(shade?palette.aDark:palette.aLight):(shade?palette.bDark:palette.bLight);
      region.cells.forEach(([r,c])=>{
        body+=`<rect class="classic-region-cell" data-region="${i}" data-motif-hue="${hue}" x="${pad+c*step}" y="${pad+r*step}" width="${step+.35}" height="${step+.35}" fill="${fill}"/>`;
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
      svg:`<svg class="classic-cipher-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Traditional Hitomezashi cipher with ${regions.length} enclosed regions">${body}</svg>`,
      regions,
      motifHues:hues
    };
  }

  C.chooseBeautifulPattern=chooseBeautifulPattern;
  C.beautyScore=beautyScore;
  C.motifHueAssignments=motifHueAssignments;
  C.buildChallenge=buildBeautifulChallenge;
  C.svgMarkup=svgMarkup;
})();