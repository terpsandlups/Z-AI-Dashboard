/* Pure metric functions, shared with validation tests. Amounts in BRL, goals in fractions. */
(function(root){
const sum=(a,i)=>a.reduce((s,r)=>s+Number(r[i]),0);
const days=m=>new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate();
const monthEnd=m=>m+'-'+String(days(m)).padStart(2,'0');
const dateList=m=>Array.from({length:days(m)},(_,i)=>m+'-'+String(i+1).padStart(2,'0'));
const monthRange=(a,b)=>{a=a.slice(0,7);b=b.slice(0,7);let out=[],d=new Date(a+'-01T12:00:00Z');while(d.toISOString().slice(0,7)<=b){if(out.length>=120)throw Error('Período muito longo: selecione no máximo 120 meses.');out.push(d.toISOString().slice(0,7));d.setUTCMonth(d.getUTCMonth()+1)}return out};
const asDateStart=v=>String(v||'').length===7?String(v)+'-01':String(v||'');
const asDateEnd=v=>String(v||'').length===7?monthEnd(String(v)):String(v||'');
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const dateSpan=(a,b)=>{if(!validDate(a)||!validDate(b)||a>b)throw Error('Intervalo de datas inválido.');const out=[],d=new Date(a+'T12:00:00Z'),end=new Date(b+'T12:00:00Z');while(d<=end){if(out.length>=3660)throw Error('Período acima do limite de 10 anos.');out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out};
const lossTarget=data=>{const v=data?.baseline?.meta_perda;return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1?v:null};
const dailyGoal=(data,dept='')=>{const v=data?.baseline?.meta_diaria,w=dept?(data.metas||[]).find(x=>x.codigo===dept)?.meta_participacao??(data.metas||[]).find(x=>x.codigo===dept)?.participacao:1;return typeof v==='number'&&Number.isFinite(v)&&v>=0&&typeof w==='number'&&Number.isFinite(w)&&w>=0&&w<=1?Math.round(v*w*100)/100:null};

function select(data,from,to,dept=''){
 const start=asDateStart(from),requestedEnd=asDateEnd(to);
 if(!validDate(start)||!validDate(requestedEnd)||start>requestedEnd)throw Error('Período inválido.');
 const requestedCalendar=dateSpan(start,requestedEnd);
 const months=monthRange(start,requestedEnd),covered=new Set(data.dias_vendas_completos||[]),allM=data.vendas_mensais||[],dailyRows=data.vendas_diarias_resumo||[];
 // Never silently truncate the selected end date to the last sale recorded.
 const end=requestedEnd,cut=null,sales=[],salesDays=new Set(),sources=[],missing=[],comparisonCoverage=new Set();

 for(const m of months){
  const segStart=start>m+'-01'?start:m+'-01',mEnd=monthEnd(m),segEnd=end<mEnd?end:mEnd;
  if(segStart>segEnd)continue;
  const calendar=dateSpan(segStart,segEnd),md=allM.filter(r=>r[0]===m),dr=dailyRows.filter(r=>r[0]>=segStart&&r[0]<=segEnd),fullMonth=segStart===m+'-01'&&segEnd===mEnd,dailyComplete=calendar.every(d=>covered.has(d));
  if(dailyComplete){
   for(const r of dr)sales.push([r[0],'',r[1],0,Number(r[2])]);
   calendar.forEach(d=>{salesDays.add(d);comparisonCoverage.add(d)});
   sources.push(m+': diária');
  }else if(fullMonth&&md.length){
   for(const r of md)sales.push(r);
   calendar.forEach(d=>{salesDays.add(d);comparisonCoverage.add(d)});
   sources.push(m+': mensal');
  }else{
   const partial=calendar.filter(d=>covered.has(d));
   for(const r of dr)if(covered.has(r[0]))sales.push([r[0],'',r[1],0,Number(r[2])]);
   partial.forEach(d=>{salesDays.add(d);comparisonCoverage.add(d)});
   if(partial.length)sources.push(m+': diária parcial');
   const absent=calendar.filter(d=>!covered.has(d));
   if(absent.length)missing.push(absent.length===1?absent[0]:absent[0]+' a '+absent.at(-1)+' ('+absent.length+' dias sem cobertura)');
  }
 }

 const sl=sales.filter(r=>!dept||r[2]===dept),
 lossAll=(data.perdas||[]).filter(r=>r[0]>=start&&r[0]<=requestedEnd&&(!dept||r[2]===dept)),
 loss=lossAll.filter(r=>r[0]<=end),
 first=(data.perdas||[]).reduce((d,r)=>r[0]<d?r[0]:d,'9999-12-31'),
 last=(data.perdas||[]).reduce((d,r)=>r[0]>d?r[0]:d,'0000-01-01'),
 calendar=requestedCalendar,
 salesComplete=calendar.length>0&&calendar.every(d=>comparisonCoverage.has(d)),
 lossSpanComplete=calendar.length>0&&first<=start&&last>=end,
 comparable=salesComplete&&lossSpanComplete,
 sv=sum(sl,4),lv=sum(loss,5),dailyGoalValue=dailyGoal(data,dept);

 return {
  months,start,end,requestedEnd,sales:sl,loss,lossAll,lossTotalAll:sum(lossAll,5),
  unmatchedLossCount:0,salesDays,sources,missing,comparable,salesComplete,lossSpanComplete,
  salesTotal:sv,lossTotal:lv,ratio:comparable&&sv>0?lv/sv:null,days:calendar.length,
  goal:dailyGoalValue==null?null:Math.round(dailyGoalValue*calendar.length*100)/100,first,last,cut
 };
}
function departmentRows(data,c){
 const map=new Map();function get(k){if(!map.has(k))map.set(k,{code:k,name:data.departamentos[k]||k,sales:0,loss:0,goal:(data.metas||[]).find(x=>x.codigo===k)});return map.get(k)}
 c.sales.forEach(r=>get(r[2]).sales+=Number(r[4]));c.loss.forEach(r=>get(r[2]).loss+=Number(r[5]));
 return [...map.values()].map(r=>({...r,ratio:c.comparable&&r.sales>0?r.loss/r.sales:null,target:r.goal?.meta_perda??null})).sort((a,b)=>b.sales-a.sales);
}
function departmentAnalytics(data,c){
 const rows=departmentRows(data,c),storeSales=Number(c.salesTotal||0),storeLoss=Number(c.lossTotal||0);
 return rows.map(r=>{
  const salesShare=storeSales>0?r.sales/storeSales:null;
  const lossShare=storeLoss>0?r.loss/storeLoss:null;
  const storeLossImpact=c.comparable&&storeSales>0?r.loss/storeSales:null;
  const shareGap=salesShare!==null&&lossShare!==null?lossShare-salesShare:null;
  const targetShare=(data.metas||[]).find(x=>x.codigo===r.code)?.meta_participacao??null;
  const shareDeviation=salesShare!==null&&targetShare!==null?salesShare-targetShare:null;
  return {...r,salesShare,lossShare,storeLossImpact,shareGap,targetShare,shareDeviation};
 });
}
function weekdays(data,c,dept=''){
 const out=Array.from({length:7},()=>({days:0,value:0})),covered=new Set(data.dias_vendas_completos||[]),start=c.start,end=c.end;
 for(const d of covered)if(d>=start&&d<=end)out[new Date(d+'T12:00:00Z').getUTCDay()].days++;
 for(const r of data.vendas_diarias_resumo||[])if(r[0]>=start&&r[0]<=end&&covered.has(r[0])&&(!dept||r[1]===dept))out[new Date(r[0]+'T12:00:00Z').getUTCDay()].value+=Number(r[2]);
 return out.map(r=>({...r,mean:r.days?r.value/r.days:null}));
}
function validateLossImport(d,data){
 if(d.schema!=='zai-perdas-import-v1'||d.loja!==data.loja||!Array.isArray(d.rows)||!d.rows.length)throw Error('Arquivo de perdas incompatível com a loja selecionada.');
 for(const [i,r] of d.rows.entries()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.data)||isNaN(Date.parse(r.data))||new Date(r.data).toISOString().slice(0,10)!==r.data||!/^\d+$/.test(r.sku)||!data.departamentos[r.dpto]||!r.produto||!r.motivo||typeof r.qtde!=='number'||typeof r.valor!=='number'||!Number.isFinite(r.valor)||!Number.isFinite(r.qtde))throw Error('Linha '+(i+1)+' inválida. Nada foi importado.');
 }
 return d.rows;
}
const api={dailyGoal,lossTarget,sum,days,monthEnd,dateList,dateSpan,monthRange,validDate,asDateStart,asDateEnd,select,departmentRows,departmentAnalytics,weekdays,validateLossImport};
root.ZAI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
