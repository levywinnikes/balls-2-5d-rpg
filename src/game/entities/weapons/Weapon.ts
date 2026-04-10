import Phaser from "phaser";
import { WeaponRegistry, WeaponDefinition } from "./WeaponRegistry";

export default class Weapon {
  public sprite: Phaser.GameObjects.Sprite;
  private definition: WeaponDefinition;
  private lastAttackTime: number = 0;
  private isEquipped: boolean = false;

  constructor(scene: Phaser.Scene, weaponId: string) {
    const definition = WeaponRegistry.getWeaponDefinition(weaponId);

    if (!definition) {
      throw new Error(`Arma não encontrada: ${weaponId}`);
    }

    this.definition = definition;
    this.sprite = WeaponRegistry.createWeaponGraphic(scene, weaponId);
    this.sprite.setVisible(false);
  }

  public attack(): boolean {
    const now = Date.now();

    // Verifica se a arma está em cooldown
    if (now - this.lastAttackTime < this.definition.cooldown) {
      return false;
    }

    console.log(`Atacando com ${this.definition.name}`);
    this.lastAttackTime = now;
    return true;
  }

  public equip(position?: { x: number; y: number }): void {
    this.sprite.setVisible(true);
    this.isEquipped = true;

    if (position) {
      this.sprite.setPosition(position.x, position.y);
    }
  }

  public unequip(): void {
    this.sprite.setVisible(false);
    this.isEquipped = false;
  }

  public getDamage(): number {
    return this.definition.damage;
  }

  public getRange(): number {
    return this.definition.range;
  }

  public getCooldown(): number {
    return this.definition.cooldown;
  }

  public getType(): string {
    return this.definition.type;
  }

  public isReadyToAttack(): boolean {
    return Date.now() - this.lastAttackTime >= this.definition.cooldown;
  }

  public updatePosition(x: number, y: number): void {
    if (this.isEquipped) {
      this.sprite.setPosition(x, y);
    }
  }

  public setDepth(depth: number): void {
    this.sprite.setDepth(depth);
  }
}

