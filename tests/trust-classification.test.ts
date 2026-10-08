import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZeroHash} from 'ethers';
import {classifyIssuer} from '../lib/trust';
import {TEST_ATTESTER,type Governance} from '../lib/giwa';
const publisher='0x1111111111111111111111111111111111111111';
const governance:Governance={block:100,complete:true,roles:[{contract:'DojangAttesterBook',address:publisher,role:'admin',roleId:ZeroHash,active:true,tx:''}]};
test('administrator and registered publisher are distinct facts',()=>{
 assert.deepEqual(classifyIssuer(publisher,[],governance,true),{issuerClass:'manager',registeredIssuer:false,managementRole:true});
 assert.deepEqual(classifyIssuer(publisher,[{id:ZeroHash,address:publisher,name:'test',tx:''}],governance,true),{issuerClass:'registered',registeredIssuer:true,managementRole:true});
});
test('upgrader and revoked admin are not classified as current registration managers',()=>{
 for(const roles of [[{...governance.roles[0],role:'upgrader' as const}],[{...governance.roles[0],active:false}]])assert.equal(classifyIssuer(publisher,[],{...governance,roles},true).managementRole,false);
});
test('failed or incomplete discovery does not claim publisher is unregistered',()=>{
 assert.equal(classifyIssuer(publisher,[],{...governance,roles:[]},false).issuerClass,'unknown');
 assert.equal(classifyIssuer(publisher,[],{...governance,roles:[]},true).issuerClass,'external');
});
test('known CIP4 mock is always shown as test data',()=>{
 assert.equal(classifyIssuer(TEST_ATTESTER,[{id:ZeroHash,address:TEST_ATTESTER,name:'registered',tx:''}],{...governance,roles:[]},true).issuerClass,'test');
});
