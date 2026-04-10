import Phaser from "phaser";
import Player from "../entities/Player";
import { PlayerState } from "../entities/Player/PlayerState";
import { WeaponRegistry } from "../entities/weapons/WeaponRegistry";
import { translations } from "../i18n/translations";

export class InventorySystem {
  private scene: Phaser.Scene;
  private player: Player;
  private playerState: PlayerState;

  // Listener para mostrar mensagem quando pegar item
  private onWeaponAdded: (weapon: any) => void;

  constructor(scene: Phaser.Scene, player: Player, playerState: PlayerState) {
    this.scene = scene;
    this.player = player;
    this.playerState = playerState;

    // Configurar listeners
    this.onWeaponAdded = (weapon) => {
      if (weapon) {
        this.showPickupMessage(weapon.id);
      }
    };

    // Ouvir o evento do PlayerState
    this.playerState.on("weaponAdded", this.onWeaponAdded);
  }

  /**
   * Método chamado pelo GameScene no loop de update.
   */
  public update(): void {
    // Nenhuma lógica visual de UI necessária aqui.
  }

  /**
   * Mostra o texto flutuante no mundo quando um item é coletado.
   */
  public showPickupMessage(itemId: string): void {
    const weapon = WeaponRegistry.getWeaponDefinition(itemId);
    
    // Translation Logic
    const lang = (localStorage.getItem("tibia-react-lang") as "en" | "pt") || "en";
    const dict = translations[lang] || translations["en"];
    
    // Attempt to translate item name: item_{id}
    const key = `item_${itemId}` as keyof typeof dict;
    const translatedName = dict[key] || weapon?.name || "Item";

    // Use NotificationSystem
    this.playerState.emit("uiNotification", {
        type: "pickup",
        message: translations[lang]["notif_item_get"]
                 ? translations[lang]["notif_item_get"].replace("{amount}", "1").replace("{item}", translatedName)
                 : `+1 ${translatedName}`
    });
  }

  /**
   * Limpeza de eventos ao destruir a cena
   */
  public destroy(): void {
    this.playerState.off("weaponAdded", this.onWeaponAdded);
  }
}
