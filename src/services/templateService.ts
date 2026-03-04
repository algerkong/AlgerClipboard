import { invoke } from "@tauri-apps/api/core";
import type { Template } from "@/types";

export async function getTemplates(
  group?: string
): Promise<Template[]> {
  return invoke("get_templates", { group: group ?? null });
}

export async function createTemplate(
  title: string,
  content: string,
  groupName?: string
): Promise<Template> {
  return invoke("create_template", {
    title,
    content,
    groupName: groupName ?? null,
  });
}

export async function updateTemplate(
  id: string,
  title: string,
  content: string,
  groupName?: string
): Promise<Template> {
  return invoke("update_template", {
    id,
    title,
    content,
    groupName: groupName ?? null,
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  return invoke("delete_template", { id });
}

export async function applyTemplate(id: string): Promise<string> {
  return invoke("apply_template", { id });
}
