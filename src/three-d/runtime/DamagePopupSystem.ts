import { type Scene, type Mesh, Vector3, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import type { GameContext } from "./GameContext";

export interface DamagePopupConfig {
  ctx: GameContext;
  scene: Scene;
}

export interface DamagePopupSystem {
  emitPlayerDamagePopup: (sourceKey: string, rawDamage: number, icon?: string, customColor?: string) => void;
  emitBloodBurst: (origin: Vector3, colorHex: string, particleCount: number, spread: number, lifetimeSec: number) => void;
}

export function createDamagePopupSystem(cfg: DamagePopupConfig): DamagePopupSystem {
  const { ctx, scene } = cfg;

  const recentPlayerDamagePopups = new Map<string, { at: number; value: number }>();

  const emitPlayerDamagePopup = (
    sourceKey: string,
    rawDamage: number,
    icon?: string,
    customColor?: string,
  ) => {
    const damage = Math.max(1, Math.floor(rawDamage));
    const now = Date.now();
    const dedupeKey = `${sourceKey}:${icon || "❤"}`;
    const previous = recentPlayerDamagePopups.get(dedupeKey);

    if (previous && previous.value === damage && now - previous.at < 280) {
      return;
    }

    recentPlayerDamagePopups.set(dedupeKey, { at: now, value: damage });

    if (recentPlayerDamagePopups.size > 64) {
      recentPlayerDamagePopups.forEach((entry, key) => {
        if (now - entry.at > 1500) {
          recentPlayerDamagePopups.delete(key);
        }
      });
    }

    document.dispatchEvent(
      new CustomEvent("slice3d:playerHit", { detail: { damage } }),
    );

    ctx.playerState.emit("floatingText", {
      x: ctx.player.position.x,
      y: ctx.player.position.y,
      z: ctx.player.position.z,
      damage: -damage,
      isCritical: false,
      icon,
      customColor,
    });
  };

  const emitBloodBurst = (
    origin: Vector3,
    colorHex: string,
    particleCount: number,
    spread: number,
    lifetimeSec: number,
  ) => {
    const particles: Mesh[] = [];
    const velocities: Vector3[] = [];
    const bloodMat = new StandardMaterial(
      `slice_blood_mat_${Date.now()}`,
      scene,
    );
    bloodMat.diffuseColor = Color3.FromHexString(colorHex);
    bloodMat.emissiveColor = Color3.FromHexString(colorHex).scale(0.15);
    bloodMat.specularColor = Color3.Black();

    for (let i = 0; i < particleCount; i += 1) {
      const p = MeshBuilder.CreateSphere(
        `slice_blood_${Date.now()}_${i}`,
        { diameter: 0.05 + Math.random() * 0.08, segments: 3 },
        scene,
      );
      p.material = bloodMat;
      p.position = origin.add(
        new Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * 0.25,
          (Math.random() - 0.5) * spread,
        ),
      );
      particles.push(p);
      velocities.push(
        new Vector3(
          (Math.random() - 0.5) * 2.5,
          1.2 + Math.random() * 1.1,
          (Math.random() - 0.5) * 2.5,
        ),
      );
    }

    let age = 0;
    const obs = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      age += dt;
      const t = Math.min(1, age / lifetimeSec);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        const vel = velocities[i];
        vel.y -= 5.5 * dt;
        particle.position.addInPlace(vel.scale(dt));
        particle.scaling.setAll(Math.max(0.01, 1 - t * 0.85));
      }

      if (age >= lifetimeSec) {
        particles.forEach((p) => p.dispose());
        bloodMat.dispose();
        scene.onBeforeRenderObservable.remove(obs);
      }
    });
  };

  return { emitPlayerDamagePopup, emitBloodBurst };
}
