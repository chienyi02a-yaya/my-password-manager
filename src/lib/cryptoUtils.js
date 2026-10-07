// Web Crypto API 零知識加密模組

export async function generateSalt() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function deriveMasterKey(masterPassword, saltHex) {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(masterPassword);
  
  const saltBuffer = new Uint8Array(
    saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  );

  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(masterKey, plaintext) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    masterKey,
    enc.encode(plaintext)
  );

  const ivHex = Array.from(iv, byte => byte.toString(16).padStart(2, '0')).join('');
  const encryptedHex = Array.from(new Uint8Array(encryptedBuffer), byte => byte.toString(16).padStart(2, '0')).join('');

  return { encryptedPayload: encryptedHex, ivHex: ivHex };
}

export async function decryptData(masterKey, encryptedHex, ivHex) {
  const dec = new TextDecoder();
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const encryptedBuffer = new Uint8Array(encryptedHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    masterKey,
    encryptedBuffer
  );

  return dec.decode(decryptedBuffer);
}
