import { NextRequest } from 'next/server';
import * as scan from '@/lib/scan-server';
export async function GET(request: NextRequest) {
 try { const params = request.nextUrl.searchParams; const kind = params.get('kind') ?? 'overview'; let result: unknown;
 switch (kind) {
  case 'overview': result = await scan.cached('overview', 20000, () => scan.recent()); break;
  case 'attestations': { const cursor = params.get('cursor'); if (cursor && cursor.length > 300) throw new Error('페이지 값이 잘못되었습니다.'); result = await scan.recent(cursor ? JSON.parse(cursor) : null, params.get('filter') ?? ''); break; }
  case 'attestation': result = await scan.attestation(params.get('uid') ?? ''); break;
  case 'schema': result = await scan.getSchema(params.get('uid') ?? ''); break;
  case 'schemas': result = await scan.catalog(); break;
  case 'wallet': result = await scan.wallet(params.get('address') ?? ''); break;
  case 'transaction': result = await scan.transaction(params.get('hash') ?? ''); break;
  case 'search': { const value=params.get('value')??''; const schema=await scan.getSchema(value); if(schema) result={type:'schema',record:schema}; else { const record=await scan.attestation(value); if(record) result={type:'attestation',record}; else { const tx=await scan.transaction(value); result=tx?{type:'transaction',record:tx}:null; } } break; }
  case 'contracts': result = await scan.cached('contracts', 60000, scan.contracts); break;
  case 'offchain': result = await scan.offchainStatus(params.get('issuer') ?? '', params.get('uid') ?? ''); break;
  default: return Response.json({ error: '지원하지 않는 조회입니다.' }, { status: 400 });
 } return Response.json(result, { status: result === null ? 404 : 200, headers: { 'Cache-Control': 'no-store' } });
 } catch (error) { return Response.json({ error: error instanceof Error ? error.message : '데이터 조회에 실패했습니다.' }, { status: 502 }); }
}
