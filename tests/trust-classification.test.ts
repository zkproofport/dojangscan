import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Interface,ZeroAddress,ZeroHash} from 'ethers';
import {classifyIssuer} from '../lib/trust';
import {GIWA_PROOF,type Governance} from '../lib/giwa';
import {testRecipe} from '../lib/examples';
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
 assert.equal(classifyIssuer(GIWA_PROOF.mock,[{id:ZeroHash,address:GIWA_PROOF.mock,name:'registered',tx:''}],{...governance,roles:[]},true).issuerClass,'test');
});
test('test recipe uses a new permissionless schema and existing EAS instead of a Dojang resolver',()=>{
 const recipe=testRecipe(publisher);const registry=new Interface(['function register(string schema,address resolver,bool revocable) returns (bytes32)']);
 const args=registry.decodeFunctionData('register',recipe.register.data);assert.equal(args[0],'bool completedCourse');assert.equal(args[1],ZeroAddress);assert.equal(args[2],true);assert.notEqual(recipe.register.to,recipe.attest.to);
});
