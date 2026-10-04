import { Fragment, useLayoutEffect, useRef } from 'react';
import { TimelineTask } from './TimelineTask.tsx';
import type { Task } from '../../domain/task.ts';
import type { TaskCommand } from '../../domain/actions.ts';

const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

interface TimelineProps {
  tasks: Task[];
  now: Date;
  disabled: boolean;
  onEdit: (task: Task) => void;
  onCommand: (command: TaskCommand) => Promise<boolean>;
}

export function Timeline({ tasks, now, disabled, onEdit, onCommand }: TimelineProps) {
  const timeline = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const split = tasks.findIndex((task) => new Date(task.scheduledAtUtc).getTime() >= now.getTime());
  const past = split === -1 ? tasks : tasks.slice(0, split);
  const future = split === -1 ? [] : tasks.slice(split);
  const nextId = future.find((task) => task.status !== 'done')?.id;

  useLayoutEffect(() => {
    if (scrolled.current || !timeline.current) return;
    scrolled.current = true;
    const target = timeline.current.querySelector<HTMLElement>('[data-next="true"]')
      ?? timeline.current.querySelector<HTMLElement>('.now-marker');
    // Scroll only the timeline, once. Later task edits and clock ticks leave it alone.
    if (target) {
      const container = timeline.current;
      container.scrollTop = Math.max(0, container.scrollTop
        + target.getBoundingClientRect().top - container.getBoundingClientRect().top
        - container.clientHeight / 3);
    }
  }, []);

  function rows(group: Task[]) {
    let previousDay = '';
    return group.map((task) => {
      const date = new Date(task.scheduledAtUtc);
      const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const showHeader = day !== previousDay;
      previousDay = day;
      return (
        <Fragment key={task.id}>
          {showHeader ? <h2 className="day-header">{dayLabel.format(date)}</h2> : null}
          <TimelineTask task={task} next={task.id === nextId} disabled={disabled} onEdit={onEdit} onCommand={onCommand} />
        </Fragment>
      );
    });
  }

  return (
    <div className="timeline" ref={timeline} role="region" aria-label="Task timeline" tabIndex={0}>
      {rows(past)}
      <div className="now-marker"><span>NOW · {clock.format(now)}</span></div>
      {tasks.length === 0 ? (
        <div className="empty-state"><h2>A little room for your day.</h2><p>Start with one task. Give it a time, and it will appear here.</p></div>
      ) : rows(future)}
    </div>
  );
}
