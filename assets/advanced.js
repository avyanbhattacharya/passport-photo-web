(()=>{
  const $=id=>document.getElementById(id);
  const video=$('video'),preview=$('preview');
  if(!video||!preview)return;

  let faceImage=null,faceVideo=null,visionFiles=null,liveTimer=null,liveBusy=false,autoBusy=false;

  async function vision(){
    if(visionFiles)return visionFiles;
    const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm');
    const files=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
    visionFiles={mod,files};
    return visionFiles;
  }

  async function imageLandmarker(){
    if(faceImage)return faceImage;
    const {mod,files}=await vision();
    faceImage=await mod.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},runningMode:'IMAGE',numFaces:1,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5});
    return faceImage;
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
      if(m.faceH<.28)notes.push('move closer'); else if(m.faceH>.58)notes.push('move farther back');
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

  async function detectPreview(){
    const lmkr=await imageLandmarker(),img=await canvasImage(preview),det=lmkr.detect(img),faces=det.faceLandmarks||[];
    if(faces.length!==1)throw Error('Exactly one clear face is required for automatic positioning.');
    return metrics(faces[0],preview.width,preview.height);
  }

  $('autoPosition')?.addEventListener('click',async()=>{
    if(autoBusy)return;autoBusy=true;
    const b=$('autoPosition'),msg=$('autoPositionStatus');b.disabled=true;b.textContent='Positioning…';
    try{
      let m=await detectPreview();
      const zoom=$('zoom'),current=Number(zoom.value),targetFace=.55;
      fireRange('zoom',current*(targetFace/Math.max(.01,m.faceH)));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      m=await detectPreview();
      fireRange('xpos',Number($('xpos').value)+(.5-m.cx)*400);
      fireRange('ypos',Number($('ypos').value)+(.38-m.eyeY)*400);
      msg.textContent='Face positioned automatically. Review the preview and run checks.';
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
