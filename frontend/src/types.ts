export type Status = "online" | "offline" | "unknown";
export type Theme = "light" | "dark";

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  relatedHostIds: string[];
  relatedProjectIds: string[];
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
}

export interface Host {
  id: string;
  name: string;
  address: string;
  os: string;
  environment: string;
  status: Status;
  sshPort: string;
  notes: string;
}

export interface Project {
  id: string;
  name: string;
  hostId: string;
  stack: string;
  port: string;
  url: string;
  adminUrl: string;
  repoUrl: string;
  deployPath: string;
  status: Status;
  notes: string;
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  group: string;
  icon: string;
  description: string;
  pinned: boolean;
  openInNewTab: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface WorkspaceData {
  notes: Note[];
  hosts: Host[];
  projects: Project[];
  links: LinkItem[];
  tags: Tag[];
}
