/**
 * Client-Side PIN Lock Utility
 * Secures IndexedDB local records with zero cloud dependency.
 * Note: WebAuthn biometric passkey registration is not enabled in offline mode,
 * so biometric availability returns false rather than claiming unsupported functionality.
 */

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_sawaari_salt_np');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(enteredPin: string, storedHash: string): Promise<boolean> {
  if (!/^\d{4}$/.test(enteredPin) || !storedHash) {
    return false;
  }
  const enteredHash = await hashPin(enteredPin);
  return enteredHash === storedHash;
}

export function isBiometricAvailable(): boolean {
  return false;
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  return false;
}
