import { useState, useEffect } from 'react';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from './supabaseClient'; // Din nya databas-koppling!
import './index.css';

// --- DATA ---
const initialProjects = [
  { id: 'p1', title: 'Project Manager' },
  { id: 'p2', title: 'InspoHub' },
  { id: 'p3', title: 'Trading Script' },
  { id: 'p4', title: 'Övrigt' }
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
  const [tasks, setTasks] = useState([]); // Börjar tomt, hämtar från DB
  const [activeId, setActiveId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- SUPABASE LOGIK ---

  // 1. Hämta tasks vid start
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true }); // Sortera på skapad

    if (error) console.error('Error fetching tasks:', error);
    else setTasks(data || []);
    setLoading(false);
  };

  // 2. Uppdatera status (Drag & Drop)
  const updateTaskStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', id);
    
    if (error) console.error('Error moving task:', error);
  };

  // 3. Spara (Ny eller Uppdaterad)
  const saveTaskToDb = async (task) => {
    // Om det är en "new" (id='new'), ta bort id så Supabase genererar ett (eller vi gör ett)
    // I din SQL satte vi id som text primary key, så vi genererar ett här.
    
    const taskToSave = {
        id: task.id === 'new' ? crypto.randomUUID() : task.id,
        title: task.title,
        project_id: task.projectId, // Mappar projectId -> project_id i DB
        status: task.status,
        date: task.date,
        subtasks: task.subtasks
    };

    const { error } = await supabase
      .from('tasks')
      .upsert(taskToSave); // Upsert = Insert or Update

    if (error) {
        console.error('Error saving task:', error);
        alert('Kunde inte spara! Kolla konsolen.');
    } else {
        fetchTasks(); // Hämta lista igen för att vara säker
        setEditingTask(null);
    }
  };

  // 4. Ta bort
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
    const overContainer = over.data?.current?.sortable?.containerId || over.id;
    
    let newStatus = null;
    if (['todo', 'progress', 'done'].includes(overContainer)) {
      newStatus = overContainer;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }

    if (newStatus) {
      // Optimistisk UI-uppdatering (uppdatera direkt, sen databas)
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === activeId);
        const newItems = [...items];
        if (newItems[oldIndex].status !== newStatus) {
            newItems[oldIndex].status = newStatus;
            updateTaskStatus(activeId, newStatus); // Skicka till DB
        }
        return newItems;
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
                      project={initialProjects.find(p => p.id === (task.projectId || task.project_id))} // Hantera både camelCase och snake_case från DB
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