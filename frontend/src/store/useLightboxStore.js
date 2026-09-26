import { create } from "zustand";

export const useLightboxStore = create((set) => ({
  imageUrl: null,
  open: (imageUrl) => set({ imageUrl }),
  close: () => set({ imageUrl: null }),
}));
