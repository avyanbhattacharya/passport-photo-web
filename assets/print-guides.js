(()=>{
  const button=document.getElementById('downloadSheet');
  const preview=document.getElementById('preview');
  const format=document.getElementById('format');
  if(!button||!preview||!format)return;

  function toBlob(canvas,type='image/jpeg',quality=.95){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not create image file.')),type,quality));
  }

  async function downloadCanvas(canvas,name){
    const blob=await toBlob(canvas),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();
    setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1500);
  }

  function lightCutGuide(ctx,x,y,w,h){
    ctx.save();
    ctx.strokeStyle='rgba(70,70,70,.45)';
    ctx.lineWidth=1;
    ctx.setLineDash([8,8]);
    ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    ctx.restore();
  }

  button.onclick=async()=>{
    const old=button.textContent;button.disabled=true;button.textContent='Preparing…';
    try{
      const canvas=document.createElement('canvas');
      canvas.width=1200;canvas.height=1800;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);

      if(format.value==='2x2'){
        // 1200 px = 4 in on a 4x6 print, so 600 px = exactly 2 in.
        const pw=600,ph=600,left=0,top=300;
        const positions=[[left,top],[left+pw,top],[left,top+ph],[left+pw,top+ph]];
        positions.forEach(([x,y])=>ctx.drawImage(preview,x,y,pw,ph));
        positions.forEach(([x,y])=>lightCutGuide(ctx,x,y,pw,ph));
      }else{
        // Use the physical 4-inch sheet width as the conversion basis.
        // This keeps each copy at exactly 35 x 45 mm when the full sheet prints at 4 x 6 inches.
        const pxPerMm=canvas.width/101.6;
        const pw=35*pxPerMm,ph=45*pxPerMm,gap=36;
        const totalW=pw*2+gap,totalH=ph*2+gap;
        const left=(canvas.width-totalW)/2,top=(canvas.height-totalH)/2;
        const positions=[[left,top],[left+pw+gap,top],[left,top+ph+gap],[left+pw+gap,top+ph+gap]];
        positions.forEach(([x,y])=>ctx.drawImage(preview,x,y,pw,ph));
        positions.forEach(([x,y])=>lightCutGuide(ctx,x,y,pw,ph));
      }

      await downloadCanvas(canvas,'passport-photo-4x6-sheet-4-copies.jpg');
    }catch(e){
      console.error(e);alert('Could not prepare the print sheet. Please try again.');
    }finally{
      button.textContent=old;button.disabled=false;
    }
  };
})();
