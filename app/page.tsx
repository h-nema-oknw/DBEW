'use client';

import React, { useState, useEffect, useCallback, useRef, useId, useMemo } from 'react';

// Suppress ResizeObserver loop errors globally and immediately
if (typeof window !== 'undefined') {
  const isResizeObserverError = (msg: unknown) => {
    if (typeof msg !== 'string') return false;
    return (
      msg.includes('ResizeObserver') || 
      msg.includes('ResizeObserver loop limit exceeded') || 
      msg.includes('ResizeObserver loop completed with undelivered notifications') ||
      msg.includes('Script error.') ||
      msg === 'ResizeObserver loop completed with undelivered notifications.'
    );
  };

  const errorHandler = (e: ErrorEvent | PromiseRejectionEvent) => {
    const error = (e instanceof ErrorEvent) ? (e.error || e.message) : (e.reason);
    const message = typeof error === 'string' ? error : (error?.message || '');
    
    if (isResizeObserverError(message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      
      // Force hide Next.js overlays that might have popped up
      const overlaySelectors = [
        'nextjs-portal', 
        'nextjs-dev-overlay', 
        '[data-nextjs-dialog-overlay]',
        '.nextjs-container'
      ];
      overlaySelectors.forEach(s => {
        document.querySelectorAll(s).forEach(el => {
          (el as HTMLElement).style.setProperty('display', 'none', 'important');
          (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
          (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
        });
      });
      return true;
    }
  };

  window.addEventListener('error', errorHandler, true);
  window.addEventListener('unhandledrejection', errorHandler, true);
  
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (isResizeObserverError(message)) return true;
    if (originalOnError) return originalOnError(message, source, lineno, colno, error);
    return false;
  };
}

import Head from 'next/head';
import { 
  Database, 
  Download, 
  Upload, 
  Bookmark, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  FileJson,
  Play, 
  Code,
  X,
  ChevronRight,
  ChevronDown,
  Layout,
  Table as TableIcon,
  Workflow,
  Layers,
  Settings as SettingsIcon,
  Info,
  Search,
  ChevronUp,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Diagram from '@/components/Diagram';
import { Project, Table, Field, Relation, DBType, AppSettings, DBTypeOption, DBEnvironment } from '@/lib/types';
import { generateMarkdown, analyzeMarkdown, layoutTables, parseStructuredData } from '@/lib/ai';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { Connection, addEdge, Edge, Node, OnNodesChange } from '@xyflow/react';
import { Sparkles, LayoutGrid, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
});

const Mermaid = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const reactId = useId();
  const idRef = useRef(`mermaid-${reactId.replace(/:/g, '')}`);

  useEffect(() => {
    mermaid.render(idRef.current, chart)
      .then((res) => {
        setSvg(res.svg);
        setError(false);
      })
      .catch((e) => {
        console.error("Mermaid parsing error", e);
        setError(true);
      });
  }, [chart]);

  if (error) {
    return <div className="text-red-400 p-4 border border-red-500/30 rounded bg-red-500/10 text-xs text-center">Mermaid図の描画に失敗しました</div>;
  }

  return <div className="mermaid-wrapper flex justify-center py-6" dangerouslySetInnerHTML={{ __html: svg }} />;
};

const INITIAL_PROJECT: Project = {
  id: '1',
  name: '新規プロジェクト',
  dbName: 'new_database',
  description: '新しいデータベース設計プロジェクト。',
  dbType: 'Relational',
  language: 'SQL',
  context: '',
  constraints: '',
  tables: [],
  relations: [],
  createdAt: 1713760000000,
  updatedAt: 1713760000000,
};

const DEFAULT_SETTINGS: AppSettings = {
  initialView: 'design',
  dbTypes: [
    { id: 'rel', name: 'Relational (RDBMS)' },
    { id: 'doc', name: 'Document (NoSQL)' },
    { id: 'kv', name: 'Key-Value' },
    { id: 'graph', name: 'Graph' },
    { id: 'ts', name: 'Time Series' },
    { id: 'vec', name: 'Vector (AI/Search)' }
  ],
  dbEnvironments: [
    { 
      id: 'pg', name: 'PostgreSQL', version: '15', 
      defaultTypes: [
        { name: 'VARCHAR', defaultLength: '255' },
        { name: 'CHAR', defaultLength: '36' },
        { name: 'INTEGER', defaultLength: '' },
        { name: 'BIGINT', defaultLength: '' },
        { name: 'SERIAL', defaultLength: '' },
        { name: 'TEXT', defaultLength: '' },
        { name: 'TIMESTAMP', defaultLength: '' },
        { name: 'DATE', defaultLength: '' },
        { name: 'BOOLEAN', defaultLength: '' },
        { name: 'NUMERIC', defaultLength: '10,2' },
        { name: 'JSONB', defaultLength: '' },
        { name: 'UUID', defaultLength: '' }
      ] 
    },
    { 
      id: 'my', name: 'MySQL', version: '8.0', 
      defaultTypes: [
        { name: 'VARCHAR', defaultLength: '255' },
        { name: 'CHAR', defaultLength: '36' },
        { name: 'INT', defaultLength: '' },
        { name: 'BIGINT', defaultLength: '' },
        { name: 'TEXT', defaultLength: '' },
        { name: 'LONGTEXT', defaultLength: '' },
        { name: 'DATETIME', defaultLength: '' },
        { name: 'TIMESTAMP', defaultLength: '' },
        { name: 'DATE', defaultLength: '' },
        { name: 'TINYINT(1)', defaultLength: '' },
        { name: 'DECIMAL', defaultLength: '10,2' },
        { name: 'JSON', defaultLength: '' }
      ] 
    },
    { 
      id: 'ora', name: 'Oracle', version: '19c', 
      defaultTypes: [
        { name: 'VARCHAR2', defaultLength: '255' },
        { name: 'CHAR', defaultLength: '36' },
        { name: 'NUMBER', defaultLength: '' },
        { name: 'INTEGER', defaultLength: '' },
        { name: 'CLOB', defaultLength: '' },
        { name: 'DATE', defaultLength: '' },
        { name: 'TIMESTAMP', defaultLength: '' },
        { name: 'RAW', defaultLength: '16' },
        { name: 'BLOB', defaultLength: '' }
      ] 
    },
    { 
      id: 'mssql', name: 'SQL Server', version: '2022', 
      defaultTypes: [
        { name: 'NVARCHAR', defaultLength: '255' },
        { name: 'VARCHAR', defaultLength: '255' },
        { name: 'CHAR', defaultLength: '36' },
        { name: 'INT', defaultLength: '' },
        { name: 'BIGINT', defaultLength: '' },
        { name: 'TEXT', defaultLength: '' },
        { name: 'DATETIME2', defaultLength: '' },
        { name: 'DATE', defaultLength: '' },
        { name: 'BIT', defaultLength: '' },
        { name: 'DECIMAL', defaultLength: '10,2' },
        { name: 'UNIQUEIDENTIFIER', defaultLength: '' }
      ] 
    },
    { 
      id: 'sqlite', name: 'SQLite', version: '3', 
      defaultTypes: [
        { name: 'TEXT', defaultLength: '' },
        { name: 'INTEGER', defaultLength: '' },
        { name: 'REAL', defaultLength: '' },
        { name: 'BLOB', defaultLength: '' },
        { name: 'NUMERIC', defaultLength: '' }
      ] 
    },
    { 
      id: 'bq', name: 'BigQuery', version: 'Standard SQL', 
      defaultTypes: [
        { name: 'STRING', defaultLength: '' },
        { name: 'INT64', defaultLength: '' },
        { name: 'FLOAT64', defaultLength: '' },
        { name: 'BOOL', defaultLength: '' },
        { name: 'DATE', defaultLength: '' },
        { name: 'DATETIME', defaultLength: '' },
        { name: 'TIMESTAMP', defaultLength: '' },
        { name: 'JSON', defaultLength: '' },
        { name: 'ARRAY', defaultLength: '' },
        { name: 'STRUCT', defaultLength: '' }
      ] 
    }
  ],
  selectedEnvironmentId: 'pg',
  geminiApiKey: ''
};

import { TableListItem } from '@/components/TableListItem';
import { TableCard } from '@/components/TableCard';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('1');
  const [project, setProject] = useState<Project>(INITIAL_PROJECT);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [activeTab, setActiveTab] = useState<'design' | 'specification' | 'preview'>('design');
  const [leftSidebarTab, setLeftSidebarTab] = useState<'tables' | 'overview' | 'projects' | 'settings'>('tables');
  const [settingsTab, setSettingsTab] = useState<'initialView' | 'dbTypes' | 'dbEnvironments' | 'gemini'>('initialView');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [relationEditingField, setRelationEditingField] = useState<{ tableId: string, fieldId: string } | null>(null);
  const [newRelSourceFieldId, setNewRelSourceFieldId] = useState<string>('');
  const [newRelTargetTableId, setNewRelTargetTableId] = useState<string>('');
  const [newRelTargetFieldId, setNewRelTargetFieldId] = useState<string>('');
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append');
  const [importSource, setImportSource] = useState<'ai' | 'structured'>('ai');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showTableDeleteConfirmModal, setShowTableDeleteConfirmModal] = useState(false);
  const [confirmTableDeleteId, setConfirmTableDeleteId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchTriggerId, setSearchTriggerId] = useState<string | null>(null);

  const isAutoScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleSidebarTableSelect = useCallback((id: string) => {
    setSelectedTableId(id);
    if (activeTab === 'specification') {
      isAutoScrolling.current = true;
      const el = document.getElementById(`table-card-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Give time for smooth scroll to finish
        setTimeout(() => {
          isAutoScrolling.current = false;
        }, 800);
      } else {
        isAutoScrolling.current = false;
      }
    }
  }, [activeTab]);

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isAutoScrolling.current) return;
    
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    
    const target = e.currentTarget;
    scrollTimeout.current = setTimeout(() => {
      const containerRect = target.getBoundingClientRect();
      const cards = target.querySelectorAll('[id^="table-card-"]');
      
      let topCardId = null;
      let minDistance = Infinity;

      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const cardTopRelativeToContainer = rect.top - containerRect.top;
        // Check if card is visible near the top
        if (cardTopRelativeToContainer > -rect.height && cardTopRelativeToContainer < containerRect.height / 2) {
            const distance = Math.abs(cardTopRelativeToContainer);
            if (distance < minDistance) {
                minDistance = distance;
                topCardId = card.id.replace('table-card-', '');
            }
        }
      });

      if (topCardId && topCardId !== selectedTableId) {
        setSelectedTableId(topCardId);
      }
    }, 100);
  }, [selectedTableId]);

  const getSearchResults = useCallback((query: string, tables: Table[]) => {
    if (!query) return [];
    const q = query.toLowerCase();
    const results: {tableId: string}[] = [];
    tables.forEach(t => {
      let match = false;
      if ((t.name || '').toLowerCase().includes(q)) match = true;
      if ((t.description || '').toLowerCase().includes(q)) match = true;
      if (!match) {
         match = t.fields.some(f => 
           (f.name || '').toLowerCase().includes(q) || 
           (f.type || '').toLowerCase().includes(q) ||
           (f.notes || '').toLowerCase().includes(q)
         );
      }
      if (match) results.push({ tableId: t.id });
    });
    return results;
  }, []);

  const searchResults = useMemo(() => getSearchResults(searchQuery, project.tables), [searchQuery, project.tables, getSearchResults]);

  const focusResult = useCallback((results: {tableId: string}[], index: number) => {
    if (results.length === 0) return;
    const res = results[index];
    if (res) {
      setSelectedTableId(res.tableId);
      setSearchTriggerId(res.tableId); // Triggers pan in Diagram view
      
      // Scroll in Grid View
      if (activeTab === 'specification') {
         setTimeout(() => {
           document.getElementById(`table-card-${res.tableId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         }, 50);
      }
    }
  }, [activeTab]);

  const handleFindNext = () => {
    if (activeTab === 'preview' || searchResults.length === 0) {
      window.find(searchQuery, false, false, true, false, false, false);
      return;
    }
    const nextIdx = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIdx);
    focusResult(searchResults, nextIdx);
  };
  
  const handleFindPrev = () => {
    if (activeTab === 'preview' || searchResults.length === 0) {
      window.find(searchQuery, false, true, true, false, false, false);
      return;
    }
    const prevIdx = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIdx);
    focusResult(searchResults, prevIdx);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (importSource === 'ai' && !name.endsWith('.md')) {
      alert('Markdownファイル(.md)を選択してください');
      return;
    }
    if (importSource === 'structured' && !name.endsWith('.csv') && !name.endsWith('.json')) {
      alert('CSV(.csv) または JSON(.json) ファイルを選択してください');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportText(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const name = file.name.toLowerCase();
      const isValid = importSource === 'ai' 
        ? name.endsWith('.md') 
        : (name.endsWith('.csv') || name.endsWith('.json'));

      if (isValid) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setImportText(event.target?.result as string);
        };
        reader.readAsText(file);
        return;
      }
    }
    alert(importSource === 'ai' ? 'Markdownファイル(.md)を選択してください' : '対応するファイル(.csv, .json)を選択してください');
  };

  // Load from local storage and handle mounting
  useEffect(() => {
    // Initial mount logic
    const timer = setTimeout(() => {
      setMounted(true);
      const savedProjects = localStorage.getItem('schemaforge_projects');
      const savedActiveId = localStorage.getItem('schemaforge_active_project_id');
      const savedSettings = localStorage.getItem('schemaforge_settings');
      
      if (savedSettings) {
        try {
          const settingsParsed = JSON.parse(savedSettings);
          setSettings(settingsParsed);
          // Only auto-apply initial view if specifically coming from a fresh load
          setActiveTab(settingsParsed.initialView || 'design');
        } catch (e) {
          console.error('Failed to load settings', e);
        }
      }

      if (savedProjects) {
        try {
          const parsed = JSON.parse(savedProjects);
          if (parsed.length > 0) {
            setProjects(parsed);
            const activeId = savedActiveId || parsed[0].id;
            setCurrentProjectId(activeId);
            const activeProject = parsed.find((p: Project) => p.id === activeId) || parsed[0];
            setProject(activeProject);
          } else {
            setProjects([INITIAL_PROJECT]);
            setProject(INITIAL_PROJECT);
            setCurrentProjectId('1');
          }
        } catch (e) {
          console.error('Failed to load projects', e);
          setProjects([INITIAL_PROJECT]);
        }
      } else {
        setProjects([INITIAL_PROJECT]);
      }
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Persistent Projects & Settings Sync (Debounced to improve performance)
  useEffect(() => {
    if (!mounted) return;
    
    const syncTimer = setTimeout(() => {
      setProjects(prevProjects => {
        const index = prevProjects.findIndex(p => p.id === project.id);
        const updatedProjects = [...prevProjects];
        
        if (index === -1) {
          updatedProjects.push(project);
        } else if (prevProjects[index] !== project) {
          updatedProjects[index] = project;
        } else {
          // If no change to projects list, still need to sync current projects to localStorage
          localStorage.setItem('schemaforge_projects', JSON.stringify(prevProjects));
          localStorage.setItem('schemaforge_active_project_id', currentProjectId);
          localStorage.setItem('schemaforge_settings', JSON.stringify(settings));
          return prevProjects;
        }

        // Save the newly updated list
        localStorage.setItem('schemaforge_projects', JSON.stringify(updatedProjects));
        localStorage.setItem('schemaforge_active_project_id', currentProjectId);
        localStorage.setItem('schemaforge_settings', JSON.stringify(settings));
        return updatedProjects;
      });
    }, 1000);

    return () => clearTimeout(syncTimer);
  }, [project, currentProjectId, settings, mounted]); // Dependency on project (the active one)

  const switchProject = (id: string) => {
    const target = projects.find(p => p.id === id);
    if (target) {
      setProject(target);
      setCurrentProjectId(id);
      setSelectedTableId(null);
      // Apply initial view setting
      setActiveTab(settings.initialView);
    }
  };

  const createNewProject = useCallback(() => {
    const newId = crypto.randomUUID();
    const now = Date.now();
    const newProject: Project = {
      ...INITIAL_PROJECT,
      id: newId,
      name: `新規プロジェクト ${projects.length + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    setProjects(prev => [...prev, newProject]);
    setProject(newProject);
    setCurrentProjectId(newId);
    setLeftSidebarTab('overview');
    setSelectedTableId(null);
  }, [projects.length]);

  const deleteProject = useCallback((id: string) => {
    const target = projects.find(p => p.id === id);
    if (!target) return;

    const newProjects = projects.filter(p => p.id !== id);
    
    if (newProjects.length === 0) {
      // 最後のプロジェクトを削除する場合、新しい空のプロジェクトを生成する
      const newId = crypto.randomUUID();
      const now = Date.now();
      const newDefaultProject: Project = {
        ...INITIAL_PROJECT,
        id: newId,
        name: '新規プロジェクト',
        createdAt: now,
        updatedAt: now,
      };
      setProjects([newDefaultProject]);
      setProject(newDefaultProject);
      setCurrentProjectId(newId);
    } else {
      setProjects(newProjects);
      if (currentProjectId === id) {
        const nextProject = newProjects[0];
        setProject(nextProject);
        setCurrentProjectId(nextProject.id);
      }
    }

    setConfirmDeleteId(null);
    setShowDeleteConfirmModal(false);
  }, [projects, currentProjectId]);

  const copyProject = useCallback((id: string) => {
    const target = projects.find(p => p.id === id);
    if (!target) return;

    const newId = crypto.randomUUID();
    const now = Date.now();
    const newProject: Project = {
      ...target,
      id: newId,
      name: `${target.name} (コピー)`,
      createdAt: now,
      updatedAt: now,
    };
    setProjects(prev => [...prev, newProject]);
    setProject(newProject);
    setCurrentProjectId(newId);
    setLeftSidebarTab('overview');
    setSelectedTableId(null);
  }, [projects]);

  const handleUpdateProject = useCallback((updates: Partial<Project>) => {
    setProject(prev => {
      const updated = { ...prev, ...updates, updatedAt: Date.now() };
      setProjects(prevProjects => {
        const index = prevProjects.findIndex(p => p.id === updated.id);
        if (index === -1) return [...prevProjects, updated];
        const newProjects = [...prevProjects];
        newProjects[index] = updated;
        return newProjects;
      });
      return updated;
    });
  }, []);

  const addTable = useCallback(() => {
    setProject(currentProject => {
      const defaultName = `テーブル_${currentProject.tables.length + 1}`;
      if (currentProject.tables.some(t => t.name.toLowerCase() === defaultName.toLowerCase())) {
        alert(`「${defaultName}」は既に存在します。別の名前に変更してから追加してください。`);
        return currentProject;
      }

      const newTable: Table = {
        id: crypto.randomUUID(),
        name: defaultName,
        description: 'テーブルの説明',
        fields: [
          {
            id: crypto.randomUUID(),
            name: 'id',
            type: 'INT',
            length: '',
            isNullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            notes: '自動インクリメント主キー'
          }
        ],
        position: { x: 100 + currentProject.tables.length * 50, y: 100 + currentProject.tables.length * 50 }
      };

      const newTables = [...currentProject.tables, newTable];
      const updated = { ...currentProject, tables: newTables, updatedAt: Date.now() };
      
      setProjects(prevProjects => {
        const index = prevProjects.findIndex(p => p.id === updated.id);
        if (index === -1) return [...prevProjects, updated];
        const newProjects = [...prevProjects];
        newProjects[index] = updated;
        return newProjects;
      });

      setSelectedTableId(newTable.id);
      setTimeout(() => {
        const element = document.getElementById(`table-card-${newTable.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      return updated;
    });
  }, []);

  const updateTable = useCallback((id: string, updates: Partial<Table>) => {
    setProject(currentProject => {
      const newTables = currentProject.tables.map(t => t.id === id ? { ...t, ...updates } : t);
      const updated = { ...currentProject, tables: newTables, updatedAt: Date.now() };
      return updated;
    });
  }, []);

  const validateTableName = useCallback((id: string, name: string, element: HTMLInputElement) => {
    if (!name) return true;
    const isDuplicate = project.tables.some(t => t.id !== id && t.name.toLowerCase() === name.trim().toLowerCase());
    if (isDuplicate) {
      alert(`テーブル名「${name}」は既に存在します。別の名前を指定してください。`);
      setTimeout(() => element.focus(), 0);
      return false;
    }
    return true;
  }, [project.tables]);

  const deleteTable = useCallback((id: string) => {
    setProject(currentProject => {
      const newTables = currentProject.tables.filter(t => t.id !== id);
      const newRelations = currentProject.relations.filter(r => r.sourceTableId !== id && r.targetTableId !== id);
      const updated = { ...currentProject, tables: newTables, relations: newRelations, updatedAt: Date.now() };

      setProjects(prevProjects => {
        const index = prevProjects.findIndex(p => p.id === updated.id);
        if (index === -1) return [...prevProjects, updated];
        const newProjects = [...prevProjects];
        newProjects[index] = updated;
        return newProjects;
      });

      setSelectedTableId(prevSelected => prevSelected === id ? null : prevSelected);
      return updated;
    });
    setConfirmTableDeleteId(null);
    setShowTableDeleteConfirmModal(false);
  }, []);

  const copyTable = useCallback((id: string) => {
    setProject(currentProject => {
      const targetIndex = currentProject.tables.findIndex(t => t.id === id);
      if (targetIndex === -1) return currentProject;
      const target = currentProject.tables[targetIndex];

      const newId = crypto.randomUUID();
      const newTable: Table = {
        ...target,
        id: newId,
        name: `${target.name}_copy`,
        fields: target.fields.map(f => ({ ...f, id: crypto.randomUUID() })),
        position: { x: target.position.x + 30, y: target.position.y + 30 }
      };

      const newTables = [...currentProject.tables];
      newTables.splice(targetIndex + 1, 0, newTable);
      const updated = { ...currentProject, tables: newTables, updatedAt: Date.now() };

      setProjects(prevProjects => {
        const index = prevProjects.findIndex(p => p.id === updated.id);
        if (index === -1) return [...prevProjects, updated];
        const newProjects = [...prevProjects];
        newProjects[index] = updated;
        return newProjects;
      });

      setSelectedTableId(newId);
      return updated;
    });
  }, []);

  const addField = useCallback((tableId: string) => {
    setProject(currentProject => {
      const table = currentProject.tables.find(t => t.id === tableId);
      if (!table) return currentProject;
      let defaultName = `カラム_${table.fields.length + 1}`;
      
      // Auto-increment default name to avoid immediate validation failure
      let counter = table.fields.length + 1;
      while (table.fields.some(f => f.name.toLowerCase() === defaultName.toLowerCase())) {
        counter++;
        defaultName = `カラム_${counter}`;
      }

      const newField: Field = {
        id: crypto.randomUUID(),
        name: defaultName,
        type: 'VARCHAR',
        length: '255',
        isNullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
        notes: ''
      };
      
      const newTables = currentProject.tables.map(t => 
        t.id === tableId ? { ...t, fields: [...t.fields, newField] } : t
      );
      const updated = { ...currentProject, tables: newTables, updatedAt: Date.now() };

      setProjects(prevProjects => {
        const index = prevProjects.findIndex(p => p.id === updated.id);
        if (index === -1) return [...prevProjects, updated];
        const newProjects = [...prevProjects];
        newProjects[index] = updated;
        return newProjects;
      });

      return updated;
    });
  }, []);

  const updateField = useCallback((tableId: string, fieldId: string, updates: Partial<Field>) => {
    setProject(currentProject => {
      const table = currentProject.tables.find(t => t.id === tableId);
      if (!table) return currentProject;

      const newTables = currentProject.tables.map(t => 
        t.id === tableId ? { 
          ...t, 
          fields: t.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f) 
        } : t
      );
      const updated = { ...currentProject, tables: newTables, updatedAt: Date.now() };
      return updated;
    });
  }, []);

  const validateFieldName = useCallback((tableId: string, fieldId: string, name: string, element: HTMLInputElement) => {
    if (!name) return true;
    const table = project.tables.find(t => t.id === tableId);
    if (!table) return true;
    const isDuplicate = table.fields.some(f => f.id !== fieldId && f.name.toLowerCase() === name.trim().toLowerCase());
    if (isDuplicate) {
      alert(`フィールド名「${name}」は既に同じテーブル内に存在します。`);
      setTimeout(() => element.focus(), 0);
      return false;
    }
    return true;
  }, [project.tables]);

  const deleteField = useCallback((tableId: string, fieldId: string) => {
    setProject(currentProject => {
      const table = currentProject.tables.find(t => t.id === tableId);
      if (!table) return currentProject;

      const newTables = currentProject.tables.map(t => 
        t.id === tableId ? { 
          ...t, 
          fields: t.fields.filter(f => f.id !== fieldId) 
        } : t
      );
      const updated = { ...currentProject, tables: newTables, updatedAt: Date.now() };

      setProjects(prevProjects => {
        const index = prevProjects.findIndex(p => p.id === updated.id);
        if (index === -1) return [...prevProjects, updated];
        const newProjects = [...prevProjects];
        newProjects[index] = updated;
        return newProjects;
      });

      return updated;
    });
  }, []);

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    setProject(currentProject => {
      let newTables = [...currentProject.tables];

      if (result.type === 'table') {
        const [reorderedTable] = newTables.splice(result.source.index, 1);
        newTables.splice(result.destination.index, 0, reorderedTable);
      } else if (result.type === 'field') {
        const tableId = result.source.droppableId.replace('fields-', '');
        newTables = newTables.map(t => {
          if (t.id === tableId) {
            const newFields = [...t.fields];
            const [reorderedField] = newFields.splice(result.source.index, 1);
            newFields.splice(result.destination.index, 0, reorderedField);
            return { ...t, fields: newFields };
          }
          return t;
        });
      }

      const updated = { ...currentProject, tables: newTables, updatedAt: Date.now() };
      
      setProjects(prevProjects => {
        const index = prevProjects.findIndex(p => p.id === updated.id);
        if (index === -1) return [...prevProjects, updated];
        const newProjects = [...prevProjects];
        newProjects[index] = updated;
        return newProjects;
      });

      return updated;
    });
  }, []);

  if (!mounted) {
    return <div className="h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  const handleAutoLayout = async () => {
    if (project.tables.length === 0) return;
    setIsAIAnalyzing(true);
    try {
      const positions = await layoutTables(project, settings.geminiApiKey);
      handleUpdateProject({
        tables: project.tables.map(t => ({
          ...t,
          position: positions[t.id] || t.position
        }))
      });
    } catch (e) {
      console.error('Auto layout failed', e);
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    
    // Extract field IDs from handle IDs if present (format: source-FIELDID or target-FIELDID)
    const sourceFieldId = connection.sourceHandle?.split('-')[1] || '';
    const targetFieldId = connection.targetHandle?.split('-')[1] || '';

    const newRelation: Relation = {
      id: crypto.randomUUID(),
      sourceTableId: connection.source,
      sourceFieldId: sourceFieldId,
      sourceHandleId: connection.sourceHandle || undefined,
      targetTableId: connection.target,
      targetFieldId: targetFieldId,
      targetHandleId: connection.targetHandle || undefined,
      type: 'one-to-many'
    };
    handleUpdateProject({ relations: [...project.relations, newRelation] });
  };

  const handleExport = () => {
    const md = generateMarkdown(project);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${project.name.replace(/\s+/g, '_')}_spec.md`);
  };

  const handleExportCSV = () => {
    const headers = ['Table', 'Description', 'Field', 'Type', 'Length', 'PK', 'Nullable', 'FK', 'Notes'];
    const lines = [headers.join(',')];
    project.tables.forEach(t => {
      if (t.fields.length === 0) {
        lines.push([t.name, t.description, '', '', '', '', '', '', ''].map(str => `"${str || ''}"`).join(','));
      } else {
        t.fields.forEach(f => {
          lines.push([
            t.name, t.description, f.name, f.type, f.length, 
            f.isPrimaryKey ? '1' : '', 
            f.isNullable ? '1' : '', 
            f.isForeignKey ? '1' : '', 
            f.notes
          ].map(str => `"${str || ''}"`).join(','));
        });
      }
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${project.name.replace(/\s+/g, '_')}.csv`);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(project.tables, null, 2)], { type: 'application/json' });
    saveAs(blob, `${project.name.replace(/\s+/g, '_')}_tables.json`);
  };

  const handleAIImport = async () => {
    if (!importText || !importText.trim()) return;

    if (importMode === 'replace' && project.tables.length > 0) {
      setShowOverwriteConfirm(true);
      return;
    }

    executeImport();
  };

  const executeImport = async () => {
    setIsAIAnalyzing(true);
    setShowOverwriteConfirm(false);
    try {
      let analyzed;
      if (importSource === 'structured') {
        analyzed = parseStructuredData(importText);
        if (!analyzed) {
          throw new Error('CSVまたはJSONのフォーマットが正しくありません');
        }
      } else {
        analyzed = await analyzeMarkdown(importText, settings.geminiApiKey);
      }
      
      // Calculate start position for new tables if appending
      let startX = 50;
      let startY = 100;
      
      if (importMode === 'append' && project.tables.length > 0) {
        // Find the rightmost position of existing tables
        const maxX = Math.max(...project.tables.map(t => t.position.x));
        startX = maxX + 300;
      }

      // Map analyzed data to full project structure
      const newTables: Table[] = (analyzed.tables || []).map((t: any, i: number) => {
        // Handle name duplicates when appending
        let finalName = t.name || 'Table';
        if (importMode === 'append') {
          let counter = 1;
          const originalName = finalName;
          while (project.tables.some(et => et.name.toLowerCase() === finalName.toLowerCase())) {
            finalName = `${originalName}_${counter}`;
            counter++;
          }
        }

        return {
          id: crypto.randomUUID(),
          name: finalName,
          description: t.description || '',
          fields: (t.fields || []).map((f: any) => ({
            id: crypto.randomUUID(),
            ...f
          })),
          position: { x: startX + i * 250, y: startY }
        };
      });

      // Basic relation mapping
      const newRelations: Relation[] = (analyzed.relations || []).map((r: any) => {
        const source = newTables.find(t => t.name === r.sourceTableName);
        const target = newTables.find(t => t.name === r.targetTableName);
        
        const sourceField = source?.fields.find(f => f.name === r.sourceFieldName);
        const targetField = target?.fields.find(f => f.name === r.targetFieldName);
        
        return {
          id: crypto.randomUUID(),
          sourceTableId: source?.id || '',
          targetTableId: target?.id || '',
          sourceFieldId: sourceField?.id || '',
          targetFieldId: targetField?.id || '',
          sourceHandleId: sourceField ? `source-${sourceField.id}-right` : undefined,
          targetHandleId: targetField ? `target-${targetField.id}` : undefined,
          type: (r.type as 'one-to-one' | 'one-to-many' | 'many-to-many') || 'one-to-many'
        };
      }).filter(r => r.sourceTableId && r.targetTableId);

      if (importMode === 'replace') {
        setProject({
          ...project,
          name: analyzed.name || project.name,
          description: analyzed.description || project.description,
          dbType: analyzed.dbType as DBType || project.dbType,
          language: analyzed.language || project.language,
          context: analyzed.context || project.context,
          tables: newTables,
          relations: newRelations,
          updatedAt: Date.now()
        });
      } else {
        // Append mode
        setProject({
          ...project,
          tables: [...project.tables, ...newTables],
          relations: [...project.relations, ...newRelations],
          updatedAt: Date.now()
        });
      }
      
      setShowImportModal(false);
      setImportText('');
      setImportMode('append'); // Reset to default
    } catch (e) {
      alert('AI解析に失敗しました。Markdownの形式を確認してください。');
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  const handleNodesChange: OnNodesChange = (changes) => {
    changes.forEach(change => {
      if (change.type === 'position' && change.position && change.id) {
        updateTable(change.id, { position: change.position });
      }
    });
  };

  const selectedTable = project.tables.find(t => t.id === selectedTableId);

  return (
    <div className="flex flex-col h-screen bg-[#0F172A] text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-[#1E293B] border-b border-slate-700 flex items-center justify-between px-6 shadow-xl z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-sky-500 rounded flex flex-col items-center justify-center text-white font-black tracking-tighter shadow-inner select-none pb-0.5">
            <span className="text-[11px] leading-[11px]">DB</span>
            <span className="text-[11px] leading-[11px]">EW</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">DBEW</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            disabled={!settings.geminiApiKey}
            onClick={() => {
              setImportMode('append');
              setImportSource('ai');
              setShowImportModal(true);
            }}
            className={`px-4 py-1.5 text-xs font-medium border rounded transition-colors ${!settings.geminiApiKey ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-50' : 'bg-slate-800 border-sky-500/50 text-sky-400 hover:bg-slate-700'}`}
            title={!settings.geminiApiKey ? 'GEMINI APIキーが未設定です' : ''}
          >
            AI解析(.md)
          </button>
          <button 
            onClick={() => {
              setImportMode('append');
              setImportSource('structured');
              setShowImportModal(true);
            }}
            className="px-4 py-1.5 text-xs font-medium bg-slate-800 border border-emerald-500/50 rounded hover:bg-slate-700 text-emerald-400 transition-colors"
          >
            定型インポート(.csv/.json)
          </button>
          <button 
            onClick={() => setShowExportModal(true)}
            className="px-4 py-1.5 text-xs font-medium bg-sky-600 rounded hover:bg-sky-500 text-white flex items-center gap-2 transition-all shadow-lg ml-2"
          >
            <Download size={14} /> エクスポート...
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-16 bg-[#0a0f1c] border-r border-slate-800 flex flex-col items-center py-6 gap-6 shrink-0 z-20">
          <button 
            onClick={() => setLeftSidebarTab('projects')}
            className={`p-3 rounded-xl transition-all duration-300 ${leftSidebarTab === 'projects' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800'}`}
            title="プロジェクト管理"
          >
            <Layers size={22} />
          </button>

          <button 
            onClick={() => setLeftSidebarTab('settings')}
            className={`p-3 rounded-xl transition-all duration-300 ${leftSidebarTab === 'settings' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800'}`}
            title="設定"
          >
            <SettingsIcon size={22} />
          </button>
        </div>

        {/* Project Sidebar Content */}
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
          className="bg-[#111827] border-r border-slate-800 flex flex-col shrink-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {leftSidebarTab === 'projects' ? (
              <div className="p-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">プロジェクト一覧</span>
                  <button 
                    onClick={createNewProject}
                    className="text-emerald-500 hover:text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded"
                  >
                    + 新規作成
                  </button>
                </div>

                <div className="space-y-2">
                  {projects.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        switchProject(p.id);
                        setLeftSidebarTab('overview');
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer group flex items-center justify-between ${currentProjectId === p.id ? 'bg-sky-500/10 border-sky-500/50 shadow-inner' : 'bg-slate-900/30 border-slate-800 hover:border-slate-700'}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-2 h-2 rounded-full ${currentProjectId === p.id ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-slate-700'}`} />
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-bold truncate ${currentProjectId === p.id ? 'text-sky-100' : 'text-slate-400'}`}>
                            {p.name || "名称未設定"}
                          </span>
                          <span className="text-[9px] text-slate-600 font-mono tracking-tighter">
                            {new Date(p.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button 
                          onClick={(e) => { e.stopPropagation(); copyProject(p.id); }}
                          className="p-1 text-slate-600 hover:text-sky-400 transition-all"
                          title="プロジェクトをコピー"
                        >
                          <Copy size={12} />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setConfirmDeleteId(p.id);
                            setShowDeleteConfirmModal(true);
                          }}
                          className="p-1 text-slate-600 hover:text-red-400 transition-all"
                          title="プロジェクトを削除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : leftSidebarTab === 'settings' ? (
              <div className="p-4 flex flex-col h-full bg-[#111827]">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">システム設定</span>
                </div>

                <div className="space-y-1">
                  {[
                    { id: 'initialView', label: '初期表示の選択', icon: Layout },
                    { id: 'dbTypes', label: 'DB種別マスタ', icon: Database },
                    { id: 'dbEnvironments', label: 'DB環境マスタ', icon: Workflow },
                    { id: 'gemini', label: 'Gemini API Key', icon: Sparkles },
                  ].map(menu => (
                    <button
                      key={menu.id}
                      onClick={() => setSettingsTab(menu.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${settingsTab === menu.id ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-lg shadow-sky-500/5' : 'text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-200'}`}
                    >
                      <menu.icon size={16} strokeWidth={settingsTab === menu.id ? 2.5 : 2} />
                      {menu.label}
                    </button>
                  ))}
                </div>

                <div className="mt-auto pt-6 border-t border-slate-800/50">
                  <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50">
                    <p className="text-[9px] text-slate-500 leading-relaxed text-center font-medium italic">
                      すべての設定はローカルストレージに自動保存されます。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Tabs for selected project */}
                <div className="flex border-b border-slate-800 bg-slate-900/50 p-1">
                  <button 
                    onClick={() => setLeftSidebarTab('overview')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 ${leftSidebarTab === 'overview' ? 'bg-slate-800 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Bookmark size={12} /> 概要
                  </button>
                  <button 
                    onClick={() => setLeftSidebarTab('tables')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 ${leftSidebarTab === 'tables' ? 'bg-slate-800 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <TableIcon size={12} /> テーブル
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {leftSidebarTab === 'tables' ? (
                    <div className="p-4 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4 group/title text-slate-500">
                        <span className="text-[9px] uppercase tracking-widest font-black">テーブル定義</span>
                        <button 
                          onClick={addTable}
                          className="text-sky-500 hover:text-sky-400 transition-colors"
                          title="新規テーブル追加"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="tables-list" type="table">
                          {(provided) => (
                            <ul 
                              className="space-y-1"
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                            >
                              {project.tables.map((table, index) => (
                                <TableListItem 
                                  key={table.id}
                                  table={table}
                                  index={index}
                                  isSelected={selectedTableId === table.id}
                                  onSelect={handleSidebarTableSelect}
                                  onUpdate={updateTable}
                                  onCopy={copyTable}
                                  onDeleteRequest={(id) => {
                                    setConfirmTableDeleteId(id);
                                    setShowTableDeleteConfirmModal(true);
                                  }}
                                />
                              ))}
                              {provided.placeholder}
                            </ul>
                          )}
                        </Droppable>
                      </DragDropContext>
                    </div>
                  ) : (
                    <div className="p-5 flex flex-col gap-6">
                      <div className="space-y-5">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">プロジェクト名</label>
                          <input 
                            type="text"
                            value={project.name || ""}
                            onChange={(e) => handleUpdateProject({ name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 text-slate-200 transition-all outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">DB種別</label>
                          <select 
                            value={project.dbType}
                            onChange={(e) => handleUpdateProject({ dbType: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 text-slate-200 appearance-none outline-none"
                          >
                            {settings.dbTypes.map(type => (
                              <option key={type.id} value={type.name}>{type.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">DB環境 / バージョン</label>
                          <select 
                            value={project.environmentId || ""}
                            onChange={(e) => {
                              const envId = e.target.value;
                              const env = settings.dbEnvironments.find(env => env.id === envId);
                              handleUpdateProject({ 
                                environmentId: envId,
                                language: env ? `${env.name} ${env.version}` : ""
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 text-slate-200 appearance-none outline-none"
                          >
                            <option value="">未指定</option>
                            {settings.dbEnvironments.map(env => (
                              <option key={env.id} value={env.id}>{env.name} ({env.version})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">データベース名</label>
                          <input 
                            type="text"
                            value={project.dbName || ""}
                            onChange={(e) => handleUpdateProject({ dbName: e.target.value })}
                            placeholder="例: production_v1"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 text-slate-200 outline-none"
                          />
                        </div>

                        <div className="pt-4 border-t border-slate-800 space-y-4">
                          <div className="space-y-1.5">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">コンテキスト</div>
                            <textarea 
                              value={project.context || ""}
                              onChange={(e) => handleUpdateProject({ context: e.target.value })}
                              className="w-full h-32 bg-slate-950 border border-slate-800 rounded p-3 text-[11px] text-slate-300 focus:ring-1 focus:ring-sky-500 outline-none placeholder:text-slate-500 italic resize-none leading-relaxed"
                              placeholder="システム要件や目的を入力..."
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">制約・ルール</div>
                            <textarea 
                              value={project.constraints || ""}
                              onChange={(e) => handleUpdateProject({ constraints: e.target.value })}
                              className="w-full h-32 bg-slate-950 border border-slate-800 rounded p-3 text-[11px] text-slate-300 focus:ring-1 focus:ring-sky-500 outline-none placeholder:text-slate-500 italic resize-none leading-relaxed"
                              placeholder="制約事項を入力してください..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.aside>
        <main className="flex-1 flex flex-col h-full bg-[#0a0f1c] overflow-hidden relative">
          
          {/* Chrome-like Search UI */}
          <div className="absolute top-2 right-6 z-[100]">
            {!isSearchOpen ? (
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md border border-slate-700/50 rounded-full p-2 text-slate-300 hover:text-sky-400 transition-all shadow-lg"
                title="文字列を検索 (Ctrl+F)"
              >
                <Search size={16} />
              </button>
            ) : (
              <div className="flex items-center bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 overflow-hidden text-sm h-10 ring-4 ring-black/5 transition-all">
                <Search size={14} className="ml-3 mr-2 text-slate-400 shrink-0" />
                <input 
                  ref={searchInputRef}
                  className="outline-none border-none bg-transparent w-[140px] py-2 font-medium text-slate-800 placeholder:text-slate-400" 
                  placeholder="ページ内を検索..." 
                  value={searchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchQuery(value);
                    setCurrentSearchIndex(0);
                    if (!value) {
                      setSearchTriggerId(null);
                    } else {
                      const results = getSearchResults(value, project.tables);
                      if (results.length > 0) {
                        focusResult(results, 0);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.shiftKey ? handleFindPrev() : handleFindNext();
                    } else if (e.key === 'Escape') {
                      setIsSearchOpen(false);
                      setSearchQuery("");
                    }
                  }}
                  autoFocus
                />
                <div className="text-[10px] text-slate-400 px-2 select-none shrink-0 font-medium whitespace-nowrap">
                  {activeTab === 'preview' ? '' : searchResults.length > 0 ? `${currentSearchIndex + 1} / ${searchResults.length}` : '0 / 0'}
                </div>
                <div className="flex items-center gap-1 px-2 border-l border-slate-200 h-full bg-slate-50 shrink-0">
                  <button onClick={handleFindPrev} className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="前へ (Shift+Enter)">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={handleFindNext} className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="次へ (Enter)">
                    <ChevronDown size={14} />
                  </button>
                  <div className="w-px h-4 bg-slate-300 mx-0.5"></div>
                  <button onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }} className="p-1 hover:bg-red-100 hover:text-red-500 rounded text-slate-500 transition-colors" title="閉じる (Esc)">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View Tabs */}
          {leftSidebarTab !== 'settings' && (
            <div className="bg-[#1E293B] border-b border-slate-700 px-4 h-12 flex items-end gap-1 shrink-0 z-10">
              {[
                { id: 'specification', icon: Layout, label: 'グリッドビュー' },
                { id: 'design', icon: Workflow, label: '図面ビュー' },
                { id: 'preview', icon: Code, label: '仕様書ビュー' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-all text-xs font-semibold uppercase tracking-wider ${activeTab === tab.id ? 'border-sky-500 text-sky-400 bg-sky-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {leftSidebarTab === 'settings' ? (
                <motion.div
                  key="settings-content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-full h-full p-12 overflow-y-auto bg-[#0a0f1c]"
                >
                  <div className="max-w-4xl mx-auto">
                    {settingsTab === 'initialView' && (
                      <div className="space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
                            <Layout size={20} />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-100">初期表示の選択</h2>
                            <p className="text-sm text-slate-500">プロジェクト選択時に最初に表示される画面を設定します。</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                          {[
                            { id: 'specification', label: 'グリッドビュー', desc: 'Excelライクな高速カラム編集' },
                            { id: 'design', label: '図面ビュー', desc: 'ER図による視覚的な設計' },
                            { id: 'preview', label: '仕様書ビュー', desc: 'Markdown形式の仕様書閲覧' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setSettings({...settings, initialView: opt.id as any})}
                              className={`p-6 rounded-2xl border-2 text-left transition-all group ${settings.initialView === opt.id ? 'border-sky-500 bg-sky-500/5' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'}`}
                            >
                              <div className={`w-3 h-3 rounded-full mb-4 ${settings.initialView === opt.id ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-slate-700'}`} />
                              <h3 className="font-bold text-slate-100 mb-2">{opt.label}</h3>
                              <p className="text-xs text-slate-500 leading-relaxed">{opt.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {settingsTab === 'dbTypes' && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
                              <Database size={20} />
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-slate-100">DB種別マスタ</h2>
                              <p className="text-sm text-slate-500">プロジェクトで選択可能なデータベースのアーキテクチャ種別を管理します。</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              if (confirm('DB種別マスタを初期設定にリセットしますか？')) {
                                setSettings({ ...settings, dbTypes: DEFAULT_SETTINGS.dbTypes });
                              }
                            }}
                            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-400 border border-slate-800 hover:border-sky-500/30 rounded-lg transition-all"
                          >
                            初期設定にリセット
                          </button>
                        </div>
                        
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
                          <div className="p-6 space-y-4">
                            {settings.dbTypes.map((type, idx) => (
                              <div key={type.id} className="flex gap-4 items-center bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                                <input 
                                  value={type.name}
                                  onChange={(e) => {
                                    const newTypes = [...settings.dbTypes];
                                    newTypes[idx].name = e.target.value;
                                    setSettings({...settings, dbTypes: newTypes});
                                  }}
                                  className="flex-1 bg-transparent border-none text-slate-200 font-bold focus:ring-0 text-sm"
                                />
                                <button 
                                  onClick={() => {
                                    const newTypes = settings.dbTypes.filter((_, i) => i !== idx);
                                    setSettings({...settings, dbTypes: newTypes});
                                  }}
                                  className="text-slate-600 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="bg-slate-900/60 p-4 border-t border-slate-800">
                            <button 
                              onClick={() => {
                                const newType: DBTypeOption = { id: crypto.randomUUID(), name: 'New Type' };
                                setSettings({...settings, dbTypes: [...settings.dbTypes, newType]});
                              }}
                              className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-sky-400 hover:text-sky-300 transition-colors"
                            >
                              <Plus size={16} /> 新しい種別を追加
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {settingsTab === 'dbEnvironments' && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
                              <Workflow size={20} />
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-slate-100">DB環境マスタ</h2>
                              <p className="text-sm text-slate-500">主要なデータベース製品とデフォルトの型定義を管理します。</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              if (confirm('DB環境マスタを初期設定にリセットしますか？（現在の追加内容は失われます）')) {
                                setSettings({ ...settings, dbEnvironments: DEFAULT_SETTINGS.dbEnvironments });
                              }
                            }}
                            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-400 border border-slate-800 hover:border-sky-500/30 rounded-lg transition-all"
                          >
                            初期設定にリセット
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          {settings.dbEnvironments.map((env, idx) => (
                            <div key={env.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-6 relative group">
                              <button 
                                onClick={() => {
                                  const newEnvs = settings.dbEnvironments.filter((_, i) => i !== idx);
                                  setSettings({...settings, dbEnvironments: newEnvs});
                                }}
                                className="absolute top-6 right-6 text-slate-700 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">DB Name</label>
                                  <input 
                                    value={env.name}
                                    onChange={(e) => {
                                      const newEnvs = [...settings.dbEnvironments];
                                      newEnvs[idx].name = e.target.value;
                                      setSettings({...settings, dbEnvironments: newEnvs});
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 outline-none focus:border-sky-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Version</label>
                                  <input 
                                    value={env.version}
                                    onChange={(e) => {
                                      const newEnvs = [...settings.dbEnvironments];
                                      newEnvs[idx].version = e.target.value;
                                      setSettings({...settings, dbEnvironments: newEnvs});
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 outline-none focus:border-sky-500"
                                  />
                                </div>
                              </div>

                              <div className="space-y-3">
                                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">デフォルトデータ型</label>
                                <div className="space-y-1 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
                                  {env.defaultTypes.map((type, tIdx) => (
                                    <div key={tIdx} className="flex gap-2 p-1.5 hover:bg-slate-900/50 rounded-lg group/type">
                                      <input 
                                        value={type.name}
                                        onChange={(e) => {
                                          const newEnvs = [...settings.dbEnvironments];
                                          newEnvs[idx].defaultTypes[tIdx].name = e.target.value;
                                          setSettings({...settings, dbEnvironments: newEnvs});
                                        }}
                                        className="flex-1 bg-transparent border-none text-xs text-slate-300 font-mono"
                                        placeholder="TYPE"
                                      />
                                      <input 
                                        value={type.defaultLength}
                                        onChange={(e) => {
                                          const newEnvs = [...settings.dbEnvironments];
                                          newEnvs[idx].defaultTypes[tIdx].defaultLength = e.target.value;
                                          setSettings({...settings, dbEnvironments: newEnvs});
                                        }}
                                        className="w-16 bg-slate-900/50 border border-slate-700/50 rounded px-2 text-[10px] text-slate-500 text-center"
                                        placeholder="LENGTH"
                                      />
                                      <button 
                                        onClick={() => {
                                          const newEnvs = [...settings.dbEnvironments];
                                          newEnvs[idx].defaultTypes = newEnvs[idx].defaultTypes.filter((_, i) => i !== tIdx);
                                          setSettings({...settings, dbEnvironments: newEnvs});
                                        }}
                                        className="text-slate-700 hover:text-red-400 opacity-0 group-hover/type:opacity-100"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ))}
                                  <button 
                                    onClick={() => {
                                      const newEnvs = [...settings.dbEnvironments];
                                      newEnvs[idx].defaultTypes.push({ name: 'NEW_TYPE', defaultLength: '' });
                                      setSettings({...settings, dbEnvironments: newEnvs});
                                    }}
                                    className="w-full py-2 text-[10px] text-slate-600 hover:text-sky-500 font-bold uppercase transition-colors"
                                  >
                                    + 型を追加
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newEnv: DBEnvironment = { 
                                id: crypto.randomUUID(), 
                                name: 'New Database', 
                                version: '1.0', 
                                defaultTypes: [{ name: 'VARCHAR', defaultLength: '255' }] 
                              };
                              setSettings({...settings, dbEnvironments: [...settings.dbEnvironments, newEnv]});
                            }}
                            className="h-full min-h-[200px] border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-600 hover:text-sky-500 hover:border-sky-500/50 transition-all bg-slate-900/20"
                          >
                            <Plus size={32} strokeWidth={1} />
                            <span className="text-sm font-bold uppercase tracking-widest">新しいDBを追加</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {settingsTab === 'gemini' && (
                      <div className="space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-100">Gemini API Key 設定</h2>
                            <p className="text-sm text-slate-500">Google AI Studioで取得したAPIキーを設定して、AIによる設計支援機能を有効にします。</p>
                          </div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 space-y-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">API Endpoint Key</label>
                              <a 
                                href="https://aistudio.google.com/app/apikey" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
                              >
                                キーを取得する <LayoutGrid size={10} />
                              </a>
                            </div>
                            <input 
                              type="password"
                              value={settings.geminiApiKey}
                              onChange={(e) => setSettings({...settings, geminiApiKey: e.target.value})}
                              placeholder="Enter your Gemini API key here..."
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-6 py-4 text-emerald-400 font-mono text-sm outline-none focus:border-amber-500/50 transition-colors shadow-inner"
                            />
                          </div>

                          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex gap-3">
                            <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-500/70 leading-relaxed">
                              入力したキーはブラウザのローカルストレージにのみ暗号化されずに保存されます。セキュリティのため、共有PCなどでの入力は控え、自分のみが利用する環境で設定してください。このキーは AI解析（Markdownインポート）および ER図の自動レイアウト機能で使用されます。
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : activeTab === 'design' && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="w-full h-full"
                >
                    <Diagram 
                      tables={project.tables}
                      relations={project.relations}
                      onNodesChange={handleNodesChange}
                      onEdgesChange={() => {}}
                      onConnect={onConnect}
                      onAddTable={addTable}
                      onAutoLayout={handleAutoLayout}
                      onUpdateTable={updateTable}
                      onAddField={addField}
                      onUpdateField={updateField}
                      onValidateTableName={validateTableName}
                      onValidateFieldName={validateFieldName}
                      onSelectTable={setSelectedTableId}
                      selectedTableId={selectedTableId}
                      searchTriggerId={searchTriggerId}
                    />
                </motion.div>
              )}

              {activeTab === 'specification' && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="p-8 h-full overflow-y-auto bg-[#0a0f1c]"
                  onScroll={handleGridScroll}
                >
                  <div className="max-w-5xl mx-auto space-y-8">
                    {project.tables.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4 border border-slate-800 rounded-lg bg-slate-900/20">
                        <TableIcon size={48} className="opacity-10" />
                        <p className="text-sm font-medium tracking-widest uppercase">スキーマ要素がありません</p>
                      </div>
                    ) : (
                      project.tables.map(table => (
                        <TableCard 
                          key={table.id}
                          table={table}
                          isSelected={selectedTableId === table.id}
                          environmentId={project.environmentId}
                          dbEnvironments={settings.dbEnvironments}
                          onSelect={setSelectedTableId}
                          onUpdateTable={updateTable}
                          onValidateTableName={validateTableName}
                          onCopyTable={copyTable}
                          onDeleteTableRequest={(id) => {
                            setConfirmTableDeleteId(id);
                            setShowTableDeleteConfirmModal(true);
                          }}
                          onAddField={addField}
                          onUpdateField={updateField}
                          onValidateFieldName={validateFieldName}
                          onDeleteField={deleteField}
                          onDragEnd={onDragEnd}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'preview' && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full bg-[#0a0f1c]"
                >
                  <div className="flex-1 overflow-y-auto p-12 shadow-inner">
                    <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 p-12 rounded shadow-2xl">
                      <div className="prose prose-invert max-w-none prose-headings:border-b prose-headings:pb-3 prose-headings:border-slate-800 prose-table:border prose-table:border-slate-800 prose-th:bg-slate-800 prose-th:p-3 prose-td:p-3 prose-p:text-slate-400">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({node, className, children, ...props}) {
                              const match = /language-(\w+)/.exec(className || '');
                              if (match && match[1] === 'mermaid') {
                                return <Mermaid chart={String(children).replace(/\n$/, '')} />;
                              }
                              return <code className={className} {...props}>{children}</code>;
                            }
                          }}
                        >
                          {generateMarkdown(project)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Right Sidebar: Properties */}
        <AnimatePresence>
          {selectedTable && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-slate-800 bg-[#111827] flex flex-col shrink-0 overflow-hidden"
            >
              <div className="p-5 flex flex-col h-full overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">テーブル詳細</div>
                  <button onClick={() => setSelectedTableId(null)} className="text-slate-600 hover:text-slate-400">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">テーブル物理名</label>
                    <input 
                      type="text"
                      value={selectedTable.name || ""}
                      onChange={(e) => updateTable(selectedTable.id, { name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-100 font-bold tracking-tight"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">説明・注釈</label>
                    <textarea 
                      value={selectedTable.description || ""}
                      onChange={(e) => updateTable(selectedTable.id, { description: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-xs h-24 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none text-slate-300 leading-relaxed"
                      placeholder="このテーブルの用途や役割..."
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Workflow size={14} className="text-sky-400" />
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">リレーション管理</h4>
                    </div>

                    <div className="space-y-3">
                      {project.relations.filter(r => r.sourceTableId === selectedTable.id || r.targetTableId === selectedTable.id).length === 0 ? (
                        <div className="text-[10px] text-slate-600 italic py-4 border border-dashed border-slate-800 rounded-lg bg-slate-900/30 text-center px-4 leading-relaxed">
                          有効なリレーションはありません
                        </div>
                      ) : (
                        project.relations.filter(r => r.sourceTableId === selectedTable.id || r.targetTableId === selectedTable.id).map(rel => {
                          const isSource = rel.sourceTableId === selectedTable.id;
                          const sTable = project.tables.find(t => t.id === rel.sourceTableId);
                          const tTable = project.tables.find(t => t.id === rel.targetTableId);
                          const sField = sTable?.fields.find(f => f.id === rel.sourceFieldId);
                          const tField = tTable?.fields.find(f => f.id === rel.targetFieldId);

                          return (
                            <div key={rel.id} className={`bg-slate-900 border ${isSource ? 'border-sky-800/30' : 'border-emerald-800/30'} p-3 rounded-lg space-y-3 shadow-inner`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                  <Workflow size={10} className={isSource ? 'text-sky-500' : 'text-emerald-500'} />
                                  {isSource ? '出力' : '入力'}
                                </div>
                                <button 
                                  onClick={() => handleUpdateProject({ relations: project.relations.filter(r => r.id !== rel.id) })}
                                  className="text-slate-600 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                  <span className="text-sky-400 truncate max-w-[80px]">{sTable?.name || '??'}.{sField?.name || '??'}</span>
                                  <ChevronRight size={10} className="text-slate-700" />
                                  <span className="text-emerald-400 truncate max-w-[80px] text-right">{tTable?.name || '??'}.{tField?.name || '??'}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <div className="h-[1px] flex-1 bg-slate-800" />
                                    <div className="text-[8px] text-slate-500 uppercase font-black px-2 py-0.5 rounded border border-slate-800 bg-slate-900">
                                        {rel.type === 'one-to-many' ? '1 : N' : rel.type === 'one-to-one' ? '1 : 1' : 'N : N'}
                                    </div>
                                    <div className="h-[1px] flex-1 bg-slate-800" />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="pt-4 space-y-3">
                        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest pl-1">新規リレーション追加</div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter pl-1">元カラム</label>
                            <select 
                              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-sky-500"
                              value={newRelSourceFieldId}
                              onChange={(e) => setNewRelSourceFieldId(e.target.value)}
                            >
                              <option value="" disabled>カラムを選択</option>
                              {selectedTable.fields.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter pl-1">先テーブル</label>
                            <select 
                              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-sky-500"
                              value={newRelTargetTableId}
                              onChange={(e) => {
                                const tId = e.target.value;
                                setNewRelTargetTableId(tId);
                                // Auto-select first field of target table
                                const targetT = project.tables.find(t => t.id === tId);
                                if (targetT && targetT.fields.length > 0) {
                                  setNewRelTargetFieldId(targetT.fields[0].id);
                                }
                              }}
                            >
                              <option value="" disabled>テーブルを選択</option>
                              {project.tables.filter(t => t.id !== selectedTable.id).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>

                          {newRelTargetTableId && (
                            <div className="space-y-1">
                              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter pl-1">先カラム</label>
                              <select 
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-sky-500"
                                value={newRelTargetFieldId}
                                onChange={(e) => setNewRelTargetFieldId(e.target.value)}
                              >
                                {project.tables.find(t => t.id === newRelTargetTableId)?.fields.map(f => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            if (newRelSourceFieldId && newRelTargetTableId && newRelTargetFieldId) {
                              const newRel: Relation = {
                                id: crypto.randomUUID(),
                                sourceTableId: selectedTable.id,
                                sourceFieldId: newRelSourceFieldId,
                                targetTableId: newRelTargetTableId,
                                targetFieldId: newRelTargetFieldId,
                                type: 'one-to-many'
                              };
                              handleUpdateProject({ relations: [...project.relations, newRel] });
                              
                              // Reset states
                              setNewRelSourceFieldId('');
                              setNewRelTargetTableId('');
                              setNewRelTargetFieldId('');
                            }
                          }}
                          disabled={!newRelSourceFieldId || !newRelTargetTableId || !newRelTargetFieldId}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-[10px] font-bold transition-all shadow-lg shadow-sky-500/20 uppercase tracking-widest"
                        >
                          <Plus size={14} /> リレーション追加
                        </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="h-8 bg-[#1E293B] border-t border-slate-700 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-6 text-[10px] text-slate-500 font-medium tracking-wide">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"></span> 
            ローカルストレージ保存済み
          </span>
          <span className="opacity-70 uppercase tracking-widest">
            DB言語: {project.language || '標準SQL'}
          </span>
        </div>
        <div className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-bold">
          Forge Engine v1.1.2
        </div>
      </footer>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#1E293B] border border-slate-700 w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                <div>
                  <h2 className="text-xl font-bold text-sky-400 tracking-tight flex items-center gap-2">
                    <Workflow size={24} /> {importSource === 'ai' ? 'AI自動解析インポート (.md)' : '定型データインポート (.csv / .json)'}
                  </h2>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">
                    {importSource === 'ai' 
                      ? 'Markdown形式の仕様書を読み込ませてAIに解釈させます' 
                      : '規定フォーマットのCSVまたはJSONを選択してください'}
                  </p>
                </div>
                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-700 rounded-full text-slate-500 hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 flex-1 overflow-hidden flex flex-col gap-6 bg-[#0F172A]">
                {!importText ? (
                  <div className="flex-1 flex flex-col gap-4">
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${
                        isDragging 
                          ? 'border-sky-500 bg-sky-500/10 scale-[1.02]' 
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept={importSource === 'ai' ? '.md' : '.csv,.json'} 
                        className="hidden" 
                      />
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-sky-400 transition-colors">
                        <Upload size={32} />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-200">ファイルをドラッグ＆ドロップ</p>
                        <p className="text-sm text-slate-500 mt-1">またはクリックしてファイルを選択 ({importSource === 'ai' ? '.md' : '.csv, .json'})</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-[1px] bg-slate-800"></div>
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">または</span>
                      <div className="flex-1 h-[1px] bg-slate-800"></div>
                    </div>
                    <button 
                      onClick={() => setImportText(' ')} // Space to trigger textarea view
                      className="w-full py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-300 font-bold text-sm hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <FileText size={18} /> 仕様テキストを直接貼り付ける
                    </button>
                    
                    <div className="flex items-center gap-4 mt-2">
                       <p className="text-xs text-slate-500 font-medium">{importSource === 'ai' ? '例:' : 'テンプレート:'}</p>
                       {importSource === 'structured' && (
                         <>
                           <button
                             onClick={() => {
                               const csv = 'Table, Description, Field, Type, Length, PK, Nullable, FK, Notes\nusers, User table, id, INT, 11, true, false, false, Primary Key\nusers, User table, name, VARCHAR, 255, false, true, false, User Name';
                               const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                               saveAs(blob, 'template.csv');
                             }}
                             className="px-3 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded text-xs transition-colors flex items-center gap-1"
                           >
                             <Download size={14}/> CSV
                           </button>
                           <button
                             onClick={() => {
                               const json = '[\n  {\n    "name": "users",\n    "description": "User table",\n    "fields": [\n      {\n        "name": "id",\n        "type": "INT",\n        "length": "11",\n        "isPrimaryKey": true,\n        "isNullable": false,\n        "isForeignKey": false,\n        "notes": "Primary Key"\n      }\n    ]\n  }\n]';
                               const blob = new Blob([json], { type: 'application/json' });
                               saveAs(blob, 'template.json');
                             }}
                             className="px-3 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded text-xs transition-colors flex items-center gap-1"
                           >
                             <Download size={14}/> JSON
                           </button>
                         </>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest">
                            <FileText size={14} /> 解析準備完了
                        </div>
                        <button 
                            onClick={() => setImportText('')}
                            className="text-[10px] text-slate-500 hover:text-red-400 uppercase font-bold transition-colors"
                        >
                            ファイルを変更
                        </button>
                    </div>
                    <textarea 
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="flex-1 w-full bg-[#0a0f1c] border border-slate-800 rounded-xl p-5 font-mono text-sm resize-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-sky-200 shadow-inner"
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {importSource === 'structured' && (
                    <div className="col-span-2 bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                        <Info size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">CSV/JSONフォーマット</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          CSVの場合は Table, Description, Field, Type, Length, PK, Nullable, FK, Notes のヘッダーを使用します。
                        </p>
                      </div>
                    </div>
                  )}
                  {importSource === 'ai' && (
                    <>
                      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                          <Info size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">ヒント</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">
                            テーブル定義、フィールド名、データ型、PK/FK等のリレーション情報が含まれていることを確認してください。
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-500">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">AI解析</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">
                            Geminiが図面の座標計算から関係性の整理までを自動で行い、ER図としてレンダリングします。
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-700 flex items-center justify-between bg-slate-800/50">
                <div className="flex bg-[#0a0f1c] p-1 rounded-lg border border-slate-700">
                  <button 
                    onClick={() => setImportMode('replace')}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                      importMode === 'replace' 
                        ? "bg-sky-600 text-white shadow-lg shadow-sky-500/20" 
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    上書き
                  </button>
                  <button 
                    onClick={() => setImportMode('append')}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                      importMode === 'append' 
                        ? "bg-sky-600 text-white shadow-lg shadow-sky-500/20" 
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    追加
                  </button>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowImportModal(false)}
                    className="px-6 py-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-white transition-all"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={handleAIImport}
                    disabled={!importText || !importText.trim() || isAIAnalyzing || (importSource === 'ai' && !settings.geminiApiKey)}
                    className={`px-8 py-2.5 font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg ${
                      importSource === 'ai' 
                        ? 'bg-sky-600 text-white hover:bg-sky-500 shadow-sky-500/10 disabled:bg-slate-700' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/10 disabled:bg-slate-700'
                    } disabled:text-slate-500 disabled:cursor-not-allowed`}
                  >
                    {isAIAnalyzing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {importSource === 'ai' ? '設計を分析中...' : 'データをインポート中...'}
                      </>
                    ) : (
                      <>
                        {importSource === 'ai' ? <Sparkles size={16} /> : <Play size={16} fill="currentColor" />}
                        {importSource === 'ai' ? 'AIで処理を開始' : 'インポート実行'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#1E293B] border border-slate-700 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/30">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Download size={20} className="text-sky-500" /> エクスポート形式を選択
                </h3>
                <button 
                  onClick={() => setShowExportModal(false)}
                  className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 flex flex-col gap-4 bg-[#0F172A]">
                <button
                  onClick={() => {
                    handleExport();
                    setShowExportModal(false);
                  }}
                  className="w-full text-left px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700 transition flex flex-col"
                >
                  <span className="text-sm font-bold text-sky-300 flex items-center gap-2"><FileText size={16}/> MD仕様書 (.md)</span>
                  <span className="text-xs text-slate-500 mt-1 pl-6">人間が読みやすいMarkdown形式</span>
                </button>
                <button
                  onClick={() => {
                    handleExportCSV();
                    setShowExportModal(false);
                  }}
                  className="w-full text-left px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700 transition flex flex-col"
                >
                  <span className="text-sm font-bold text-emerald-300 flex items-center gap-2"><Database size={16}/> CSVテーブル定義 (.csv)</span>
                  <span className="text-xs text-slate-500 mt-1 pl-6">再利用やスプレッドシート用フォーマット</span>
                </button>
                <button
                  onClick={() => {
                    handleExportJSON();
                    setShowExportModal(false);
                  }}
                  className="w-full text-left px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700 transition flex flex-col"
                >
                  <span className="text-sm font-bold text-amber-300 flex items-center gap-2"><FileJson size={16}/> JSON定義 (.json)</span>
                  <span className="text-xs text-slate-500 mt-1 pl-6">プログラムから読み込みやすいJSON形式</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Delete Confirmation Modal */}
      <AnimatePresence>
        {showTableDeleteConfirmModal && confirmTableDeleteId && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#1E293B] border border-slate-700 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/30">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trash2 size={20} className="text-red-500" /> テーブル削除の確認
                </h3>
                <button 
                  onClick={() => setShowTableDeleteConfirmModal(false)}
                  className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 text-center bg-[#0F172A]/50">
                <p className="text-slate-300 text-sm leading-relaxed mb-2">
                  <span className="text-red-400 font-bold block mb-1">
                    「{project.tables.find(t => t.id === confirmTableDeleteId)?.name}」
                  </span>
                  を本当に削除してよろしいですか？
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  テーブル内の全フィールドと関連するリレーションも削除されます
                </p>
              </div>

              <div className="p-6 border-t border-slate-700 bg-slate-800/30 flex justify-end gap-3">
                <button 
                  onClick={() => setShowTableDeleteConfirmModal(false)}
                  className="px-5 py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
                >
                  キャンセル
                </button>
                <button 
                  onClick={() => deleteTable(confirmTableDeleteId)}
                  className="px-6 py-2 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-red-500 transition-all shadow-lg shadow-red-500/10"
                >
                  はい、削除します
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Analyzing Overlay */}
      <AnimatePresence>
        {isAIAnalyzing && !showImportModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center pointer-events-auto"
          >
            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full mx-4">
              <div className="relative">
                <motion.div 
                  className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <motion.div 
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles size={24} className="text-amber-400" />
                </motion.div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-widest">AIによる自動整列中</h3>
                <p className="text-sm text-slate-400 leading-relaxed italic">
                  リレーションを分析し、最適な配置を計算しています。しばらくお待ちください...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overwrite Confirmation Modal */}
      <AnimatePresence>
        {showOverwriteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[70] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#1E293B] border border-slate-700 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/30">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Info size={20} className="text-amber-500" /> 上書きインポートの確認
                </h3>
                <button 
                  onClick={() => setShowOverwriteConfirm(false)}
                  className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 text-center bg-[#0F172A]/50">
                <p className="text-slate-300 text-sm leading-relaxed mb-2">
                  上書きモードを選択しています。
                </p>
                <p className="text-amber-400 font-bold text-sm mb-4">
                  既存のすべてのテーブルと関係が削除され、新しいデータで置き換えられます。本当に続行しますか？
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  現在のプロジェクト内容は失われます
                </p>
              </div>

              <div className="p-6 border-t border-slate-700 bg-slate-800/30 flex justify-end gap-3">
                <button 
                  onClick={() => setShowOverwriteConfirm(false)}
                  className="px-5 py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
                >
                  キャンセル
                </button>
                <button 
                  onClick={executeAIImport}
                  className="px-6 py-2 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-amber-500 transition-all shadow-lg shadow-amber-500/10"
                >
                  はい、上書きします
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirmModal && confirmDeleteId && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#1E293B] border border-slate-700 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/30">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trash2 size={20} className="text-red-500" /> 削除の確認
                </h3>
                <button 
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 text-center bg-[#0F172A]/50">
                <p className="text-slate-300 text-sm leading-relaxed mb-2">
                  <span className="text-red-400 font-bold block mb-1">
                    「{projects.find(p => p.id === confirmDeleteId)?.name}」
                  </span>
                  を本当に削除してよろしいですか？
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  この操作は取り消せません
                </p>
              </div>

              <div className="p-6 border-t border-slate-700 bg-slate-800/30 flex justify-end gap-3">
                <button 
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="px-5 py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
                >
                  キャンセル
                </button>
                <button 
                  onClick={() => deleteProject(confirmDeleteId)}
                  className="px-6 py-2 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-red-500 transition-all shadow-lg shadow-red-500/10"
                >
                  はい、削除します
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Delete Confirmation Modal */}
      <AnimatePresence>
        {showTableDeleteConfirmModal && confirmTableDeleteId && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#1E293B] border border-slate-700 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/30">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trash2 size={20} className="text-red-500" /> テーブル削除の確認
                </h3>
                <button 
                  onClick={() => setShowTableDeleteConfirmModal(false)}
                  className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 text-center bg-[#0F172A]/50">
                <p className="text-slate-300 text-sm leading-relaxed mb-2">
                  <span className="text-red-400 font-bold block mb-1">
                    「{project.tables.find(t => t.id === confirmTableDeleteId)?.name}」
                  </span>
                  を本当に削除してよろしいですか？
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  テーブル内の全フィールドと関連するリレーションも削除されます
                </p>
              </div>

              <div className="p-6 border-t border-slate-700 bg-slate-800/30 flex justify-end gap-3">
                <button 
                  onClick={() => setShowTableDeleteConfirmModal(false)}
                  className="px-5 py-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
                >
                  キャンセル
                </button>
                <button 
                  onClick={() => {
                    if (confirmTableDeleteId) {
                      deleteTable(confirmTableDeleteId);
                    }
                  }}
                  className="px-6 py-2 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-red-500 transition-all shadow-lg shadow-red-500/10"
                >
                  はい、削除します
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .markdown-body table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        .markdown-body th, .markdown-body td { border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left; }
        .markdown-body th { background-color: #f8fafc; font-weight: bold; }
        .markdown-body h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 1rem; }
        .markdown-body h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #f1f5f9; }
        .markdown-body h3 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
        .markdown-body p { margin-bottom: 1rem; color: #475569; }
      `}</style>
    </div>
  );
}
