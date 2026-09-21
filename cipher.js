(() => {
  const ALPHABET = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',' ','.',',',"'","?","ESC"];
  const INDEX = new Map(ALPHABET.map((c,i)=>[c,i]));
  const WHEEL = [
    {name:'Blue',hex:'#477fbd'},
    {name:'Blue-violet',hex:'#6858b7'},
    {name:'Violet',hex:'#8b50ae'},
    {name:'Red-violet',hex:'#b34f8d'},
    {name:'Red',hex:'#c85658'},
    {name:'Red-orange',hex:'#d77745'},
    {name:'Orange',hex:'#df9a3e'},
    {name:'Yellow-orange',hex:'#d9b83f'},
    {name:'Yellow',hex:'#c7c94a'},
    {name:'Yellow-green',hex:'#8cbb55'},
    {name:'Green',hex:'#4fa16a'},
    {name:'Blue-green',hex:'#3e9993'}
  ];
  const SHIFTS = [-5,-4,-3,-2,-1,0,1,2,3,4,5,6];
  const ROTATIONS = [0,90,180,270];
  const HINTS = [
    {id:1,title:'Think Binary',cost:5,text:'Every meaningful choice in the pattern can ultimately be reduced to 0 or 1.'},
    {id:2,title:'Groups of Five',cost:7,text:'Look for information arranged in groups of five. Five binary values are enough to represent one symbol.'},
    {id:3,title:'More Than One Message',cost:8,text:'The stitching and the filled squares are not just two ways of drawing the same information.'},
    {id:4,title:'Read the Grid Lines',cost:10,text:'Treat each individual segment between two neighboring intersections as a bit. A stitch and a gap represent opposite values.'},
    {id:5,title:'Split the Stitch Layer',cost:10,text:'Horizontal stitch lines and vertical stitch lines are read separately. Each complete line contains five bits.'},
    {id:6,title:'Split the Color Layer',cost:12,text:'Color contains two independent properties. Read hue in one direction and light/dark shade in the other.'},
    {id:7,title:'The Dot Matters',cost:13,text:'The corner marker tells you how the grid is oriented. Rotate the pattern until the marked corner is back where it belongs before decoding.'},
    {id:8,title:'The Colors Are a Key',cost:15,text:'The complementary hue pair changes the decoded symbols. Blue/orange is the neutral pair, and moving around the color wheel changes the value.'},
    {id:9,title:'Exact Shift Rule',cost:12,text:'Blue/orange = 0. Each color-wheel step clockwise from blue is +1 and each step counterclockwise is −1. Reverse that shift modulo 32 when decoding.'},
    {id:10,title:'Full Alphabet',cost:8,text:"Use A=00000, B=00001, C=00010 … Z=11001, then SPACE, period, comma, apostrophe, question mark, and ESC through 11111."}
  ];

  const mod = (n,m) => ((n % m) + m) % m;
  const hue0 = s => WHEEL[mod(s,12)];
  const hue1 = s => WHEEL[mod(s+6,12)];

  function lighten(hex, amount){
    const n=parseInt(hex.slice(1),16);
    let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    r=Math.round(r+(255-r)*amount);
    g=Math.round(g+(255-g)*amount);
    b=Math.round(b+(255-b)*amount);
    return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  function colorsFor(shift){
    const a=hue0(shift),b=hue1(shift);
    return {
      '00':lighten(a.hex,.56),
      '01':a.hex,
      '10':lighten(b.hex,.56),
      '11':b.hex
    };
  }

  function sanitize(raw){
    let text='',bad=0;
    for(const ch of String(raw ?? '').toUpperCase()){
      if(INDEX.has(ch) && ch !== 'ESC') text += ch;
      else if(/\s/.test(ch)) text += ' ';
      else { text += ' '; bad++; }
    }
    return {text,bad};
  }

  function normalizeAnswer(raw){
    return sanitize(raw).text.replace(/\s+$/,'');
  }

  function charIndex(ch){
    return INDEX.has(ch) ? INDEX.get(ch) : INDEX.get(' ');
  }

  function shiftedIndex(ch,shift){
    return mod(charIndex(ch)+shift,32);
  }

  function bitsFor(ch,shift){
    return shiftedIndex(ch,shift).toString(2).padStart(5,'0').split('').map(Number);
  }

  function shiftedChar(ch,shift){
    return ALPHABET[shiftedIndex(ch,shift)];
  }

  function segment(text,start,count){
    return text.slice(start,start+count).padEnd(count,' ');
  }

  function requiredGridCount(lineText,colorText){
    return Math.max(Math.ceil(lineText.length/12),Math.ceil(colorText.length/10),1);
  }

  function encodeGrid(line12,color10,shift){
    const hChars=line12.slice(0,6).padEnd(6,' ').split('');
    const vChars=line12.slice(6,12).padEnd(6,' ').split('');
    const rowChars=color10.slice(0,5).padEnd(5,' ').split('');
    const colChars=color10.slice(5,10).padEnd(5,' ').split('');

    const hBits=hChars.map(c=>bitsFor(c,shift));
    const vBits=vChars.map(c=>bitsFor(c,shift));
    const rowBits=rowChars.map(c=>bitsFor(c,shift));
    const colBits=colChars.map(c=>bitsFor(c,shift));

    return {hBits,vBits,rowBits,colBits,shift};
  }

  function rotatePoint(x,y,cx,cy,deg){
    const q=deg*Math.PI/180,dx=x-cx,dy=y-cy;
    return {
      x:cx+dx*Math.cos(q)-dy*Math.sin(q),
      y:cy+dx*Math.sin(q)+dy*Math.cos(q)
    };
  }

  function svgMarkup(grid,rotation=0){
    const step=54,pad=38,total=pad*2+step*5,cx=total/2,cy=total/2;
    const colors=colorsFor(grid.shift);
    let inner='';

    for(let r=0;r<5;r++){
      for(let c=0;c<5;c++){
        const hue=grid.rowBits[r][c];
        const shade=grid.colBits[c][r];
        const fill=colors[`${hue}${shade}`];
        inner += `<rect x="${pad+c*step+2}" y="${pad+r*step+2}" width="${step-4}" height="${step-4}" rx="2" fill="${fill}"/>`;
      }
    }

    for(let i=0;i<6;i++){
      const p=pad+i*step;
      inner += `<line x1="${pad}" y1="${p}" x2="${pad+5*step}" y2="${p}" stroke="#c9d2df" stroke-width="1.4"/>`;
      inner += `<line x1="${p}" y1="${pad}" x2="${p}" y2="${pad+5*step}" stroke="#c9d2df" stroke-width="1.4"/>`;
    }

    for(let r=0;r<6;r++){
      for(let c=0;c<5;c++){
        if(grid.hBits[r][c]===0){
          const y=pad+r*step,x1=pad+c*step+6,x2=pad+(c+1)*step-6;
          inner += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#173b70" stroke-width="7" stroke-linecap="round"/>`;
        }
      }
    }

    for(let c=0;c<6;c++){
      for(let r=0;r<5;r++){
        if(grid.vBits[c][r]===0){
          const x=pad+c*step,y1=pad+r*step+6,y2=pad+(r+1)*step-6;
          inner += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#173b70" stroke-width="7" stroke-linecap="round"/>`;
        }
      }
    }

    for(let r=0;r<6;r++){
      for(let c=0;c<6;c++){
        inner += `<circle cx="${pad+c*step}" cy="${pad+r*step}" r="4" fill="#173b70"/>`;
      }
    }

    const dot=rotatePoint(pad-19,pad-19,cx,cy,rotation);
    return `<svg viewBox="0 0 ${total} ${total}" role="img" aria-label="Stitch cipher grid"><g transform="rotate(${rotation} ${cx} ${cy})">${inner}</g><circle cx="${dot.x}" cy="${dot.y}" r="9" fill="${hue0(grid.shift).hex}" stroke="#173b70" stroke-width="2"/></svg>`;
  }

  function bytesToBase64Url(bytes){
    let binary='';
    bytes.forEach(b=>binary+=String.fromCharCode(b));
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  function base64UrlToBytes(text){
    let s=text.replace(/-/g,'+').replace(/_/g,'/');
    while(s.length%4) s+='=';
    const binary=atob(s);
    return Uint8Array.from(binary,c=>c.charCodeAt(0));
  }

  function encodePayload(payload){
    const json=JSON.stringify(payload);
    return bytesToBase64Url(new TextEncoder().encode(json));
  }

  function decodePayload(encoded){
    const json=new TextDecoder().decode(base64UrlToBytes(encoded));
    return JSON.parse(json);
  }

  async function sha256(text){
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function buildChallenge(title,lineRaw,colorRaw,keys){
    const line=normalizeAnswer(lineRaw);
    const color=normalizeAnswer(colorRaw);
    const count=requiredGridCount(line,color);
    const normalizedKeys=Array.from({length:count},(_,i)=>({
      shift:Number(keys[i]?.shift ?? 0),
      rotation:Number(keys[i]?.rotation ?? 0)
    }));
    const grids=Array.from({length:count},(_,i)=>{
      const line12=segment(line,i*12,12);
      const color10=segment(color,i*10,10);
      const grid=encodeGrid(line12,color10,normalizedKeys[i].shift);
      return {
        h:grid.hBits,
        v:grid.vBits,
        r:grid.rowBits,
        c:grid.colBits,
        s:normalizedKeys[i].shift,
        o:normalizedKeys[i].rotation
      };
    });
    return {
      v:1,
      title:String(title || 'Untitled Stitcher challenge').slice(0,80),
      grids,
      lineHash:await sha256(line),
      colorHash:await sha256(color),
      lineLength:line.length,
      colorLength:color.length
    };
  }

  function gridFromPayloadGrid(g){
    return {
      hBits:g.h,
      vBits:g.v,
      rowBits:g.r,
      colBits:g.c,
      shift:Number(g.s)
    };
  }

  async function checkAnswer(raw,expectedHash){
    return (await sha256(normalizeAnswer(raw))) === expectedHash;
  }

  window.StitcherCipher = {
    ALPHABET,INDEX,WHEEL,SHIFTS,ROTATIONS,HINTS,
    mod,hue0,hue1,colorsFor,sanitize,normalizeAnswer,
    charIndex,shiftedIndex,bitsFor,shiftedChar,
    segment,requiredGridCount,encodeGrid,svgMarkup,
    encodePayload,decodePayload,buildChallenge,gridFromPayloadGrid,
    checkAnswer
  };
})();
