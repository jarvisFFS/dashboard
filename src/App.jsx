import { useState } from 'react'
import { Link } from 'react-router-dom'
import './index.css'

const initialProjects = [
  { id: 1, title: 'Project Manager', status: 'active', desc: 'Bygga detta dashboard.' },
  { id: 2, title: 'InspoHub', status: 'active', desc: 'Affiliate-sajt med Pinterest-grid.' },
  { id: 3, title: 'Trading Script', status: 'idea', desc: 'Pine Script för TradingView.' },
]

const initialTasks = [
  { id: 101, projectId: 1, title: 'Sätta upp React-projekt', status: 'done' },
  { id: 102, projectId: 1, title: 'Skapa Kanban-vy', status: 'progress' },
  { id: 103, projectId: 2, title: 'Fixa "Explore"-sidan', status: 'done' },
  { id: 104, projectId: 2, title: 'Länka till produkter', status: 'todo' },
  { id: 105, projectId: 3, title: 'Bestämma strategi', status: 'todo' },
]

function App() {
  const [tasks, setTasks] = useState(initialTasks)

  const getTasksByStatus = (status) => tasks.filter(t => t.status === status)

  const moveTask = (id, newStatus) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t))
  }

  return (
    <div className="dashboard">
      <header>
        <h1>JARVIS COMMAND CENTER</h1>
        <div className="user">OSCAR</div>
      </header>

      <main className="board">
        {/* Kolumn: ATT GÖRA */}
        <div className="column todo">
          <h2>ATT GÖRA 📝</h2>
          <div className="card-list">
            {getTasksByStatus('todo').map(task => (
              <div key={task.id} className="card" onClick={() => moveTask(task.id, 'progress')}>
                <h3>{task.title}</h3>
                <span className="tag">{initialProjects.find(p => p.id === task.projectId)?.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kolumn: PÅGÅENDE */}
        <div className="column progress">
          <h2>PÅGÅENDE 🚧</h2>
          <div className="card-list">
            {getTasksByStatus('progress').map(task => (
              <div key={task.id} className="card" onClick={() => moveTask(task.id, 'done')}>
                <h3>{task.title}</h3>
                <span className="tag">{initialProjects.find(p => p.id === task.projectId)?.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kolumn: KLART */}
        <div className="column done">
          <h2>KLART ✅</h2>
          <div className="card-list">
            {getTasksByStatus('done').map(task => (
              <div key={task.id} className="card" style={{opacity: 0.6}}>
                <h3>{task.title}</h3>
                <span className="tag">{initialProjects.find(p => p.id === task.projectId)?.title}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App