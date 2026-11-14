import {after,NextResponse} from 'next/server';
import {accountApi} from '@/lib/accountApi';
import {connectDrive,disconnectDrive,driveStatus,syncDrive} from '@/lib/driveSync';
export const runtime='nodejs';
export const maxDuration=60;
export function GET(request){return accountApi(request,async user=>NextResponse.json({ok:true,...await driveStatus(user.id)},{headers:{'Cache-Control':'private, no-store'}}));}
export function POST(request){return accountApi(request,async user=>{
 if(user.email===(process.env.KAMAL_DEMO_EMAIL||'patient@example.com'))return NextResponse.json({ok:false,message:'Sign in to your own KAMAL account to connect private Google Drive storage.'},{status:403});
 const body=await request.json(),origin=new URL(request.url).origin;
 if(body.action==='connect'){
  if(request.headers.get('x-requested-with')!=='XmlHttpRequest'||body.consent!==true)throw new Error('Approve automatic Drive sync before connecting.');
  await connectDrive(user.id,body.code,origin);
 }else if(body.action==='disconnect'){await disconnectDrive(user.id);return NextResponse.json({ok:true,connected:false});}
 else if(body.action!=='retry')throw new Error('Unknown Drive action.');
 after(async()=>{await syncDrive(user.id,origin);});
 return NextResponse.json({ok:true,...await driveStatus(user.id)});
});}
