(()=>{
  const $=id=>document.getElementById(id);
  const button=$('makeBackgroundWhite'),status=$('backgroundStatus');
  if(!button||!status)return;

  let imageSegmenter=null,busy=false;

  async function getSegmenter(){
    if(imageSegmenter)return imageSegmenter;
    status.textContent='Loading lightweight MediaPipe background model…';
    const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm');
    const vision=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
    imageSegmenter=await mod.ImageSegmenter.createFromOptions(vision,{
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
        delegate:'CPU'
      },
      runningMode:'IMAGE',
      outputCategoryMask:false,
      outputConfidenceMasks:true
    });
    return imageSegmenter;
  }

  function applyMask(base,mask){
    const w=base.width,h=base.height;
    const src=base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h);
    const out=document.createElement('canvas');out.width=w;out.height=h;
    const ctx=out.getContext('2d',{willReadFrequently:true});
    const img=ctx.createImageData(w,h),d=img.data,s=src.data;
    const mw=mask.width||w,mh=mask.height||h,vals=mask.getAsFloat32Array();
    for(let y=0;y<h;y++){
      const my=Math.min(mh-1,Math.floor(y*mh/h));
      for(let x=0;x<w;x++){
        const mx=Math.min(mw-1,Math.floor(x*mw/w)),mi=my*mw+mx,i=(y*w+x)*4;
        let a=Math.max(0,Math.min(1,vals[mi]||0));
        a=a*a*(3-2*a);
        d[i]=Math.round(s[i]*a+255*(1-a));
        d[i+1]=Math.round(s[i+1]*a+255*(1-a));
        d[i+2]=Math.round(s[i+2]*a+255*(1-a));
        d[i+3]=255;
      }
    }
    ctx.putImageData(img,0,0);return out;
  }

  async function segment(base){
    const seg=await getSegmenter();
    return new Promise((resolve,reject)=>{
      try{
        seg.segment(base,result=>{
          try{
            const masks=result?.confidenceMasks||[];
            if(masks.length<2)throw Error('Person mask was not returned.');
            const composite=applyMask(base,masks[1]);
            masks.forEach(m=>m.close?.());
            result?.categoryMask?.close?.();
            resolve(composite);
          }catch(e){reject(e)}
        });
      }catch(e){reject(e)}
    });
  }

  button.onclick=async()=>{
    if(busy||typeof source==='undefined'||!source)return;
    if(typeof backgroundCutout!=='undefined'&&backgroundCutout){
      clearBackgroundResult();
      clearChecks('Background restored. Run checks again to evaluate the original background.');
      render();return;
    }
    busy=true;button.disabled=true;button.textContent='Working…';
    try{
      const base=makeBaseCanvas();
      status.textContent='Separating person from background on this device…';
      const composite=await segment(base);
      backgroundCutout=composite;
      button.textContent='Restore original background';
      status.textContent='White background applied with lightweight MediaPipe selfie segmentation. Inspect hair, ears and shoulder edges before downloading.';
      clearChecks('Background changed. Run checks again to evaluate the edited photo.');
      render();
    }catch(e){
      console.error('MediaPipe background removal failed',e);
      try{imageSegmenter?.close?.()}catch(_){ }
      imageSegmenter=null;
      backgroundCutout=null;
      button.textContent='Make background white';
      status.textContent=`MediaPipe background removal failed: ${e?.message||e}`;
    }finally{
      busy=false;button.disabled=false;
      if(typeof backgroundCutout!=='undefined'&&backgroundCutout)button.textContent='Restore original background';
    }
  };
})();
