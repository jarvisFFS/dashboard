  return (
    <div className="dashboard">
      <header>
        <div className="header-left">
            <h1>JARVIS BOARD</h1>
            
            {/* FILTER DROPDOWN */}
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
        <div className="user">OSCAR</div>
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
              {projects.map(p => (
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