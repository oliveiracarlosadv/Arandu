// Detecção de capacidades do dispositivo. Os navegadores expõem pouca informação de hardware:
// - navigator.deviceMemory existe só em navegadores Chromium e é arredondado/limitado a 8 GB;
// - Safari e Firefox não informam memória. Nesses casos, a RAM é exibida como "não informada".

import type { HardwareProfile } from '../../types';

export interface HardwareInfo {
  wasm: boolean;
  wasmSimd: boolean;
  webgpu: boolean;
  webgpuF16: boolean;
  gpuDescription?: string;
  /** GB aproximados (Chromium, limitado a 8) ou null quando o navegador não informa. */
  deviceMemoryGb: number | null;
  cores: number | null;
  storageQuotaMb: number | null;
  storageUsageMb: number | null;
  offscreenCanvas: boolean;
  serviceWorker: boolean;
  recommendedProfile: HardwareProfile;
}

function simdSupported(): boolean {
  try {
    // Módulo WASM mínimo que usa uma instrução SIMD (v128)
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch {
    return false;
  }
}

export async function detectHardware(): Promise<HardwareInfo> {
  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: { requestAdapter(): Promise<{ features: Set<string>; info?: { vendor?: string; architecture?: string } } | null> } };
  const wasm = typeof WebAssembly === 'object';
  let webgpu = false, webgpuF16 = false, gpuDescription: string | undefined;
  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        webgpu = true;
        webgpuF16 = adapter.features.has('shader-f16');
        const info = adapter.info;
        gpuDescription = [info?.vendor, info?.architecture].filter(Boolean).join(' ') || undefined;
      }
    } catch { /* WebGPU indisponível */ }
  }
  let storageQuotaMb: number | null = null, storageUsageMb: number | null = null;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota) storageQuotaMb = Math.round(est.quota / 1048576);
    if (est?.usage !== undefined) storageUsageMb = Math.round(est.usage / 1048576);
  } catch { /* opcional */ }
  const deviceMemoryGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const cores = navigator.hardwareConcurrency || null;

  let recommendedProfile: HardwareProfile = 'balanced';
  if ((deviceMemoryGb !== null && deviceMemoryGb < 4) || (cores !== null && cores <= 4)) recommendedProfile = 'economy';
  else if (webgpu && (deviceMemoryGb === null || deviceMemoryGb >= 8) && (cores ?? 0) >= 8) recommendedProfile = 'high';

  return {
    wasm,
    wasmSimd: wasm && simdSupported(),
    webgpu,
    webgpuF16,
    gpuDescription,
    deviceMemoryGb,
    cores,
    storageQuotaMb,
    storageUsageMb,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    serviceWorker: 'serviceWorker' in navigator,
    recommendedProfile,
  };
}

export const PROFILE_LABEL: Record<HardwareProfile, string> = { economy: 'Econômica', balanced: 'Equilibrada', high: 'Alta precisão' };
