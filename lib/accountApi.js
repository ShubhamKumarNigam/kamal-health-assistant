import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {SESSION_COOKIE,getUserBySessionToken} from './auth/sqliteStore';
export async function accountApi(request,action){
 if(request.method!=='GET'&&request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({ok:false,message:'Open KAMAL to make this change.'},{status:403});
 const jar=await cookies();const user=await getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);
 if(!user)return NextResponse.json({ok:false,message:'Please sign in.'},{status:401});
 try{return await action(user);}catch(error){return NextResponse.json({ok:false,message:error?.code?'Storage is unavailable. Please retry.':String(error.message||'Request failed.').slice(0,300)},{status:400});}
}
