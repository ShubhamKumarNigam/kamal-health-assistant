import {copyFileSync,cpSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const assetRoot='public/showcase-assets';mkdirSync(join(assetRoot,'ocr'),{recursive:true});mkdirSync(join(assetRoot,'fonts'),{recursive:true});
copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs',join(assetRoot,'pdf.worker.min.mjs'));
copyFileSync('node_modules/tesseract.js/dist/worker.min.js',join(assetRoot,'ocr/worker.min.js'));
for(const name of readdirSync('node_modules/tesseract.js-core').filter(name=>name.includes('.wasm')))copyFileSync(join('node_modules/tesseract.js-core',name),join(assetRoot,'ocr',name));
const english='node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz';if(!existsSync(english))throw new Error('English OCR language asset missing');copyFileSync(english,join(assetRoot,'ocr/eng.traineddata.gz'));
for(const [name,file] of [['dm-sans','dm-sans-latin-wght-normal.woff2'],['manrope','manrope-latin-wght-normal.woff2']]){copyFileSync(`node_modules/@fontsource-variable/${name}/files/${file}`,join(assetRoot,'fonts',name+'.woff2'));cpSync(`node_modules/@fontsource-variable/${name}/LICENSE`,join(assetRoot,'fonts',name+'-LICENSE.txt'));}
console.log('Prepared local showcase fonts, PDF worker and English OCR assets.');
