(() => {
  const ALPHABET=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',' '];
  const INDEX=new Map(ALPHABET.map((ch,i)=>[ch,i]));
  const PALETTES=[
    {name:'Indigo & Saffron',background:'#f7f0df',ground:'#cbd8b7',thread:'#173b70',aLight:'#a9c4df',aDark:'#4d86bd',bLight:'#f2d19e',bDark:'#e4a038'},
    {name:'Teal & Coral',background:'#f6f0e8',ground:'#d8cbea',thread:'#153d49',aLight:'#9bc9c3',aDark:'#3f9690',bLight:'#f0b1a2',bDark:'#d96f5c'},
    {name:'Plum & Sage',background:'#f5f0e7',ground:'#bdd3df',thread:'#3f3150',aLight:'#c3afd0',aDark:'#806397',bLight:'#c9d4ae',bDark:'#839a66'},
    {name:'Navy & Rust',background:'#f4eee2',ground:'#c8d5bd',thread:'#132f50',aLight:'#a8bed8',aDark:'#486f9f',bLight:'#e7b18e',bDark:'#b9663d'}
  ];

  function mod(n,m){ return ((n%m)+m)%m; }

  function normalize(text){
    return String(text||'')
      .toUpperCase()
      .replace(/[^A-Z]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function bitsForText(text){
    const clean=normalize(text);
    const bits=[];
    for(const ch of clean){
      const value=INDEX.get(ch);
      for(let i=4;i>=0;i--) bits.push((value>>i)&1);
    }
    return bits;
  }

  function textFromBits(bits,length){
    let out='';
    const count=Math.min(Number(length)||0,Math.floor(bits.length/5));
    for(let i=0;i<count;i++){
      let value=0;
      for(let j=0;j<5;j++) value=(value<<1)|(bits[i*5+j]&1);
      out+=ALPHABET[value]??'?';
    }
    return out;
  }

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

  function hVisible(hPhases,track,segment){
    return mod((hPhases[track]||0)+segment,2)===0;
  }

  function vVisible(vPhases,track,segment){
    return mod((vPhases[track]||0)+segment,2)===0;
  }

  function enclosedRegions(hPhases,vPhases){
    const rows=hPhases.length-1;
    const cols=vPhases.length-1;
    if(rows<1||cols<1) return [];
    const seen=Array.from({length:rows},()=>Array(cols).fill(false));
    const regions=[];

    for(let sr=0;sr<rows;sr++){
      for(let sc=0;sc<cols;sc++){
        if(seen[sr][sc]) continue;
        const queue=[[sr,sc]];
        const cells=[];
        let outside=false;
        seen[sr][sc]=true;

        for(let q=0;q<queue.length;q++){
          const [r,c]=queue[q];
          cells.push([r,c]);

          if(r===0&&!hVisible(hPhases,0,c)) outside=true;
          if(r===rows-1&&!hVisible(hPhases,rows,c)) outside=true;
          if(c===0&&!vVisible(vPhases,0,r)) outside=true;
          if(c===cols-1&&!vVisible(vPhases,cols,r)) outside=true;

          if(r>0&&!hVisible(hPhases,r,c)&&!seen[r-1][c]){
            seen[r-1][c]=true;queue.push([r-1,c]);
          }
          if(r<rows-1&&!hVisible(hPhases,r+1,c)&&!seen[r+1][c]){
            seen[r+1][c]=true;queue.push([r+1,c]);
          }
          if(c>0&&!vVisible(vPhases,c,r)&&!seen[r][c-1]){
            seen[r][c-1]=true;queue.push([r,c-1]);
          }
          if(c<cols-1&&!vVisible(vPhases,c+1,r)&&!seen[r][c+1]){
            seen[r][c+1]=true;queue.push([r,c+1]);
          }
        }

        if(!outside){
          let minR=Infinity,minC=Infinity;
          cells.forEach(([r,c])=>{minR=Math.min(minR,r);minC=Math.min(minC,c);});
          regions.push({cells,minR,minC});
        }
      }
    }

    regions.sort((a,b)=>a.minR-b.minR||a.minC-b.minC||a.cells.length-b.cells.length);
    return regions.map((region,id)=>({...region,id}));
  }

  function candidatePhases(lineBits,hTracks,vTracks,seed){
    const capacity=hTracks+vTracks;
    const rng=makeRng(seed);
    const bits=Array.from({length:capacity},(_,i)=>i<lineBits.length?lineBits[i]:(rng()>.5?1:0));
    return {hPhases:bits.slice(0,hTracks),vPhases:bits.slice(hTracks)};
  }

  function choosePattern(lineText,surfaceText){
    const line=normalize(lineText);
    const surface=normalize(surfaceText);
    if(line.length>80||surface.length>80) throw new Error('Classic messages are limited to 80 characters each.');
    const lineBits=bitsForText(line);
    const neededRegions=Math.max(surface.length*5,surface.length?0:5);
    const neededGroups=Math.max(line.length,2);
    const seed=hashSeed(line+'|'+surface);

    for(let extraGroups=0;extraGroups<=120;extraGroups++){
      const totalGroups=neededGroups+extraGroups;
      const pairs=[];
      for(let hg=1;hg<totalGroups;hg++) pairs.push([hg,totalGroups-hg]);
      pairs.sort((a,b)=>Math.abs(a[0]-a[1])-Math.abs(b[0]-b[1]));

      for(let variant=0;variant<10;variant++){
        for(const [hGroups,vGroups] of pairs.slice(0,Math.min(pairs.length,18))){
          const hTracks=hGroups*5;
          const vTracks=vGroups*5;
          const phases=candidatePhases(lineBits,hTracks,vTracks,seed+variant*7919+extraGroups*104729+hGroups*97);
          const regions=enclosedRegions(phases.hPhases,phases.vPhases);
          if(regions.length>=neededRegions){
            return {...phases,hTracks,vTracks,regions};
          }
        }
      }
    }
    throw new Error('Could not find a Classic field with enough enclosed regions. Try a shorter surface message.');
  }

  function buildChallenge(title,lineText,surfaceText,paletteIndex=0){
    const line=normalize(lineText);
    const surface=normalize(surfaceText);
    const pattern=choosePattern(line,surface);
    return {
      v:1,
      mode:'classic',
      title:String(title||'Stitcher Classic').slice(0,80),
      lineLength:line.length,
      colorLength:surface.length,
      palette:mod(Number(paletteIndex)||0,PALETTES.length),
      hPhases:pattern.hPhases,
      vPhases:pattern.vPhases,
      surfaceBits:bitsForText(surface)
    };
  }

  function expectedMessages(challenge){
    const phases=[...challenge.hPhases,...challenge.vPhases];
    return {
      line:textFromBits(phases,challenge.lineLength),
      color:textFromBits(challenge.surfaceBits,challenge.colorLength)
    };
  }

  function packBits(fields){
    const bits=[];
    fields.forEach(({value,count})=>{
      for(let i=count-1;i>=0;i--) bits.push((value>>i)&1);
    });
    const out=new Uint8Array(Math.ceil(bits.length/8));
    bits.forEach((bit,i)=>out[i>>3]|=bit<<(7-(i&7)));
    return out;
  }

  function makeBitReader(bytes){
    let pos=0;
    return count=>{
      let value=0;
      for(let i=0;i<count;i++){
        if(pos>=bytes.length*8) throw new Error('Classic challenge data ended early.');
        value=(value<<1)|((bytes[pos>>3]>>(7-(pos&7)))&1);
        pos++;
      }
      return value;
    };
  }

  function bytesToBase64Url(bytes){
    let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  function base64UrlToBytes(text){
    const padded=String(text||'').replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(text||'').length+3)%4);
    const binary=atob(padded);
    return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
  }

  function encodePayload(challenge,options={}){
    const includeTitle=options.includeTitle!==false;
    const titleBytes=includeTitle?new TextEncoder().encode(challenge.title||'Stitcher Classic'):new Uint8Array();
    if(titleBytes.length>255) throw new Error('Classic title is too long.');
    if(challenge.hPhases.length>511||challenge.vPhases.length>511) throw new Error('Classic field is too large to share.');
    const fields=[
      {value:0xa7,count:8},
      {value:challenge.lineLength,count:7},
      {value:challenge.colorLength,count:7},
      {value:challenge.palette,count:3},
      {value:includeTitle?1:0,count:1},
      {value:challenge.hPhases.length,count:9},
      {value:challenge.vPhases.length,count:9}
    ];
    if(includeTitle){
      fields.push({value:titleBytes.length,count:8});
      titleBytes.forEach(value=>fields.push({value,count:8}));
    }
    challenge.hPhases.forEach(value=>fields.push({value:value&1,count:1}));
    challenge.vPhases.forEach(value=>fields.push({value:value&1,count:1}));
    challenge.surfaceBits.slice(0,challenge.colorLength*5).forEach(value=>fields.push({value:value&1,count:1}));
    return bytesToBase64Url(packBits(fields));
  }

  function decodePayload(encoded){
    const bytes=base64UrlToBytes(encoded);
    const read=makeBitReader(bytes);
    if(read(8)!==0xa7) throw new Error('Not a Stitcher Classic challenge.');
    const lineLength=read(7);
    const colorLength=read(7);
    const palette=read(3);
    const hasTitle=read(1)===1;
    const hCount=read(9);
    const vCount=read(9);
    let title='Stitcher Classic';
    if(hasTitle){
      const titleLength=read(8);
      const titleBytes=Uint8Array.from({length:titleLength},()=>read(8));
      title=new TextDecoder().decode(titleBytes)||title;
    }
    const hPhases=Array.from({length:hCount},()=>read(1));
    const vPhases=Array.from({length:vCount},()=>read(1));
    const surfaceBits=Array.from({length:colorLength*5},()=>read(1));
    return {v:1,mode:'classic',title,lineLength,colorLength,palette,hPhases,vPhases,surfaceBits};
  }

  function regionShadeBit(challenge,index){
    return index<challenge.surfaceBits.length?challenge.surfaceBits[index]&1:((index+Math.floor(index/2))&1);
  }

  function svgMarkup(challenge,options={}){
    const h=challenge.hPhases;
    const v=challenge.vPhases;
    const rows=h.length-1;
    const cols=v.length-1;
    const regions=enclosedRegions(h,v);
    const palette=PALETTES[mod(challenge.palette||0,PALETTES.length)];
    const step=26;
    const pad=22;
    const width=cols*step+pad*2;
    const height=rows*step+pad*2;
    let body=`<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${palette.background}"/>`;

    regions.forEach((region,i)=>{
      const shade=regionShadeBit(challenge,i);
      const hue=(region.minR+region.minC+i)&1;
      const fill=hue===0?(shade?palette.aDark:palette.aLight):(shade?palette.bDark:palette.bLight);
      region.cells.forEach(([r,c])=>{
        body+=`<rect class="classic-region-cell" data-region="${i}" x="${pad+c*step}" y="${pad+r*step}" width="${step}" height="${step}" fill="${fill}"/>`;
      });
    });

    for(let r=0;r<h.length;r++){
      for(let c=0;c<cols;c++){
        if(hVisible(h,r,c)){
          const y=pad+r*step;
          const x1=pad+c*step+2.5;
          const x2=pad+(c+1)*step-2.5;
          body+=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${palette.thread}" stroke-width="4.8" stroke-linecap="round"/>`;
        }
      }
    }
    for(let c=0;c<v.length;c++){
      for(let r=0;r<rows;r++){
        if(vVisible(v,c,r)){
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

    return {svg:`<svg class="classic-cipher-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Traditional Hitomezashi cipher with ${regions.length} enclosed regions">${body}</svg>`,regions};
  }

  window.StitcherClassic={
    ALPHABET,INDEX,PALETTES,mod,normalize,bitsForText,textFromBits,
    hVisible,vVisible,enclosedRegions,choosePattern,buildChallenge,expectedMessages,
    encodePayload,decodePayload,regionShadeBit,svgMarkup
  };
})();