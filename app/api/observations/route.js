import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {SESSION_COOKIE,getUserBySessionToken,listHealthObservations,addHealthObservations} from '@/lib/auth/sqliteStore';
async function user(){const jar=await cookies();return getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);}
export async function GET(){const account=await user();if(!account)return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true,observations:await listHealthObservations(account.id)});}
export async function POST(request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({ok:false,message:'Open KAMAL to save measurements.'},{status:403});
  const account=await user();if(!account)return NextResponse.json({ok:false,message:'Please sign in.'},{status:401});
  let body;try{body=await request.json();}catch{return NextResponse.json({ok:false,message:'Invalid upload.'},{status:400});}
  try {const count=await addHealthObservations(account.id,body.observations);return NextResponse.json({ok:true,message:`Saved ${count} new measurements. Existing duplicates were skipped.`,observations:await listHealthObservations(account.id)});}
  catch(error){if(error?.code){console.error('Observation save failed',{code:error.code});return NextResponse.json({ok:false,message:'Could not save measurements.'},{status:500});}return NextResponse.json({ok:false,message:error.message},{status:400});}
}
