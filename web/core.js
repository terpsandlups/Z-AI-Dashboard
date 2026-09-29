/* Pure metric functions, shared with validation tests. Amounts in BRL, goals in fractions. */
(function(root){
const sum=(a,i)=>a.reduce((s,r)=>s+Number(r[i]),0);
const days=m=>new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate();
const dateList=m=>Array.from({length:days(m)},(_,i)=>m+'-'+String(i+1).padStart(2,'0'));
const monthRange=(a,b)=>{let out=[],d=new Date(a+'-01T12:00:00Z');while(d.toISOString().slice(0,7)<=b&&out.length<120){out.push(d.toISOString().slice(0,7));d.setUTCMonth(d.getUTCMonth()+1)}return out};
const lossTarget=data=>{const v=data?.baseline?.meta_perda;return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1?v:null};
const dailyGoal=(data,dept='')=>{const v=data?.baseline?.meta_diaria,w=dept?(data.metas||[]).find(x=>x.codigo===dept)?.participacao:1;return typeof v==='number'&&Number.isFinite(v)&&v>=0&&typeof w==='number'&&Number.isFinite(w)&&w>=0&&w<=1?Math.round(v*w*100)/100:null};
function select(data,from,to,dept=''){
 const months=monthRange(from,to),covered=new Set(data.dias_vendas_completos||[]),allM=data.vendas_mensais||[],allD=data.vendas_diarias||[],compact=data.vendas_diarias_produto_mes;
 const lastCovered=[...covered].sort().at(-1),cut=lastCovered?.slice(0,7)===to?lastCovered:null;
 const sales=[],salesDays=new Set(),sources=[],missing=[];
 for(const m of months){
  const calendar=dateList(m).filter(d=>!cut||d<=cut),md=allM.filter(r=>r[0]===m),dd=(compact||allD).filter(r=>r[0].slice(0,7)===m);
  if(calendar.every(x=>covered.has(x))){for(const row of dd)sales.push(row);calendar.forEach(d=>salesDays.add(d));sources.push(m+': diária');}
  else if(md.length){for(const row of md)sales.push(row);calendar.forEach(d=>salesDays.add(d));sources.push(m+': mensal');}
  else if(dd.length){for(const row of dd)if(compact||covered.has(row[0]))sales.push(row);calendar.filter(d=>covered.has(d)).forEach(d=>salesDays.add(d));sources.push(m+': diária parcial');if(!calendar.every(d=>covered.has(d)))missing.push(m);}
  else missing.push(m);
 }
 const sl=sales.filter(r=>!dept||r[2]===dept),lossAll=(data.perdas||[]).filter(r=>r[0].slice(0,7)>=from&&r[0].slice(0,7)<=to&&(!dept||r[2]===dept)),loss=lossAll.filter(r=>!cut||r[0]<=cut);
 const first=(data.perdas||[]).reduce((d,r)=>r[0]<d?r[0]:d,'9999'),last=(data.perdas||[]).reduce((d,r)=>r[0]>d?r[0]:d,'0000');
 const calendar=months.flatMap(dateList).filter(d=>!cut||d<=cut),comparable=calendar.length>0&&!missing.length&&calendar.every(d=>salesDays.has(d)&&d>=first&&d<=last);
 const sv=sum(sl,4),lv=sum(loss,5),weight=dept?(data.metas||[]).find(x=>x.codigo===dept)?.participacao:1;
 return {months,sales:sl,loss,lossAll,lossTotalAll:sum(lossAll,5),unmatchedLossCount:lossAll.length-loss.length,salesDays,sources,missing,comparable,salesTotal:sv,lossTotal:lv,ratio:comparable&&sv>0?lv/sv:null,days:calendar.length,goal:dailyGoal(data,dept)==null?null:Math.round(dailyGoal(data,dept)*calendar.length*100)/100,first,last,cut};
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
  return {...r,salesShare,lossShare,storeLossImpact,shareGap};
 });
}
function weekdays(data,c,dept=''){
 const out=Array.from({length:7},()=>({days:0,value:0})),covered=new Set(data.dias_vendas_completos||[]);
 for(const d of covered)if(c.months.includes(d.slice(0,7)))out[new Date(d+'T12:00:00Z').getUTCDay()].days++;
 const compact=data.vendas_diarias_resumo;
 for(const r of compact||data.vendas_diarias||[])if(c.months.includes(r[0].slice(0,7))&&covered.has(r[0])&&(!dept||(compact?r[1]:r[2])===dept))out[new Date(r[0]+'T12:00:00Z').getUTCDay()].value+=Number(compact?r[2]:r[4]);
 return out.map(r=>({...r,mean:r.days?r.value/r.days:null}));
}
function validateLossImport(d,data){
 if(d.schema!=='zai-perdas-import-v1'||d.loja!==data.loja||!Array.isArray(d.rows)||!d.rows.length)throw Error('Arquivo de perdas incompatível com a loja selecionada.');
 for(const [i,r] of d.rows.entries()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.data)||isNaN(Date.parse(r.data))||new Date(r.data).toISOString().slice(0,10)!==r.data||!/^\d+$/.test(r.sku)||!data.departamentos[r.dpto]||!r.produto||!r.motivo||typeof r.qtde!=='number'||typeof r.valor!=='number'||!Number.isFinite(r.valor)||!Number.isFinite(r.qtde))throw Error('Linha '+(i+1)+' inválida. Nada foi importado.');
 }
 return d.rows;
}
const api={dailyGoal,lossTarget,sum,days,dateList,monthRange,select,departmentRows,departmentAnalytics,weekdays,validateLossImport};root.ZAI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
