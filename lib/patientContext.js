export function validatePatientContext(input = {}) {
  const result = {age:null,heightCm:null,weightKg:null,gender:'',allergies:'',mainConcern:'',useHistory:false};
  for (const [key, min, max] of [['age',0,130],['heightCm',40,260],['weightKg',1,500]]) {
    const value = input[key];
    result[key] = value === '' || value == null ? null : Number(value);
    if (result[key] !== null && (!Number.isFinite(result[key]) || result[key] < min || result[key] > max)) throw new Error(`Enter ${key} between ${min} and ${max}, or leave it blank.`);
  }
  result.gender = String(input.gender || '');
  if (!['','female','male','non_binary','prefer_not_to_say'].includes(result.gender)) throw new Error('Choose a supported gender option or leave it blank.');
  result.allergies = String(input.allergies || '').trim().slice(0,2000);
  result.mainConcern = String(input.mainConcern || '').trim().slice(0,2000);
  result.useHistory = input.useHistory === true;
  return result;
}

export function patientContextText(intake) {
  return `Patient-provided details (may be outdated; confirm changes, do not re-ask unchanged details):\nAge: ${intake.age ?? 'Unknown'}; gender: ${intake.gender || 'Unknown'}; height: ${intake.heightCm ?? 'Unknown'} cm; weight: ${intake.weightKg ?? 'Unknown'} kg; allergies: ${intake.allergies || 'Unknown — not confirmed absent'}.`;
}
