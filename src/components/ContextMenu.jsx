import React, { forwardRef } from 'react';

const ContextMenu = forwardRef(function ContextMenu(
  { x, y, mode='note', onDelete, onChangeFret, onAddNote, onClose },
  ref
) {
  const menuStyle = {
    position: 'fixed',
    top: y,
    left: x,
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    zIndex: 1001,            // menu above backdrop
  };
  const item = { padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' };

  return (
    <div
      ref={ref}                       // <- exposes the DOM node
      style={menuStyle}
      onClick={e => e.stopPropagation()}  // clicks inside don’t reach backdrop
    >
      {mode === 'note' ? (
        <>
          <div style={item} onClick={onDelete}>Delete note</div>
          <div style={item} onClick={onChangeFret}>Change fret…</div>
        </>
      ) : (
        <div style={item} onClick={onAddNote}>Add note…</div>
      )}
    </div>
  );
});

export default ContextMenu;
