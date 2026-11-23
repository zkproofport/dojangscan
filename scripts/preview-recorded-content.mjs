// Local-only UI fixture server. No upstream API, wallet or RPC calls.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=JSON.parse(readFileSync(new URL('../tests/fixtures/recorded-content.json',import.meta.url),'utf8'));
const first=fixture.details[0],network=first.meta.network;
const cases=new Map(fixture.details.map(d=>[d.data.uid,d]));
const extra=[['a','unavailable','STORED_PAYLOAD_UNAVAILABLE'],['b','invalid','PAYLOAD_ABI_INVALID'],['c','limited','CONTENT_SIZE_LIMIT'],['d','legacy',''],['e','error','']];
for(const [letter,status,reason] of extra){const d=structuredClone(first);d.data.uid='0x'+letter.repeat(64);if(status==='legacy'||status==='error')delete d.content;else Object.assign(d.content,{status,fields:[],reasons:[reason]});cases.set(d.data.uid,d);}
const link=uid=>`/?view=explore&source=backend&uid=${uid}`;
const server=await createServer({root,configFile:false,envDir:false,plugins:[react(),{
 name:'recorded-content-fixtures',
 transformIndexHtml(){return [{tag:'div',attrs:{style:'position:fixed;bottom:0;left:0;z-index:99999;background:#163d43;color:white;padding:5px 12px;font:12px sans-serif'},children:'LOCAL FIXTURE · 저장 Payload 예시 / 상태는 합성 · 운영 API 연결 없음',injectTo:'body'}];},
 configureServer(s){s.middlewares.use((req,res,next)=>{
  const u=new URL(req.url,'http://127.0.0.1:4317');
  if(u.pathname==='/preview'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<h1>Local content preview · 운영 응답 아님</h1><ul>'+[...cases.keys()].map((uid,i)=>`<li><a href="${link(uid)}">${i<6?'저장 Payload '+(i+1):extra[i-6][1]}</a></li>`).join('')+'</ul>');}
  if(!u.pathname.startsWith('/api/'))return next();
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const uid=u.pathname.split('/').at(-1);
  if(uid==='0x'+'e'.repeat(64)){res.statusCode=503;return res.end(JSON.stringify({error:'UNAVAILABLE',meta:first.meta}));}
  if(cases.has(uid))return res.end(JSON.stringify(cases.get(uid)));
  if(u.pathname.endsWith('/status'))return res.end(JSON.stringify({meta:first.meta}));
  if(u.pathname.endsWith('/attestations'))return res.end(JSON.stringify({meta:first.meta,data:fixture.details.map(d=>d.data),next:null}));
  res.statusCode=404;res.end(JSON.stringify({error:'FIXTURE_ROUTE_UNAVAILABLE'}));
 });}
}],resolve:{alias:{'@':root}},define:{'import.meta.env.VITE_DOJANGSCAN_NETWORK':JSON.stringify(network),'import.meta.env.VITE_DOJANGSCAN_API_BASE':JSON.stringify('/api/dojangscan'),'import.meta.env.VITE_DOJANGSCAN_HISTORY_API_BASE':JSON.stringify('/api/historical')},server:{host:'127.0.0.1',port:4317,strictPort:true,headers:{'Content-Security-Policy':"connect-src 'self' ws://127.0.0.1:4317"}}});
await server.listen();console.log('Local fixture preview: http://127.0.0.1:4317/preview');
