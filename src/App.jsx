  const handleDragEnd = async (event) => { // async nu
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    
    let newStatus = null;

    if (['todo', 'progress', 'done'].includes(overId)) {
        newStatus = overId;
    } else {
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) newStatus = overTask.status;
    }

    if (!newStatus && over.data?.current?.sortable?.containerId) {
        newStatus = over.data.current.sortable.containerId;
    }

    if (newStatus) {
      // Hitta nuvarande status för att se om den ändrats
      const currentTask = tasks.find(t => t.id === activeId);
      if (currentTask && currentTask.status !== newStatus) {
          
          // 1. Uppdatera lokalt state "dumt" men säkert (bara ändra status, ingen sortering)
          setTasks(prevTasks => prevTasks.map(t => 
              t.id === activeId ? { ...t, status: newStatus } : t
          ));

          // 2. Skicka till DB och hämta om allt för att vara säker
          await updateTaskStatus(activeId, newStatus);
          fetchTasks(); 
      }
    }
  };