import React, { useEffect, useState } from "react";
import { RPGSlot } from "../components/common/RPGSlot";
import {
  PlayerState,
  InventoryItem,
} from "../../game/entities/Player/PlayerState";
import { WeaponRegistry } from "../../game/entities/weapons/WeaponRegistry";
import { useUI } from "../../context/UIContext";
import { GhostImageUtils } from "../../game/utils/GhostImageUtils";
import { t_game } from "../../game/i18n/translations";
import { formatItemTooltip } from "../../game/utils/TooltipUtils";
import { ContainerRegistry } from "../../game/entities/containers/ContainerRegistry";
import { AudioManager } from "../../game/systems/AudioManager";

export const ContainerContent: React.FC = () => {
  const {
    s,
    showTooltip,
    hideTooltip,
    setDraggedItem,
    draggedItem,
    groundDrag,
  } = useUI();

  // We listen to container updates
  const [containerId, setContainerId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);

  // Force re-render for title update if needed
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const ps = PlayerState.getInstance();

    const updateContent = (id: string) => {
      if (id === containerId) {
        setItems([...ps.getContainerItems(id)]);
      }
    };

    const handleWindowOpen = (event: any) => {
      if (event.type === "container") {
        // Fix: Ignore Altar containers (handled by AltarWindow)
        if (event.data && event.data.containerDefId === "altar") {
          return;
        }
        console.log("ContainerContent: Event Received", event);
        setContainerId(event.id);
        setItems([...ps.getContainerItems(event.id)]);
        setForceUpdate((n) => n + 1);
      }
    };

    const handleClose = (id: string) => {
      if (id === containerId || !ps.currentOpenedContainerId) {
        setContainerId(null);
        setItems([]);
      }
    };

    ps.on("windowOpened", handleWindowOpen);
    ps.on("containerClosed", handleClose);
    ps.on("containerUpdated", updateContent);

    if (ps.currentOpenedContainerId && !containerId) {
      // Fix: Do not adopt Altar container ID
      if (ps.currentOpenedContainerDefId !== "altar") {
        setContainerId(ps.currentOpenedContainerId);
        setItems([...ps.getContainerItems(ps.currentOpenedContainerId)]);
      }
    }

    return () => {
      ps.off("windowOpened", handleWindowOpen);
      ps.off("containerClosed", handleClose);
      ps.off("containerUpdated", updateContent);
    };
  }, [containerId]);

  // DROP HANDLER (Receive items)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerId || !draggedItem) return;

    const ps = PlayerState.getInstance();

    // Prevent drop if same container
    if (
      draggedItem.source === "container" &&
      draggedItem.containerId === containerId
    ) {
      return;
    }

    if (draggedItem.source === "inventory") {
      ps.removeInventoryItem(draggedItem.uid);
      ps.addItemToContainer(containerId, draggedItem.itemId, draggedItem.count);
      setDraggedItem(null);
    } else if (draggedItem.source === "container") {
      // Moving between containers?
      // Need to remove from OLD container.
      // We need `containerId` in draggedItem metadata.
      if (draggedItem.containerId) {
        ps.removeItemFromContainer(draggedItem.containerId, draggedItem.uid);
        ps.addItemToContainer(
          containerId,
          draggedItem.itemId,
          draggedItem.count,
        );
        setDraggedItem(null);
      }
    } else if (draggedItem.source === "equipment") {
      // Equip -> Container (Direct Transfer)
      // We use our new specialized method to avoid it going to Inventory first.
      const slot = draggedItem.uid.replace("equipped_", "");
      ps.unequipItemToContainer(slot as any, containerId);
    }
    setDraggedItem(null);
    PlayerState.getInstance().emit("uiDragEnd");
  };

  // DRAG START (Take items out)
  const handleDragStart = (e: React.DragEvent, item: InventoryItem) => {
    // Attach metadata including containerId
    setDraggedItem({ ...item, source: "container", containerId });

    // Visuals
    const ghost = GhostImageUtils.getEmptyDragImage();
    e.dataTransfer.setDragImage(ghost, 0, 0);

    PlayerState.getInstance().emit("uiDragStart");
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    PlayerState.getInstance().emit("uiDragEnd");
  };

  if (!containerId) return null;

  const ps = PlayerState.getInstance();
  const defId = ps.currentOpenedContainerDefId;
  const containerRegistryDef = defId
    ? ContainerRegistry.getContainer(defId)
    : null;
  const capacity = containerRegistryDef ? containerRegistryDef.maxSlots : 20;

  // Highlight logic
  const isHighlighting =
    !!groundDrag ||
    (draggedItem &&
      (draggedItem.source !== "container" ||
        draggedItem.containerId !== containerId));
  const highlightBorder = isHighlighting
    ? "1px dashed #00d2ff"
    : "1px solid #444";

  return (
    <div
      className="custom-scrollbar"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onMouseUpCapture={(e) => {
        if (groundDrag && containerId) {
          e.stopPropagation();
          const ps = PlayerState.getInstance();
          // Move from Ground to Container
          if (
            ps.addItemToContainer(
              containerId,
              groundDrag.item.weaponId,
              groundDrag.item.count || 1,
              groundDrag.item.itemId,
            )
          ) {
            ps.removePersistentDroppedItem(
              groundDrag.item.level,
              groundDrag.item.itemId,
            );
            ps.endGroundDrag(true);
          }
        }
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: `${s(4)}px`,
        minHeight: "100px",
        padding: "4px",
        overflowY: "auto",
        maxHeight: "200px",
        paddingRight: "4px",
        alignContent: "start",
        border: isHighlighting ? highlightBorder : undefined,
      }}
    >
      {items.map((item) => {
        const def = WeaponRegistry.getWeaponDefinition(item.itemId);
        return (
          <RPGSlot
            key={item.uid}
            item={item}
            def={def}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragEnd={handleDragEnd}
            onMouseEnter={(e) => {
              if (def && !groundDrag) {
                const { name, subtext } = formatItemTooltip(def, {
                  weaponId: item.itemId,
                  uid: item.uid,
                });
                showTooltip({
                  text: name,
                  subtext,
                  x: e.clientX,
                  y: e.clientY,
                  item: { ...def, id: def.id || item.itemId },
                });
              }
            }}
            onMouseLeave={hideTooltip}
            onClick={() => {
              const itemWeight = def ? (def.weight || 0) * item.count : 0;
              const playerState = PlayerState.getInstance();
              if (
                playerState.hasCapacity &&
                !playerState.hasCapacity(itemWeight)
              ) {
                playerState.emit("message", t_game("msg_too_heavy"));
                return;
              }
              if (playerState.addItem(item.itemId, item.count)) {
                if (containerId)
                  playerState.removeItemFromContainer(containerId, item.uid);
              } else {
                playerState.emit("message", t_game("msg_inv_full"));
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (
                containerId &&
                PlayerState.getInstance().toggleContainerItem(
                  containerId,
                  item.uid,
                )
              ) {
                AudioManager.getInstance().playClick();
                return;
              }
            }}
          />
        );
      })}
      {Array.from({ length: Math.max(0, capacity - items.length) }).map(
        (_, i) => (
          <RPGSlot key={`empty-${i}`} />
        ),
      )}
    </div>
  );
};
