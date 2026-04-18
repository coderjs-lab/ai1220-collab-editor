import { useEffect, useMemo, useRef, useState } from 'react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import StarterKit from '@tiptap/starter-kit';
import { type Editor, useEditor } from '@tiptap/react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { api, ApiError } from '../../services/api';
import type { ApiDocument, ApiUser, DocumentSessionResponse, RichTextContent } from '../../types/api';
import { defaultRichTextContent, isRichTextEmpty, plainTextToRichText, richTextToPlainText } from './richText';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

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
  const [isDirty, setIsDirty] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [plainText, setPlainText] = useState('');

  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const lastSavedTitleRef = useRef(document?.title ?? '');
  const lastSavedContentRef = useRef(
    JSON.stringify(document?.content ?? defaultRichTextContent()),
  );
  const currentJsonRef = useRef<RichTextContent>(document?.content ?? defaultRichTextContent());
  const titleRef = useRef(title);
  const seededRef = useRef(false);

  const userDescriptor = useMemo(
    () => ({
      id: currentUser?.id ?? 0,
      name: currentUser?.username ?? 'Anonymous',
      role: session?.role ?? (canEdit ? 'editor' : 'viewer'),
      color: colorForUser(currentUser?.id ?? null),
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
    lastSavedTitleRef.current = document?.title ?? '';
    lastSavedContentRef.current = JSON.stringify(document?.content ?? defaultRichTextContent());
    currentJsonRef.current = document?.content ?? defaultRichTextContent();
    setPlainText(richTextToPlainText(document?.content ?? defaultRichTextContent()));
    setIsDirty(false);
    setSaveState('idle');
    setSaveError(null);
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

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: canEdit,
      editorProps: {
        attributes: {
          class: 'draftboard-editor editor-copy',
        },
      },
      extensions: [
        StarterKit.configure({
          history: false,
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
        if (
          !seededRef.current &&
          !isRichTextEmpty(document?.content) &&
          richTextToPlainText(nextEditor.getJSON() as RichTextContent).trim().length === 0
        ) {
          nextEditor.commands.setContent(document?.content ?? defaultRichTextContent(), false);
          seededRef.current = true;
        }

        const json = nextEditor.getJSON() as RichTextContent;
        currentJsonRef.current = json;
        setPlainText(richTextToPlainText(json));
      },
      onUpdate({ editor: nextEditor }) {
        const json = nextEditor.getJSON() as RichTextContent;
        currentJsonRef.current = json;
        const nextPlainText = richTextToPlainText(json);
        setPlainText(nextPlainText);
        setIsDirty(
          titleRef.current !== lastSavedTitleRef.current ||
            JSON.stringify(json) !== lastSavedContentRef.current,
        );
      },
    },
    [ydoc, provider, canEdit, userDescriptor, document?.id],
  );

  useEffect(() => {
    return () => {
      if (provider) {
        provider.awareness.setLocalState(null);
        provider.destroy();
      }
    };
  }, [provider]);

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
      setPresenceUsers(awarenessToPresence(provider));
    };

    const statusHandler = (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
      if (event.status === 'connected') {
        setConnectionState((current) => (current === 'reconnecting' ? 'resynced' : 'connected'));
        setConnectionMessage('Connected to the collaboration session.');
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
          ? 'Connection dropped. Reconnecting to the shared session.'
          : 'Collaboration is offline for this document.',
      );
    };

    const awarenessHandler = () => {
      setPresenceUsers(awarenessToPresence(provider));
    };

    const closeHandler = () => {
      setConnectionState(seededRef.current ? 'reconnecting' : 'offline');
      setConnectionMessage('The collaboration socket closed. Trying to recover.');
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
  }, [provider]);

  async function persistSnapshot() {
    if (!documentId || !document || !canEdit) {
      return false;
    }

    setSaveState('saving');
    setSaveError(null);

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
      setSaveState('saved');
      onPersisted(response.document);
      return true;
    } catch (error) {
      setSaveState('error');
      setSaveError(
        error instanceof ApiError ? error.error : 'Could not persist the latest document state.',
      );
      return false;
    }
  }

  function replaceWithSuggestion(suggestion: string) {
    if (!editor || !canEdit) {
      return;
    }

    editor.commands.setContent(plainTextToRichText(suggestion));
  }

  function appendSuggestion(suggestion: string) {
    if (!editor || !canEdit) {
      return;
    }

    const existing = richTextToPlainText(currentJsonRef.current).trim();
    const next = existing.length > 0 ? `${existing}\n\n${suggestion}` : suggestion;
    editor.commands.setContent(plainTextToRichText(next));
  }

  function clearTransientSaveState() {
    if (saveState !== 'idle' || saveError) {
      setSaveState('idle');
      setSaveError(null);
    }
  }

  return {
    editor,
    connectionState,
    connectionMessage,
    presenceUsers,
    saveState,
    saveError,
    isDirty,
    plainText,
    persistSnapshot,
    replaceWithSuggestion,
    appendSuggestion,
    clearTransientSaveState,
  };
}
