import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {SESSION_COOKIE, getUserBySessionToken} from '@/lib/auth/sqliteStore';
import {startPhoneChallenge, finishPhoneChallenge} from '@/lib/auth/phoneAuth';
import {phoneAuthConfigured} from '@/lib/auth/phoneProvider';

export const runtime = 'nodejs';
const FLOW_COOKIE = 'kamal_phone_flow';
export async function POST(request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) return NextResponse.json({ok:false,message:'Please use the KAMAL website.'},{status:403});
  if (!phoneAuthConfigured()) return NextResponse.json({ok:false,message:'Mobile sign-in is not available yet. Use Google or email.'},{status:503});
  const data = await request.json().catch(() => null);
  if (!data || !['start','check'].includes(data.action)) return NextResponse.json({ok:false,message:'Invalid request.'},{status:400});
  const jar = await cookies();
  const user = await getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);
  try {
    // On Vercel this header is set by the edge, not trusted from the request body.
    const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
    const result = data.action === 'start'
      ? await startPhoneChallenge({phone:data.phone,purpose:data.purpose,user,ip})
      : await finishPhoneChallenge({token:jar.get(FLOW_COOKIE)?.value,code:data.code,user});
    const response = NextResponse.json({...result,token:undefined,sessionToken:undefined,authenticated:Boolean(result.sessionToken)}, {status:result.ok?200:result.status,headers:{'Cache-Control':'no-store'}});
    const cookieOptions = {httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',path:'/'};
    if (result.token) response.cookies.set(FLOW_COOKIE,result.token,{...cookieOptions,maxAge:600});
    if (result.ok && data.action==='check') response.cookies.set(FLOW_COOKIE,'',{...cookieOptions,maxAge:0});
    if (result.sessionToken) response.cookies.set(SESSION_COOKIE,result.sessionToken,{...cookieOptions,sameSite:'lax',maxAge:30*24*60*60});
    return response;
  } catch (error) {
    const message = /Too many requests/.test(error.message) ? 'Too many requests. Please wait before trying again.' : 'Mobile verification could not be completed. Use Google or email, or try again later.';
    return NextResponse.json({ok:false,message},{status:message.startsWith('Too many')?429:502});
  }
}
