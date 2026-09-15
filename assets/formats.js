(()=> {
  const PRESETS={
    '2x2':{label:'United States — 2 × 2 inch',outputW:600,outputH:600,printW:600,printH:600,widthLabel:'2 in',heightLabel:'2 in',framing:'us',note:'U.S.-style 2 × 2 inch photo. The whole head has a smaller official range than 35 × 45 mm formats.'},
    '35x45':{label:'India Passport Seva — 630 × 810 px',outputW:630,outputH:810,printW:413,printH:531,widthLabel:'35 mm',heightLabel:'45 mm',framing:'biometric',limitBytes:250*1024,note:'Digital upload is 630 × 810 px; the print sheet keeps each physical copy at 35 × 45 mm.'},
    '35x45-standard':{label:'35 × 45 mm — UK, Schengen, Japan, Australia and many visas',outputW:413,outputH:531,printW:413,printH:531,widthLabel:'35 mm',heightLabel:'45 mm',framing:'biometric',note:'Common biometric print size. Check the country and document-specific background and head-size rules.'},
    'canada-50x70':{label:'Canada — 50 × 70 mm',outputW:591,outputH:827,printW:591,printH:827,widthLabel:'50 mm',heightLabel:'70 mm',framing:'canada',note:'Canada requires a larger 50 × 70 mm physical photo. Verify the photographer/studio information on the back requirement when applicable.'},
    'china-33x48':{label:'China visa — 33 × 48 mm',outputW:390,outputH:567,printW:390,printH:567,widthLabel:'33 mm',heightLabel:'48 mm',framing:'biometric',note:'Common China visa photo size. Confirm the current application centre instructions.'},
    'malaysia-35x50':{label:'Malaysia — 35 × 50 mm',outputW:413,outputH:591,printW:413,printH:591,widthLabel:'35 mm',heightLabel:'50 mm',framing:'biometric',note:'Verify the current passport or visa requirement before submitting.'},
    'vietnam-40x60':{label:'Vietnam visa — 40 × 60 mm',outputW:472,outputH:709,printW:472,printH:709,widthLabel:'40 mm',heightLabel:'60 mm',framing:'biometric',note:'Verify the current visa application requirement before submitting.'}
  };
  const pxPerInch=300;
  function customFormat(){
    const width=Math.max(.1,Number(document.getElementById('customWidth')?.value)||35);
    const height=Math.max(.1,Number(document.getElementById('customHeight')?.value)||45);
    const unit=document.getElementById('customUnit')?.value||'mm';
    const factor=unit==='in'?pxPerInch:unit==='mm'?pxPerInch/25.4:1;
    const outputW=Math.max(1,Math.round(width*factor)),outputH=Math.max(1,Math.round(height*factor));
    return {label:'Custom size',outputW,outputH,printW:outputW,printH:outputH,widthLabel:unit==='px'?width+' px':width+' '+unit,heightLabel:unit==='px'?height+' px':height+' '+unit,framing:'custom',note:'Custom dimensions are not a compliance guarantee. Verify all requirements with the issuing authority.'};
  }
  window.getPassportFormat=()=>document.getElementById('format')?.value==='custom'?customFormat():(PRESETS[document.getElementById('format')?.value]||PRESETS['2x2']);
  window.updatePassportCustomControls=()=>document.getElementById('customFormatControls')?.classList.toggle('hidden',document.getElementById('format')?.value!=='custom');
})();
