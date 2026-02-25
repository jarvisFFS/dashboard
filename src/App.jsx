import { useState, useEffect } from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable
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

// --- DATA & COLORS ---
// Vi slumpar färger från en palett om vi inte har sparat dem
const PASTEL_COLORS = [
  '#ffb7b2', // Röd
  '#b5ead7', // Grön
  '#c7ceea', // Blå
  '#e2f0cb', // Gul
  '#ffdac1', // Orange
  '#e0bbe4', // Lila
];

const getProjectColor = (index) => {
  return PASTEL_COLORS[index % PASTEL_COLORS.length];
};

// --- KOMPONENTER ---

function DroppableColumn({ id, title, children, onAddTask }) {
  const { setNodeRef } = useDroppable({ id });

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

function SortableItem({ task, project, color, onClick }) {
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
    opacity: isDragging ? 0.5 : 1,
  };

  const totalSub = task.subtasks?.length || 0;
  const doneSub = task.subtasks?.filter(s => s.done).length || 0;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className="card"
      onClick={() => onClick(task)}
    >
      {/* Vänsterkantsfärg via inline-style */}
      <div style={{position:'absolute', top:0, left:0, bottom:0, width:'4px', backgroundColor: color}}></div>
      
      <h3 style={{paddingLeft:'8px'}}>{task.title}</h3>
      {totalSub > 0 && (
        <div className="subtask-progress" style={{paddingLeft:'8px'}}>
          ☑ {doneSub}/{totalSub}
        </div>
      )}
      <div className="card-meta" style={{paddingLeft:'8px'}}>
        <span className="tag" style={{backgroundColor: color}}>{project?.title || 'Unknown'}</span>
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
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: tasksData } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
    const { data: projectsData } = await supabase.from('projects').select('*').order('created_at', { ascending: true });
    
    if (tasksData) setTasks(tasksData);
    if (projectsData) setProjects(projectsData);
    setLoading(false);
  };

  // --- PROJECT MANAGEMENT ---
  const addProject = async () => {
    if (!newProjectName.trim()) return;
    const { data, error } = await supabase.from('projects').insert({
        id: `p${Date.now()}`, // Enkelt ID
        title: newProjectName
    }).select();

    if (data) {
        setProjects([...projects, data[0]]);
        setNewProjectName('');
    }
  };

  const deleteProject = async (id) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (!error) {
          setProjects(projects.filter(p => p.id !== id));
      }
  };

  // --- TASK LOGIC ---
  const updateTaskStatus = async (id, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
  };

  const saveTaskToDb = async (task) => {
    const taskToSave = {
        id: task.id === 'new' ? crypto.randomUUID() : task.id,
        title: task.title,
        project_id: task.projectId || task.project_id,
        status: task.status,
        date: task.date,
        subtasks: task.subtasks
    };
    const { error } = await supabase.from('tasks').upsert(taskToSave);
    if (!error) {
        fetchData(); // Uppdatera allt
        setEditingTask(null);
    }
  };

  const deleteTaskFromDb = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
        setTasks(tasks.filter(t => t.id !== id));
        setEditingTask(null);
    }
  };

  // --- DRAG HANDLER ---
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    let newStatus = null;

    if (['todo', 'progress', 'done'].includes(overId)) newStatus = overId;
    else {
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) newStatus = overTask.status;
    }

    if (newStatus) {
      setTasks((items) => {
        const item = items.find(i => i.id === activeId);
        if (item && item.status !== newStatus) {
            updateTaskStatus(activeId, newStatus);
            return items.map(i => i.id === activeId ? { ...i, status: newStatus } : i);
        }
        return items;
      });
    }
  };

  const handleDragStart = (event) => setActiveId(event.active.id);

  const addNewTask = (status) => {
      setEditingTask({
          id: 'new', title: '', projectId: projects[0]?.id || '', status: status, 
          date: new Date().toISOString().split('T')[0], subtasks: []
      });
  };

  // --- SUBTASKS ---
  const updateSubtask = (id, field, value) => {
    const updated = editingTask.subtasks.map(s => s.id === id ? { ...s, [field]: value } : s);
    setEditingTask({ ...editingTask, subtasks: updated });
  };
  const addSubtask = () => {
      setEditingTask({ ...editingTask, subtasks: [...(editingTask.subtasks || []), { id: `s${Date.now()}`, text: '', done: false }] });
  };
  const removeSubtask = (id) => {
      setEditingTask({ ...editingTask, subtasks: editingTask.subtasks.filter(s => s.id !== id) });
  };

  if (loading) return <div className="dashboard" style={{justifyContent:'center', alignItems:'center'}}><h1>Loading...</h1></div>;

  return (
    <div className="dashboard">
      <header>
        <h1>JARVIS BOARD</h1>
        <div className="header-actions">
            <button className="btn-projects" onClick={() => setShowProjectModal(true)}>⚙️ Projects</button>
            <div className="user">OSCAR</div>
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <main className="board">
          {['todo', 'progress', 'done'].map(status => (
            <DroppableColumn key={status} id={status} title={status === 'todo' ? 'To Do' : status === 'progress' ? 'In Progress' : 'Done'} onAddTask={() => addNewTask(status)}>
              <SortableContext id={status} items={tasks.filter(t => t.status === status).map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="card-list">
                  {tasks.filter(t => t.status === status).map(task => {
                    const project = projects.find(p => p.id === (task.projectId || task.project_id));
                    // Hitta färg baserat på projektets index i listan
                    const colorIndex = projects.findIndex(p => p.id === (task.projectId || task.project_id));
                    const color = getProjectColor(colorIndex >= 0 ? colorIndex : 0);
                    
                    return (
                        <SortableItem key={task.id} task={task} project={project} color={color} onClick={setEditingTask} />
                    );
                  })}
                </div>
              </SortableContext>
            </DroppableColumn>
          ))}
        </main>
        <DragOverlay>
          {activeId ? <div className="card dragging"><h3>{tasks.find(t => t.id === activeId)?.title}</h3></div> : null}
        </DragOverlay>
      </DndContext>

      {/* TASK MODAL */}
      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingTask.id === 'new' ? 'New Task' : 'Edit Task'}</h2>
            <label>Title</label>
            <input type="text" autoFocus value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} />
            
            <label>Project</label>
            <select value={editingTask.projectId || editingTask.project_id} onChange={e => setEditingTask({...editingTask, projectId: e.target.value})}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>

            <label>Checklist</label>
            <div className="checklist">
              {(editingTask.subtasks || []).map(sub => (
                <div key={sub.id} className="checklist-item">
                  <input type="checkbox" checked={sub.done} onChange={e => updateSubtask(sub.id, 'done', e.target.checked)} />
                  <input type="text" value={sub.text} onChange={e => updateSubtask(sub.id, 'text', e.target.value)} />
                  <button onClick={() => removeSubtask(sub.id)}>🗑️</button>
                </div>
              ))}
              <button className="btn-add-subtask" onClick={addSubtask}>+ Add Item</button>
            </div>

            <label>Due Date</label>
            <input type="date" value={editingTask.date || ''} onChange={e => setEditingTask({...editingTask, date: e.target.value})} />

            <div className="modal-actions">
              {editingTask.id !== 'new' && <button className="btn-delete" onClick={() => deleteTaskFromDb(editingTask.id)}>Delete</button>}
              <button className="btn-save" onClick={() => saveTaskToDb(editingTask)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECT MANAGER MODAL */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2>Manage Projects</h2>
                <button className="btn-close" onClick={() => setShowProjectModal(false)}>✕</button>
            </div>
            
            <div className="project-list">
                {projects.map((p, index) => (
                    <div key={p.id} className="project-item">
                        <span style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <span className="tag" style={{backgroundColor: getProjectColor(index)}}>{p.title}</span>
                        </span>
                        <button onClick={() => deleteProject(p.id)}>🗑️</button>
                    </div>
                ))}
            </div>

            <div className="add-project-form">
                <input 
                    type="text" 
                    placeholder="New Project Name..." 
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                />
                <button onClick={addProject}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;