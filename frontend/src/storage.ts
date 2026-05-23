import { WorkspaceData } from "./types";

export const STORAGE_KEY = "personal-workspace-data-v1";
export const THEME_KEY = "personal-workspace-theme";

const now = new Date().toISOString();

export const starterData: WorkspaceData = {
  tags: [
    { id: "tag-ops", name: "ops", color: "#2563eb" },
    { id: "tag-note", name: "note", color: "#059669" },
    { id: "tag-project", name: "project", color: "#7c3aed" }
  ],
  hosts: [
    {
      id: "host-server",
      name: "正式服务器 4C4G",
      address: "124.221.142.66",
      os: "Ubuntu",
      environment: "production",
      status: "online",
      sshPort: "22",
      notes: "personal-workspace 云服务器部署主机。"
    }
  ],
  projects: [
    {
      id: "project-workspace",
      name: "personal-workspace",
      hostId: "host-server",
      stack: "Spring Boot + React + SQLite",
      port: "80 / 8080",
      url: "http://124.221.142.66",
      adminUrl: "http://124.221.142.66",
      repoUrl: "",
      deployPath: "/opt/personal-workspace",
      status: "online",
      notes: "个人笔记、主机、项目和链接工作台。"
    }
  ],
  links: [
    {
      id: "link-production",
      title: "Personal Workspace",
      url: "http://124.221.142.66",
      group: "生产环境",
      icon: "app",
      description: "线上个人工作台入口",
      pinned: true,
      openInNewTab: true
    }
  ],
  notes: [
    {
      id: "note-welcome",
      title: "个人工作台启动笔记",
      content:
        "## Welcome\n\n这里可以记录项目想法、服务器维护记录、部署步骤和日常笔记。\n\n- 使用左侧导航切换模块\n- 在 Notes 中写 Markdown\n- 在 Hosts / Projects 中维护资产\n- 在 Links 中保存常用入口",
      tags: ["note", "project"],
      relatedHostIds: [],
      relatedProjectIds: [],
      createdAt: now,
      updatedAt: now,
      pinned: true
    }
  ]
};

export interface AuthInfo {
  authenticated: boolean;
  username?: string;
}

export async function login(username: string, password: string): Promise<AuthInfo> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    throw new Error("用户名或密码错误");
  }
  return response.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin"
  });
}

export async function getCurrentUser(): Promise<AuthInfo> {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin"
  });
  return response.json();
}

export async function fetchWorkspaceData(): Promise<WorkspaceData> {
  const response = await fetch("/api/workspace", {
    credentials: "same-origin"
  });
  if (response.status === 401) {
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    throw new Error("读取服务器数据失败");
  }
  const parsed = await response.json();
  if (isWorkspaceData(parsed)) {
    return parsed;
  }
  return starterData;
}

export async function saveWorkspaceData(data: WorkspaceData): Promise<void> {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error("保存服务器数据失败");
  }
}

export function loadLocalWorkspaceData(): WorkspaceData | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (isWorkspaceData(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["notes", "hosts", "projects", "links", "tags"].every((key) => Array.isArray(candidate[key]));
}

export function isWorkspaceEmpty(data: WorkspaceData): boolean {
  return data.notes.length === 0 && data.hosts.length === 0 && data.projects.length === 0 && data.links.length === 0;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
