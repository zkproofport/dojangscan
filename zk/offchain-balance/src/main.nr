use dep::keccak256::keccak256;

// EAS v2, uint256 balanceKRW, resolver=0, revocable=true, refUID=0.
// Prototype statement: an expected issuer signed this recipient's balance,
// and that hidden balance is >= threshold. Source revocation is NOT proven.
fn word(value: u128) -> [u8; 32] {
    let mut out = [0; 32];
    for i in 0..16 { out[31-i] = ((value >> ((i*8) as u8)) & 255) as u8; }
    out
}

fn main(
    issuer: pub [u8; 20],
    registry: pub [u8; 20],
    recipient: pub [u8; 20],
    domain_separator: pub [u8; 32],
    issued_at: pub u64,
    expiration: pub u64,
    threshold: pub u128,
    scope: pub [u8; 32],
    nullifier: pub [u8; 32],
    balance: u128,
    salt: [u8; 32],
    pubkey_x: [u8; 32],
    pubkey_y: [u8; 32],
    signature: [u8; 64],
) {
    assert(threshold > 0, "Threshold must be positive");
    assert(balance >= threshold, "Balance condition not met");
    assert(expiration > issued_at, "Finite expiry is required");
    let mut public_key = [0; 64];
    for i in 0..32 { public_key[i] = pubkey_x[i]; public_key[32+i] = pubkey_y[i]; }
    let key_hash = keccak256(public_key, 64);
    for i in 0..20 { assert(key_hash[12+i] == issuer[i], "Unexpected issuer"); }

    let type_text = "Attest(uint16 version,bytes32 schema,address recipient,uint64 time,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,bytes32 salt)";
    let type_hash = keccak256(type_text.as_bytes(), 143);
    let definition = "uint256 balanceKRW";
    let mut schema_preimage = [0; 39];
    for i in 0..18 { schema_preimage[i] = definition.as_bytes()[i]; }
    schema_preimage[38] = 1;
    let schema = keccak256(schema_preimage, 39);
    let data_hash = keccak256(word(balance), 32);
    let mut struct_data = [0; 320];
    let version_word = word(2);
    let time_word = word(issued_at as u128);
    let expiration_word = word(expiration as u128);
    let revocable_word = word(1);
    for i in 0..32 {
        struct_data[i] = type_hash[i];
        struct_data[32+i] = version_word[i];
        struct_data[64+i] = schema[i];
        struct_data[128+i] = time_word[i];
        struct_data[160+i] = expiration_word[i];
        struct_data[192+i] = revocable_word[i];
        struct_data[256+i] = data_hash[i];
        struct_data[288+i] = salt[i];
    }
    for i in 0..20 { struct_data[108+i] = recipient[i]; }
    let struct_hash = keccak256(struct_data, 320);
    let mut signing_preimage = [0; 66];
    signing_preimage[0] = 25; signing_preimage[1] = 1;
    for i in 0..32 { signing_preimage[2+i] = domain_separator[i]; signing_preimage[34+i] = struct_hash[i]; }
    let signing_hash = keccak256(signing_preimage, 66);
    assert(std::ecdsa_secp256k1::verify_signature(pubkey_x,pubkey_y,signature,signing_hash), "Invalid EIP-712 signature");
    let mut nullifier_preimage = [0; 124];
    for i in 0..32 { nullifier_preimage[i] = salt[i]; nullifier_preimage[92+i] = scope[i]; }
    for i in 0..20 { nullifier_preimage[32+i] = recipient[i]; nullifier_preimage[52+i] = issuer[i]; nullifier_preimage[72+i] = registry[i]; }
    assert(keccak256(nullifier_preimage,124) == nullifier, "Wrong scope-bound nullifier");
}
