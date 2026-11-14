export const observationTypes = {
  resting_heart_rate:{label:'Resting heart rate',unit:'bpm',min:20,max:250},
  heart_rate:{label:'Heart rate',unit:'bpm',min:20,max:250},
  steps:{label:'Daily steps',unit:'steps',min:0,max:150000},
  sleep:{label:'Sleep duration',unit:'hours',min:0,max:24},
  glucose:{label:'Glucose',unit:'mg/dL',min:10,max:1000},
  weight:{label:'Weight',unit:'kg',min:1,max:500},
  systolic:{label:'Systolic blood pressure',unit:'mmHg',min:40,max:300},
  diastolic:{label:'Diastolic blood pressure',unit:'mmHg',min:20,max:200},
  spo2:{label:'Oxygen saturation',unit:'%',min:30,max:100}
};
export function normalizeObservation(row, now=Date.now()) {
  const spec = observationTypes[row?.type];
  if (!spec) throw new Error('Unsupported measurement type.');
  if (row.value==='' || row.value==null || !Number.isFinite(Number(row.value))) throw new Error('Enter a numeric measurement.');
  let value=Number(row.value),unit=String(row.unit||spec.unit);
  if(row.type==='glucose' && unit==='mmol/L'){value*=18.0182;unit='mg/dL';}
  if(row.type==='weight' && unit==='lb'){value*=0.45359237;unit='kg';}
  if(row.type==='sleep' && unit==='minutes'){value/=60;unit='hours';}
  if(unit!==spec.unit || value<spec.min || value>spec.max) throw new Error(`Check ${spec.label} and its unit. These are input checks, not clinical reference ranges.`);
  const date=new Date(row.timestamp);
  if(!Number.isFinite(date.getTime())||date.getTime()>now+300000) throw new Error('Use a valid measurement date, not a future date.');
  const source=String(row.source||'Manual entry').trim().slice(0,80);
  return {type:row.type,value:Math.round(value*100)/100,unit,timestamp:date.toISOString(),source:source||'Manual entry'};
}
export function parseObservationCsv(text) {
  const lines=text.trim().split(/\r?\n/).filter(x=>x.trim());
  if(lines.length<2||lines.length>501) throw new Error('Import between 1 and 500 rows.');
  if(lines[0].trim()!=='type,value,unit,timestamp,source') throw new Error('Use the KAMAL CSV header: type,value,unit,timestamp,source');
  return lines.slice(1).map((line,index)=>{
    const parts=line.split(',');
    if(parts.length!==5||line.includes('"')) throw new Error(`Row ${index+2}: use five comma-separated fields without embedded commas or quotes.`);
    const [type,value,unit,timestamp,source]=parts.map(x=>x.trim());
    if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) throw new Error(`Row ${index+2}: include the timezone in the timestamp.`);
    try{return normalizeObservation({type,value,unit,timestamp,source});}catch(error){throw new Error(`Row ${index+2}: ${error.message}`);}
  });
}
export function observationInsights(rows, now=Date.now()) {
  const output=[];
  const today=new Date(now).toISOString().slice(0,10);
  // Compare complete UTC days, separately for each source. Multiple readings
  // on one day must not masquerade as several days of sustained change.
  for (const type of ['resting_heart_rate','sleep','systolic']) {
    for(const source of new Set(rows.filter(r=>r.type===type).map(r=>r.source))) {
      const daily=new Map();
      for(const r of rows.filter(r=>r.type===type&&r.source===source)) {
        const date=r.timestamp.slice(0,10);
        if(date>=today||now-Date.parse(date)>34*86400000)continue;
        const values=daily.get(date)||[];values.push(r.value);daily.set(date,values);
      }
      const days=[...daily].map(([date,values])=>({date,value:values.reduce((a,b)=>a+b,0)/values.length})).sort((a,b)=>a.date.localeCompare(b.date));
      const recentDates=[3,2,1].map(n=>new Date(Date.parse(today)-n*86400000).toISOString().slice(0,10));
      const recent=recentDates.map(date=>days.find(d=>d.date===date));
      const baselineDays=days.filter(d=>d.date<recentDates[0]);
      if(recent.some(x=>!x)||baselineDays.length<7) continue;
      const baseline=baselineDays.reduce((s,d)=>s+d.value,0)/baselineDays.length;
      const direction=type==='sleep'?-1:1;
      const threshold=type==='sleep'?0.15:0.1;
      if(!baseline||!recent.every(d=>direction*(d.value-baseline)/baseline>=threshold))continue;
      const average=recent.reduce((s,d)=>s+d.value,0)/3;
      output.push({type,source,title:`${observationTypes[type].label} has shifted from your recent baseline`,detail:`Three complete days averaged ${average.toFixed(1)} ${observationTypes[type].unit}, compared with ${baseline.toFixed(1)} across ${baselineDays.length} earlier recorded days.`,period:`${recentDates[0]} – ${recentDates[2]} (UTC)`,action:'Check the source readings and discuss a persistent change with your clinician. This comparison is not a diagnosis or emergency alert.'});
    }
  }
  return output;
}
