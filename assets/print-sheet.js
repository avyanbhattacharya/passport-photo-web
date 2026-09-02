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

  function dashedRect(ctx,x,y,w,h){
    ctx.save();
    ctx.strokeStyle='#111';
    ctx.lineWidth=4;
    ctx.setLineDash([18,12]);
    ctx.strokeRect(x+2,y+2,w-4,h-4);
    ctx.restore();
  }

  function cropMarks(ctx,x,y,w,h,pageW,pageH){
    const len=34,gap=8;
    ctx.save();
    ctx.strokeStyle='#111';
    ctx.lineWidth=4;
    ctx.setLineDash([]);
    const corners=[[x,y,-1,-1],[x+w,y,1,-1],[x,y+h,-1,1],[x+w,y+h,1,1]];
    for(const[cx,cy,sx,sy] of corners){
      ctx.beginPath();
      const hx1=Math.max(0,Math.min(pageW,cx+sx*gap));
      const hx2=Math.max(0,Math.min(pageW,cx+sx*(gap+len)));
      ctx.moveTo(hx1,cy);ctx.lineTo(hx2,cy);
      const vy1=Math.max(0,Math.min(pageH,cy+sy*gap));
      const vy2=Math.max(0,Math.min(pageH,cy+sy*(gap+len)));
      ctx.moveTo(cx,vy1);ctx.lineTo(cx,vy2);
      ctx.stroke();
    }
    ctx.restore();
  }

  button.onclick=async()=>{
    const old=button.textContent;button.disabled=true;button.textContent='Preparing…';
    try{
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d');
      canvas.width=1800;canvas.height=1200;
      ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);

      if(format.value==='2x2'){
        const pw=600,ph=600,left=300,top=0;
        const positions=[[left,top],[left+pw,top],[left,top+ph],[left+pw,top+ph]];
        for(const[px,py] of positions)ctx.drawImage(preview,px,py,pw,ph);
        for(const[px,py] of positions){dashedRect(ctx,px,py,pw,ph);cropMarks(ctx,px,py,pw,ph,canvas.width,canvas.height)}
        // Extend the middle horizontal cut line into the generous side margins.
        ctx.save();ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.setLineDash([18,12]);
        ctx.beginPath();ctx.moveTo(80,600);ctx.lineTo(1720,600);ctx.stroke();ctx.restore();
      }else{
        const pw=413,ph=531,gap=70,totalW=pw*2+gap,totalH=ph*2+gap;
        const left=(canvas.width-totalW)/2,top=(canvas.height-totalH)/2;
        const positions=[[left,top],[left+pw+gap,top],[left,top+ph+gap],[left+pw+gap,top+ph+gap]];
        for(const[px,py] of positions)ctx.drawImage(preview,px,py,pw,ph);
        for(const[px,py] of positions){dashedRect(ctx,px,py,pw,ph);cropMarks(ctx,px,py,pw,ph,canvas.width,canvas.height)}
      }

      await downloadCanvas(canvas,'passport-photo-4x6-landscape-4-copies.jpg');
    }catch(e){console.error(e);alert('Could not prepare the print sheet. Please try again.');}
    finally{button.textContent=old;button.disabled=false;}
  };
})();
