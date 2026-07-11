export class Vector3 {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}
  static Distance(a: Vector3, b: Vector3): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }
  subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }
  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }
  scale(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
  length(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }
  lengthSquared(): number {
    return this.x ** 2 + this.y ** 2 + this.z ** 2;
  }
  normalize(): Vector3 {
    const len = this.length();
    if (len < 0.001) return new Vector3(0, 0, 0);
    return this.scale(1 / len);
  }
  addInPlace(other: Vector3): void {
    this.x += other.x; this.y += other.y; this.z += other.z;
  }
}

export class Color3 {
  constructor(public r: number = 0, public g: number = 0, public b: number = 0) {}
  static FromHexString(hex: string): Color3 {
    hex = hex.replace("#", "");
    return new Color3(
      parseInt(hex.substring(0, 2), 16) / 255,
      parseInt(hex.substring(2, 4), 16) / 255,
      parseInt(hex.substring(4, 6), 16) / 255,
    );
  }
  static Black(): Color3 { return new Color3(0, 0, 0); }
  static White(): Color3 { return new Color3(1, 1, 1); }
  scale(s: number): Color3 { return new Color3(this.r * s, this.g * s, this.b * s); }
}

export const Mesh = { BILLBOARDMODE_ALL: 7 } as any;
export class MeshBuilder {
  static CreatePlane(_name: string, _opts: any, _scene: any): any {
    return { position: new Vector3(), billboardMode: 7, rotation: { z: 0 }, material: null, isPickable: false };
  }
  static CreateSphere(_name: string, _opts: any, _scene: any): any {
    return { position: new Vector3(), scaling: { setAll: () => {} }, material: null };
  }
  static CreateCylinder(_name: string, _opts: any, _scene: any): any {
    return { position: new Vector3(), material: null };
  }
  static CreateBox(_name: string, _opts: any, _scene: any): any {
    return { position: new Vector3(), material: null };
  }
  static CreateDisc(_name: string, _opts: any, _scene: any): any {
    return { position: new Vector3() };
  }
}
export class StandardMaterial {
  constructor(public name: string, _scene: any) {}
  diffuseColor = new Color3();
  emissiveColor = new Color3();
  specularColor = new Color3();
  diffuseTexture = null;
  opacityTexture = null;
  useAlphaFromDiffuseTexture = false;
  backFaceCulling = true;
  disableLighting = false;
  alpha = 1;
  needAlphaBlendingForMesh() { return this.alpha < 1 || this.diffuseTexture !== null; } // needed by RenderingGroup
}
export class DynamicTexture {
  getContext(): CanvasRenderingContext2D { return null as any; }
  update(): void {}
}
export class TransformNode {
  name: string;
  constructor(name: string, _scene: any) { this.name = name; }
}
export const VertexData = { ComputeNormals: (_p: number[], _i: number[], _n: number[]) => {} };
export class Engine {
  getDeltaTime(): number { return 16; }
  getRenderWidth(): number { return 800; }
  getRenderHeight(): number { return 600; }
  setHardwareScalingLevel(_level: number): void {}
}
export class Scene {
  static FOGMODE_NONE = 0;
  static FOGMODE_EXP = 1;
  fogMode = 0;
  fogDensity = 0;
  activeCamera = null;
  lights = null;
  onBeforeRenderObservable = { add: () => ({}) };
  onPointerObservable = { add: () => ({}) };
  getEngine(): Engine { return new Engine(); }
  dispose(): void {}
}
export class HemisphericLight {
  intensity = 1;
}
export class ArcRotateCamera {}
export class UniversalCamera {}
export class SceneInstrumentation {}
export const PointerEventTypes = { POINTERDOWN: 1 };
export type AbstractMesh = any;
export type Scene = any;
export type Engine = any;
export type Camera = any;
export type AbstractEngine = any;
