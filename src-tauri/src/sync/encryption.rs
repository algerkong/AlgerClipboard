use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedManifestWrapper {
    pub encrypted: bool,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

pub struct SyncEncryption {
    key: [u8; 32],
}

impl SyncEncryption {
    pub fn from_passphrase(passphrase: &str, salt: &[u8]) -> Result<Self, String> {
        use argon2::Argon2;
        let mut key = [0u8; 32];
        Argon2::default()
            .hash_password_into(passphrase.as_bytes(), salt, &mut key)
            .map_err(|e| format!("Key derivation failed: {}", e))?;
        Ok(Self { key })
    }

    pub fn generate_salt() -> Vec<u8> {
        use rand::RngCore;
        let mut salt = vec![0u8; 16];
        rand::thread_rng().fill_bytes(&mut salt);
        salt
    }

    pub fn encrypt(&self, plaintext: &[u8]) -> Result<EncryptedPayload, String> {
        use aes_gcm::{Aes256Gcm, Nonce};
        use aes_gcm::aead::{Aead, KeyInit};
        use rand::RngCore;

        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| format!("Cipher init failed: {}", e))?;
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, plaintext)
            .map_err(|e| format!("Encryption failed: {}", e))?;
        Ok(EncryptedPayload {
            nonce: nonce_bytes.to_vec(),
            ciphertext,
        })
    }

    pub fn decrypt(&self, payload: &EncryptedPayload) -> Result<Vec<u8>, String> {
        use aes_gcm::{Aes256Gcm, Nonce};
        use aes_gcm::aead::{Aead, KeyInit};

        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| format!("Cipher init failed: {}", e))?;
        let nonce = Nonce::from_slice(&payload.nonce);
        cipher.decrypt(nonce, payload.ciphertext.as_ref())
            .map_err(|e| format!("Decryption failed: {}", e))
    }

    pub fn encrypt_for_storage(&self, plaintext: &[u8], salt: &[u8]) -> Result<EncryptedManifestWrapper, String> {
        use base64::Engine;
        use base64::engine::general_purpose::STANDARD;

        let payload = self.encrypt(plaintext)?;
        Ok(EncryptedManifestWrapper {
            encrypted: true,
            salt: STANDARD.encode(salt),
            nonce: STANDARD.encode(&payload.nonce),
            ciphertext: STANDARD.encode(&payload.ciphertext),
        })
    }

    pub fn decrypt_from_storage(&self, wrapper: &EncryptedManifestWrapper) -> Result<Vec<u8>, String> {
        use base64::Engine;
        use base64::engine::general_purpose::STANDARD;

        let payload = EncryptedPayload {
            nonce: STANDARD.decode(&wrapper.nonce).map_err(|e| format!("Decode nonce: {}", e))?,
            ciphertext: STANDARD.decode(&wrapper.ciphertext).map_err(|e| format!("Decode ciphertext: {}", e))?,
        };
        self.decrypt(&payload)
    }
}
