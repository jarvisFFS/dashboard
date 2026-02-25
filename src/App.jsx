  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    
    // Hitta vilken kolumn vi släppte på
    let newStatus = null;

    if (['todo', 'progress', 'done'].includes(overId)) {
        // Släppte direkt på kolumnen
        newStatus = overId;
    } else {
        // Släppte på ett annat kort -> ta det kortets status
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) newStatus = overTask.status;
    }

    // Fallback: Kolla container-data
    if (!newStatus && over.data?.current?.sortable?.containerId) {
        newStatus = over.data.current.sortable.containerId;
    }

    if (newStatus) {
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === activeId);
        // Hitta item
        const item = items[oldIndex];
        
        // Om statusen ändrats -> Uppdatera
        if (item && item.status !== newStatus) {
            const newItems = [...items];
            newItems[oldIndex] = { ...newItems[oldIndex], status: newStatus };
            
            // Skicka till DB
            updateTaskStatus(activeId, newStatus);
            
            return newItems;
        }
        
        // Om vi bara sorterar inom samma kolumn (kan implementeras senare, men vi skippar arrayMove för nu för att undvika krasch)
        return items;
      });
    }
  };