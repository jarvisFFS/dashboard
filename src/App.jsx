import { useState, useEffect } from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable // Importera useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from './supabaseClient';
import './index.css';

// --- DATA ---
const initialProjects = [
  { id: 'p1', title: 'Project Manager' },
  { id: 'p2', title: 'InspoHub' },
  { id: 'p3', title: 'Trading Script' },
  { id: 'p4', title: 'Övrigt' }
];

// --- KOMPONENTER ---

// En wrapper för kolumnen för att göra den "Droppable"
function DroppableColumn({ id, title, children, onAddTask }) {
  const { setNodeRef } = useDroppable({ id }); // id är 'todo', 'progress', 'done'

  return (
    <div ref={setNodeRef} className={`column ${id}`}>
      <h2>{title}</h2>
      {children}
      <button className="btn-add-task" onClick={onAddTask}>
          <span>+</span> Add Task
      </button>
    </div>
  );
}

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

  const totalSub = task.subtasks?.length || 0;
  const doneSub = task.subtasks?.filter(s => s.done).length || 0;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`card proj-${task.project_id || task.projectId}`}
      onClick={() => onClick(task)}
    >
      <h3>{task.title}</h3>
      {totalSub > 0 && (
        <div className="subtask-progress">
          ☑ {doneSub}/{totalSub}
        </div>
      )}
      <div className="card-meta">
        <span className={`tag proj-${task.project_id || task.projectId}`}>{project?.title || 'Övrigt'}</span>
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
  const [tasks, setTasks] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- SUPABASE LOGIK ---
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) console.error('Error fetching tasks:', error);
    else setTasks(data || []);
    setLoading(false);
  };

  const updateTaskStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', id);
    
    if (error) console.error('Error moving task:', error);
  };

  const saveTaskToDb = async (task) => {
    const taskToSave = {
        id: task.id === 'new' ? crypto.randomUUID() : task.id,
        title: task.title,
        project_id: task.projectId || task.project_id, // Hantera båda
        status: task.status,
        date: task.date,
        subtasks: task.subtasks
    };

    const { error } = await supabase
      .from('tasks')
      .upsert(taskToSave);

    if (error) {
        console.error('Error saving task:', error);
        alert('Kunde inte spara! Kolla konsolen.');
    } else {
        fetchTasks();
        setEditingTask(null);
    }
  };

  const deleteTaskFromDb = async (id) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting:', error);
    else {
        setTasks(tasks.filter(t => t.id !== id));
        setEditingTask(null);
    }
  };

  // --- UI HANDLERS ---

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    
    // Check if dropped on a container (column) OR another item
    // dnd-kit kan returnera containerId via data.current.sortable.containerId
    // ELLER så är over.id själva container-id:t om vi använder useDroppable på kolumnen
    let newStatus = null;

    if (['todo', 'progress', 'done'].includes(overId)) {
        // Dropped directly on the column background
        newStatus = overId;
    } else {
        // Dropped on another item -> get that item's status
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) newStatus = overTask.status;
    }

    // Om vi inte hittade status via overId, försök via sortable-data
    if (!newStatus && over.data?.current?.sortable?.containerId) {
        newStatus = over.data.current.sortable.containerId;
    }

    if (newStatus) {
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === activeId);
        const newItems = [...items];
        
        // Optimistisk uppdatering: Flytta kortet direkt i UI
        if (newItems[oldIndex]) {
            if (newItems[oldIndex].status !== newStatus) {
                newItems[oldIndex].status = newStatus;
                updateTaskStatus(activeId, newStatus); // Skicka till DB
            }
            return arrayMove(newItems, oldIndex, items.findIndex(i => i.id === overId)); // Sortera om om vi droppade på ett item
        }
        return items;
      });
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
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

  // --- Subtask Helpers ---
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

  if (loading && tasks.length === 0) {
      return <div className="dashboard" style={{justifyContent:'center', alignItems:'center'}}><h1>Laddar Jarvis DB...</h1></div>
  }

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
            <DroppableColumn 
                key={status} 
                id={status} 
                title={status === 'todo' ? 'To Do' : status === 'progress' ? 'In Progress' : 'Done'}
                onAddTask={() => addNewTask(status)}
            >
              <SortableContext 
                id={status} 
                items={tasks.filter(t => t.status === status).map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="card-list">
                  {tasks.filter(t => t.status === status).map(task => (
                    <SortableItem 
                      key={task.id} 
                      task={task} 
                      project={initialProjects.find(p => p.id === (task.projectId || task.project_id))}
                      onClick={setEditingTask}
                    />
                  ))}
                </div>
              </SortableContext>
            </DroppableColumn>
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
              value={editingTask.projectId || editingTask.project_id} 
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
                  <button className="btn-delete" onClick={() => deleteTaskFromDb(editingTask.id)}>Delete</button>
              )}
              <div style={{flex:1}}></div>
              <button className="btn-save" onClick={() => saveTaskToDb(editingTask)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;