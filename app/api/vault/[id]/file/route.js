import {NextResponse} from 'next/server';
import {accountApi} from '@/lib/accountApi';
import {readVaultChunk} from '@/lib/vaultStore';
export function GET(request,{params}){return accountApi(request,async user=>{const {id}=await params;const part=Number(new URL(request.url).searchParams.get('part'));if(!Number.isSafeInteger(part)||part<0)return new NextResponse(null,{status:400});const data=await readVaultChunk(user.id,id,part);return data?new NextResponse(Buffer.from(data,'base64'),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment'}}):new NextResponse(null,{status:404});});}
