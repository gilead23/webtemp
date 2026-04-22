import React, { useState } from 'react';
import { FlagDefinition, UiFlagInstance } from '../types/flags';
import { FlagColumn } from './FlagColumn';
import { FlagParamModal } from './FlagParamModal';

type FlagKind = 'entry' | 'exit';

interface SweepFlagsPaneProps {
  entryFlagDefs: FlagDefinition[];
  exitFlagDefs: FlagDefinition[];
  entryFlags: UiFlagInstance[];
  exitFlags: UiFlagInstance[];
  onChangeEntryFlags(flags: UiFlagInstance[]): void;
  onChangeExitFlags(flags: UiFlagInstance[]): void;
}

export const SweepFlagsPane: React.FC<SweepFlagsPaneProps> = ({
  entryFlagDefs,
  exitFlagDefs,
  entryFlags,
  exitFlags,
  onChangeEntryFlags,
  onChangeExitFlags,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<FlagKind>('entry');
  const [editingFlag, setEditingFlag] = useState<UiFlagInstance | null>(null);

  const openAddModal = (kind: FlagKind) => {
    setEditingFlag(null);
    setModalKind(kind);
    setModalOpen(true);
  };

  const openEditModal = (kind: FlagKind, flag: UiFlagInstance) => {
    setModalKind(kind);
    setEditingFlag(flag);
    setModalOpen(true);
  };

  const handleSave = (saved: UiFlagInstance) => {
    if (modalKind === 'entry') {
      const existing = entryFlags.find(f => f.id === saved.id);
      if (existing) {
        onChangeEntryFlags(entryFlags.map(f => (f.id === saved.id ? saved : f)));
      } else {
        onChangeEntryFlags([...entryFlags, saved]);
      }
    } else {
      const existing = exitFlags.find(f => f.id === saved.id);
      if (existing) {
        onChangeExitFlags(exitFlags.map(f => (f.id === saved.id ? saved : f)));
      } else {
        onChangeExitFlags([...exitFlags, saved]);
      }
    }
    setModalOpen(false);
    setEditingFlag(null);
  };

  const handleDelete = (kind: FlagKind, id: string) => {
    if (kind === 'entry') {
      onChangeEntryFlags(entryFlags.filter(f => f.id !== id));
    } else {
      onChangeExitFlags(exitFlags.filter(f => f.id !== id));
    }
  };

  const definitions = modalKind === 'entry' ? entryFlagDefs : exitFlagDefs;

  return (
    <div className="flex gap-4 w-full">
      <FlagColumn
        title="Entry Flags"
        kind="entry"
        flags={entryFlags}
        onAdd={() => openAddModal('entry')}
        onEdit={(flag) => openEditModal('entry', flag)}
        onDelete={(id) => handleDelete('entry', id)}
      />
      <FlagColumn
        title="Exit Flags"
        kind="exit"
        flags={exitFlags}
        onAdd={() => openAddModal('exit')}
        onEdit={(flag) => openEditModal('exit', flag)}
        onDelete={(id) => handleDelete('exit', id)}
      />

      <FlagParamModal
        isOpen={modalOpen}
        kind={modalKind}
        flagDefinitions={definitions}
        initialFlag={editingFlag}
        onCancel={() => {
          setModalOpen(false);
          setEditingFlag(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};
