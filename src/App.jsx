import { useState } from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './index.css';

// --- DATA ---
const initialProjects = [
  { id: 'p1', title: 'Project Manager' },
  { id: 'p2', title: 'InspoHub' },
  { id: 'p3', title: 'Trading Script' },
  { id: 'p4', title: 'Övrigt' }
];

const initialTasks = [
  { 
    id: 't1', 
    projectId: 'p1', 
    title: 'Sätta upp React-projekt', 
    status: 'done', 
    date: '2026-02-24',
    subtasks: [{ id: 's1', text: 'Installera Vite', done: true }, { id: 's2', text: 'Konfa CSS', done: true }]
  },
  { id: 't2', projectId: 'p1', title: 'Skapa Kanban-vy', status: 'progress', date: '2026-02-25', subtasks: [] },
  { id: 't3', projectId: 'p2', title: 'Fixa "Explore"-sidan', status: 'done', date: '2026-02-23', subtasks: [] },
  { id: 't4', projectId: 'p2', title: 'Länka till produkter', status: 'todo', date: '', subtasks: [] },
  { id: 't5', projectId: 'p3', title: 'Bestämma strategi', status: 'todo', date: '2026-02-28', subtasks: [] },
];

// --- KOMPONENTER ---

function SortableItem({ task, project, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { ...task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.0 : 1,
  };

  // Beräkna progress (antal klara / totalt)
  const totalSub = task.subtasks?.length || 0;
  const doneSub = task.subtasks?.filter(s => s.done).length || 0;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`card proj-${task.projectId}`} // Klass för färg
      onClick={() => onClick(task)}
    >
      <h3>{task.title}</h3>
      
      {/* Visa progress om subtasks finns */}
      {totalSub > 0 && (
        <div className="subtask-progress">
          ☑ {doneSub}/{totalSub}
        </div>
      )}

      <div className="card-meta">
        <span className={`tag proj-${task.projectId}`}>{project?.title || 'Övrigt'}</span>
        {task.date && (
          <span className="date-badge">
            📅 {task.date.slice(5)}
          </span>
        )}
      </div>
    </div>
  );
}

function App() {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    const overContainer = over.data?.current?.sortable?.containerId || over.id;
    
    let newStatus = null;
    if (['todo', 'progress', 'done'].includes(overContainer)) {
      newStatus = overContainer;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }

    if (newStatus) {
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === activeId);
        const newItems = [...items];
        newItems[oldIndex].status = newStatus;
        return newItems;
      });
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const saveTask = () => {
    if (editingTask.id === 'new') {
        const newTask = { ...editingTask, id: `t${Date.now()}` };
        setTasks([...tasks, newTask]);
    } else {
        setTasks(tasks.map(t => t.id === editingTask.id ? editingTask : t));
    }
    setEditingTask(null);
  };

  const deleteTask = () => {
    setTasks(tasks.filter(t => t.id !== editingTask.id));
    setEditingTask(null);
  };

  const addNewTask = (status) => {
      setEditingTask({
          id: 'new',
          title: '',
          projectId: 'p4',
          status: status,
          date: new Date().toISOString().split('T')[0],
          subtasks: []
      });
  };

  // --- Subtask funktioner ---
  const addSubtask = () => {
    const newSub = { id: `s${Date.now()}`, text: '', done: false };
    setEditingTask({ ...editingTask, subtasks: [...(editingTask.subtasks || []), newSub] });
  };

  const updateSubtask = (id, field, value) => {
    const updated = editingTask.subtasks.map(s => s.id === id ? { ...s, [field]: value } : s);
    setEditingTask({ ...editingTask, subtasks: updated });
  };

  const removeSubtask = (id) => {
    const updated = editingTask.subtasks.filter(s => s.id !== id);
    setEditingTask({ ...editingTask, subtasks: updated });
  };

  return (
    <div className="dashboard">
      <header>
        <h1>JARVIS BOARD</h1>
        <div className="user">OSCAR</div>
      </header>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        <main className="board">
          {['todo', 'progress', 'done'].map(status => (
            <div key={status} className={`column ${status}`}>
              <h2>{status === 'todo' ? 'To Do' : status === 'progress' ? 'In Progress' : 'Done'}</h2>
              
              <SortableContext 
                id={status} 
                items={tasks.filter(t => t.status === status).map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="card-list" id={status}>
                  {tasks.filter(t => t.status === status).map(task => (
                    <SortableItem 
                      key={task.id} 
                      task={task} 
                      project={initialProjects.find(p => p.id === task.projectId)}
                      onClick={setEditingTask}
                    />
                  ))}
                </div>
              </SortableContext>

              <button className="btn-add-task" onClick={() => addNewTask(status)}>
                  <span>+</span> Add Task
              </button>
            </div>
          ))}
        </main>

        <DragOverlay>
          {activeId ? (
            <div className="card dragging">
               <h3>{tasks.find(t => t.id === activeId)?.title}</h3>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* EDIT MODAL */}
      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2>{editingTask.id === 'new' ? 'New Task' : 'Edit Task'}</h2>
                <button className="btn-close" onClick={() => setEditingTask(null)}>✕</button>
            </div>
            
            <label>Title</label>
            <input 
              type="text" 
              autoFocus
              value={editingTask.title} 
              onChange={e => setEditingTask({...editingTask, title: e.target.value})}
              placeholder="Vad ska göras?"
            />

            <label>Project</label>
            <select 
              value={editingTask.projectId} 
              onChange={e => setEditingTask({...editingTask, projectId: e.target.value})}
            >
              {initialProjects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>

            <label>Checklist</label>
            <div className="checklist">
              {(editingTask.subtasks || []).map(sub => (
                <div key={sub.id} className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={sub.done} 
                    onChange={e => updateSubtask(sub.id, 'done', e.target.checked)}
                  />
                  <input 
                    type="text" 
                    value={sub.text} 
                    onChange={e => updateSubtask(sub.id, 'text', e.target.value)}
                    placeholder="Delmål..."
                  />
                  <button onClick={() => removeSubtask(sub.id)} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button>
                </div>
              ))}
              <button className="btn-add-subtask" onClick={addSubtask}>+ Add Item</button>
            </div>

            <label>Due Date</label>
            <input 
                type="date"
                value={editingTask.date || ''}
                onChange={e => setEditingTask({...editingTask, date: e.target.value})}
            />

            <div className="modal-actions">
              {editingTask.id !== 'new' && (
                  <button className="btn-delete" onClick={deleteTask}>Delete</button>
              )}
              <div style={{flex:1}}></div>
              <button className="btn-save" onClick={saveTask}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;