import {NextResponse} from 'next/server';
import {accountApi} from '@/lib/accountApi';
import {query} from '@/lib/auth/sqliteStore';
export function GET(request){return accountApi(request,async user=>NextResponse.json({ok:true,enabled:user.useSavedContext},{headers:{'Cache-Control':'private, no-store'}}));}
export function PUT(request){return accountApi(request,async user=>{const {enabled}=await request.json();if(typeof enabled!=='boolean')throw new Error('Choose whether to use saved context.');await query('UPDATE users SET use_saved_context=$2 WHERE id=$1',[user.id,enabled]);return NextResponse.json({ok:true,enabled});});}
