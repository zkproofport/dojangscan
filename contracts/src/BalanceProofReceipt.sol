// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBalanceVerifier {
    function verify(bytes calldata, bytes32[] calldata) external view returns (bool);
}

interface IReceiptEAS {
    struct Data {
        address recipient;
        uint64 expirationTime;
        bool revocable;
        bytes32 refUID;
        bytes data;
        uint256 value;
    }

    struct Request {
        bytes32 schema;
        Data data;
    }
    function attest(Request calldata request) external payable returns (bytes32);
}

/// @notice Development receipt: signed balance threshold, not KYC or source non-revocation.
contract BalanceProofReceipt {
    bytes32 public constant PROFILE = keccak256("dojang-scan:offchain-balance:v1");
    IBalanceVerifier public immutable verifier;
    IReceiptEAS public immutable eas;
    bytes32 public immutable receiptSchema;
    address public immutable expectedIssuer;
    bytes32 public immutable expectedDomain;
    bytes32 public immutable expectedScope;
    uint128 public immutable minimumThreshold;
    bytes32 public immutable vkHash;
    bytes32 public immutable circuitHash;
    mapping(bytes32 => bytes32) public receipts;
    event ProofRegistered(
        bytes32 indexed nullifier, bytes32 indexed uid, address indexed recipient, uint128 threshold, uint64 validUntil
    );
    error InvalidStatement();
    error InvalidProof();
    error AlreadyRegistered();

    constructor(
        address verifier_,
        address eas_,
        bytes32 schema_,
        address issuer_,
        bytes32 domain_,
        bytes32 scope_,
        uint128 threshold_,
        bytes32 vkHash_,
        bytes32 circuitHash_
    ) {
        require(block.chainid == 91342, "GIWA chain required");
        require(
            verifier_.code.length > 0 && eas_.code.length > 0 && issuer_ != address(0) && schema_ != bytes32(0)
                && domain_ != bytes32(0) && scope_ != bytes32(0) && threshold_ > 0,
            "Invalid config"
        );
        verifier = IBalanceVerifier(verifier_);
        eas = IReceiptEAS(eas_);
        receiptSchema = schema_;
        expectedIssuer = issuer_;
        expectedDomain = domain_;
        expectedScope = scope_;
        minimumThreshold = threshold_;
        vkHash = vkHash_;
        circuitHash = circuitHash_;
    }

    function addressAt(bytes32[] calldata inputs, uint256 offset) private pure returns (address) {
        uint160 value;
        for (uint256 i = 0; i < 20; i++) {
            if (uint256(inputs[offset + i]) > 255) revert InvalidStatement();
            value = (value << 8) | uint160(uint256(inputs[offset + i]));
        }
        return address(value);
    }

    function bytesAt(bytes32[] calldata inputs, uint256 offset) private pure returns (bytes32) {
        uint256 value;
        for (uint256 i = 0; i < 32; i++) {
            if (uint256(inputs[offset + i]) > 255) revert InvalidStatement();
            value = (value << 8) | uint256(inputs[offset + i]);
        }
        return bytes32(value);
    }

    function registerProof(bytes calldata proof, bytes32[] calldata inputs) external returns (bytes32 uid) {
        if (inputs.length != 159) revert InvalidStatement();
        address issuer = addressAt(inputs, 0);
        address boundRegistry = addressAt(inputs, 20);
        address recipient = addressAt(inputs, 40);
        bytes32 domain = bytesAt(inputs, 60);
        uint256 issued = uint256(inputs[92]);
        uint256 expires = uint256(inputs[93]);
        uint256 threshold = uint256(inputs[94]);
        bytes32 scope = bytesAt(inputs, 95);
        bytes32 nullifier = bytesAt(inputs, 127);
        if (
            issuer != expectedIssuer || boundRegistry != address(this) || recipient != msg.sender
                || domain != expectedDomain || scope != expectedScope || nullifier == bytes32(0)
                || threshold < minimumThreshold || threshold > type(uint128).max || expires > type(uint64).max
                || issued > block.timestamp || expires <= block.timestamp || expires <= issued
                || expires - issued > 1 days
        ) revert InvalidStatement();
        if (receipts[nullifier] != bytes32(0)) revert AlreadyRegistered();
        if (!verifier.verify(proof, inputs)) revert InvalidProof();
        uid = eas.attest(
            IReceiptEAS.Request(
                receiptSchema,
                IReceiptEAS.Data(
                    recipient,
                    uint64(expires),
                    false,
                    bytes32(0),
                    abi.encode(PROFILE, issuer, uint128(threshold), scope, nullifier, false),
                    0
                )
            )
        );
        require(uid != bytes32(0), "Missing receipt");
        receipts[nullifier] = uid;
        emit ProofRegistered(nullifier, uid, recipient, uint128(threshold), uint64(expires));
    }
}
