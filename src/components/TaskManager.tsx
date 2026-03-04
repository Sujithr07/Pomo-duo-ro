import React, { useEffect, useState } from 'react';
import { database } from '../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import type { Task } from '../types';

interface Props {
  userUid: string;
  /** Called when user selects a task to work on */
  onSelectTask?: (taskName: string) => void;
  activeTask?: string;
}

const TaskManager: React.FC<Props> = ({ userUid, onSelectTask, activeTask }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    const tasksRef = ref(database, `tasks/${userUid}`);
    return onValue(tasksRef, (snap) => {
      if (!snap.exists()) { setTasks([]); return; }
      const data = snap.val() as Record<string, Omit<Task, 'id'>>;
      const list = Object.entries(data)
        .map(([id, t]) => ({ id, ...t }))
        .sort((a, b) => b.createdAt - a.createdAt);
      setTasks(list);
    });
  }, [userUid]);

  const addTask = () => {
    const name = newTask.trim();
    if (!name) return;
    const tasksRef = ref(database, `tasks/${userUid}`);
    push(tasksRef, { name, completed: false, createdAt: Date.now() });
    setNewTask('');
  };

  const toggleComplete = (task: Task) => {
    // If completing the active task, clear the active selection
    if (!task.completed && activeTask === task.name && onSelectTask) {
      onSelectTask('');
    }
    const taskRef = ref(database, `tasks/${userUid}/${task.id}`);
    update(taskRef, { completed: !task.completed });
  };

  const deleteTask = (task: Task) => {
    // If the deleted task is the active one, clear it
    if (activeTask === task.name && onSelectTask) {
      onSelectTask('');
    }
    const taskRef = ref(database, `tasks/${userUid}/${task.id}`);
    remove(taskRef);
  };

  const displayed = hideCompleted ? tasks.filter((t) => !t.completed) : tasks;
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="task-manager">
      <div className="task-header">
        <div className="task-title-group">
          <span className="task-icon">📋</span>
          <h3 className="task-title">Tasks</h3>
          <span className="task-count">{tasks.length - completedCount} active</span>
        </div>
        {completedCount > 0 && (
          <label className="task-hide-toggle">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={() => setHideCompleted(!hideCompleted)}
            />
            <span>Hide done ({completedCount})</span>
          </label>
        )}
      </div>

      <div className="task-input-row">
        <input
          className="task-input"
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          placeholder="Add a task…"
        />
        <button className="btn btn-primary task-add-btn" onClick={addTask} disabled={!newTask.trim()}>
          Add
        </button>
      </div>

      {displayed.length === 0 ? (
        <p className="task-empty">
          {tasks.length === 0 ? 'No tasks yet. Add one above!' : 'All tasks completed! 🎉'}
        </p>
      ) : (
        <div className="task-list">
          {displayed.map((task) => (
            <div
              key={task.id}
              className={`task-row ${task.completed ? 'done' : ''} ${activeTask === task.name ? 'active' : ''}`}
            >
              <button
                className={`task-check ${task.completed ? 'checked' : ''}`}
                onClick={() => toggleComplete(task)}
                title={task.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {task.completed ? '✓' : ''}
              </button>
              <span className="task-name">{task.name}</span>
              {onSelectTask && !task.completed && (
                <button
                  className={`task-select-btn ${activeTask === task.name ? 'selected' : ''}`}
                  onClick={() => onSelectTask(task.name)}
                  title="Work on this task"
                >
                  {activeTask === task.name ? '▶ Active' : '▶ Start'}
                </button>
              )}
              <button
                className="task-delete-btn"
                onClick={() => deleteTask(task)}
                title="Delete task"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskManager;
