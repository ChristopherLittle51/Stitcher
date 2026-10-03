(() => {
  const C=window.StitcherClassic;
  if(!C) return;
  const originalBuild=C.buildChallenge;

  C.buildChallenge=(title,lineText,surfaceText,paletteIndex=0)=>{
    const surface=C.normalize(surfaceText);
    if(surface) return originalBuild(title,lineText,surface,paletteIndex);

    // Force the generator to find at least one full five-region group so a
    // stitch-only puzzle still retains the enclosed Hitomezashi aesthetic.
    const challenge=originalBuild(title,lineText,'A',paletteIndex);
    challenge.colorLength=0;
    challenge.surfaceBits=[];
    return challenge;
  };
})();