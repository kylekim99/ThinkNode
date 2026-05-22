import { useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useTagStore } from '../store/useTagStore';

export function useKeyboardShortcuts() {
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const addNode = useMapStore((s) => s.addNode);
  const addSibling = useMapStore((s) => s.addSibling);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);
  const applyLayout = useMapStore((s) => s.applyLayout);
  const setSearchOverlayOpen = useTagStore((s) => s.setSearchOverlayOpen);
  const searchOverlayOpen = useTagStore((s) => s.searchOverlayOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd+F: toggle search overlay
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOverlayOpen(!searchOverlayOpen);
        return;
      }

      // Ctrl/Cmd+L: auto layout
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        applyLayout();
        return;
      }

      if (editingNodeId) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if (!selectedNodeId) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        addNode(selectedNodeId);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        addSibling(selectedNodeId);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(selectedNodeId);
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        setEditingNode(selectedNodeId);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, editingNodeId, addNode, addSibling, deleteNode, setEditingNode, undo, redo, applyLayout, setSearchOverlayOpen, searchOverlayOpen]);
}
