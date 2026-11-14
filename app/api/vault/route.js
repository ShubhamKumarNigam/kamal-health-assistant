import {NextResponse} from 'next/server';
import {accountApi} from '@/lib/accountApi';
import {listVault,startVaultUpload,checkVaultUpload} from '@/lib/vaultStore';
export const runtime='nodejs';
export function GET(request){return accountApi(request,async user=>NextResponse.json({ok:true,documents:await listVault(user.id)},{headers:{'Cache-Control':'private, no-store'}}));}
export function POST(request){return accountApi(request,async user=>{const body=await request.json();return NextResponse.json({ok:true,...await (body.action==='check'?checkVaultUpload(user.id,body):startVaultUpload(user.id,body))});});}
