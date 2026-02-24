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
  { id: 't1', projectId: 'p1', title: 'Sätta upp React-projekt', status: 'done' },
  { id: 't2', projectId: 'p1', title: 'Skapa Kanban-vy', status: 'progress' },
  { id: 't3', projectId: 'p2', title: 'Fixa "Explore"-sidan', status: 'done' },
  { id: 't4', projectId: 'p2', title: 'Länka till produkter', status: 'todo' },
  { id: 't5', projectId: 'p3', title: 'Bestämma strategi', status: 'todo' },
];

// --- KOMPONENTER ---

// Det enskilda kortet (Task)
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

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className="card"
      onClick={() => onClick(task)}
    >
      <h3>{task.title}</h3>
      <span className="tag" style={{backgroundColor: '#333'}}>{project?.title || 'Okänt projekt'}</span>
    </div>
  );
}

// Huvudappen
function App() {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState(null); // ID på kortet vi drar just nu
  const [editingTask, setEditingTask] = useState(null); // Tasken vi redigerar just nu

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Kräv 5px rörelse för att starta drag (så man kan klicka)
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Hantera Drag-Slut
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Hitta vilken kolumn vi släppte i (om vi släppte på en container)
    const overContainer = over.data?.current?.sortable?.containerId || over.id;
    
    // Om vi släppte direkt på en kolumn-ID (todo, progress, done)
    let newStatus = null;
    if (['todo', 'progress', 'done'].includes(overContainer)) {
      newStatus = overContainer;
    } else {
      // Om vi släppte på ett annat kort, hitta dess status
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }

    if (newStatus) {
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === activeId);
        // Uppdatera status
        const newItems = [...items];
        newItems[oldIndex].status = newStatus;
        return newItems;
      });
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  // Spara ändringar från modalen
  const saveTask = () => {
    setTasks(tasks.map(t => t.id === editingTask.id ? editingTask : t));
    setEditingTask(null);
  };

  // Ta bort task
  const deleteTask = () => {
    setTasks(tasks.filter(t => t.id !== editingTask.id));
    setEditingTask(null);
  };

  return (
    <div className="dashboard">
      <header>
        <h1>JARVIS COMMAND CENTER</h1>
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
              <h2>{status === 'todo' ? 'ATT GÖRA 📝' : status === 'progress' ? 'PÅGÅENDE 🚧' : 'KLART ✅'}</h2>
              
              <SortableContext 
                id={status} 
                items={tasks.filter(t => t.status === status).map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="card-list" id={status}> {/* ID behövs för DndContext att hitta kolumnen */}
                  {tasks.filter(t => t.status === status).map(task => (
                    <SortableItem 
                      key={task.id} 
                      task={task} 
                      project={initialProjects.find(p => p.id === task.projectId)}
                      onClick={setEditingTask} // Öppna modal vid klick
                    />
                  ))}
                  {/* Droppable area hack: Osynlig div för att kunna släppa i tom kolumn */}
                  {tasks.filter(t => t.status === status).length === 0 && (
                     <div style={{height: '100px', border: '2px dashed #333', borderRadius: '8px', margin: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555'}}>
                       Släpp här
                     </div>
                  )}
                </div>
              </SortableContext>
            </div>
          ))}
        </main>

        {/* Drag Overlay (Kortet som följer musen) */}
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
            <h2>Redigera Uppgift</h2>
            
            <label>Uppgift</label>
            <input 
              type="text" 
              value={editingTask.title} 
              onChange={e => setEditingTask({...editingTask, title: e.target.value})}
            />

            <label>Projekt</label>
            <select 
              value={editingTask.projectId} 
              onChange={e => setEditingTask({...editingTask, projectId: e.target.value})}
            >
              {initialProjects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>

            <label>Status</label>
            <select 
              value={editingTask.status} 
              onChange={e => setEditingTask({...editingTask, status: e.target.value})}
            >
              <option value="todo">Att göra</option>
              <option value="progress">Pågående</option>
              <option value="done">Klart</option>
            </select>

            <div className="modal-actions">
              <button className="btn-delete" onClick={deleteTask}>Ta bort</button>
              <button className="btn-save" onClick={saveTask}>Spara</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;