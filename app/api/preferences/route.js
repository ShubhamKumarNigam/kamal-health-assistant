import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {SESSION_COOKIE,getUserBySessionToken,savePreferredLanguage} from '@/lib/auth/sqliteStore';
async function account(){const jar=await cookies();return getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);}
export async function GET(){const user=await account();return NextResponse.json(user?{ok:true,languageCode:user.preferredLanguage}:{ok:false},{status:user?200:401,headers:{'Cache-Control':'private, no-store'}});}
export async function PUT(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({ok:false,message:'Open KAMAL to update your preferences.'},{status:403});
 const user=await account();if(!user)return NextResponse.json({ok:false,message:'Please sign in.'},{status:401});
 const body=await request.json().catch(()=>({}));
 try{return NextResponse.json({ok:true,languageCode:await savePreferredLanguage(user.id,body.languageCode)});}catch{return NextResponse.json({ok:false,message:'Could not save language. Please try again.'},{status:400});}
}
