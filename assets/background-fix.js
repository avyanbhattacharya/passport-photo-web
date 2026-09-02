(()=>{
  const button=document.getElementById('makeBackgroundWhite');
  const status=document.getElementById('backgroundStatus');
  if(!button||!status)return;

  let imageSegmenter=null;

  async function getSegmenter(){
    if(imageSegmenter)return imageSegmenter;
    status.textContent='Loading lightweight MediaPipe background model…';
    const {ImageSegmenter,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm');
    const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
    imageSegmenter=await ImageSegmenter.createFromOptions(vision,{
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

  function runSegmenter(seg,img){
    return new Promise((resolve,reject)=>{
      try{
        seg.segment(img,result=>resolve(result));
      }catch(e){reject(e);}
    });
  }

  function imageFromCanvas(c){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error('Could not prepare photo for background processing.'));
      img.src=c.toDataURL('image/jpeg',.95);
    });
  }

  function compositeWithPersonMask(base,result){
    const masks=result?.confidenceMasks;
    if(!masks||masks.length<2)throw new Error('MediaPipe did not return a person mask.');
    const mask=masks[1];
    const values=mask.getAsFloat32Array();
    const mw=mask.width||256,mh=mask.height||256;

    const maskCanvas=document.createElement('canvas');
    maskCanvas.width=mw;maskCanvas.height=mh;
    const mctx=maskCanvas.getContext('2d');
    const imageData=mctx.createImageData(mw,mh);
    for(let i=0,j=0;i<values.length;i++,j+=4){
      const a=Math.max(0,Math.min(255,Math.round(values[i]*255)));
      imageData.data[j]=255;
      imageData.data[j+1]=255;
      imageData.data[j+2]=255;
      imageData.data[j+3]=a;
    }
    mctx.putImageData(imageData,0,0);

    const person=document.createElement('canvas');
    person.width=base.width;person.height=base.height;
    const pctx=person.getContext('2d');
    pctx.drawImage(base,0,0);
    pctx.globalCompositeOperation='destination-in';
    pctx.imageSmoothingEnabled=true;
    pctx.drawImage(maskCanvas,0,0,base.width,base.height);
    pctx.globalCompositeOperation='source-over';

    const composite=document.createElement('canvas');
    composite.width=base.width;composite.height=base.height;
    const ctx=composite.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,composite.width,composite.height);
    ctx.drawImage(person,0,0);
    return composite;
  }

  button.onclick=async()=>{
    if(backgroundBusy||!source)return;
    if(backgroundCutout){
      clearBackgroundResult();
      clearChecks('Background restored. Run checks again to evaluate the original background.');
      render();
      return;
    }

    backgroundBusy=true;
    button.disabled=true;
    button.textContent='Working…';
    try{
      const seg=await getSegmenter();
      status.textContent='Separating person from background on this device…';
      const base=makeBaseCanvas();
      if(!base)throw new Error('No photo is available.');
      const img=await imageFromCanvas(base);
      const result=await runSegmenter(seg,img);
      backgroundCutout=compositeWithPersonMask(base,result);
      result?.confidenceMasks?.forEach(m=>m.close?.());
      result?.categoryMask?.close?.();
      button.textContent='Restore original background';
      status.textContent='White background applied with lightweight MediaPipe selfie segmentation. Inspect hair, ears and shoulders before downloading.';
      clearChecks('Background changed. Run checks again to evaluate the edited photo.');
      render();
    }catch(e){
      console.error('MediaPipe background removal failed',e);
      imageSegmenter?.close?.();
      imageSegmenter=null;
      backgroundCutout=null;
      button.textContent='Make background white';
      status.textContent=`Background removal failed: ${e?.message||'unknown MediaPipe error'}`;
    }finally{
      backgroundBusy=false;
      button.disabled=false;
    }
  };
})();
