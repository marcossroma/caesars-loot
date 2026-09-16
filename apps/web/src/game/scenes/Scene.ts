export interface Scene {
  resize(width: number, height: number): void;
  destroy(): void;
}
