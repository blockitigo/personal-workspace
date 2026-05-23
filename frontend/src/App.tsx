import {
  AppWindow,
  CheckCircle2,
  CircleHelp,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Home,
  Laptop,
  Link as LinkIcon,
  Moon,
  Plus,
  Save,
  Search,
  Server,
  Settings,
  Star,
  Sun,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { ChangeEvent, FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AuthInfo,
  createId,
  fetchWorkspaceData,
  getCurrentUser,
  isWorkspaceData,
  isWorkspaceEmpty,
  loadLocalWorkspaceData,
  login,
  logout,
  saveWorkspaceData,
  starterData,
  THEME_KEY
} from "./storage";
import { Host, LinkItem, Note, Project, Status, Theme, WorkspaceData } from "./types";

type View = "dashboard" | "notes" | "hosts" | "projects" | "links" | "settings";

const views: Array<{ id: View; label: string; sub: string; icon: typeof Home }> = [
  { id: "dashboard", label: "仪表盘", sub: "Dashboard", icon: Home },
  { id: "notes", label: "笔记", sub: "Notes", icon: FileText },
  { id: "hosts", label: "主机与项目", sub: "Assets", icon: Server },
  { id: "links", label: "链接", sub: "Links", icon: LinkIcon },
  { id: "settings", label: "设置", sub: "Settings", icon: Settings }
];

const statusMeta: Record<Status, { label: string; className: string }> = {
  online: { label: "Online", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  offline: { label: "Offline", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  unknown: { label: "Unknown", className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" }
};

const blankHost: Omit<Host, "id"> = {
  name: "",
  address: "",
  os: "",
  environment: "local",
  status: "unknown",
  sshPort: "22",
  notes: ""
};

const blankProject: Omit<Project, "id"> = {
  name: "",
  hostId: "",
  stack: "",
  port: "",
  url: "",
  adminUrl: "",
  repoUrl: "",
  deployPath: "",
  status: "unknown",
  notes: ""
};

const blankLink: Omit<LinkItem, "id"> = {
  title: "",
  url: "",
  group: "默认",
  icon: "link",
  description: "",
  pinned: false,
  openInNewTab: true
};

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<WorkspaceData>(starterData);
  const [theme, setTheme] = useState<Theme>(() => (window.localStorage.getItem(THEME_KEY) as Theme) || "light");
  const [selectedNoteId, setSelectedNoteId] = useState(() => starterData.notes[0]?.id ?? "");
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false });
  const [authChecked, setAuthChecked] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [focusHostId, setFocusHostId] = useState("");
  const [focusProjectId, setFocusProjectId] = useState("");

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        setAuth(user);
        if (user.authenticated) {
          await loadServerWorkspace();
        }
      })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!auth.authenticated || !workspaceReady) {
      return;
    }

    setSaveState("saving");
    const handle = window.setTimeout(() => {
      saveWorkspaceData(data)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 450);

    return () => window.clearTimeout(handle);
  }, [auth.authenticated, data, workspaceReady]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const selectedNote = data.notes.find((note) => note.id === selectedNoteId) ?? data.notes[0];

  async function loadServerWorkspace() {
    const serverData = await fetchWorkspaceData();
    const initialData = isWorkspaceEmpty(serverData) ? loadLocalWorkspaceData() ?? starterData : serverData;
    setData(initialData);
    setSelectedNoteId(initialData.notes[0]?.id ?? "");
    setWorkspaceReady(true);
    if (isWorkspaceEmpty(serverData)) {
      await saveWorkspaceData(initialData);
    }
  }

  async function handleLogin(username: string, password: string) {
    const user = await login(username, password);
    setAuth(user);
    await loadServerWorkspace();
  }

  async function handleLogout() {
    await logout();
    setAuth({ authenticated: false });
    setWorkspaceReady(false);
  }

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const notes = data.notes
      .filter((note) => `${note.title} ${note.content} ${note.tags.join(" ")}`.toLowerCase().includes(normalized))
      .map((item) => ({ type: "Note", title: item.title, detail: item.tags.join(", "), target: "notes" as View }));
    const hosts = data.hosts
      .filter((host) => `${host.name} ${host.address} ${host.os} ${host.environment}`.toLowerCase().includes(normalized))
      .map((item) => ({ type: "Host", title: item.name, detail: item.address, target: "hosts" as View }));
    const projects = data.projects
      .filter((project) => `${project.name} ${project.stack} ${project.url} ${project.notes}`.toLowerCase().includes(normalized))
      .map((item) => ({ type: "Project", title: item.name, detail: item.stack, target: "hosts" as View }));
    const links = data.links
      .filter((link) => `${link.title} ${link.group} ${link.url} ${link.description}`.toLowerCase().includes(normalized))
      .map((item) => ({ type: "Link", title: item.title, detail: item.url, target: "links" as View }));

    return [...notes, ...hosts, ...projects, ...links].slice(0, 8);
  }, [data, query]);

  function updateData(next: Partial<WorkspaceData>) {
    setData((current) => ({ ...current, ...next }));
  }

  function createNote() {
    const timestamp = new Date().toISOString();
    const note: Note = {
      id: createId("note"),
      title: "Untitled Note",
      content: "## 新笔记\n\n开始记录。",
      tags: [],
      relatedHostIds: [],
      relatedProjectIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      pinned: false
    };
    updateData({ notes: [note, ...data.notes] });
    setSelectedNoteId(note.id);
    setView("notes");
  }

  function updateNote(noteId: string, patch: Partial<Note>) {
    updateData({
      notes: data.notes.map((note) =>
        note.id === noteId ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note
      )
    });
  }

  function deleteNote(noteId: string) {
    const nextNotes = data.notes.filter((note) => note.id !== noteId);
    updateData({ notes: nextNotes });
    setSelectedNoteId(nextNotes[0]?.id ?? "");
  }

  function addHost(host: Omit<Host, "id">) {
    updateData({ hosts: [{ ...host, id: createId("host") }, ...data.hosts] });
  }

  function updateHost(hostId: string, patch: Omit<Host, "id">) {
    updateData({ hosts: data.hosts.map((host) => (host.id === hostId ? { ...host, ...patch } : host)) });
  }

  function addProject(project: Omit<Project, "id">) {
    updateData({ projects: [{ ...project, id: createId("project") }, ...data.projects] });
  }

  function updateProject(projectId: string, patch: Omit<Project, "id">) {
    updateData({
      projects: data.projects.map((project) => (project.id === projectId ? { ...project, ...patch } : project))
    });
  }

  function addLink(link: Omit<LinkItem, "id">) {
    updateData({ links: [{ ...link, id: createId("link") }, ...data.links] });
  }

  function updateLink(linkId: string, patch: Omit<LinkItem, "id">) {
    updateData({ links: data.links.map((link) => (link.id === linkId ? { ...link, ...patch } : link)) });
  }

  function removeItem(collection: keyof WorkspaceData, id: string) {
    updateData({ [collection]: data[collection].filter((item) => item.id !== id) } as Partial<WorkspaceData>);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `personal-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (isWorkspaceData(parsed)) {
          setData(parsed);
          setSelectedNoteId(parsed.notes[0]?.id ?? "");
        } else {
          window.alert("导入失败：JSON 结构不是 personal-workspace 数据。");
        }
      } catch {
        window.alert("导入失败：无法解析 JSON 文件。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (!authChecked) {
    return <FullPageMessage title="Checking session" detail="Connecting to the server." />;
  }

  if (!auth.authenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (!workspaceReady) {
    return <FullPageMessage title="Loading workspace" detail="Reading synchronized data from the server database." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 transition dark:bg-slate-950 dark:text-slate-50">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Database size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold">Personal Workspace</p>
            <p className="text-xs text-slate-500">Notes / Hosts / Links</p>
          </div>
        </div>
        <nav className="space-y-1">
          {views.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${item.id === view ? "nav-item-active" : ""}`} onClick={() => setView(item.id)}>
                <Icon size={18} />
                <span className="flex-1 text-left">{item.label}</span>
                <span className="text-[11px] text-slate-400">{item.sub}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto lg:hidden">
              {views.map((item) => (
                <button key={item.id} className={`mobile-tab ${item.id === view ? "mobile-tab-active" : ""}`} onClick={() => setView(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Workspace</p>
              <h1 className="text-xl font-semibold">{views.find((item) => item.id === view)?.label}</h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-80">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input className="field pl-10" placeholder="Search notes, hosts, projects, links" value={query} onChange={(event) => setQuery(event.target.value)} />
                {searchResults.length > 0 && (
                  <div className="absolute right-0 top-11 z-30 max-h-80 w-full overflow-auto rounded border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {searchResults.map((item, index) => (
                      <button
                        key={`${item.type}-${item.title}-${index}`}
                        className="w-full rounded px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => {
                          setView(item.target);
                          setQuery("");
                        }}
                      >
                        <p className="text-xs font-semibold text-slate-500">{item.type}</p>
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-slate-500">{item.detail}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="切换主题">
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <span className={`rounded px-2 py-1 text-xs font-semibold ${saveState === "error" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                {saveState === "saving" ? "Saving" : saveState === "error" ? "Save error" : "Synced"}
              </span>
              <button className="secondary-button" onClick={handleLogout}>
                Logout
              </button>
              <button className="primary-button" onClick={createNote}>
                <Plus size={18} />
                新建笔记
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6">
          {view === "dashboard" && (
            <Dashboard
              data={data}
              setView={setView}
              setSelectedNoteId={setSelectedNoteId}
              setFocusHostId={setFocusHostId}
              setFocusProjectId={setFocusProjectId}
            />
          )}
          {view === "notes" && (
            <NotesView data={data} selectedNote={selectedNote} setSelectedNoteId={setSelectedNoteId} updateNote={updateNote} deleteNote={deleteNote} />
          )}
          {(view === "hosts" || view === "projects") && (
            <HostsView
              data={data}
              addHost={addHost}
              updateHost={updateHost}
              removeHost={(id) => removeItem("hosts", id)}
              addProject={addProject}
              updateProject={updateProject}
              removeProject={(id) => removeItem("projects", id)}
              focusHostId={focusHostId}
              focusProjectId={focusProjectId}
              clearFocus={() => {
                setFocusHostId("");
                setFocusProjectId("");
              }}
              openProjectReadme={(project) => {
                const key = project.name.split(/[ /]/)[0].toLowerCase();
                const relatedNote = data.notes.find((note) => `${note.title} ${note.content}`.toLowerCase().includes(key));
                if (relatedNote) {
                  setSelectedNoteId(relatedNote.id);
                  setView("notes");
                  return;
                }
                if (project.repoUrl) {
                  window.open(`${project.repoUrl.replace(/\/$/, "")}/blob/main/README.md`, "_blank", "noreferrer");
                }
              }}
            />
          )}
          {view === "links" && <LinksView data={data} addLink={addLink} updateLink={updateLink} removeLink={(id) => removeItem("links", id)} />}
          {view === "settings" && <SettingsView data={data} exportData={exportData} importData={importData} />}
        </main>
      </div>
    </div>
  );
}

function Dashboard({
  data,
  setView,
  setSelectedNoteId,
  setFocusHostId,
  setFocusProjectId
}: {
  data: WorkspaceData;
  setView: (view: View) => void;
  setSelectedNoteId: (id: string) => void;
  setFocusHostId: (id: string) => void;
  setFocusProjectId: (id: string) => void;
}) {
  const onlineHosts = data.hosts.filter((host) => host.status === "online").length;
  const pinnedNotes = data.notes.filter((note) => note.pinned).slice(0, 3);
  const recentNotes = [...data.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const pinnedLinks = data.links.filter((link) => link.pinned).slice(0, 4);

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={FileText} label="Notes" value={data.notes.length} detail={`${pinnedNotes.length} pinned`} />
        <Metric icon={Server} label="Hosts" value={data.hosts.length} detail={`${onlineHosts} online`} />
        <Metric icon={AppWindow} label="Projects" value={data.projects.length} detail="tracked services" />
        <Metric icon={LinkIcon} label="Links" value={data.links.length} detail="quick access" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="最近笔记" action="查看 Notes" onAction={() => setView("notes")}>
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <button
                key={note.id}
                className="row-card w-full text-left"
                onClick={() => {
                  setSelectedNoteId(note.id);
                  setView("notes");
                }}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{note.title}</p>
                  <p className="line-clamp-1 text-sm text-slate-500">{note.content.replace(/[#*_`]/g, "")}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{new Date(note.updatedAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="主机状态" action="查看 Hosts" onAction={() => setView("hosts")}>
          <div className="space-y-3">
            {data.hosts.map((host) => (
              <button
                key={host.id}
                className="row-card w-full text-left"
                onClick={() => {
                  setFocusHostId(host.id);
                  setView("hosts");
                }}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{host.name}</p>
                  <p className="truncate text-sm text-slate-500">{host.address}</p>
                </div>
                <StatusPill status={host.status} />
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="项目入口" action="查看 Assets" onAction={() => setView("hosts")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.projects.slice(0, 4).map((project) => (
              <button
                key={project.id}
                className="text-left"
                onClick={() => {
                  setFocusProjectId(project.id);
                  setFocusHostId(project.hostId);
                  setView("hosts");
                }}
              >
                <ProjectTile project={project} host={data.hosts.find((host) => host.id === project.hostId)} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Pinned Links" action="查看 Links" onAction={() => setView("links")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinnedLinks.map((link) => (
              <ExternalAnchor key={link.id} href={link.url} title={link.title} description={link.description || link.group} />
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

type NoteTreeNode = {
  note: Note;
  children: NoteTreeNode[];
};

function buildNoteTree(notes: Note[]): NoteTreeNode[] {
  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const nodes = new Map(sorted.map((note) => [note.id, { note, children: [] as NoteTreeNode[] }]));
  const roots: NoteTreeNode[] = [];

  sorted.forEach((note) => {
    const node = nodes.get(note.id);
    if (!node) return;
    const parent = note.parentId ? nodes.get(note.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function isNoteDescendant(notes: Note[], candidateId: string | undefined, parentId: string): boolean {
  if (!candidateId) return false;
  const candidate = notes.find((note) => note.id === candidateId);
  if (!candidate?.parentId) return false;
  if (candidate.parentId === parentId) return true;
  return isNoteDescendant(notes, candidate.parentId, parentId);
}

function NotesView({
  data,
  selectedNote,
  setSelectedNoteId,
  updateNote,
  deleteNote
}: {
  data: WorkspaceData;
  selectedNote?: Note;
  setSelectedNoteId: (id: string) => void;
  updateNote: (noteId: string, patch: Partial<Note>) => void;
  deleteNote: (noteId: string) => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [draggedNoteId, setDraggedNoteId] = useState("");
  const allTags = useMemo(() => Array.from(new Set(data.notes.flatMap((note) => note.tags))).sort(), [data.notes]);
  const filteredNotes = useMemo(() => {
    if (selectedTags.length === 0) return data.notes;
    return data.notes.filter((note) => selectedTags.every((tag) => note.tags.includes(tag)));
  }, [data.notes, selectedTags]);
  const noteTree = useMemo(() => buildNoteTree(filteredNotes), [filteredNotes]);

  if (!selectedNote) return <EmptyState title="还没有笔记" detail="点击右上角新建笔记开始记录。" />;
  const activeNote = selectedNote;

  function applyMarkdown(prefix: string, suffix = "", placeholder = "text") {
    const textarea = document.getElementById("note-editor") as HTMLTextAreaElement | null;
    const content = activeNote.content;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || placeholder;
    const next = `${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`;
    updateNote(activeNote.id, { content: next });
    window.setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function moveNote(noteId: string, parentId?: string) {
    if (noteId === parentId || isNoteDescendant(data.notes, parentId, noteId)) return;
    updateNote(noteId, { parentId });
  }

  function renderTree(nodes: NoteTreeNode[], depth = 0): React.ReactNode {
    return nodes.map((node) => {
      const note = node.note;
      return (
        <div key={note.id}>
          <button
            draggable
            onDragStart={() => setDraggedNoteId(note.id)}
            onDragEnd={() => setDraggedNoteId("")}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedNoteId) moveNote(draggedNoteId, note.id);
            }}
            className={`note-tab ${note.id === activeNote.id ? "note-tab-active" : ""}`}
            style={{ paddingLeft: `${12 + depth * 18}px` }}
            onClick={() => setSelectedNoteId(note.id)}
          >
            <span className="flex items-center gap-2">
              {note.pinned && <Star size={14} className="fill-current text-amber-500" />}
              <span className="truncate">{note.title}</span>
            </span>
            <span className="flex flex-wrap gap-1 text-xs text-slate-500">
              {note.tags.length > 0 ? note.tags.map((tag) => <span key={tag}>#{tag}</span>) : <span>no tag</span>}
            </span>
          </button>
          {node.children.length > 0 && <div className="mt-1 space-y-1">{renderTree(node.children, depth + 1)}</div>}
        </div>
      );
    });
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="panel p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-semibold">Notes</h2>
          <span className="text-xs text-slate-500">{filteredNotes.length} / {data.notes.length}</span>
        </div>
        {allTags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 px-1">
            {allTags.map((tag) => (
              <button key={tag} className={`tag-chip ${selectedTags.includes(tag) ? "tag-chip-active" : ""}`} onClick={() => toggleTag(tag)}>
                #{tag}
              </button>
            ))}
            {selectedTags.length > 0 && <button className="tag-chip" onClick={() => setSelectedTags([])}>清空</button>}
          </div>
        )}
        <div
          className="mb-2 rounded border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedNoteId) moveNote(draggedNoteId);
          }}
        >
          拖到这里变成顶层笔记
        </div>
        <div className="space-y-2">{renderTree(noteTree)}</div>
      </div>

      <div className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="field flex-1 text-lg font-semibold" value={selectedNote.title} onChange={(event) => updateNote(selectedNote.id, { title: event.target.value })} />
          <button className="icon-button" title="置顶" onClick={() => updateNote(selectedNote.id, { pinned: !selectedNote.pinned })}>
            <Star size={18} className={selectedNote.pinned ? "fill-current text-amber-500" : ""} />
          </button>
          <button className="danger-button" title="删除" onClick={() => deleteNote(selectedNote.id)}>
            <Trash2 size={18} />
          </button>
        </div>

        <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
          <input
            className="field mb-2"
            placeholder="多个标签用逗号分隔，例如 xsy_website, production, node"
            value={selectedNote.tags.join(", ")}
            onChange={(event) =>
              updateNote(selectedNote.id, {
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
              })
            }
          />
          <div className="flex flex-wrap gap-2">
            {selectedNote.tags.map((tag) => (
              <span key={tag} className="tag-chip tag-chip-active">#{tag}</span>
            ))}
          </div>
        </div>

        <MarkdownToolbar onApply={applyMarkdown} />
        <textarea
          id="note-editor"
          className="note-canvas"
          value={selectedNote.content}
          onChange={(event) => updateNote(selectedNote.id, { content: event.target.value })}
        />
      </div>
    </section>
  );
}
function HostsView({
  data,
  addHost,
  updateHost,
  removeHost,
  addProject,
  updateProject,
  removeProject,
  focusHostId,
  focusProjectId,
  clearFocus,
  openProjectReadme
}: {
  data: WorkspaceData;
  addHost: (host: Omit<Host, "id">) => void;
  updateHost: (hostId: string, patch: Omit<Host, "id">) => void;
  removeHost: (id: string) => void;
  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (projectId: string, patch: Omit<Project, "id">) => void;
  removeProject: (id: string) => void;
  focusHostId: string;
  focusProjectId: string;
  clearFocus: () => void;
  openProjectReadme: (project: Project) => void;
}) {
  const [draftHost, setDraftHost] = useState(blankHost);
  const [draftProject, setDraftProject] = useState({ ...blankProject, hostId: data.hosts[0]?.id ?? "" });
  const [addMode, setAddMode] = useState<"host" | "project" | null>(null);
  const [expandedHostId, setExpandedHostId] = useState(data.hosts[0]?.id ?? "");
  const [expandedProjectId, setExpandedProjectId] = useState("");
  const [editingHostId, setEditingHostId] = useState("");
  const [editingProjectId, setEditingProjectId] = useState("");
  const [editingHost, setEditingHost] = useState<Omit<Host, "id">>(blankHost);
  const [editingProject, setEditingProject] = useState<Omit<Project, "id">>(blankProject);

  useEffect(() => {
    if (!focusHostId && !focusProjectId) return;
    const focusedProject = focusProjectId ? data.projects.find((project) => project.id === focusProjectId) : undefined;
    setExpandedHostId(focusHostId || focusedProject?.hostId || "");
    setExpandedProjectId(focusProjectId);
    clearFocus();
  }, [focusHostId, focusProjectId, data.projects, clearFocus]);

  function submitHost(event: FormEvent) {
    event.preventDefault();
    if (!draftHost.name.trim()) return;
    addHost(draftHost);
    setDraftHost(blankHost);
    setAddMode(null);
  }

  function submitProject(event: FormEvent) {
    event.preventDefault();
    if (!draftProject.name.trim()) return;
    addProject(draftProject);
    setDraftProject({ ...blankProject, hostId: data.hosts[0]?.id ?? "" });
    setAddMode(null);
  }

  function startHostEdit(host: Host) {
    setExpandedHostId(host.id);
    setEditingHostId(host.id);
    setEditingHost(stripId(host));
  }

  function startProjectEdit(project: Project) {
    setExpandedProjectId(project.id);
    setEditingProjectId(project.id);
    setEditingProject(stripId(project));
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-slate-500">主机和项目在一个画面中管理。点击卡片展开详情，项目会挂在所属主机下方。</p>
        <button className="secondary-button w-fit" onClick={() => setAddMode("project")}>
          <Plus size={16} />
          新增项目
        </button>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        {data.hosts.map((host) => {
          const hostProjects = data.projects.filter((project) => project.hostId === host.id);
          const isExpanded = expandedHostId === host.id;
          const isEditing = editingHostId === host.id;
          const hostDetails = getHostDetailPairs(host);
          return (
            <div key={host.id} className={`asset-card ${isExpanded ? "asset-card-open" : ""}`}>
              {isEditing ? (
                <HostForm
                  title="编辑主机 Host"
                  value={editingHost}
                  onChange={setEditingHost}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!editingHost.name.trim()) return;
                    updateHost(host.id, editingHost);
                    setEditingHostId("");
                  }}
                  submitLabel="保存"
                  onCancel={() => setEditingHostId("")}
                />
              ) : (
                <>
                  <button className="w-full text-left" onClick={() => setExpandedHostId(isExpanded ? "" : host.id)}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">{host.name}</h3>
                        <p className="truncate text-sm text-slate-500">{host.address || "No address"}</p>
                      </div>
                      <StatusPill status={host.status} />
                    </div>
                    <InfoGrid items={[["系统", host.os || "-"], ["环境", host.environment || "-"], ["SSH", host.sshPort || "-"], ["项目", String(hostProjects.length)]]} />
                  </button>

                  {isExpanded && (
                    <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <KeyValueGrid items={hostDetails} />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button className="secondary-button" onClick={() => startHostEdit(host)}>
                          <Edit3 size={16} />
                          编辑
                        </button>
                        <button className="text-button text-rose-600" onClick={() => removeHost(host.id)}>
                          <Trash2 size={16} />
                          删除
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="asset-project-list">
                    {hostProjects.map((project) => {
                      const projectExpanded = expandedProjectId === project.id;
                      const projectEditing = editingProjectId === project.id;
                      return (
                        <div key={project.id} className="asset-project-row">
                          <span className="asset-project-line" />
                          <div className="asset-project-card">
                            {projectEditing ? (
                              <ProjectForm
                                title="编辑项目 Project"
                                value={editingProject}
                                hosts={data.hosts}
                                onChange={setEditingProject}
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  if (!editingProject.name.trim()) return;
                                  updateProject(project.id, editingProject);
                                  setEditingProjectId("");
                                }}
                                submitLabel="保存"
                                onCancel={() => setEditingProjectId("")}
                              />
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <button className="min-w-0 flex-1 text-left" onClick={() => openProjectReadme(project)}>
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold">{project.name}</p>
                                      <p className="truncate text-sm text-slate-500">
                                        {project.stack || "No stack"} {project.port ? `/ ${project.port}` : ""}
                                      </p>
                                    </div>
                                  </button>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      type="button"
                                      className="rounded border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300"
                                      onClick={() => setExpandedProjectId(projectExpanded ? "" : project.id)}
                                    >
                                      详情
                                    </button>
                                    <StatusPill status={project.status} />
                                  </div>
                                </div>
                                {projectExpanded && (
                                  <div className="mt-3">
                                    <InfoGrid items={[["端口", project.port || "-"], ["URL", project.url || "-"], ["后台", project.adminUrl || "-"], ["部署", project.deployPath || "-"]]} />
                                    {project.notes && <p className="mt-3 text-sm text-slate-500">{project.notes}</p>}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {project.url && <SmallLink href={project.url} label="打开 URL" />}
                                      {project.adminUrl && <SmallLink href={project.adminUrl} label="后台 Admin" />}
                                      {project.repoUrl && <SmallLink href={project.repoUrl} label="Repo" />}
                                      <button className="secondary-button" onClick={() => startProjectEdit(project)}>
                                        <Edit3 size={16} />
                                        编辑
                                      </button>
                                      <button className="text-button text-rose-600" onClick={() => removeProject(project.id)}>
                                        <Trash2 size={16} />
                                        删除
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {hostProjects.length === 0 && (
                      <button
                        className="ml-6 mt-3 rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700"
                        onClick={() => {
                          setDraftProject({ ...blankProject, hostId: host.id });
                          setAddMode("project");
                        }}
                      >
                        + 在此主机下添加项目
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <DraggableAddButton onAddHost={() => setAddMode("host")} onAddProject={() => setAddMode("project")} />

      {addMode && (
        <div className="asset-modal-backdrop" onClick={() => setAddMode(null)}>
          <div className="asset-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{addMode === "host" ? "Host" : "Project"}</p>
                <h2 className="text-lg font-semibold">{addMode === "host" ? "新增主机" : "新增项目"}</h2>
              </div>
              <button className="icon-button" onClick={() => setAddMode(null)} title="关闭">
                <X size={18} />
              </button>
            </div>
            {addMode === "host" ? (
              <HostForm title="" value={draftHost} onChange={setDraftHost} onSubmit={submitHost} submitLabel="添加主机" />
            ) : (
              <ProjectForm title="" value={draftProject} hosts={data.hosts} onChange={setDraftProject} onSubmit={submitProject} submitLabel="添加项目" />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DraggableAddButton({ onAddHost, onAddProject }: { onAddHost: () => void; onAddProject: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: Math.max(272, window.innerWidth - 92),
    y: Math.max(120, window.innerHeight - 92)
  }));
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragRef.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    dragRef.current.moved = true;
    const nextX = Math.min(Math.max(12, event.clientX - dragRef.current.dx), window.innerWidth - 60);
    const nextY = Math.min(Math.max(76, event.clientY - dragRef.current.dy), window.innerHeight - 60);
    setPos({ x: nextX, y: nextY });
  }

  function handlePointerUp() {
    const moved = dragRef.current?.moved;
    dragRef.current = null;
    if (!moved) setOpen((current) => !current);
  }

  return (
    <div className="asset-fab-wrap" style={{ left: pos.x, top: pos.y }}>
      {open && (
        <div className="asset-fab-menu">
          <button
            onClick={() => {
              setOpen(false);
              onAddHost();
            }}
          >
            新增主机
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onAddProject();
            }}
          >
            新增项目
          </button>
        </div>
      )}
      <button className="asset-fab" title="拖动移动，点击新增" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <Plus size={22} />
      </button>
    </div>
  );
}

function getHostDetailPairs(host: Host) {
  const notes = host.notes || "";
  const read = (pattern: RegExp) => notes.match(pattern)?.[1]?.trim();
  const regionRaw = read(/Region:\s*([^/\n]+(?:\s*\/\s*rid=\d+)?)/i);
  const region = regionRaw?.includes("ap-shanghai") ? `上海 (${regionRaw})` : regionRaw;
  const pairs: Array<[string, string | undefined]> = [
    ["实例类型", host.name.toLowerCase().includes("lighthouse") ? "轻量应用服务器" : "云服务器 CVM"],
    ["公网IP(public ip)", host.address],
    ["私有IP(private ip)", read(/Private IP:\s*([^\n]+?)(?=\s+(?:CPU|Memory|Disk|Services|Ports|$))/i)],
    ["地区", region],
    ["实例ID", read(/(?:Instance ID|Console ID|Metadata ID):\s*([^\n]+?)(?=\s+(?:Region|Hostname|Public IP|$))/i)],
    ["主机名", read(/Hostname:\s*([^\n]+?)(?=\s+(?:Public IP|Private IP|CPU|$))/i)],
    ["系统", host.os],
    ["CPU", read(/CPU:\s*([^\n]+?)(?=\s+Memory|$)/i)],
    ["内存", read(/Memory:\s*([^\n]+?)(?=\s+Disk|$)/i)],
    ["磁盘", read(/Disk:\s*([^\n]+?)(?=\s+Services|$)/i)],
    ["服务", read(/Services(?: active)?:\s*([^\n]+?)(?=\s+Ports|$)/i)],
    ["端口", read(/Ports:\s*([^\n]+)/i)]
  ];
  return pairs.filter(([, value]) => value && value !== "-") as Array<[string, string]>;
}

function KeyValueGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-2 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-slate-800 dark:text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function ProjectsView({
  data,
  addProject,
  updateProject,
  removeProject
}: {
  data: WorkspaceData;
  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (projectId: string, patch: Omit<Project, "id">) => void;
  removeProject: (id: string) => void;
}) {
  const [draft, setDraft] = useState({ ...blankProject, hostId: data.hosts[0]?.id ?? "" });
  const [editingId, setEditingId] = useState("");
  const [editing, setEditing] = useState<Omit<Project, "id">>(blankProject);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    addProject(draft);
    setDraft({ ...blankProject, hostId: data.hosts[0]?.id ?? "" });
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setEditing(stripId(project));
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="panel p-4">
        <ProjectForm title="新增项目 Project" value={draft} hosts={data.hosts} onChange={setDraft} onSubmit={submit} submitLabel="添加项目" />
      </div>

      <div className="space-y-4">
        {data.projects.map((project) => {
          const isEditing = editingId === project.id;
          return (
            <div key={project.id} className="panel p-4">
              {isEditing ? (
                <ProjectForm
                  title="编辑 Project"
                  value={editing}
                  hosts={data.hosts}
                  onChange={setEditing}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!editing.name.trim()) return;
                    updateProject(project.id, editing);
                    setEditingId("");
                  }}
                  submitLabel="保存"
                  onCancel={() => setEditingId("")}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{project.name}</h3>
                      <p className="text-sm text-slate-500">
                        {data.hosts.find((host) => host.id === project.hostId)?.name || "No host"} / {project.stack || "No stack"}
                      </p>
                    </div>
                    <StatusPill status={project.status} />
                  </div>
                  <InfoGrid items={[["Port", project.port || "-"], ["URL", project.url || "-"], ["Admin", project.adminUrl || "-"], ["Deploy", project.deployPath || "-"]]} />
                  <p className="mt-3 text-sm text-slate-500">{project.notes}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.url && <SmallLink href={project.url} label="打开 URL" />}
                    {project.adminUrl && <SmallLink href={project.adminUrl} label="后台 Admin" />}
                    {project.repoUrl && <SmallLink href={project.repoUrl} label="Repo" />}
                    <button className="secondary-button" onClick={() => startEdit(project)}>
                      <Edit3 size={16} />
                      编辑
                    </button>
                    <button className="text-button text-rose-600" onClick={() => removeProject(project.id)}>
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LinksView({
  data,
  addLink,
  updateLink,
  removeLink
}: {
  data: WorkspaceData;
  addLink: (link: Omit<LinkItem, "id">) => void;
  updateLink: (linkId: string, patch: Omit<LinkItem, "id">) => void;
  removeLink: (id: string) => void;
}) {
  const [draft, setDraft] = useState(blankLink);
  const [editingId, setEditingId] = useState("");
  const [editing, setEditing] = useState<Omit<LinkItem, "id">>(blankLink);
  const grouped = useMemo(() => {
    return data.links.reduce<Record<string, LinkItem[]>>((groups, link) => {
      groups[link.group] = [...(groups[link.group] || []), link];
      return groups;
    }, {});
  }, [data.links]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.url.trim()) return;
    addLink(draft);
    setDraft(blankLink);
  }

  function startEdit(link: LinkItem) {
    setEditingId(link.id);
    setEditing(stripId(link));
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="panel p-4">
        <LinkForm title="新增链接 Link" value={draft} onChange={setDraft} onSubmit={submit} submitLabel="添加链接" />
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([group, links]) => (
          <Panel key={group} title={group}>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {links.map((link) => {
                const isEditing = editingId === link.id;
                return (
                  <div key={link.id} className="rounded border border-slate-200 p-4 dark:border-slate-800">
                    {isEditing ? (
                      <LinkForm
                        title="编辑 Link"
                        value={editing}
                        onChange={setEditing}
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!editing.title.trim() || !editing.url.trim()) return;
                          updateLink(link.id, editing);
                          setEditingId("");
                        }}
                        submitLabel="保存"
                        onCancel={() => setEditingId("")}
                      />
                    ) : (
                      <>
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">{link.title}</h3>
                            <p className="line-clamp-2 text-sm text-slate-500">{link.description || link.url}</p>
                          </div>
                          {link.pinned && <Star size={16} className="shrink-0 fill-current text-amber-500" />}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <SmallLink href={link.url} label="打开" />
                          <button className="secondary-button" onClick={() => startEdit(link)}>
                            <Edit3 size={16} />
                            编辑
                          </button>
                          <button className="text-button text-rose-600" onClick={() => removeLink(link.id)}>
                            <Trash2 size={16} />
                            删除
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function SettingsView({ data, exportData, importData }: { data: WorkspaceData; exportData: () => void; importData: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <Panel title="数据 Data">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">当前数据保存在浏览器 localStorage。导出 JSON 可作为备份，也方便后续迁移到数据库。</p>
          <div className="flex flex-wrap gap-2">
            <button className="primary-button" onClick={exportData}>
              <Download size={18} />
              导出 JSON
            </button>
            <label className="secondary-button cursor-pointer">
              <Upload size={18} />
              导入 JSON
              <input className="hidden" type="file" accept="application/json" onChange={importData} />
            </label>
          </div>
        </div>
      </Panel>
      <Panel title="当前规模">
        <InfoGrid items={[["Notes", String(data.notes.length)], ["Hosts", String(data.hosts.length)], ["Projects", String(data.projects.length)], ["Links", String(data.links.length)], ["Tags", String(data.tags.length)]]} />
      </Panel>
      <Panel title="安全提醒">
        <div className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
          <CircleHelp size={20} className="shrink-0 text-slate-400" />
          <p>第一版不保存明文密码、密钥或 Token。涉及服务器凭据时，只记录路径、用途和提示。</p>
        </div>
      </Panel>
    </section>
  );
}

function MarkdownToolbar({ onApply }: { onApply: (prefix: string, suffix?: string, placeholder?: string) => void }) {
  const tools = [
    { label: "H1", title: "大标题", prefix: "# ", placeholder: "大标题" },
    { label: "H2", title: "中标题", prefix: "## ", placeholder: "中标题" },
    { label: "H3", title: "小标题", prefix: "### ", placeholder: "小标题" },
    { label: "P", title: "正文", prefix: "", placeholder: "正文内容" },
    { label: "B", title: "加粗", prefix: "**", suffix: "**", placeholder: "加粗文字" },
    { label: "I", title: "斜体", prefix: "*", suffix: "*", placeholder: "斜体文字" },
    { label: "•", title: "圆点列表", prefix: "- ", placeholder: "列表项" },
    { label: "1.", title: "编号列表", prefix: "1. ", placeholder: "列表项" },
    { label: "`", title: "行内代码", prefix: "`", suffix: "`", placeholder: "code" },
    { label: "```", title: "代码块", prefix: "```\n", suffix: "\n```", placeholder: "code block" },
    { label: ">", title: "引用", prefix: "> ", placeholder: "引用内容" },
    { label: "Link", title: "链接", prefix: "[", suffix: "](https://)", placeholder: "链接文字" }
  ];

  return (
    <div className="mb-3 flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
      {tools.map((tool) => (
        <button
          key={tool.title}
          type="button"
          className="secondary-button h-8 px-2"
          title={tool.title}
          onClick={() => onApply(tool.prefix, tool.suffix, tool.placeholder)}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

function HostForm({
  title,
  value,
  onChange,
  onSubmit,
  submitLabel,
  onCancel
}: {
  title: string;
  value: Omit<Host, "id">;
  onChange: (value: Omit<Host, "id">) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <FormPanel title={title} onSubmit={onSubmit} submitLabel={submitLabel} onCancel={onCancel}>
      <Field label="Name" value={value.name} onChange={(next) => onChange({ ...value, name: next })} required />
      <Field label="Address / IP" value={value.address} onChange={(next) => onChange({ ...value, address: next })} />
      <Field label="OS" value={value.os} onChange={(next) => onChange({ ...value, os: next })} />
      <Field label="Environment" value={value.environment} onChange={(next) => onChange({ ...value, environment: next })} />
      <Field label="SSH Port" value={value.sshPort} onChange={(next) => onChange({ ...value, sshPort: next })} />
      <StatusSelect value={value.status} onChange={(status) => onChange({ ...value, status })} />
      <TextArea label="Notes" value={value.notes} onChange={(next) => onChange({ ...value, notes: next })} />
    </FormPanel>
  );
}

function ProjectForm({
  title,
  value,
  hosts,
  onChange,
  onSubmit,
  submitLabel,
  onCancel
}: {
  title: string;
  value: Omit<Project, "id">;
  hosts: Host[];
  onChange: (value: Omit<Project, "id">) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <FormPanel title={title} onSubmit={onSubmit} submitLabel={submitLabel} onCancel={onCancel}>
      <Field label="Name" value={value.name} onChange={(next) => onChange({ ...value, name: next })} required />
      <label className="label">
        Host
        <select className="field" value={value.hostId} onChange={(event) => onChange({ ...value, hostId: event.target.value })}>
          <option value="">未关联</option>
          {hosts.map((host) => (
            <option key={host.id} value={host.id}>
              {host.name}
            </option>
          ))}
        </select>
      </label>
      <Field label="Stack" value={value.stack} onChange={(next) => onChange({ ...value, stack: next })} />
      <Field label="Port" value={value.port} onChange={(next) => onChange({ ...value, port: next })} />
      <Field label="URL" value={value.url} onChange={(next) => onChange({ ...value, url: next })} />
      <Field label="Admin URL" value={value.adminUrl} onChange={(next) => onChange({ ...value, adminUrl: next })} />
      <Field label="Repo URL" value={value.repoUrl} onChange={(next) => onChange({ ...value, repoUrl: next })} />
      <Field label="Deploy Path" value={value.deployPath} onChange={(next) => onChange({ ...value, deployPath: next })} />
      <StatusSelect value={value.status} onChange={(status) => onChange({ ...value, status })} />
      <TextArea label="Notes" value={value.notes} onChange={(next) => onChange({ ...value, notes: next })} />
    </FormPanel>
  );
}

function LinkForm({
  title,
  value,
  onChange,
  onSubmit,
  submitLabel,
  onCancel
}: {
  title: string;
  value: Omit<LinkItem, "id">;
  onChange: (value: Omit<LinkItem, "id">) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <FormPanel title={title} onSubmit={onSubmit} submitLabel={submitLabel} onCancel={onCancel}>
      <Field label="Title" value={value.title} onChange={(next) => onChange({ ...value, title: next })} required />
      <Field label="URL" value={value.url} onChange={(next) => onChange({ ...value, url: next })} required />
      <Field label="Group" value={value.group} onChange={(next) => onChange({ ...value, group: next })} />
      <Field label="Icon" value={value.icon} onChange={(next) => onChange({ ...value, icon: next })} />
      <TextArea label="Description" value={value.description} onChange={(next) => onChange({ ...value, description: next })} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.pinned} onChange={(event) => onChange({ ...value, pinned: event.target.checked })} />
        Pinned
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.openInNewTab} onChange={(event) => onChange({ ...value, openInNewTab: event.target.checked })} />
        New tab
      </label>
    </FormPanel>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof FileText; label: string; value: number; detail: string }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action && (
          <button className="text-button" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function FormPanel({
  title,
  onSubmit,
  submitLabel,
  onCancel,
  children
}: {
  title: string;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
  children: React.ReactNode;
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <h2 className="font-semibold">{title}</h2>
      {children}
      <div className="flex gap-2">
        <button className="primary-button flex-1 justify-center" type="submit">
          {submitLabel === "保存" ? <Save size={18} /> : <Plus size={18} />}
          {submitLabel}
        </button>
        {onCancel && (
          <button className="secondary-button" type="button" onClick={onCancel}>
            <X size={18} />
            取消
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="label">
      {label}
      <input className="field" value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="label">
      {label}
      <textarea className="field min-h-24 resize-y" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function StatusSelect({ value, onChange }: { value: Status; onChange: (value: Status) => void }) {
  return (
    <label className="label">
      Status
      <select className="field" value={value} onChange={(event) => onChange(event.target.value as Status)}>
        <option value="online">online</option>
        <option value="offline">offline</option>
        <option value="unknown">unknown</option>
      </select>
    </label>
  );
}

function MultiSelect({
  label,
  values,
  options,
  onChange
}: {
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="label">
      {label}
      <select className="field min-h-28" multiple value={values} onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((option) => option.value))}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${statusMeta[status].className}`}>{statusMeta[status].label}</span>;
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded bg-slate-50 p-3 dark:bg-slate-950">
          <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProjectTile({ project, host }: { project: Project; host?: Host }) {
  return (
    <div className="rounded border border-slate-200 p-4 dark:border-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <Laptop size={18} className="text-slate-500" />
        <StatusPill status={project.status} />
      </div>
      <h3 className="font-semibold">{project.name}</h3>
      <p className="text-sm text-slate-500">{host?.name || "No host"}</p>
      <p className="mt-2 text-sm text-slate-500">{project.stack}</p>
    </div>
  );
}

function ExternalAnchor({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <a className="rounded border border-slate-200 p-4 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600" href={href} target="_blank" rel="noreferrer">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        <ExternalLink size={16} />
      </div>
      <p className="line-clamp-2 text-sm text-slate-500">{description}</p>
    </a>
  );
}

function SmallLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="secondary-button" href={href} target="_blank" rel="noreferrer">
      <ExternalLink size={16} />
      {label}
    </a>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel grid min-h-96 place-items-center p-6 text-center">
      <div>
        <CheckCircle2 className="mx-auto mb-3 text-slate-400" size={40} />
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onLogin(username, password);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <form className="panel w-full max-w-sm space-y-4 p-6" onSubmit={submit}>
        <div>
          <div className="mb-4 grid h-11 w-11 place-items-center rounded bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Database size={20} />
          </div>
          <h1 className="text-xl font-semibold">Personal Workspace</h1>
          <p className="mt-1 text-sm text-slate-500">登录后使用服务器数据库同步数据。</p>
        </div>
        <Field label="Username" value={username} onChange={setUsername} required />
        <label className="label">
          Password
          <input className="field" type="password" value={password} required onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        <button className="primary-button w-full justify-center" type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

function FullPageMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4 text-center text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="panel max-w-sm p-6">
        <Database className="mx-auto mb-3 text-slate-400" size={36} />
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function stripId<T extends { id: string }>(value: T): Omit<T, "id"> {
  const { id: _id, ...rest } = value;
  return rest;
}

export default App;



