import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePatientContext,patientContextText} from '../../lib/patientContext';
import {normalizeObservation,parseObservationCsv,observationInsights} from '../../lib/observations';
test('optional intake preserves unknown values without invented demographics',()=>{
 const data=validatePatientContext({});assert.equal(data.age,null);assert.equal(data.weightKg,null);assert.equal(data.mainConcern,'');assert.equal(data.useHistory,false);assert.match(patientContextText(data),/not confirmed absent/);
 assert.throws(()=>validatePatientContext({age:'NaN'}));assert.throws(()=>validatePatientContext({heightCm:2}));
 assert.equal(validatePatientContext({age:0,useHistory:true}).age,0);
});
test('measurements normalize compatible units and reject invalid inputs',()=>{
 const row={type:'glucose',value:5,unit:'mmol/L',timestamp:'2026-01-01T10:00:00Z',source:'My meter'};
 assert.equal(normalizeObservation(row).value,90.09);
 assert.throws(()=>normalizeObservation({...row,unit:'kg'}));assert.throws(()=>normalizeObservation({...row,value:''}));assert.throws(()=>normalizeObservation({...row,timestamp:'2999-01-01'}));
});
test('CSV validates all rows before saving and requires explicit timezones',()=>{
 const header='type,value,unit,timestamp,source\n';
 assert.equal(parseObservationCsv(header+'steps,100,steps,2026-01-01T10:00:00Z,Watch').length,1);
 assert.throws(()=>parseObservationCsv(header+'steps,100,steps,2026-01-01T10:00:00,Watch'));
 assert.throws(()=>parseObservationCsv(header+'glucose,5,kg,2026-01-01T10:00:00Z,Meter'));
});
test('insights require a sustained change across days and the same source',()=>{
 const now=Date.parse('2026-02-15T12:00:00Z');
 const readings=Array.from({length:10},(_,i)=>({type:'resting_heart_rate',value:i<7?60:75,unit:'bpm',timestamp:new Date(Date.parse('2026-02-05')+i*86400000).toISOString(),source:'Watch'}));
 assert.equal(observationInsights(readings,now).length,1);
 assert.equal(observationInsights(readings.map((r,i)=>({...r,source:i<7?'Old watch':'New watch'})),now).length,0);
 assert.equal(observationInsights(readings.map((r,i)=>i===9?{...r,value:60}:r),now).length,0);
 assert.equal(observationInsights(readings.map(r=>({...r,timestamp:'2026-02-14T10:00:00Z'})),now).length,0);
 assert.equal(observationInsights(readings,now+86400000*10).length,0);
});
