import { toLocalIsoWithoutOffset } from '../../src/domain/dates.ts';
import { MODEL_FILENAME, MODEL_PROJECTOR_FILENAME } from '../../src/model/modelConfig.ts';
import { THEMES } from '../../src/state/preferences.ts';

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

function changeValue(control, value) {
  const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value);
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
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
      assert([...document.querySelectorAll('.app-header button')].find(button => button.textContent === '+ New task')?.disabled, 'Manual writes should be disabled before the database opens');
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
      const timeline = document.querySelector('.task-workspace');
      timeline.scrollTop = 0;
      click('Read', next);
      await waitFor(() => row('Gym')?.querySelector('h3').dataset.read === 'true', 'The seeded task did not update');
      assert(timeline.scrollTop === 0, 'Task updates should not move the timeline after the initial scroll');
      checks.push('manual scroll stays in place after an update');
    }

    const count = document.querySelectorAll('.task-row').length;
    if (count) {
      changeValue(document.querySelector('[aria-label="Search tasks"]'), 'gym');
      await waitFor(() => document.querySelectorAll('.task-row').length === 1 && row('Gym'), 'Search did not narrow tasks');
      changeValue(document.querySelector('[aria-label="Task filter"]'), 'done');
      await waitFor(() => document.querySelectorAll('.task-row').length === 0, 'Combined search/status filter failed');
      click('Clear');
      await waitFor(() => document.querySelectorAll('.task-row').length === count, 'Clear did not restore tasks');
      checks.push('search and status filters compose without modifying tasks');
    }
    document.activeElement?.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    assert(document.activeElement === document.querySelector('[aria-label="Search tasks"]'), 'Search keyboard shortcut failed');
    document.activeElement.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    await waitFor(() => document.querySelector('.editor'), 'New-task keyboard shortcut failed');
    click('Cancel', document.querySelector('.editor'));
    await waitFor(() => !document.querySelector('.editor'), 'Keyboard-created editor did not close');
    checks.push('local keyboard shortcuts');

    click('Settings');
    const modelGroup = await waitFor(() => document.querySelector('.settings details'), 'Model settings did not open');
    if (!modelGroup.open) modelGroup.querySelector('summary').click();
    const modelSelector = await waitFor(() => document.querySelector('#local-model:not(:disabled)'), 'Model list did not load');
    assert(![...modelSelector.options].some(option => option.value.includes('fixture:cloud')), 'Cloud model was offered');
    for (const scheme of THEMES) {
      document.querySelector(`input[name="theme"][value="${scheme}"]`).click();
      await waitFor(() => document.documentElement.dataset.theme === scheme, 'Theme did not change');
      const styles = getComputedStyle(document.body);
      assert(styles.color !== styles.backgroundColor, 'Theme hides text against its background');
      assert(localStorage.getItem('taskflow.theme') === scheme, 'Theme preference did not persist');
    }
    document.querySelector('input[name="theme"][value="classic"]').click();
    changeValue(modelSelector, 'ollama|fixture-local:latest');
    await waitFor(() => document.querySelector('#local-model:not(:disabled)')?.value === 'ollama|fixture-local:latest', 'Ollama selection did not apply');
    const requestControl = document.getElementById('task-request');
    changeValue(requestControl, 'Add a task tomorrow at 9');
    click('Send');
    await waitFor(() => document.querySelector('.approval'), 'Ollama adapter did not return a proposal');
    assert(!row('Approved browser request'), 'Ollama wrote without approval');
    click('Cancel', document.querySelector('.approval'));
    changeValue(document.getElementById('local-model'), `gguf|${MODEL_FILENAME}`);
    await waitFor(() => document.querySelector('#local-model:not(:disabled)')?.value === `gguf|${MODEL_FILENAME}`, 'GGUF selection did not restore');
    changeValue(document.getElementById('image-projector'), MODEL_PROJECTOR_FILENAME);
    await waitFor(() => document.querySelector('#image-projector:not(:disabled)')?.value === MODEL_PROJECTOR_FILENAME, 'Image projector selection failed');
    click('Close', document.querySelector('.settings'));
    checks.push('eleven persisted themes and local model selection with Ollama approval');

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

    const attachment = new DataTransfer();
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII='), character => character.charCodeAt(0));
    attachment.items.add(new File([png], 'synthetic-screenshot.png', { type: 'image/png' }));
    const imagePicker = document.querySelector('[aria-label="Choose screenshot"]');
    imagePicker.files = attachment.files;
    imagePicker.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => document.querySelector('.image-attachment'), 'Screenshot preview did not appear');
    click('Send');
    await waitFor(() => document.querySelector('.approval'), 'Screenshot did not produce an approval card');
    assert(!row('Approved browser request'), 'Screenshot request wrote a task without approval');
    click('Cancel', document.querySelector('.approval'));
    checks.push('screenshot attachment stays a proposal before approval');

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
    changeValue(document.querySelector('.editor-reminder select'), '15');
    click('Add task', document.querySelector('.editor'));
    let task = await waitFor(() => row(title), 'New task did not appear');
    assert(task.querySelector('time').dateTime === scheduledAt.toISOString(), 'The form should convert local time to UTC');
    assert(task.querySelector('.duration').textContent === '45 min', 'Duration was not saved');
    assert(task.querySelector('.reminder-label'), 'Desktop reminder was not saved');
    checks.push('manual create and UTC conversion');

    for (const status of ['in_progress', 'done', 'todo']) {
      const select = task.querySelector('select');
      select.value = status;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => row(title)?.dataset.status === status, `Status did not change to ${status}`);
      task = row(title);
    }
    checks.push('status and reopen controls');
    click('Read', task);
    await waitFor(() => row(title)?.querySelector('h3').dataset.read === 'true', 'Read state was not set');
    click('Unread', row(title));
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
    await waitFor(() => ![...document.querySelectorAll('.app-header button')].find(button => button.textContent === '+ New task')?.disabled, 'Controls stayed disabled after saving');
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
