import {NextResponse} from 'next/server';
import {accountApi} from '@/lib/accountApi';
import {listVault,startVaultUpload} from '@/lib/vaultStore';
export const runtime='nodejs';
export function GET(request){return accountApi(request,async user=>NextResponse.json({ok:true,documents:await listVault(user.id)},{headers:{'Cache-Control':'private, no-store'}}));}
export function POST(request){return accountApi(request,async user=>NextResponse.json({ok:true,...await startVaultUpload(user.id,await request.json())}));}
