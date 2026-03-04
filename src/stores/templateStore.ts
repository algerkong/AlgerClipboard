import { create } from "zustand";
import type { Template } from "@/types";
import {
  getTemplates,
  createTemplate as createTemplateApi,
  updateTemplate as updateTemplateApi,
  deleteTemplate as deleteTemplateApi,
  applyTemplate as applyTemplateApi,
} from "@/services/templateService";

interface TemplateState {
  templates: Template[];
  selectedGroup: string | null;
  loading: boolean;

  fetchTemplates: () => Promise<void>;
  setSelectedGroup: (group: string | null) => void;
  createTemplate: (title: string, content: string, groupName?: string) => Promise<void>;
  updateTemplate: (id: string, title: string, content: string, groupName?: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  applyTemplate: (id: string) => Promise<string>;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  selectedGroup: null,
  loading: false,

  fetchTemplates: async () => {
    set({ loading: true });
    try {
      const group = get().selectedGroup;
      const templates = await getTemplates(group ?? undefined);
      set({ templates, loading: false });
    } catch (err) {
      console.error("Failed to fetch templates:", err);
      set({ loading: false });
    }
  },

  setSelectedGroup: (group: string | null) => {
    set({ selectedGroup: group });
    get().fetchTemplates();
  },

  createTemplate: async (title, content, groupName) => {
    try {
      await createTemplateApi(title, content, groupName);
      await get().fetchTemplates();
    } catch (err) {
      console.error("Failed to create template:", err);
    }
  },

  updateTemplate: async (id, title, content, groupName) => {
    try {
      await updateTemplateApi(id, title, content, groupName);
      await get().fetchTemplates();
    } catch (err) {
      console.error("Failed to update template:", err);
    }
  },

  deleteTemplate: async (id) => {
    try {
      await deleteTemplateApi(id);
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
      }));
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  },

  applyTemplate: async (id) => {
    return applyTemplateApi(id);
  },
}));
