import {after,NextResponse} from 'next/server';
import {syncDrive} from '@/lib/driveSync';
import {accountApi} from '@/lib/accountApi';
import {getVault,updateVault,saveVaultChunk,finishVaultUpload} from '@/lib/vaultStore';
export const runtime='nodejs';
export const maxDuration=60;
export function GET(request,{params}){return accountApi(request,async user=>{const {id}=await params;const document=await getVault(user.id,id);return NextResponse.json({ok:!!document,document},{status:document?200:404,headers:{'Cache-Control':'private, no-store'}});});}
export function PATCH(request,{params}){return accountApi(request,async user=>{const {id}=await params;const document=await updateVault(user.id,id,await request.json());after(()=>syncDrive(user.id,new URL(request.url).origin));return NextResponse.json({ok:true,document});});}
export function POST(request,{params}){return accountApi(request,async user=>{const {id}=await params,body=await request.json();if(body.action==='finish'){const document=await finishVaultUpload(user.id,id,body);after(()=>syncDrive(user.id,new URL(request.url).origin));return NextResponse.json({ok:true,document});}await saveVaultChunk(user.id,id,body.part,body.data);return NextResponse.json({ok:true});});}
