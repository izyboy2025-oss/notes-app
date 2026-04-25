import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Cloud as CloudBackup, 
  Download as CloudDownload, 
  LogOut, 
  Menu,
  Trash2, 
  ChevronLeft, 
  Clock,
  User as UserIcon,
  Check,
  ChevronDown,
  X,
  StickyNote,
  Pin,
  RefreshCw,
  Type,
  Camera,
  CheckSquare,
  Sparkles,
  Palette,
  Type as FontIcon,
  Maximize2,
  Undo2,
  Redo2
} from 'lucide-react';
import { Note, signIn, logout, backupNotes, restoreNotes, getLastBackupDate } from './services/userService';
import { improveText } from './services/aiService';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format, isToday, subDays, isAfter, isSameYear } from 'date-fns';
import { cn } from './lib/utils';

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('cloud_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('app_settings');
    return saved ? JSON.parse(saved) : {
      themeColor: '#1E88E5',
      fontSize: '16px',
      fontStyle: 'Inter'
    };
  });

  const [isAiLoading, setIsAiLoading] = useState(false);

  // Undo/Redo History
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState(-1);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('cloud_notes', JSON.stringify(notes));
  }, [notes]);

  // Sync content history when editing starts
  useEffect(() => {
    if (editingNote && historyCursor === -1) {
      setContentHistory([editingNote.content]);
      setHistoryCursor(0);
    }
  }, [editingNote?.id]);

  const pushToHistory = (newContent: string) => {
    if (newContent === contentHistory[historyCursor]) return;
    const newHistory = contentHistory.slice(0, historyCursor + 1);
    newHistory.push(newContent);
    // Keep history manageable
    if (newHistory.length > 50) newHistory.shift();
    setContentHistory(newHistory);
    setHistoryCursor(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyCursor > 0) {
      const prevContent = contentHistory[historyCursor - 1];
      setHistoryCursor(historyCursor - 1);
      setEditingNote(prev => prev ? { ...prev, content: prevContent } : null);
    }
  };

  const handleRedo = () => {
    if (historyCursor < contentHistory.length - 1) {
      const nextContent = contentHistory[historyCursor + 1];
      setHistoryCursor(historyCursor + 1);
      setEditingNote(prev => prev ? { ...prev, content: nextContent } : null);
    }
  };

  useEffect(() => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
    document.documentElement.style.setProperty('--theme-primary', settings.themeColor);
    document.documentElement.style.setProperty('--theme-primary-dark', settings.themeColor + 'DD');
    document.documentElement.style.setProperty('--selected-font', settings.fontStyle === 'Serif' ? 'var(--font-serif)' : settings.fontStyle === 'Mono' ? 'var(--font-mono)' : 'var(--font-sans)');
    document.documentElement.style.setProperty('--selected-font-size', settings.fontSize);
  }, [settings]);

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        fetchLastBackupDate(u.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchLastBackupDate = async (uid: string) => {
    const date = await getLastBackupDate(uid);
    setLastBackup(date);
  };

  const handleSignIn = async () => {
    try {
      await signIn();
      notify('Signed in successfully', 'success');
    } catch (error) {
      notify('Failed to sign in', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    notify('Logged out', 'success');
    setIsMenuOpen(false);
  };

  const notify = (message: string, type: 'success' | 'error') => {
    setShowToast({ message, type });
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleCreateNote = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: user?.uid || 'anonymous'
    };
    setEditingNote(newNote);
  };

  const handleSaveNote = () => {
    if (!editingNote) return;
    if (!editingNote.title.trim() && !editingNote.content.trim()) {
      setEditingNote(null);
      return;
    }
    
    const updatedNote = { ...editingNote, updatedAt: new Date().toISOString() };
    setNotes(prev => {
      const exists = prev.find(n => n.id === updatedNote.id);
      if (exists) {
        return prev.map(n => n.id === updatedNote.id ? updatedNote : n);
      }
      return [updatedNote, ...prev];
    });
    setEditingNote(null);
  };

  const [showTrash, setShowTrash] = useState(false);

  const handlePinNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: new Date().toISOString() } : n));
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isDeleted: true, deletedAt: new Date().toISOString() } : n));
    notify('Moved to Trash', 'success');
  };

  const handlePermanentDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes(prev => prev.filter(n => n.id !== id));
    notify('Permanently deleted', 'success');
  };

  const handleRestoreFromTrash = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isDeleted: false, deletedAt: undefined } : n));
    notify('Note restored', 'success');
  };

  const handleBackup = async () => {
    if (!user) {
      notify('Please sign in to backup', 'error');
      return;
    }
    setIsBackupLoading(true);
    try {
      await backupNotes(user.uid, notes);
      await fetchLastBackupDate(user.uid);
      notify('Backup successful', 'success');
    } catch (error) {
      notify('Backup failed', 'error');
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!user) {
      notify('Please sign in to restore', 'error');
      return;
    }
    setIsRestoreLoading(true);
    try {
      const cloudNotes = await restoreNotes(user.uid);
      if (cloudNotes.length > 0) {
        setNotes(prev => {
          const merged = [...prev];
          let updatedCount = 0;
          let addedCount = 0;

          cloudNotes.forEach(cloudNote => {
            const localIndex = merged.findIndex(n => n.id === cloudNote.id);
            if (localIndex > -1) {
              // Only update if cloud version is newer
              const localDate = new Date(merged[localIndex].updatedAt).getTime();
              const cloudDate = new Date(cloudNote.updatedAt).getTime();
              if (cloudDate > localDate) {
                merged[localIndex] = cloudNote;
                updatedCount++;
              }
            } else {
              merged.push(cloudNote);
              addedCount++;
            }
          });

          if (updatedCount === 0 && addedCount === 0) {
            notify('All notes are already up to date', 'success');
          } else {
            notify(`Synced: ${addedCount} new, ${updatedCount} updated`, 'success');
          }
          return merged;
        });
      } else {
        notify('No backup found', 'error');
      }
    } catch (error) {
      notify('Restore failed', 'error');
    } finally {
      setIsRestoreLoading(false);
    }
  };

  const handleAiAction = async (action: 'polish' | 'summarize' | 'expand' | 'fix') => {
    if (!editingNote || !editingNote.content.trim()) return;
    setIsAiLoading(true);
    try {
      const result = await improveText(editingNote.content, action);
      setEditingNote(prev => prev ? { ...prev, content: result } : null);
      pushToHistory(result);
      notify(`AI text ${action}ed`, 'success');
    } catch (error) {
      notify('AI processing failed', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleInsertChecklist = () => {
    if (!editingNote) return;
    const checklist = "\n[ ] New task\n[ ] New task";
    setEditingNote(prev => prev ? { ...prev, content: prev.content + checklist } : null);
  };

  const handleInsertTimestamp = () => {
    if (!editingNote) return;
    const dateStr = format(new Date(), 'dd/MM/yy');
    const stamp = `\n${dateStr}\n`;
    const newContent = editingNote.content + stamp;
    setEditingNote(prev => prev ? { ...prev, content: newContent } : null);
    pushToHistory(newContent);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingNote) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result;
        if (base64) {
          const imgTag = `\n![image](${base64})\n`;
          const newContent = editingNote.content + imgTag;
          setEditingNote(prev => prev ? { ...prev, content: newContent } : null);
          pushToHistory(newContent);
          notify("Image added", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [activeFilter, setActiveFilter] = useState<'all' | 'pinned' | 'images'>('all');

  // Grouping Logic
  const groupedNotes = useMemo(() => {
    let activeNotes = notes.filter(n => (showTrash ? n.isDeleted : !n.isDeleted));
    
    if (activeFilter === 'pinned') {
      activeNotes = activeNotes.filter(n => n.isPinned);
    } else if (activeFilter === 'images') {
      activeNotes = activeNotes.filter(n => n.content?.includes('![image]'));
    }

    const filtered = activeNotes.filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      // Pinning takes precedence
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const groups: { [key: string]: Note[] } = {};
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    filtered.forEach(note => {
      if (note.isPinned && !showTrash) {
        if (!groups['Pinned']) groups['Pinned'] = [];
        groups['Pinned'].push(note);
        return;
      }

      const date = new Date(showTrash && note.deletedAt ? note.deletedAt : note.updatedAt);
      let label = '';

      if (isToday(date)) {
        label = 'Today';
      } else if (isAfter(date, thirtyDaysAgo)) {
        label = 'Previous 30 Days';
      } else if (isSameYear(date, now)) {
        label = format(date, 'MMMM');
      } else {
        label = format(date, 'yyyy');
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(note);
    });

    return Object.entries(groups);
  }, [notes, searchQuery, showTrash]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-900 selection:bg-primary/30 antialiased">
      {/* Sidebar Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 mb-4">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-slate-50 rounded-full">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                
                {user ? (
                  <div className="relative">
                    <button 
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="w-full flex items-center gap-4 group text-left"
                    >
                      <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                        <UserIcon size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate text-sm flex items-center gap-1">
                          {user.email}
                          <ChevronDown size={14} className={cn("transition-transform duration-300", isUserMenuOpen && "rotate-180")} />
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Backup Account</p>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isUserMenuOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[80] overflow-hidden"
                        >
                          <button 
                            onClick={handleSignIn}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-slate-700 transition-colors text-sm font-bold"
                          >
                            <RefreshCw size={16} className="text-primary" />
                            Switch Account
                          </button>
                          <button 
                            onClick={handleLogout}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 text-red-500 transition-colors text-sm font-bold"
                          >
                            <LogOut size={16} />
                            Log Out
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <button 
                    onClick={handleSignIn}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-primary rounded-2xl font-bold shadow-lg shadow-primary/10 active:scale-95 transition-all text-sm mb-2"
                  >
                    <UserIcon size={18} />
                    Link Google Account
                  </button>
                )}
              </div>

              <div className="flex-1 p-4 flex flex-col gap-2">
                <div className="px-4 py-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Views</p>
                  <button 
                    onClick={() => { setShowTrash(false); setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl transition-colors",
                      !showTrash ? "bg-primary/10 text-primary" : "hover:bg-slate-50"
                    )}
                  >
                    <StickyNote size={20} />
                    <span className="font-bold text-sm">All Notes</span>
                  </button>
                  <button 
                    onClick={() => { setShowTrash(true); setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl transition-colors",
                      showTrash ? "bg-red-50 text-red-500" : "hover:bg-slate-50"
                    )}
                  >
                    <Trash2 size={20} />
                    <span className="font-bold text-sm">Recently Deleted</span>
                  </button>

                  <div className="h-[1px] bg-slate-100 my-4" />
                  
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Cloud Services</p>
                  
                  <button 
                    onClick={handleBackup}
                    disabled={isBackupLoading || !user}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-40"
                  >
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <CloudBackup size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Backup Now</p>
                      <p className="text-[10px] text-slate-400">
                        {lastBackup ? `Last: ${format(new Date(lastBackup), 'MMM d, HH:mm')}` : 'Save your notes'}
                      </p>
                    </div>
                    {isBackupLoading && <div className="ml-auto w-4 h-4 border-2 border-primary rounded-full animate-spin border-t-transparent" />}
                  </button>

                  <button 
                    onClick={handleRestore}
                    disabled={isRestoreLoading || !user}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-40"
                  >
                    <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                      <CloudDownload size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Restore Notes</p>
                      <p className="text-[10px] text-slate-400">Download previously saved</p>
                    </div>
                    {isRestoreLoading && <div className="ml-auto w-4 h-4 border-2 border-primary rounded-full animate-spin border-t-transparent" />}
                  </button>
                  
                  <div className="h-[1px] bg-slate-100 my-4" />
                  
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Personalization</p>
                  
                  <div className="space-y-4 px-2">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">Theme Color</label>
                      <div className="flex gap-2">
                        {['#1E88E5', '#F44336', '#4CAF50', '#FF9800', '#9C27B0'].map(color => (
                          <button 
                            key={color}
                            onClick={() => setSettings({...settings, themeColor: color})}
                            style={{ backgroundColor: color }}
                            className={cn(
                              "w-8 h-8 rounded-full border-2 transition-transform",
                              settings.themeColor === color ? "border-slate-900 scale-110" : "border-transparent"
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">Font Style</label>
                        <select 
                          className="w-full p-2 bg-slate-50 rounded-xl text-sm font-bold border-none outline-none"
                          value={settings.fontStyle}
                          onChange={(e) => setSettings({...settings, fontStyle: e.target.value})}
                        >
                          <option value="Sans">Default</option>
                          <option value="Serif">Classic</option>
                          <option value="Mono">Digital</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">Size (px)</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            className="w-full p-2 bg-slate-50 rounded-xl text-sm font-bold border-none outline-none"
                            value={parseInt(settings.fontSize)}
                            onChange={(e) => setSettings({...settings, fontSize: `${e.target.value}px`})}
                            min="8"
                            max="72"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100">
                {user && (
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-red-50 text-red-500 transition-colors"
                  >
                    <LogOut size={20} />
                    <span className="font-bold text-sm text-slate-700">Sign Out</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main UI */}
      <div className="flex-1 flex flex-col">
        {!editingNote ? (
          <>
            {/* Header */}
            <header className="px-6 pt-4 pb-2 sticky top-0 bg-[#F8F9FA]/80 backdrop-blur-md z-30">
              <div className="flex items-center justify-between mb-4">
                <button 
                  onClick={() => setIsMenuOpen(true)}
                  className="flex items-center gap-1.5 focus:outline-none group"
                >
                  <h1 className="text-[28px] font-bold tracking-tight text-[#111111]">Notes</h1>
                  <ChevronDown size={22} className="text-slate-400 group-active:translate-y-0.5 transition-transform" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search"
                  className="w-full bg-[#EAEAEA] border-none h-[46px] pl-11 pr-4 rounded-[12px] focus:ring-0 text-slate-800 placeholder:text-slate-500 font-medium text-base transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pinned', label: 'Pinned' },
                  { id: 'images', label: 'Images' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id as any)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                      activeFilter === f.id 
                        ? "bg-primary text-white shadow-sm" 
                        : "bg-white text-slate-400 border border-slate-100"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </header>

            {/* Notes List */}
            <main className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
              {groupedNotes.length > 0 ? (
                <div className="space-y-8 mt-2">
                  {groupedNotes.map(([label, notesInGroup]) => (
                    <div key={label} className="space-y-3">
                      <h3 className="text-[17px] font-bold text-[#111111] px-1 opacity-90">{label}</h3>
                      <div className="bg-white rounded-[16px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        {notesInGroup.map((note, idx) => (
                          <div key={note.id} className="relative">
                            <motion.div
                              onClick={() => !showTrash && setEditingNote(note)}
                              className={cn(
                                "p-5 active:bg-slate-50 transition-colors group cursor-pointer",
                                showTrash && "cursor-default"
                              )}
                            >
                              <div className="flex justify-between items-start mb-1 gap-4">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {note.isPinned && !showTrash && <Pin size={14} className="text-primary fill-primary shrink-0" />}
                                  <h4 className="font-bold text-[#111111] text-[16px] line-clamp-1">
                                    {note.title || (note.content ? note.content.split('\n')[0] : 'Untitled Note')}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-1">
                                  {!showTrash && (
                                    <button 
                                      onClick={(e) => handlePinNote(note.id, e)}
                                      className={cn("p-1 transition-colors", note.isPinned ? "text-primary" : "text-slate-200 opacity-0 group-hover:opacity-100")}
                                    >
                                      <Pin size={16} />
                                    </button>
                                  )}
                                  <button 
                                    onClick={(e) => showTrash ? handlePermanentDelete(note.id, e) : handleDeleteNote(note.id, e)}
                                    className="text-slate-200 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                  {showTrash && (
                                    <button 
                                      onClick={(e) => handleRestoreFromTrash(note.id, e)}
                                      className="text-slate-200 hover:text-green-500 transition-colors p-1"
                                    >
                                      <RefreshCw size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-[#8E8E93]">
                                <span className="font-medium shrink-0 text-xs">
                                  {format(new Date(note.updatedAt), 'MM/dd')}
                                </span>
                                <p className="line-clamp-1 font-medium text-sm opacity-80">
                                  {note.content?.replace(/!\[.*?\]\(.*?\)/g, '[Image]').replace(/\n/g, ' ') || 'Note something down'}
                                </p>
                              </div>
                            </motion.div>
                            {idx < notesInGroup.length - 1 && (
                              <div className="absolute bottom-0 left-5 right-0 h-[0.5px] bg-[#F1F1F1]" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-40 py-20">
                  <StickyNote size={64} strokeWidth={1} />
                  <p className="font-medium text-lg text-center px-8">No notes found. Tap the button below to start writing.</p>
                </div>
              )}
            </main>

            {/* FAB */}
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={handleCreateNote}
              className="fixed bottom-8 right-8 w-[64px] h-[64px] bg-[#E7F0FF] text-[#1E88E5] rounded-full flex items-center justify-center shadow-xl active:shadow-md z-40 transition-all border border-[#D0E3FF]"
            >
              <Plus size={36} strokeWidth={2.5} />
            </motion.button>
          </>
        ) : (
          /* Editor Layout */
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col bg-white overflow-hidden"
          >
            <div className="h-16 flex items-center justify-between px-4 sticky top-0 bg-white/90 backdrop-blur-md z-20">
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleSaveNote}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400"
                >
                  <ChevronLeft size={28} strokeWidth={2.5} />
                </button>
                <div className="h-6 w-[1px] bg-slate-100 mx-1" />
                <button 
                  onClick={handleUndo}
                  disabled={historyCursor <= 0}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 disabled:opacity-20"
                >
                  <Undo2 size={22} />
                </button>
                <button 
                  onClick={handleRedo}
                  disabled={historyCursor >= contentHistory.length - 1}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 disabled:opacity-20"
                >
                  <Redo2 size={22} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                 <button onClick={handleSaveNote} className="p-2 text-primary hover:bg-slate-50 rounded-full"><Check size={24} /></button>
              </div>
            </div>

            <div className="flex-1 flex flex-col px-8 overflow-y-auto no-scrollbar">
              <input 
                autoFocus
                type="text" 
                placeholder="Title"
                className="text-[30px] font-bold text-[#111111] bg-transparent border-none outline-none placeholder:text-[#C7C7CC] w-full mb-2 mt-4 caret-primary"
                value={editingNote.title}
                onChange={(e) => setEditingNote({...editingNote!, title: e.target.value})}
              />
              <textarea 
                placeholder="Note something down"
                style={{ fontSize: settings.fontSize }}
                className="flex-1 bg-transparent border-none outline-none resize-none placeholder:text-[#C7C7CC] w-full leading-[1.6] text-slate-600 font-medium pb-24 caret-primary"
                value={editingNote.content}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingNote({...editingNote!, content: val});
                  // We could debounce this, but for simple notes history on every substantial change is fine
                  if (Math.abs(val.length - (contentHistory[historyCursor]?.length || 0)) > 5) {
                    pushToHistory(val);
                  }
                }}
                onBlur={(e) => pushToHistory(e.target.value)}
              />
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={onFileChange} 
              />
            </div>

            {/* Bottom Editor Toolbar */}
            <div className="h-16 border-t border-slate-100 flex items-center justify-around px-4 text-slate-400 bg-white/80 backdrop-blur-md">
                <button 
                  onClick={() => handleAiAction('polish')}
                  disabled={isAiLoading}
                  className={cn("p-3 hover:bg-slate-50 rounded-2xl transition-all relative group", isAiLoading && "animate-pulse")}
                >
                  <Sparkles size={22} className={cn("transition-colors", isAiLoading ? "text-primary" : "text-slate-400")} />
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">AI Polish</span>
                </button>

                <button 
                  onClick={() => setIsMenuOpen(true)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-colors group relative"
                >
                  <Type size={22} className="text-slate-400" />
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Settings</span>
                </button>

                <button 
                  onClick={handleAddImage}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-colors group relative"
                >
                  <Camera size={22} className="text-slate-400" />
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Add Image</span>
                </button>

                <div className="w-[1px] h-6 bg-slate-100 mx-2" />

                <button 
                  onClick={handleInsertChecklist}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-colors group relative"
                >
                  <CheckSquare size={22} className="text-slate-400" />
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Checklist</span>
                </button>

                <button 
                  onClick={handleInsertTimestamp}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-colors group relative"
                >
                  <Plus size={22} className="text-slate-400" />
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Timestamp</span>
                </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              "fixed bottom-24 left-1/2 px-6 py-2 rounded-full shadow-lg z-[100] flex items-center gap-3 font-bold text-xs tracking-tight",
              showToast.type === 'success' ? "bg-slate-900 text-white" : "bg-red-500 text-white"
            )}
          >
            {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        body { -webkit-tap-highlight-color: transparent; }
        input, textarea { border: none !important; box-shadow: none !important; }
      `}</style>
    </div>
  );
}

// Global declarations fix
declare global {
  interface Crypto {
    randomUUID(): string;
  }
}

