// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {PrivateAttestationRegistry, IPrivateAttestationVerifier, IDerivedEAS} from "../src/PrivateAttestationRegistry.sol";
contract TestEAS is IDerivedEAS { uint256 private next; bool public fail; function setFail(bool value) external { fail=value; } function attest(Request calldata) external payable returns (bytes32) { require(!fail); return bytes32(++next); } }
contract TestVerifier is IPrivateAttestationVerifier { bytes32 public expected; function setExpected(bytes32 value) external {expected=value;} function verify(bytes calldata proof,bytes32 digest) external view returns(bool){return proof.length==1&&expected==digest;} }
interface Vm { function warp(uint256) external; function prank(address) external; function expectRevert(bytes4) external; }
contract PrivateAttestationRegistryTest {
 Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
 PrivateAttestationRegistry registry; TestVerifier verifier; TestEAS eas;
 bytes32 constant PROFILE=keccak256("balance-threshold:v1"); bytes32 constant ROOT=keccak256("issuer"); bytes32 constant REV=keccak256("revocation");
 function setUp() public {vm.warp(100000);eas=new TestEAS();verifier=new TestVerifier();registry=new PrivateAttestationRegistry(address(eas));registry.setProfile(PROFILE,PrivateAttestationRegistry.Profile(address(verifier),keccak256("derived-schema"),ROOT,3600,600,true));registry.setRevocationRoot(PROFILE,REV,1);}
 function statement() internal view returns(PrivateAttestationRegistry.Statement memory s){s=PrivateAttestationRegistry.Statement(PROFILE,address(this),keccak256("scope"),keccak256("nullifier"),keccak256("balance >= threshold"),uint64(block.timestamp+300),ROOT,REV,1);}
 function testRegisterAndReplay() public {PrivateAttestationRegistry.Statement memory s=statement();verifier.setExpected(registry.statementDigest(s));bytes32 uid=registry.register(s,hex"01");assert(registry.isReceiptCurrent(uid));vm.expectRevert(PrivateAttestationRegistry.AlreadyUsed.selector);registry.register(s,hex"01");}
 function testRootRotationInvalidatesReceipts() public {PrivateAttestationRegistry.Statement memory s=statement();verifier.setExpected(registry.statementDigest(s));bytes32 uid=registry.register(s,hex"01");registry.setRevocationRoot(PROFILE,keccak256("next"),2);assert(!registry.isReceiptCurrent(uid));}
 function testRejectsStaleRoot() public {vm.warp(block.timestamp+601);PrivateAttestationRegistry.Statement memory s=statement();vm.expectRevert(PrivateAttestationRegistry.StaleRoot.selector);registry.register(s,hex"01");}
 function testRejectsChangedPredicate() public {PrivateAttestationRegistry.Statement memory s=statement();verifier.setExpected(registry.statementDigest(s));s.predicateHash=keccak256("tampered");vm.expectRevert(PrivateAttestationRegistry.InvalidProof.selector);registry.register(s,hex"01");}
 function testRejectsWrongRecipient() public {PrivateAttestationRegistry.Statement memory s=statement();vm.prank(address(123));vm.expectRevert(PrivateAttestationRegistry.InvalidStatement.selector);registry.register(s,hex"01");}
 function testRejectsChangedIssuerAndExcessiveLifetime() public {PrivateAttestationRegistry.Statement memory s=statement();s.issuerRoot=keccak256("other");vm.expectRevert(PrivateAttestationRegistry.InvalidStatement.selector);registry.register(s,hex"01");s=statement();s.validUntil=uint64(block.timestamp+3601);vm.expectRevert(PrivateAttestationRegistry.InvalidStatement.selector);registry.register(s,hex"01");}
 function testProfilesCannotChangeMeaning() public {vm.expectRevert(PrivateAttestationRegistry.InvalidProfile.selector);registry.setProfile(PROFILE,PrivateAttestationRegistry.Profile(address(verifier),keccak256("different-schema"),ROOT,3600,600,true));}
 function testDigestBindsRegistryAddress() public {PrivateAttestationRegistry other=new PrivateAttestationRegistry(address(eas));PrivateAttestationRegistry.Statement memory s=statement();assert(registry.statementDigest(s)!=other.statementDigest(s));}
 function testUnknownProfileIsDisabled() public {PrivateAttestationRegistry.Statement memory s=statement();s.profileId=keccak256("unknown");vm.expectRevert(PrivateAttestationRegistry.InvalidProfile.selector);registry.register(s,hex"01");}
}
