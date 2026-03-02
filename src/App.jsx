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

// --- CONSTANTS ---
const assignees = [
  { id: 'oscar', name: 'Oscar', emoji: '👑' },
  { id: 'jarvis', name: 'Jarvis', emoji: '🤖' },
  { id: 'malin', name: 'Malin', emoji: '👩' }
];

// --- KOMPONENTER ---

function DroppableColumn({ id, title, children, onAddTask }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className={`column ${id}`}>
      <h2>{title}</h2>
      {children}
      {id === 'todo' && (
        <button className="btn-add-task" onClick={onAddTask}>
            <span>+</span> Add Task
        </button>
      )}
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
    opacity: isDragging ? 0.5 : 1,
  };

  const totalSub = task.subtasks?.length || 0;
  const doneSub = task.subtasks?.filter(s => s.done).length || 0;

  // Generera en färg baserat på projekt-ID
  const getProjectColor = (pid) => {
      if (!pid) return '#ccc';
      // Fördefinierade färger för kända projekt
      if (pid === 'p1') return '#ffb7b2'; // Project Manager (Pastell Röd)
      if (pid === 'p2') return '#b5ead7'; // InspoHub (Pastell Grön)
      if (pid === 'p3') return '#c7ceea'; // Trading Script (Pastell Blå)
      if (pid === 'p4') return '#e2f0cb'; // Övrigt (Pastell Gul)
      if (pid === 'jarvis-project-id') return '#f9e7b8'; // En pastellgul för Jarvis
      
      // Enkel hash för nya projekt om färgen inte är fördefinierad
      const hash = pid.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
      const hues = [200, 150, 300, 60, 25]; // Försöker sprida ut färger
      const hue = hues[hash % hues.length];
      return `hsl(${hue}, 70%, 80%)`; 
  };

  const tagColor = getProjectColor(task.project_id || task.projectId);
  const assigneeInfo = assignees.find(a => a.id === task.assignee);

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className="card"
      onClick={() => onClick(task)}
    >
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', backgroundColor: tagColor}}></div>
      <h3>{task.title}</h3>
      {totalSub > 0 && (
        <div className="subtask-progress">
          ☑ {doneSub}/{totalSub}
        </div>
      )}
      <div className="card-meta">
        <div style={{display:'flex', gap:'5px', alignItems:'center', flexWrap:'wrap'}}>
            <span className="tag" style={{backgroundColor: tagColor}}>{project?.title || 'Övrigt'}</span>
            {assigneeInfo && <span title={assigneeInfo.name} style={{fontSize: '1rem'}}>{assigneeInfo.emoji}</span>}
        </div>
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
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('all');
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
    const { data: tasksData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    const { data: projData, error: projError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true });

    if (taskError) console.error('Error fetching tasks:', taskError);
    if (projData) setProjects(projData);
    if (tasksData) setTasks(tasksData);
    
    setLoading(false);
  };

  const addProject = async () => {
      if (!newProjectTitle.trim()) return;
      const newId = `p${Date.now()}`;
      // Här lägger vi till en standard-färg för nya projekt
      const projectColor = getProjectColor(newId);
      const { error } = await supabase.from('projects').insert({ id: newId, title: newProjectTitle });
      if (error) console.error('Error adding project:', error);
      else {
          setProjects([...projects, { id: newId, title: newProjectTitle, color: projectColor }]); // Spara färgen med projektet
          setNewProjectTitle('');
      }
  };

  const deleteProject = async (id) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) console.error('Error deleting project:', error);
      else {
          setProjects(projects.filter(p => p.id !== id));
          if (filterProjectId === id) setFilterProjectId('all');
      }
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
        project_id: task.projectId || task.project_id,
        status: task.status,
        date: task.date,
        subtasks: task.subtasks,
        assignee: task.assignee
    };

    const { error } = await supabase.from('tasks').upsert(taskToSave);

    if (error) {
        console.error('Error saving task:', error);
        alert('Kunde inte spara!');
    } else {
        fetchData();
        setEditingTask(null);
    }
  };

  const deleteTaskFromDb = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) console.error('Error deleting:', error);
    else {
        setTasks(tasks.filter(t => t.id !== id));
        setEditingTask(null);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedTaskId = active.id;
    const overId = over.id;
    
    let newStatus = null;

    if (['todo', 'progress', 'done', 'archive'].includes(overId)) {
        newStatus = overId;
    } 
    else {
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) {
            newStatus = overTask.status;
        }
    }

    if (!newStatus) return;

    setTasks((currentTasks) => {
        return currentTasks.map(task => {
            if (task.id === draggedTaskId) {
                if (task.status !== newStatus) {
                    updateTaskStatus(draggedTaskId, newStatus);
                    return { ...task, status: newStatus };
                }
            }
            return task;
        });
    });
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const addNewTask = (status) => {
      setEditingTask({
          id: 'new',
          title: '',
          projectId: projects.length > 0 ? projects[0].id : 'p4', // Använd första projektet om det finns, annars default
          status: status,
          date: new Date().toISOString().split('T')[0],
          subtasks: []
      });
  };

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

  const filteredTasks = filterProjectId === 'all' 
      ? tasks 
      : tasks.filter(t => (t.project_id || t.projectId) === filterProjectId);

  if (loading && tasks.length === 0) {
      return <div className="dashboard" style={{justifyContent:'center', alignItems:'center'}}><h1>Laddar Dashboard...</h1></div>
  }

  return (
    <div className="dashboard">
      <header>
        <div className="header-left">
            <h1>JARVIS KANBAN BOARD</h1>
            
            <select 
                className="project-filter"
                value={filterProjectId}
                onChange={(e) => setFilterProjectId(e.target.value)}
            >
                <option value="all">Show All Projects</option>
                {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                ))}
            </select>
        </div>
        
        <div className="header-right">
            <button className="btn-projects" onClick={() => setShowProjectModal(true)}>
                <span>⚙️</span> Projects
            </button>
        </div>
      </header>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        <main className="board">
          {['todo', 'progress', 'done', 'archive'].map(status => (
            <DroppableColumn 
                key={status} 
                id={status} 
                title={status === 'todo' ? 'To Do' : status === 'progress' ? 'In Progress' : status === 'done' ? 'Done' : 'Archive 📦'}
                onAddTask={() => addNewTask(status)}
            >
              <SortableContext 
                id={status} 
                items={filteredTasks.filter(t => t.status === status).map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="card-list">
                  {filteredTasks.filter(t => t.status === status).map(task => (
                    <SortableItem 
                      key={task.id} 
                      task={task} 
                      project={projects.find(p => p.id === (task.projectId || task.project_id))}
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

      {/* EDIT TASK MODAL */}
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
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>

            <label>Assignee</label>
            <select 
              value={editingTask.assignee || ''} 
              onChange={e => setEditingTask({...editingTask, assignee: e.target.value})}
            >
              <option value="">Unassigned</option>
              {assignees.map(a => (
                <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
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

      {/* PROJECT MANAGER MODAL */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2>Manage Projects</h2>
                <button className="btn-close" onClick={() => setShowProjectModal(false)}>✕</button>
            </div>

            <div className="project-list">
                {projects.map(p => (
                    <div key={p.id} className="project-item">
                        <span>{p.title}</span>
                        <button onClick={() => deleteProject(p.id)}>🗑️</button>
                    </div>
                ))}
            </div>

            <label>Add New Project</label>
            <div className="add-project-form">
                <input 
                    type="text" 
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    placeholder="Project Name..."
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