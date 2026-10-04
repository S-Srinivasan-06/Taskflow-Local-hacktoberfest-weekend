import { toLocalIsoWithoutOffset } from '../src/domain/dates.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(condition, message) {
  const deadline = performance.now() + 5000;
  while (performance.now() < deadline) {
    const result = condition();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(message);
}

function click(text, root = document) {
  const button = [...root.querySelectorAll('button')].find((item) => item.textContent.trim() === text);
  assert(button && !button.disabled, `Button is missing or disabled: ${text}`);
  button.click();
}

function input(labelText, value) {
  const label = [...document.querySelectorAll('.editor label')].find((item) => item.textContent === labelText);
  const control = label && document.getElementById(label.htmlFor);
  assert(control instanceof HTMLInputElement, `Input is missing: ${labelText}`);
  // Dispatch the same DOM events a browser input sends, bypassing React's value tracker.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

function row(title) {
  return [...document.querySelectorAll('.task-row')].find((item) => item.querySelector('h3')?.textContent === title);
}

async function openEditor(title) {
  click('+ New task');
  await waitFor(() => document.querySelector('.editor'), 'The editor did not open');
  input('Task', title);
}

export async function runSmoke(browserErrors) {
  const checks = [];
  const result = document.createElement('output');
  result.id = 'browser-check';
  result.hidden = true;
  document.body.append(result);
  try {
    const parameters = new URLSearchParams(location.search);
    if (parameters.has('fail_load')) {
      await waitFor(() => document.querySelector('.notice'), 'Database-open error did not appear');
      assert(document.querySelector('.app-header button').disabled, 'Manual writes should be disabled before the database opens');
      click('Reload tasks');
      checks.push('database-open failure can be retried');
    }
    await waitFor(() => document.querySelector('.timeline'), 'The timeline did not load');
    assert(!document.querySelector('.notice'), 'The app still shows a load error');
    assert(!document.querySelector('vite-error-overlay'), 'Vite reports a page error');
    const marker = document.querySelector('.now-marker');
    assert(marker, 'The NOW marker is missing');
    if (parameters.has('empty')) {
      assert(document.querySelector('.empty-state'), 'The empty timeline should explain how to add a task');
      checks.push('empty timeline renders');
    } else {
      const previous = row('Finish the report');
      const next = document.querySelector('[data-next="true"]');
      assert(previous.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING, 'Past tasks should precede NOW');
      assert(next.querySelector('h3').textContent === 'Gym', 'NEXT should skip completed future tasks');
      assert(marker.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING, 'Future tasks should follow NOW');
      checks.push('timeline order and next task');
      const timeline = document.querySelector('.timeline');
      timeline.scrollTop = 0;
      click('Mark read', next);
      await waitFor(() => row('Gym')?.querySelector('h3').dataset.read === 'true', 'The seeded task did not update');
      assert(timeline.scrollTop === 0, 'Task updates should not move the timeline after the initial scroll');
      checks.push('manual scroll stays in place after an update');
    }

    const count = document.querySelectorAll('.task-row').length;
    const requestInput = document.getElementById('task-request');
    assert(requestInput instanceof HTMLInputElement, 'Local request input is missing');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(requestInput, 'Add browser request task tomorrow at nine for one hour');
    requestInput.dispatchEvent(new Event('input', { bubbles: true }));
    click('Send');
    await waitFor(() => document.querySelector('.approval'), 'The local model did not return an approval card');
    assert(!row('Approved browser request'), 'A model proposal wrote a task before approval');
    assert(document.querySelector('.approval')?.textContent.includes('Nothing changes until you approve it.'), 'The approval card must tell the user no change has been saved');
    click('Approve', document.querySelector('.approval'));
    const proposedTask = await waitFor(() => row('Approved browser request'), 'Approved model proposal did not create a task');
    assert(proposedTask.querySelector('.duration')?.textContent === '60 min', 'The approval must preserve the validated duration');
    click('Delete', proposedTask);
    await waitFor(() => proposedTask.querySelector('.delete-confirm'), 'Fixture proposal cleanup confirmation did not open');
    click('Delete task', proposedTask);
    await waitFor(() => !row('Approved browser request'), 'Fixture proposal cleanup did not complete');
    assert(document.querySelectorAll('.task-row').length === count, 'The model approval fixture task count should be restored');
    checks.push('model proposal waits for approval before one task write');

    await openEditor('   ');
    click('Add task', document.querySelector('.editor'));
    await waitFor(() => document.querySelector('.editor [role="alert"]'), 'Whitespace-only titles should show validation');
    assert(document.querySelectorAll('.task-row').length === count, 'Invalid input wrote a task');
    click('Cancel', document.querySelector('.editor'));
    await waitFor(() => !document.querySelector('.editor'), 'Cancel did not close the editor');
    checks.push('invalid form does not write');

    const title = 'Browser check task';
    const scheduledAt = new Date(Date.now() + 120 * 60_000);
    scheduledAt.setSeconds(0, 0);
    await openEditor(title);
    input('Date and time', toLocalIsoWithoutOffset(scheduledAt));
    input('Duration (minutes)', '45');
    click('Add task', document.querySelector('.editor'));
    let task = await waitFor(() => row(title), 'New task did not appear');
    assert(task.querySelector('time').dateTime === scheduledAt.toISOString(), 'The form should convert local time to UTC');
    assert(task.querySelector('.duration').textContent === '45 min', 'Duration was not saved');
    checks.push('manual create and UTC conversion');

    for (const status of ['in_progress', 'done', 'todo']) {
      const select = task.querySelector('select');
      select.value = status;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => row(title)?.dataset.status === status, `Status did not change to ${status}`);
      task = row(title);
    }
    checks.push('status and reopen controls');
    click('Mark read', task);
    await waitFor(() => row(title)?.querySelector('h3').dataset.read === 'true', 'Read state was not set');
    click('Mark unread', row(title));
    await waitFor(() => row(title)?.querySelector('h3').dataset.read === 'false', 'Unread state was not restored');
    checks.push('read and unread controls');

    click('Edit', row(title));
    await waitFor(() => document.querySelector('.editor'), 'Edit did not open');
    input('Task', 'Edited browser task');
    input('Duration (minutes)', '');
    click('Save changes', document.querySelector('.editor'));
    task = await waitFor(() => row('Edited browser task'), 'Edited title did not appear');
    assert(!task.querySelector('.duration'), 'An empty duration should clear the saved duration');
    checks.push('manual edit and clearing duration');

    click('Delete', task);
    await waitFor(() => row('Edited browser task')?.querySelector('.delete-confirm'), 'Delete confirmation did not appear');
    click('Keep task', task);
    await waitFor(() => !row('Edited browser task')?.querySelector('.delete-confirm'), 'Keep task did not cancel deletion');
    assert(row('Edited browser task'), 'Cancelled deletion removed the task');
    click('Delete', task);
    await waitFor(() => task.querySelector('.delete-confirm'), 'Second delete confirmation did not appear');
    click('Delete task', task);
    await waitFor(() => !row('Edited browser task'), 'Confirmed deletion did not remove the task');
    assert(document.querySelectorAll('.task-row').length === count, 'The task count should be restored after delete');
    checks.push('delete confirmation, cancel, and delete');
    await waitFor(() => !document.querySelector('.app-header button').disabled, 'Controls stayed disabled after saving');
    assert([...document.querySelectorAll('.task-controls button, .task-controls select')].every((control) => !control.disabled),
      'Task controls stayed disabled after saving');
    assert(browserErrors.length === 0, `Browser errors: ${browserErrors.join('; ')}`);
    checks.push('no browser or console errors');
    result.dataset.result = 'pass';
    result.textContent = checks.join(' | ');
  } catch (error) {
    result.dataset.result = 'fail';
    result.textContent = error instanceof Error ? error.message : String(error);
  }
}
