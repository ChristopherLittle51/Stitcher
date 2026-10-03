(() => {
  const C=window.StitcherClassic;
  if(!C) return;

  function foregroundHues(regions,hPhases,vPhases){
    let hues=C.motifHueAssignments
      ? C.motifHueAssignments(regions,hPhases,vPhases)
      : regions.map((_,i)=>i&1);
    if(regions.length>1&&new Set(hues).size<2){
      hues=hues.map((h,i)=>i&1);
    }
    return hues;
  }

  function svgMarkup(challenge,options={}){
    const h=challenge.hPhases;
    const v=challenge.vPhases;
    const rows=h.length-1;
    const cols=v.length-1;
    const allRegions=C.enclosedRegions(h,v);
    const eligible=C.surfaceRegions?C.surfaceRegions(allRegions):allRegions;
    const needed=Math.max(0,(Number(challenge.colorLength)||0)*5);
    const regions=eligible.slice(0,needed);
    const hues=foregroundHues(regions,h,v);
    const hueGrid=C.cellHueGrid?C.cellHueGrid(h,v):null;
    const palette=C.PALETTES[C.mod(Number(challenge.palette)||0,C.PALETTES.length)];
    const ground=palette.ground||palette.background;
    const step=26;
    const pad=22;
    const width=cols*step+pad*2;
    const height=rows*step+pad*2;

    let body=`<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${palette.background}"/>`;
    body+=`<rect class="classic-ground-field" x="${pad}" y="${pad}" width="${cols*step}" height="${rows*step}" fill="${ground}"/>`;

    // The third hue is the non-data ground. Only the first N substantial enclosed
    // motifs are foreground surface symbols. Hue A/B is decorative; light/dark is data.
    regions.forEach((region,i)=>{
      const shade=challenge.surfaceBits[i]&1;
      const hue=hues[i]||0;
      const fill=hue===0
        ? (shade?palette.aDark:palette.aLight)
        : (shade?palette.bDark:palette.bLight);
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
      svg:`<svg class="classic-cipher-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Three-hue Hitomezashi cipher with ${regions.length} shade-bearing foreground motifs">${body}</svg>`,
      regions,
      allRegions,
      eligibleRegions:eligible,
      motifHues:hues,
      hueGrid,
      groundHue:ground
    };
  }

  C.svgMarkup=svgMarkup;
})();