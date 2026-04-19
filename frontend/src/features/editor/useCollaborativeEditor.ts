import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { type Editor, useEditor } from '@tiptap/react';
import { common, createLowlight } from 'lowlight';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { api, ApiError } from '../../services/api';
import type { ApiDocument, ApiUser, DocumentSessionResponse, RichTextContent } from '../../types/api';
import { defaultRichTextContent, isRichTextEmpty, plainTextToRichText, richTextToPlainText } from './richText';

type SaveState = 'idle' | 'queued' | 'saving' | 'saved' | 'error';
type PresenceActivity = 'typing' | 'active' | 'idle';

export type CollabConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'resynced'
  | 'error';

export interface PresenceUser {
  clientId: number;
  userId: number | null;
  name: string;
  color: string;
  role: 'owner' | 'editor' | 'viewer' | 'unknown';
  activity: PresenceActivity;
  lastActiveAt: string | null;
  active: boolean;
  connections: number;
}

interface UseCollaborativeEditorOptions {
  documentId: string | null;
  document: ApiDocument | null;
  session: DocumentSessionResponse | null;
  title: string;
  canEdit: boolean;
  currentUser: ApiUser | null;
  onPersisted: (document: ApiDocument) => void;
}

const USER_COLORS = ['#115e59', '#b45309', '#7c3aed', '#be123c', '#0f766e', '#1d4ed8'];
const lowlight = createLowlight(common);

function colorForUser(userId: number | null) {
  if (userId === null) {
    return USER_COLORS[0];
  }

  return USER_COLORS[Math.abs(userId) % USER_COLORS.length];
}

function initialsForName(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'C'
  );
}

function renderCaret(user: Record<string, unknown>) {
  const color = String(user.color ?? USER_COLORS[0]);
  const name = String(user.name ?? 'Collaborator');
  let hideTimer: number | null = null;

  const cursor = document.createElement('span');
  cursor.classList.add('collab-caret');
  cursor.style.setProperty('--collab-color', color);

  const line = document.createElement('span');
  line.classList.add('collab-caret__line');

  const label = document.createElement('div');
  label.classList.add('collab-caret__label');
  label.style.setProperty('--collab-color', color);

  const badge = document.createElement('span');
  badge.classList.add('collab-caret__badge');
  badge.textContent = initialsForName(name);

  const text = document.createElement('span');
  text.classList.add('collab-caret__name');
  text.textContent = name;

  label.append(badge, text);
  cursor.append(line, label);

  const showLabel = () => {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }

    cursor.classList.add('is-active');
    cursor.classList.remove('is-lingering');
  };

  const scheduleHide = () => {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
    }

    cursor.classList.add('is-lingering');
    hideTimer = window.setTimeout(() => {
      cursor.classList.remove('is-active', 'is-lingering');
      hideTimer = null;
    }, 1000);
  };

  cursor.addEventListener('mouseenter', showLabel);
  cursor.addEventListener('mouseleave', scheduleHide);
  cursor.addEventListener('focusin', showLabel);
  cursor.addEventListener('focusout', scheduleHide);

  return cursor;
}

function renderSelection(user: Record<string, unknown>) {
  const color = String(user.color ?? USER_COLORS[0]);
  return {
    class: 'collab-selection',
    style: `--collab-color: ${color}; background-color: ${color}24`,
  };
}

function activityRank(activity: PresenceActivity) {
  if (activity === 'typing') {
    return 3;
  }
  if (activity === 'active') {
    return 2;
  }
  return 1;
}

function awarenessToPresence(provider: WebsocketProvider | null): PresenceUser[] {
  if (!provider) {
    return [];
  }

  const entries = Array.from(provider.awareness.getStates().entries());
  const users = entries
    .map(([clientId, state]) => {
      const record =
        state && typeof state === 'object' ? (state as Record<string, unknown>) : null;
      const user =
        record?.user && typeof record.user === 'object'
          ? (record.user as Record<string, unknown>)
          : null;

      return {
        clientId,
        userId: typeof user?.id === 'number' ? user.id : null,
        name: typeof user?.name === 'string' ? user.name : 'Collaborator',
        color: typeof user?.color === 'string' ? user.color : USER_COLORS[0],
        role:
          user?.role === 'owner' || user?.role === 'editor' || user?.role === 'viewer'
            ? user.role
            : 'unknown',
        activity:
          user?.activity === 'typing' || user?.activity === 'idle' ? user.activity : 'active',
        lastActiveAt:
          typeof user?.lastActiveAt === 'string'
            ? user.lastActiveAt
            : typeof user?.last_active_at === 'string'
              ? user.last_active_at
              : null,
        active: true,
        connections: 1,
      } satisfies PresenceUser;
    });

  const deduped = new Map<string, PresenceUser>();

  for (const user of users) {
    const key =
      user.userId !== null ? `user:${user.userId}` : `name:${user.name.toLowerCase()}:${user.role}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, user);
      continue;
    }

    deduped.set(key, {
      ...existing,
      clientId: Math.min(existing.clientId, user.clientId),
      activity:
        activityRank(user.activity) > activityRank(existing.activity)
          ? user.activity
          : existing.activity,
      lastActiveAt: user.lastActiveAt ?? existing.lastActiveAt,
      active: existing.active || user.active,
      connections: existing.connections + 1,
    });
  }

  return Array.from(deduped.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function useCollaborativeEditor({
  documentId,
  document,
  session,
  title,
  canEdit,
  currentUser,
  onPersisted,
}: UseCollaborativeEditorOptions) {
  const [connectionState, setConnectionState] = useState<CollabConnectionState>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [plainText, setPlainText] = useState('');
  const [selectionText, setSelectionText] = useState('');
  const [offlineHydrationReady, setOfflineHydrationReady] = useState(false);
  const [canUndoAiApply, setCanUndoAiApply] = useState(false);

  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const lastSavedTitleRef = useRef(document?.title ?? '');
  const lastSavedContentRef = useRef(
    JSON.stringify(document?.content ?? defaultRichTextContent()),
  );
  const currentJsonRef = useRef<RichTextContent>(document?.content ?? defaultRichTextContent());
  const titleRef = useRef(title);
  const seededRef = useRef(false);
  const pendingPersistRef = useRef(false);
  const isPersistingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const typingResetTimerRef = useRef<number | null>(null);
  const lastAiSnapshotRef = useRef<RichTextContent | null>(null);

  const userDescriptor = useMemo(
    () => ({
      id: currentUser?.id ?? 0,
      name: currentUser?.username ?? 'Anonymous',
      role: session?.role ?? (canEdit ? 'editor' : 'viewer'),
      color: colorForUser(currentUser?.id ?? null),
      activity: 'active' as PresenceActivity,
      lastActiveAt: new Date().toISOString(),
    }),
    [canEdit, currentUser?.id, currentUser?.username, session?.role],
  );

  useEffect(() => {
    titleRef.current = title;
    setIsDirty(
      title !== lastSavedTitleRef.current ||
        JSON.stringify(currentJsonRef.current) !== lastSavedContentRef.current,
    );
  }, [title]);

  useEffect(() => {
    seededRef.current = false;
    setOfflineHydrationReady(false);
    lastSavedTitleRef.current = document?.title ?? '';
    lastSavedContentRef.current = JSON.stringify(document?.content ?? defaultRichTextContent());
    currentJsonRef.current = document?.content ?? defaultRichTextContent();
    setPlainText(richTextToPlainText(document?.content ?? defaultRichTextContent()));
    setSelectionText('');
    setIsDirty(false);
    setSaveState('idle');
    setSaveError(null);
    setSaveMessage(null);
    pendingPersistRef.current = false;
    lastAiSnapshotRef.current = null;
    setCanUndoAiApply(false);
  }, [document?.id, document?.updated_at]);

  const provider = useMemo(() => {
    if (!documentId || !session) {
      return null;
    }

    return new WebsocketProvider(session.ws_url, documentId, ydoc, {
      params: { token: session.session_token },
      maxBackoffTime: 4000,
    });
  }, [documentId, session, ydoc]);

  const offlinePersistence = useMemo(() => {
    if (!documentId) {
      return null;
    }

    return new IndexeddbPersistence(`draftboard:${documentId}`, ydoc);
  }, [documentId, ydoc]);

  const updateLocalActivity = useCallback(
    (activity: PresenceActivity, bumpTimestamp = true) => {
      if (!provider) {
        return;
      }

      const currentState = provider.awareness.getLocalState();
      const existingUser =
        currentState &&
        typeof currentState === 'object' &&
        'user' in currentState &&
        currentState.user &&
        typeof currentState.user === 'object'
          ? (currentState.user as Record<string, unknown>)
          : null;
      const timestamp =
        bumpTimestamp || typeof existingUser?.lastActiveAt !== 'string'
          ? new Date().toISOString()
          : existingUser.lastActiveAt;

      provider.awareness.setLocalStateField('user', {
        ...userDescriptor,
        activity,
        lastActiveAt: timestamp,
      });
    },
    [provider, userDescriptor],
  );

  const markTyping = useCallback(() => {
    if (!canEdit) {
      return;
    }

    updateLocalActivity('typing');
    if (typingResetTimerRef.current !== null) {
      window.clearTimeout(typingResetTimerRef.current);
    }
    typingResetTimerRef.current = window.setTimeout(() => {
      updateLocalActivity(window.document.hasFocus() ? 'active' : 'idle', false);
      typingResetTimerRef.current = null;
    }, 1400);
  }, [canEdit, updateLocalActivity]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: canEdit,
      editorProps: {
        attributes: {
          class: 'draftboard-editor editor-copy',
          'data-testid': 'collaborative-editor-content',
        },
      },
      extensions: [
        StarterKit.configure({
          history: false,
          codeBlock: false,
        }),
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: 'javascript',
          languageClassPrefix: 'language-',
        }),
        Underline,
        Highlight.configure({
          multicolor: false,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: 'https',
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Collaboration.configure({
          document: ydoc,
        }),
        ...(provider
          ? [
              CollaborationCaret.configure({
                provider,
                user: userDescriptor,
                render: renderCaret,
                selectionRender: renderSelection,
              }),
            ]
          : []),
      ],
      onCreate({ editor: nextEditor }) {
        const json = nextEditor.getJSON() as RichTextContent;
        currentJsonRef.current = json;
        setPlainText(richTextToPlainText(json));
        const { from, to } = nextEditor.state.selection;
        setSelectionText(nextEditor.state.doc.textBetween(from, to, '\n\n'));
      },
      onUpdate({ editor: nextEditor }) {
        const json = nextEditor.getJSON() as RichTextContent;
        currentJsonRef.current = json;
        const nextPlainText = richTextToPlainText(json);
        setPlainText(nextPlainText);
        const nextIsDirty =
          titleRef.current !== lastSavedTitleRef.current ||
          JSON.stringify(json) !== lastSavedContentRef.current;
        setIsDirty(nextIsDirty);

        if (nextIsDirty && canEdit) {
          setSaveState((current) => (current === 'saving' ? current : 'queued'));
          setSaveError(null);
          setSaveMessage(null);
          markTyping();
        }
      },
    },
    [ydoc, provider, canEdit, userDescriptor, document?.id, markTyping],
  );

  useEffect(() => {
    let cancelled = false;

    if (!documentId) {
      setOfflineHydrationReady(true);
      return;
    }

    if (!offlinePersistence) {
      setOfflineHydrationReady(true);
      return;
    }

    if (offlinePersistence.synced) {
      setOfflineHydrationReady(true);
      return;
    }

    void offlinePersistence.whenSynced.then(() => {
      if (!cancelled) {
        setOfflineHydrationReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [documentId, offlinePersistence]);

  useEffect(() => {
    if (!editor || !offlineHydrationReady || seededRef.current) {
      return;
    }

    const hasExistingYState = ydoc.getXmlFragment('default').length > 0;
    if (
      !hasExistingYState &&
      !isRichTextEmpty(document?.content) &&
      richTextToPlainText(editor.getJSON() as RichTextContent).trim().length === 0
    ) {
      editor.commands.setContent(document?.content ?? defaultRichTextContent(), false);
    }

    seededRef.current = true;
  }, [document?.content, editor, offlineHydrationReady, ydoc]);

  useEffect(() => {
    return () => {
      if (typingResetTimerRef.current !== null) {
        window.clearTimeout(typingResetTimerRef.current);
      }
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      if (provider) {
        provider.awareness.setLocalState(null);
        provider.destroy();
      }
      offlinePersistence?.destroy();
    };
  }, [offlinePersistence, provider]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(canEdit);
    if ('updateUser' in editor.commands && typeof editor.commands.updateUser === 'function') {
      editor.commands.updateUser(userDescriptor);
    }
  }, [editor, canEdit, userDescriptor]);

  useEffect(() => {
    if (!provider) {
      return;
    }

    updateLocalActivity('active');

    return () => {
      provider.awareness.setLocalState(null);
    };
  }, [provider, updateLocalActivity]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleSelection = () => {
      const { from, to } = editor.state.selection;
      setSelectionText(editor.state.doc.textBetween(from, to, '\n\n'));
      updateLocalActivity(editor.isFocused ? 'active' : 'idle', false);
    };
    const handleFocus = () => updateLocalActivity('active');
    const handleBlur = () => updateLocalActivity('idle', false);

    editor.on('selectionUpdate', handleSelection);
    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', handleSelection);
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);
    };
  }, [editor, updateLocalActivity]);

  useEffect(() => {
    if (!provider) {
      setConnectionState('idle');
      setConnectionMessage(null);
      setPresenceUsers([]);
      return;
    }

    setConnectionState('connecting');
    setConnectionMessage('Establishing shared editing session.');

    const syncHandler = (synced: boolean) => {
      if (!synced) {
        return;
      }

      setConnectionState((current) => (current === 'reconnecting' ? 'resynced' : 'connected'));
      setConnectionMessage(
        seededRef.current ? 'Live collaboration is active.' : 'Shared session is ready.',
      );
      updateLocalActivity('active');
      setPresenceUsers(awarenessToPresence(provider));
    };

    const statusHandler = (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
      if (event.status === 'connected') {
        setConnectionState((current) => (current === 'reconnecting' ? 'resynced' : 'connected'));
        setConnectionMessage('Connected to the collaboration session.');
        updateLocalActivity('active');
        return;
      }

      if (event.status === 'connecting') {
        setConnectionState((current) => (current === 'connected' || current === 'resynced' ? 'reconnecting' : 'connecting'));
        setConnectionMessage(
          seededRef.current
            ? 'Reconnecting to collaborators...'
            : 'Connecting to collaborators...',
        );
        return;
      }

      setConnectionState(seededRef.current ? 'reconnecting' : 'offline');
      setConnectionMessage(
        seededRef.current
          ? 'Connection dropped. Local edits stay on this device and will sync when collaboration reconnects.'
          : 'Collaboration is offline for this document.',
      );
    };

    const awarenessHandler = () => {
      setPresenceUsers(awarenessToPresence(provider));
    };

    const closeHandler = () => {
      setConnectionState(seededRef.current ? 'reconnecting' : 'offline');
      setConnectionMessage(
        'The collaboration socket closed. Local edits are preserved and Draftboard is trying to recover.',
      );
    };

    const errorHandler = () => {
      setConnectionState('error');
      setConnectionMessage('Could not maintain the collaboration connection.');
    };

    provider.on('sync', syncHandler);
    provider.on('status', statusHandler);
    provider.on('connection-close', closeHandler);
    provider.on('connection-error', errorHandler);
    provider.awareness.on('update', awarenessHandler);
    awarenessHandler();

    return () => {
      provider.awareness.off('update', awarenessHandler);
      provider.off('sync', syncHandler);
      provider.off('status', statusHandler);
      provider.off('connection-close', closeHandler);
      provider.off('connection-error', errorHandler);
    };
  }, [provider, updateLocalActivity]);

  const persistSnapshot = useCallback(async () => {
    if (!documentId || !document || !canEdit) {
      return false;
    }
    if (isPersistingRef.current) {
      return false;
    }

    isPersistingRef.current = true;
    setSaveState('saving');
    setSaveError(null);
    setSaveMessage(null);

    try {
      const response = await api.documents.update(documentId, {
        title: titleRef.current,
        content: currentJsonRef.current,
      });

      lastSavedTitleRef.current = response.document.title;
      lastSavedContentRef.current = JSON.stringify(response.document.content);
      currentJsonRef.current = response.document.content;
      setPlainText(richTextToPlainText(response.document.content));
      setIsDirty(false);
      pendingPersistRef.current = false;
      setSaveState('saved');
      setSaveMessage(null);
      onPersisted(response.document);
      return true;
    } catch (error) {
      if (!(error instanceof ApiError)) {
        pendingPersistRef.current = true;
        setSaveState('queued');
        setSaveError(null);
        setSaveMessage(
          'Working offline. Changes are stored locally and will sync when the connection returns.',
        );
        return false;
      }

      setSaveState('error');
      setSaveMessage(null);
      setSaveError(error.error);
      return false;
    } finally {
      isPersistingRef.current = false;
    }
  }, [canEdit, document, documentId, onPersisted]);

  const applyServerDocument = useCallback(
    (nextDocument: ApiDocument) => {
      lastSavedTitleRef.current = nextDocument.title;
      lastSavedContentRef.current = JSON.stringify(nextDocument.content);
      currentJsonRef.current = nextDocument.content;
      titleRef.current = nextDocument.title;
      pendingPersistRef.current = false;
      setPlainText(richTextToPlainText(nextDocument.content));
      setIsDirty(false);
      setSaveState('idle');
      setSaveError(null);
      setSaveMessage(null);
      lastAiSnapshotRef.current = null;
      setCanUndoAiApply(false);

      if (!editor) {
        return;
      }

      editor.commands.setContent(nextDocument.content, false);
    },
    [editor],
  );

  useEffect(() => {
    if (!canEdit || !documentId || !document || !isDirty || isPersistingRef.current) {
      return;
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistSnapshot();
    }, 1200);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [canEdit, document, documentId, isDirty, persistSnapshot, title]);

  useEffect(() => {
    if (!pendingPersistRef.current || !canEdit || !documentId || !document) {
      return;
    }

    const retryPersist = () => {
      if (!pendingPersistRef.current || !navigator.onLine) {
        return;
      }
      void persistSnapshot();
    };

    const shouldRetrySoon =
      navigator.onLine &&
      (connectionState === 'connected' ||
        connectionState === 'resynced' ||
        connectionState === 'idle');
    let retryTimer: number | null = null;

    if (shouldRetrySoon) {
      retryTimer = window.setTimeout(retryPersist, 500);
    }

    window.addEventListener('online', retryPersist);

    return () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      window.removeEventListener('online', retryPersist);
    };
  }, [canEdit, connectionState, document, documentId, persistSnapshot]);

  useEffect(() => {
    if (saveState !== 'saved') {
      return;
    }

    const timer = window.setTimeout(() => {
      setSaveState((current) => (current === 'saved' ? 'idle' : current));
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [saveState]);

  function replaceWithSuggestion(suggestion: string) {
    if (!editor || !canEdit) {
      return;
    }

    lastAiSnapshotRef.current = JSON.parse(JSON.stringify(currentJsonRef.current)) as RichTextContent;
    setCanUndoAiApply(true);
    editor.commands.setContent(plainTextToRichText(suggestion));
  }

  function replaceSelectionWithSuggestion(suggestion: string) {
    if (!editor || !canEdit) {
      return;
    }

    lastAiSnapshotRef.current = JSON.parse(JSON.stringify(currentJsonRef.current)) as RichTextContent;
    setCanUndoAiApply(true);
    const nextContent = plainTextToRichText(suggestion).content ?? [];
    editor.chain().focus().insertContent(nextContent).run();
  }

  function appendSuggestion(suggestion: string) {
    if (!editor || !canEdit) {
      return;
    }

    lastAiSnapshotRef.current = JSON.parse(JSON.stringify(currentJsonRef.current)) as RichTextContent;
    setCanUndoAiApply(true);
    const existing = richTextToPlainText(currentJsonRef.current).trim();
    const next = existing.length > 0 ? `${existing}\n\n${suggestion}` : suggestion;
    editor.commands.setContent(plainTextToRichText(next));
  }

  function undoLastAiApply() {
    if (!editor || !canEdit || !lastAiSnapshotRef.current) {
      return;
    }

    editor.commands.setContent(lastAiSnapshotRef.current, false);
    lastAiSnapshotRef.current = null;
    setCanUndoAiApply(false);
  }

  function clearTransientSaveState() {
    if (saveState !== 'idle' || saveError || saveMessage) {
      setSaveState('idle');
      setSaveError(null);
      setSaveMessage(null);
    }
  }

  return {
    editor,
    connectionState,
    connectionMessage,
    presenceUsers,
    saveState,
    saveError,
    saveMessage,
    isDirty,
    plainText,
    selectionText,
    canUndoAiApply,
    persistSnapshot,
    applyServerDocument,
    replaceWithSuggestion,
    replaceSelectionWithSuggestion,
    appendSuggestion,
    undoLastAiApply,
    clearTransientSaveState,
  };
}
