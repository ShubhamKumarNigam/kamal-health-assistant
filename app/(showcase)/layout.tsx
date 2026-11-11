import type { Metadata } from 'next';
import './showcase.css';
export const metadata:Metadata={title:'KAMAL Health — Your health story, together',description:'Your health story should travel with you. Organise, understand and share your health information.'};
export default function ShowcaseLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
