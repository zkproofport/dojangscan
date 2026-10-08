import catalog from './translations.json';
import { getLanguage } from './preferences';
const en:Record<string,string>=catalog;
const ko:Record<string,string>=Object.entries(en).reduce<Record<string,string>>((map,[key,value])=>{map[value]??=key;return map;},{});
Object.assign(ko,{
 'Choose a registered Dojang schema.':'등록된 Dojang 스키마를 선택하세요.',
 'This schema is no longer registered in Dojang.':'현재 Dojang에 등록된 스키마가 아닙니다.',
 'Enter a nonzero bytes32 ID.':'0이 아닌 bytes32 ID를 입력하세요.',
 'Enter a nonzero address.':'0이 아닌 주소를 입력하세요.',
 'Enter a uint64 timestamp.':'uint64 범위의 Unix 시각을 입력하세요.',
 'Use named ABI fields.':'이름이 있는 ABI 필드를 사용하세요.',
 'Provide one JSON array value per schema field.':'스키마 필드마다 값 하나를 JSON 배열에 넣으세요.',
 'Unsupported operation.':'지원하지 않는 작업입니다.',
 'Enter a bytes32 role.':'bytes32 Role ID를 입력하세요.',
 'This address is a contract. Prepare calldata for its own execution flow; a wallet cannot send from this address.':'계약 주소입니다. 계약의 실행 경로에서 사용할 호출을 준비하세요. 지갑이 이 주소로 직접 전송할 수는 없습니다.',
});
const escape=(v:string)=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.entries(en).filter(([key])=>/\{\d+\}/.test(key)).map(([key,value])=>({key,value,regex:new RegExp('^'+key.split(/(\{\d+\})/).map(part=>/^\{\d+\}$/.test(part)?'(.*?)':escape(part)).join('')+'$')}));
export function tr<T>(input:T,args?:unknown[]):T {
 if(typeof input!=='string')return input;
 let output:string=input;
 if(getLanguage()==='en'){
  output=en[input]??input;
  if(output===input&&!args){for(const p of patterns){const match=p.regex.exec(input);if(match){output=p.value.replace(/\{(\d+)\}/g,(_,i)=>match[Number(i)+1]);break;}}}
 }else output=ko[input]??input;
 if(args)output=output.replace(/\{(\d+)\}/g,(_,i)=>String(args[Number(i)]??''));
 return output as T;
}
