(()=>{
  const $=id=>document.getElementById(id);
  const video=$('video'),preview=$('preview');
  if(!video||!preview)return;

  let faceImage=null,faceImagePromise=null,faceVideo=null,visionFiles=null,liveTimer=null,liveBusy=false,autoBusy=false;

  function withTimeout(promise,ms,message){
    let timer;
    return Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms)})
    ]).finally(()=>clearTimeout(timer));
  }

  async function vision(){
    if(visionFiles)return visionFiles;
    const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm');
    const files=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
    visionFiles={mod,files};
    return visionFiles;
  }

  async function imageLandmarker(){
    if(faceImage)return faceImage;
    if(!faceImagePromise)faceImagePromise=(async()=>{
      const {mod,files}=await vision();
      faceImage=await mod.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},runningMode:'IMAGE',numFaces:1,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5});
      return faceImage;
    })().catch(error=>{faceImagePromise=null;throw error});
    return faceImagePromise;
  }

  async function videoLandmarker(){
    if(faceVideo)return faceVideo;
    const {mod,files}=await vision();
    faceVideo=await mod.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5});
    return faceVideo;
  }

  function metrics(lm,w,h){
    const xs=lm.map(p=>p.x),ys=lm.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const eyeL=lm[33],eyeR=lm[263],cx=(minX+maxX)/2,faceH=maxY-minY,eyeY=(eyeL.y+eyeR.y)/2;
    const tilt=Math.abs(Math.atan2((eyeR.y-eyeL.y)*h,(eyeR.x-eyeL.x)*w)*180/Math.PI);
    return{minX,maxX,minY,maxY,cx,faceH,eyeY,tilt};
  }

  function profileForFraming(framing){
    // Face landmarks stop near the forehead rather than the top of the hair.
    // Reserve extra room for hair above the forehead landmarks. At the
    // biometric face target, this estimates a full head near 83% of the frame.
    if(framing==='us')return {targetFace:.43,targetEye:.44,liveMin:.22,liveMax:.48,tolerance:.035,summary:'Face positioned for the 2×2 inch head-size range with visible hair and a small top margin.'};
    if(framing==='canada')return {targetFace:.46,targetEye:.43,liveMin:.25,liveMax:.54,tolerance:.035,summary:'Face positioned for the Canada 50 × 70 mm head-size range with visible hair and a small top margin.'};
    if(framing==='custom')return {targetFace:.52,targetEye:.44,liveMin:.26,liveMax:.56,tolerance:.04,summary:'Face positioned using general passport-photo guidance. Verify the requirements for your custom size.'};
    return {targetFace:.64,targetEye:.48,liveMin:.34,liveMax:.64,tolerance:.04,topMargin:.04,crownAllowance:.40,summary:'Face positioned for a close biometric crop. Check that the full hair and a clear top margin are visible before downloading.'};
  }

  function framingProfile(){return profileForFraming(window.getPassportFormat?.().framing);}
  window.passportAutoPositionProfile=profileForFraming;

  function setLive(text,state='warn'){
    const el=$('liveStatus');if(!el)return;
    el.textContent=text;el.className=`live-status ${state}`;
  }

  async function liveCheck(){
    if(liveBusy||!video.srcObject||video.readyState<2||!video.videoWidth)return;
    liveBusy=true;
    try{
      const lmkr=await videoLandmarker(),det=lmkr.detectForVideo(video,performance.now()),faces=det.faceLandmarks||[];
      if(faces.length!==1){setLive(faces.length?'Only one face should be visible':'Move your face into the guide','warn');return}
      const m=metrics(faces[0],video.videoWidth,video.videoHeight),notes=[];
      if(Math.abs(m.cx-.5)>.09)notes.push(m.cx<.5?'move right':'move left');
      const profile=framingProfile();
      if(m.faceH<profile.liveMin)notes.push('move closer'); else if(m.faceH>profile.liveMax)notes.push('move farther back');
      if(m.tilt>7)notes.push('straighten your head');
      if(m.eyeY<.25)notes.push('move slightly down'); else if(m.eyeY>.48)notes.push('move slightly up');
      if(notes.length)setLive(notes.slice(0,2).join(' · '),'warn'); else setLive('Framing looks good ✓','pass');
    }catch(e){console.warn('Live guidance unavailable',e);setLive('Live guidance unavailable','warn');stopLive();}
    finally{liveBusy=false;}
  }

  function startLive(){
    stopLive();setLive('Starting live guidance…','warn');
    liveTimer=setInterval(liveCheck,650);
  }
  function stopLive(){if(liveTimer){clearInterval(liveTimer);liveTimer=null;}}

  $('startCamera')?.addEventListener('click',()=>setTimeout(()=>{if(video.srcObject)startLive()},1000));
  $('switchCamera')?.addEventListener('click',()=>setTimeout(()=>{if(video.srcObject)startLive()},1000));
  $('capture')?.addEventListener('click',()=>{stopLive();setLive('Photo captured','pass')});
  $('fileInput')?.addEventListener('change',()=>stopLive());

  function canvasImage(c){
    return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=c.toDataURL('image/jpeg',.95)});
  }

  function fireRange(id,value){
    const el=$(id);if(!el)return;
    const v=Math.max(Number(el.min),Math.min(Number(el.max),value));
    el.value=String(Math.round(v));el.dispatchEvent(new Event('input',{bubbles:true}));
  }

  async function detectPreview(onStage){
    const lmkr=await withTimeout(imageLandmarker(),20000,'The face model took too long to load. Check your connection and tap Auto-position face again.');
    onStage?.('Detecting your face…');
    const img=await canvasImage(preview),det=lmkr.detect(img),faces=det.faceLandmarks||[];
    if(faces.length!==1)throw Error('Exactly one clear face is required for automatic positioning.');
    return metrics(faces[0],preview.width,preview.height);
  }

  async function detectSource(onStage){
    const source=window.getPassportSource?.();
    if(!source)throw Error('Choose or capture a photo before positioning.');
    const lmkr=await withTimeout(imageLandmarker(),20000,'The face model took too long to load. Check your connection and tap Auto-position face again.');
    onStage?.('Detecting your face in the original photo…');
    const det=lmkr.detect(source),faces=det.faceLandmarks||[];
    if(faces.length!==1)throw Error('Exactly one clear face is required for automatic positioning.');
    return {source,m:metrics(faces[0],source.width,source.height)};
  }

  function visibleHairTop(source,m){
    // Compare the top of the head with the background on both sides of the
    // source photo. Face landmarks end at the forehead, below the hair.
    const scale=Math.min(1,384/Math.max(source.width,source.height));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(source.width*scale));
    c.height=Math.max(1,Math.round(source.height*scale));
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,0,0,c.width,c.height);
    const {data}=ctx.getImageData(0,0,c.width,c.height),w=c.width;
    const left=Math.max(1,Math.floor((m.cx-(m.maxX-m.minX)*.6)*w));
    const right=Math.min(w-2,Math.ceil((m.cx+(m.maxX-m.minX)*.6)*w));
    let consecutive=0;
    for(let y=1;y<Math.min(c.height-1,Math.ceil(m.minY*c.height));y++){
      const side=(x)=>{const p=(y*w+x)*4;return[data[p],data[p+1],data[p+2]]};
      const l=side(Math.floor(w*.04)),r=side(Math.ceil(w*.96));
      const background=(l[0]+l[1]+l[2]+r[0]+r[1]+r[2])/6;
      let run=0,found=false;
      for(let x=left;x<=right;x++){
        const p=(y*w+x)*4,brightness=(data[p]+data[p+1]+data[p+2])/3;
        const difference=Math.min(
          Math.abs(data[p]-l[0])+Math.abs(data[p+1]-l[1])+Math.abs(data[p+2]-l[2]),
          Math.abs(data[p]-r[0])+Math.abs(data[p+1]-r[1])+Math.abs(data[p+2]-r[2]));
        run=background-brightness>28&&difference>115?run+1:0;
        if(run>=Math.max(4,Math.floor((right-left)*.13))){found=true;break;}
      }
      consecutive=found?consecutive+1:0;
      if(consecutive>=3)return (y-2)/c.height;
    }
    return null;
  }

  function sourceFraming(source,m,profile){
    const w=preview.width,h=preview.height,cover=Math.max(w/source.width,h/source.height);
    const desiredZoom=profile.targetFace*h/(m.faceH*source.height*cover)*100;
    const estimatedCrown=Math.max(0,m.minY-m.faceH*(profile.crownAllowance??.14));
    const observedCrown=profile.topMargin==null?null:visibleHairTop(source,m);
    const crown=observedCrown==null?estimatedCrown:Math.min(estimatedCrown,observedCrown);
    // Keep the original photograph covering the output. The preview may have
    // already cropped the hair, so calculate these bounds from the source.
    let choice;
    for(let zoom=Math.min(180,Math.max(100,Math.floor(desiredZoom)));zoom>=100;zoom--){
      const scale=cover*zoom/100,ratio=source.height*scale/h;
      const center=(1-ratio)/2;
      const panLimit=Number($('ypos').max)/400;
      const upper=Math.min(panLimit,(ratio-1)/2),lower=Math.max(-panLimit,(1-ratio)/2);
      const eye=profile.targetEye-(center+m.eyeY*ratio);
      const hair=profile.topMargin==null?-Infinity:profile.topMargin-(center+crown*ratio);
      const shift=Math.max(eye,hair);
      choice={zoom,shift:Math.max(lower,Math.min(upper,shift)),crownY:center+crown*ratio+Math.max(lower,Math.min(upper,shift))};
      if(shift<=upper+.001)break;
    }
    const widthRatio=source.width*cover*choice.zoom/100/w;
    const xShift=Math.max(-.25,Math.min(.25,(.5-m.cx)*widthRatio));
    return {...choice,x:xShift*400,y:choice.shift*400};
  }

  $('autoPosition')?.addEventListener('click',async()=>{
    if(autoBusy)return;autoBusy=true;
    const b=$('autoPosition'),msg=$('autoPositionStatus');b.disabled=true;b.textContent='Positioning…';msg.textContent='Loading the on-device face model…';
    try{
      // Allow Safari to paint the busy state before face detection blocks the
      // main thread briefly. One measured adjustment plus one verification is
      // substantially faster than repeatedly running the model on mobile.
      await new Promise(r=>setTimeout(r,50));
      const profile=framingProfile(),{source,m}=await detectSource(text=>{msg.textContent=text});
      msg.textContent='Applying the passport framing…';
      const framing=sourceFraming(source,m,profile);
      fireRange('zoom',framing.zoom);
      fireRange('xpos',framing.x);
      fireRange('ypos',framing.y);
      await new Promise(r=>requestAnimationFrame(r));
      msg.textContent=profile.summary+(profile.topMargin!=null&&framing.crownY<profile.topMargin-.01?' The original photo may not have enough background to keep a full top margin at this size.':'')+' Review the hairline and run checks.';
    }catch(e){console.error(e);msg.textContent=e.message||'Automatic positioning could not run.';}
    finally{autoBusy=false;b.disabled=false;b.textContent='Auto-position face';}
  });

  function downsample(c,max=320){
    const s=Math.min(1,max/Math.max(c.width,c.height)),d=document.createElement('canvas');d.width=Math.max(1,Math.round(c.width*s));d.height=Math.max(1,Math.round(c.height*s));d.getContext('2d').drawImage(c,0,0,d.width,d.height);return d;
  }

  function blurScore(c){
    const d=downsample(c),ctx=d.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,d.width,d.height).data,w=d.width,h=d.height,gray=new Float32Array(w*h);
    for(let i=0,p=0;i<im.length;i+=4,p++)gray[p]=.2126*im[i]+.7152*im[i+1]+.0722*im[i+2];
    let n=0,sum=0,sum2=0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,v=gray[i-1]+gray[i+1]+gray[i-w]+gray[i+w]-4*gray[i];sum+=v;sum2+=v*v;n++;}
    const variance=Math.max(0,sum2/n-(sum/n)**2),score=Math.max(0,Math.min(100,(variance-20)*1.15));
    return{variance,score,state:score>=65?'pass':score>=40?'warn':'fail'};
  }

  function exposureScore(c){
    const d=downsample(c),data=d.getContext('2d',{willReadFrequently:true}).getImageData(0,0,d.width,d.height).data;let n=0,sum=0,dark=0,bright=0;
    for(let i=0;i<data.length;i+=16){const l=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];sum+=l;n++;if(l<20)dark++;if(l>245)bright++;}
    const mean=sum/n,clipped=(dark+bright)/n,meanPenalty=Math.abs(mean-145)/1.35,score=Math.max(0,Math.min(100,100-meanPenalty-clipped*160));
    return{mean,clipped,score,state:score>=72?'pass':score>=48?'warn':'fail'};
  }

  function shadowScore(c,m){
    const ctx=c.getContext('2d',{willReadFrequently:true}),data=ctx.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height;
    const x1=Math.max(0,Math.floor(m.minX*w)),x2=Math.min(w-1,Math.ceil(m.maxX*w)),y1=Math.max(0,Math.floor(m.minY*h)),y2=Math.min(h-1,Math.ceil(m.maxY*h)),mid=(x1+x2)/2;
    let ls=0,rs=0,ln=0,rn=0;
    for(let y=y1;y<=y2;y+=3)for(let x=x1;x<=x2;x+=3){const i=(y*w+x)*4,l=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];if(x<mid){ls+=l;ln++;}else{rs+=l;rn++;}}
    const diff=Math.abs(ls/Math.max(1,ln)-rs/Math.max(1,rn)),score=Math.max(0,Math.min(100,100-diff*2.4));
    return{diff,score,state:score>=75?'pass':score>=50?'warn':'fail'};
  }

  function qualityRow(icon,title,detail,cls){return `<div class="quality-row ${cls}"><span>${icon}</span><div><strong>${title}</strong><small>${detail}</small></div></div>`;}

  $('qualityCheck')?.addEventListener('click',async()=>{
    const b=$('qualityCheck'),out=$('qualityResults');b.disabled=true;b.textContent='Scoring…';out.innerHTML='<div class="check-empty">Analyzing sharpness, exposure and shadows…</div>';
    try{
      const m=await detectPreview(),blur=blurScore(preview),exp=exposureScore(preview),shadow=shadowScore(preview,m),overall=Math.round(blur.score*.4+exp.score*.3+shadow.score*.3);
      const cls=overall>=75?'pass':overall>=50?'warn':'fail',label=overall>=75?'Good image quality':overall>=50?'Usable, but review warnings':'Retake recommended';
      out.innerHTML=`<div class="quality-score ${cls}"><b>${overall}/100</b><span>${label}</span></div>`+
        qualityRow(blur.state==='pass'?'✅':blur.state==='warn'?'⚠️':'❌','Sharpness',blur.state==='pass'?'Image appears sharp.':blur.state==='warn'?'Slight softness detected. Hold the camera steadier or use better light.':'Image appears blurry. Retake for safer print quality.',blur.state)+
        qualityRow(exp.state==='pass'?'✅':exp.state==='warn'?'⚠️':'❌','Exposure',`Average brightness ${Math.round(exp.mean)}; clipped pixels ${(exp.clipped*100).toFixed(1)}%.`,exp.state)+
        qualityRow(shadow.state==='pass'?'✅':shadow.state==='warn'?'⚠️':'❌','Face shadows',shadow.state==='pass'?'Left/right face lighting is balanced.':shadow.state==='warn'?'Some side-to-side lighting difference detected.':'Strong uneven lighting/shadow detected across the face.',shadow.state);
    }catch(e){console.error(e);out.innerHTML=`<div class="check-empty">${e.message||'Quality scoring could not run.'}</div>`;}
    finally{b.disabled=false;b.textContent='Score image quality';}
  });

  if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js').catch(e=>console.warn('Service worker registration failed',e)));}
})();
