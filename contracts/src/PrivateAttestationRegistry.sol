// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Draft bridge for dedicated offchain-attestation ZK profiles.
/// No profile is enabled at deployment. CIP-4 is NOT a compatible adapter.
interface IPrivateAttestationVerifier {
    /// The circuit must prove the entire canonical statement digest, including
    /// registry address and chain, issuer authorization/signature, predicate,
    /// holder authorization, and non-revocation at the root's epoch.
    function verify(bytes calldata proof, bytes32 statementDigest) external view returns (bool);
}
interface IDerivedEAS {
    struct Data { address recipient; uint64 expirationTime; bool revocable; bytes32 refUID; bytes data; uint256 value; }
    struct Request { bytes32 schema; Data data; }
    function attest(Request calldata request) external payable returns (bytes32);
}

contract PrivateAttestationRegistry {
    struct Profile { address adapter; bytes32 derivedSchema; bytes32 issuerRoot; uint64 maxLifetime; uint64 maxRootAge; bool enabled; }
    struct Revocations { bytes32 root; uint64 epoch; uint64 updatedAt; }
    struct Statement { bytes32 profileId; address recipient; bytes32 scope; bytes32 nullifier; bytes32 predicateHash; uint64 validUntil; bytes32 issuerRoot; bytes32 revocationRoot; uint64 revocationEpoch; }
    struct Receipt { bytes32 profileId; uint64 epoch; uint64 validUntil; bytes32 issuerRoot; }
    address public immutable owner;
    IDerivedEAS public immutable eas;
    mapping(bytes32 => Profile) public profiles;
    mapping(bytes32 => Revocations) public revocations;
    mapping(bytes32 => bool) public usedNullifiers;
    mapping(bytes32 => Receipt) public receipts;
    bool private entered;
    event ProfileSet(bytes32 indexed profileId, address adapter, bytes32 derivedSchema, bytes32 issuerRoot, bool enabled);
    event RevocationRootSet(bytes32 indexed profileId, bytes32 root, uint64 epoch);
    event DerivedAttestation(bytes32 indexed uid, bytes32 indexed profileId, bytes32 scope, bytes32 nullifier, uint64 validUntil);
    error Unauthorized(); error InvalidProfile(); error InvalidStatement(); error StaleRoot(); error AlreadyUsed(); error InvalidProof(); error Reentrant();

    constructor(address easAddress) { require(easAddress.code.length != 0, "EAS has no code"); owner = msg.sender; eas = IDerivedEAS(easAddress); }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    function setProfile(bytes32 profileId, Profile calldata profile) external onlyOwner {
        if (profileId == bytes32(0) || profile.adapter.code.length == 0 || profile.derivedSchema == bytes32(0) || profile.issuerRoot == bytes32(0) || profile.maxLifetime == 0 || profile.maxRootAge == 0) revert InvalidProfile();
        // Existing proof semantics are immutable. New circuits/issuers require
        // a new profile ID; governance may only disable/re-enable an old one.
        Profile memory old = profiles[profileId];
        if (old.adapter != address(0) && (old.adapter != profile.adapter || old.derivedSchema != profile.derivedSchema || old.issuerRoot != profile.issuerRoot || old.maxLifetime != profile.maxLifetime || old.maxRootAge != profile.maxRootAge)) revert InvalidProfile();
        profiles[profileId] = profile;
        emit ProfileSet(profileId, profile.adapter, profile.derivedSchema, profile.issuerRoot, profile.enabled);
    }
    function setRevocationRoot(bytes32 profileId, bytes32 root, uint64 epoch) external onlyOwner {
        if (profiles[profileId].adapter == address(0) || root == bytes32(0) || epoch <= revocations[profileId].epoch) revert InvalidProfile();
        revocations[profileId] = Revocations(root, epoch, uint64(block.timestamp));
        emit RevocationRootSet(profileId, root, epoch);
    }
    function statementDigest(Statement calldata s) public view returns (bytes32) {
        return keccak256(abi.encode("DojangScan.PrivateAttestation.v1", block.chainid, address(this), s));
    }
    function register(Statement calldata s, bytes calldata proof) external returns (bytes32 uid) {
        if (entered) revert Reentrant();
        Profile memory p = profiles[s.profileId]; Revocations memory r = revocations[s.profileId];
        if (!p.enabled || p.adapter == address(0)) revert InvalidProfile();
        if (s.recipient != msg.sender || s.scope == bytes32(0) || s.nullifier == bytes32(0) || s.predicateHash == bytes32(0) || s.issuerRoot != p.issuerRoot || s.validUntil <= block.timestamp || s.validUntil > block.timestamp + p.maxLifetime) revert InvalidStatement();
        if (s.revocationRoot != r.root || s.revocationEpoch != r.epoch || r.updatedAt == 0 || block.timestamp > uint256(r.updatedAt) + p.maxRootAge) revert StaleRoot();
        bytes32 key = keccak256(abi.encode(s.profileId, s.scope, s.nullifier));
        if (usedNullifiers[key]) revert AlreadyUsed();
        entered = true;
        if (!IPrivateAttestationVerifier(p.adapter).verify(proof, statementDigest(s))) revert InvalidProof();
        usedNullifiers[key] = true;
        // Dedicated schema: bytes32 profileId,bytes32 predicateHash,bytes32 scope,
        // bytes32 nullifier,uint64 revocationEpoch. No raw credential UID/PII.
        uid = issue(s, p.derivedSchema);
        receipts[uid] = Receipt(s.profileId, s.revocationEpoch, s.validUntil, s.issuerRoot);
        entered = false;
        emit DerivedAttestation(uid, s.profileId, s.scope, s.nullifier, s.validUntil);
    }
    function issue(Statement calldata s, bytes32 schema) private returns (bytes32) {
        bytes memory publicData = abi.encode(s.profileId, s.predicateHash, s.scope, s.nullifier, s.revocationEpoch);
        IDerivedEAS.Data memory data = IDerivedEAS.Data(s.recipient, s.validUntil, false, bytes32(0), publicData, 0);
        return eas.attest(IDerivedEAS.Request(schema, data));
    }
    /// Re-check this function at consumption. EAS's standalone expiry/revoke
    /// fields cannot track private source revocation roots.
    function isReceiptCurrent(bytes32 uid) external view returns (bool) {
        Receipt memory receipt = receipts[uid]; Profile memory p = profiles[receipt.profileId]; Revocations memory r = revocations[receipt.profileId];
        return receipt.validUntil > block.timestamp && p.enabled && receipt.issuerRoot == p.issuerRoot && receipt.epoch == r.epoch && r.updatedAt != 0 && block.timestamp <= uint256(r.updatedAt) + p.maxRootAge;
    }
}
