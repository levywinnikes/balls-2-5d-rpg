export type ContainerDefinition = {
  id: string;
  name: string;
  weight: number;
  maxSlots: number;
  movable: boolean;
  pickupable: boolean;
};

const containers: ContainerDefinition[] = [
  {
    id: "wooden_chest",
    name: "item_wooden_chest",
    weight: 200.0,
    maxSlots: 10,
    movable: true,
    pickupable: true,
  },
  {
    id: "altar",
    name: "container_altar",
    weight: 1000.0,
    maxSlots: 1,
    movable: false,
    pickupable: false,
  },
];

export function getContainerData(id: string): ContainerDefinition | undefined {
  return containers.find((c) => c.id === id);
}

export function getAllContainersData(): ContainerDefinition[] {
  return containers;
}

export const ContainerRegistry = {
  getContainer: getContainerData,
  getContainerData,
  getAllContainersData,
};
