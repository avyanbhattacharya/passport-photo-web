(()=>{
  const button=document.getElementById('makeBackgroundWhite');
  const status=document.getElementById('backgroundStatus');
  if(!button||!status)return;

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
      if(!segmenter){
        status.textContent='Loading lightweight background model…';
        const {pipeline}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
        try{
          segmenter=await pipeline('background-removal','Xenova/modnet',{
            dtype:'q8',
            progress_callback:p=>{
              if(typeof p?.progress==='number'){
                const pct=p.progress<=1?Math.round(p.progress*100):Math.round(p.progress);
                status.textContent=`Loading background model… ${Math.max(0,Math.min(100,pct))}%`;
              }
            }
          });
        }catch(q8Error){
          console.warn('q8 MODNet load failed, retrying fp32',q8Error);
          status.textContent='Retrying background model in compatibility mode…';
          segmenter=await pipeline('background-removal','Xenova/modnet',{dtype:'fp32'});
        }
      }

      status.textContent='Separating person from background on this device…';
      const base=makeBaseCanvas();
      if(!base)throw Error('No photo is available.');
      const input=base.toDataURL('image/png');
      const result=await segmenter(input);
      const cutout=Array.isArray(result)?result[0]:result;
      if(!cutout?.toCanvas)throw Error('Background model returned an unsupported result.');

      const cutoutCanvas=await cutout.toCanvas();
      const composite=document.createElement('canvas');
      composite.width=base.width;
      composite.height=base.height;
      const ctx=composite.getContext('2d');
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,composite.width,composite.height);
      ctx.drawImage(cutoutCanvas,0,0,composite.width,composite.height);

      backgroundCutout=composite;
      button.textContent='Restore original background';
      status.textContent='White background applied. Inspect hair, ears and shoulder edges before downloading.';
      clearChecks('Background changed. Run checks again to evaluate the edited photo.');
      render();
    }catch(e){
      console.error('Background removal failed',e);
      segmenter=null;
      backgroundCutout=null;
      button.textContent='Make background white';
      status.textContent=`Background removal failed: ${e?.message||'unknown browser/model error'}. Try again on a strong connection or reload the page.`;
    }finally{
      backgroundBusy=false;
      button.disabled=false;
    }
  };
})();
