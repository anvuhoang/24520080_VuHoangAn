// client/tests/AppealForm.test.jsx — the form engine, through the real page, against a fake API that follows the server's rules.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { FormContext, useFormContext } from '../src/appeal/FormContext.js';
import { fakeApi } from './fakeApi.js';
import { jsonResponse } from './fetchMock.js';

let api;
const STATEMENT = 'The detection flagged my normal key presses. I have the recording of the match and can share it.';

async function setup(path = '/dossier/himass', options) {
  api = fakeApi(options);
  vi.stubGlobal('fetch', api.fetchMock);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
  await screen.findByLabelText('Your name'); // the form appears once the page and the appeal check have loaded
}

afterEach(() => vi.unstubAllGlobals());

const name = () => screen.getByLabelText('Your name');
const email = () => screen.getByLabelText('Email');
const category = () => screen.getByLabelText('Reason of the appeal');
const statement = () => screen.getByLabelText('Your statement');
const evidence = () => screen.getByLabelText('Link to evidence (optional)');
const confirm = () => screen.getByLabelText('I confirm that my statement is true.');
const send = () => screen.getByRole('button', { name: /Send appeal|Sending/ });

async function fillValid(user, { skip = [] } = {}) {
  if (!skip.includes('name')) await user.type(name(), '  Himass ');
  if (!skip.includes('email')) await user.type(email(), ' HIMASS@Example.com ');
  if (!skip.includes('category')) await user.selectOptions(category(), 'false-positive');
  if (!skip.includes('statement')) {
    await user.click(statement());
    await user.paste(STATEMENT);
  }
  if (!skip.includes('confirm')) await user.click(confirm());
}

describe('the fields', () => {
  it('has a label for every control, and the right kind of control for each', async () => {
    await setup();
    expect(name()).toHaveAttribute('autocomplete', 'name');
    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'email');
    expect(category().tagName).toBe('SELECT');
    expect(statement().tagName).toBe('TEXTAREA');
    expect(evidence()).toHaveAttribute('type', 'url');
    expect(confirm()).toHaveAttribute('type', 'checkbox');
  });

  it('starts quiet: no error is shown before the user has done anything', async () => {
    await setup();
    for (const control of [name(), email(), category(), statement(), evidence(), confirm()]) {
      expect(control).toHaveAttribute('aria-invalid', 'false');
    }
    expect(screen.queryByText(/must have at least/)).toBeNull();
  });

  it('lists every reason in the select', async () => {
    await setup();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose…',
      'The detection was a false positive',
      'Mistaken identity',
      'A technical problem (lag, crash, disconnect)',
      'Other reason',
    ]);
  });

  it('is a form with a name, so a screen reader can find it', async () => {
    await setup();
    expect(screen.getByRole('form', { name: 'File an appeal' })).toBeInTheDocument();
  });
});

describe('real-time validation (derived while rendering, no effect)', () => {
  it('shows an error as soon as the user types a value that is not valid, and removes it as soon as it is', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(name(), 'H');
    expect(name()).toHaveAttribute('aria-invalid', 'true');
    expect(name()).toHaveAccessibleDescription(/at least 2 characters/);
    await user.type(name(), 'i');
    expect(name()).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText(/at least 2 characters/)).toBeNull();
  });

  it('shows the error of a field that was only left (blur) without typing', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(email());
    await user.tab();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveAccessibleDescription('Enter a valid email address.');
  });

  it('does not show the errors of fields the user has not reached', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(name(), 'H');
    expect(email()).toHaveAttribute('aria-invalid', 'false');
    expect(statement()).toHaveAttribute('aria-invalid', 'false');
  });

  it('points aria-describedby at the error, and at the hint of the field that has one', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(statement(), 'short');
    const ids = statement().getAttribute('aria-describedby').split(' ');
    expect(ids).toHaveLength(2);
    expect(statement()).toHaveAccessibleDescription(/0 of 1000|5 of 1000/);
    expect(statement()).toHaveAccessibleDescription(/at least 50 characters/);
  });

  it('keeps the error row in place: the message appearing does not add an element above the next field', async () => {
    const user = userEvent.setup();
    await setup();
    const rowsBefore = document.querySelectorAll('form p').length;
    await user.type(name(), 'H');
    expect(document.querySelectorAll('form p').length).toBe(rowsBefore);
  });

  it('the statement counter follows every key', async () => {
    const user = userEvent.setup();
    await setup();
    expect(screen.getByText(/^0 of 1000 characters/)).toBeInTheDocument();
    await user.type(statement(), 'abcde');
    expect(screen.getByText(/^5 of 1000 characters/)).toBeInTheDocument();
  });

  it('counts the trimmed statement, not the spaces around it', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(statement(), '   ab   ');
    expect(screen.getByText(/^2 of 1000 characters/)).toBeInTheDocument();
  });

  it('shows an evidence link that is not https as an error, and accepts https and nothing', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(evidence(), 'http://example.com');
    expect(evidence()).toHaveAttribute('aria-invalid', 'true');
    await user.clear(evidence());
    expect(evidence()).toHaveAttribute('aria-invalid', 'false');
    await user.type(evidence(), 'https://example.com/replay');
    expect(evidence()).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('the cross-field rule', () => {
  it('the same statement is long enough for a named reason and not for "Other", and the error follows the CATEGORY, not the typing', async () => {
    const user = userEvent.setup();
    await setup();
    await user.selectOptions(category(), 'false-positive');
    await user.click(statement());
    await user.paste('x'.repeat(60));
    expect(statement()).toHaveAttribute('aria-invalid', 'false');
    await user.selectOptions(category(), 'other'); // the statement is not touched again
    expect(statement()).toHaveAttribute('aria-invalid', 'true');
    expect(statement()).toHaveAccessibleDescription(/For "Other", the statement must have at least 100 characters/);
    expect(screen.getByText(/^60 of 1000 characters. At least 100\./)).toBeInTheDocument();
    await user.selectOptions(category(), 'mistaken-identity');
    expect(statement()).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('submitting an invalid form', () => {
  it('shows every error, says how many fields need attention, focuses the first one, and sends nothing', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(send());
    for (const control of [name(), email(), category(), statement(), confirm()]) expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(evidence()).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByText('5 fields need attention.')).toBeInTheDocument();
    expect(name()).toHaveFocus();
    expect(api.posts()).toHaveLength(0);
  });

  it('focuses the first invalid field in the order of the form, not the first one that was touched', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user, { skip: ['email'] });
    await user.click(send());
    expect(email()).toHaveFocus();
    expect(screen.getByText('1 field needs attention.')).toBeInTheDocument();
  });

  it('requires the confirmation', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user, { skip: ['confirm'] });
    await user.click(send());
    expect(confirm()).toHaveAttribute('aria-invalid', 'true');
    expect(confirm()).toHaveAccessibleDescription('Confirm that your statement is true.');
    expect(confirm()).toHaveFocus();
  });
});

describe('submitting a valid form', () => {
  it('sends the normalized fields only, then replaces the form with the receipt', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    await user.click(send());
    const receipt = await screen.findByRole('status', { name: 'Appeal receipt' });
    expect(receipt).toHaveTextContent('Appeal received');
    expect(receipt).toHaveTextContent('Reference a1');
    expect(api.posts()).toHaveLength(1);
    expect(api.posts()[0].url).toBe('/api/appeals/himass');
    expect(api.posts()[0].body).toEqual({
      appellantName: 'Himass',
      email: 'himass@example.com',
      category: 'false-positive',
      statement: STATEMENT,
      evidenceUrl: '',
      confirm: true,
    });
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('shows no personal data in the receipt', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    await user.click(send());
    const receipt = await screen.findByRole('status', { name: 'Appeal receipt' });
    expect(receipt).not.toHaveTextContent(/example\.com|detection flagged/);
  });

  it('one click is one request, however fast the second one comes', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    const button = send();
    await act(async () => {
      button.click();
      button.click();
      button.click();
    });
    await screen.findByRole('status', { name: 'Appeal receipt' });
    expect(api.posts()).toHaveLength(1);
  });

  it('blocks the button and says it is sending while the request is on its way', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    let release;
    api.state.override = (method) => (method === 'POST' ? new Promise((resolve) => { release = () => resolve(jsonResponse({ id: 'a9', playerId: 'himass', category: 'false-positive', status: 'received', createdAt: new Date().toISOString() }, 201)); }) : null);
    await user.click(send());
    expect(screen.getByRole('button', { name: 'Sending…' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Sending your appeal…')).toBeInTheDocument();
    await act(async () => release());
    await screen.findByRole('status', { name: 'Appeal receipt' });
  });
});

describe('what the server says', () => {
  it('puts the errors of a 400 on the fields, focuses the first, and clears one when that field is edited', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    api.state.override = (method) => (method === 'POST' ? jsonResponse({ error: 'Invalid appeal.', details: { email: 'The tribunal does not accept this address.' } }, 400) : null);
    await user.click(send());
    await waitFor(() => expect(email()).toHaveAttribute('aria-invalid', 'true'));
    expect(email()).toHaveAccessibleDescription('The tribunal does not accept this address.');
    expect(email()).toHaveFocus();
    expect(screen.getByText('The tribunal did not accept the appeal. Check the marked fields.')).toBeInTheDocument();
    fireEvent.change(email(), { target: { value: 'himass2@example.com' } }); // an edit of the field
    expect(email()).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('The tribunal does not accept this address.')).toBeNull(); // the server's message went with the edit
  });

  it('a 403 (the window closed while the form was open) blocks the form for good and says so', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    api.state.override = (method) => (method === 'POST' ? jsonResponse({ error: 'The appeal window is closed.' }, 403) : null);
    await user.click(send());
    await waitFor(() => expect(send()).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getAllByText(/The appeal window is closed\. The form can no longer be sent\./).length).toBeGreaterThan(0);
    api.state.override = null;
    await user.click(send());
    expect(api.posts()).toHaveLength(1); // no second attempt
  });

  it('a 409 (an appeal already exists, from another tab) shows the receipt', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    api.state.appeals.himass = { id: 'other-tab', playerId: 'himass', category: 'other', status: 'received', createdAt: new Date().toISOString() };
    await user.click(send());
    const receipt = await screen.findByRole('status', { name: 'Appeal receipt' });
    expect(receipt).toHaveTextContent('Reference other-tab');
  });

  it('a network failure keeps what was typed and lets the user try again', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    api.state.override = (method) => {
      if (method === 'POST') throw new TypeError('Failed to fetch');
      return null;
    };
    await user.click(send());
    await screen.findByText(/Not sent: The server could not be reached\. Your answers are kept/);
    expect(name()).toHaveValue('  Himass ');
    expect(statement()).toHaveValue(STATEMENT);
    expect(send()).toHaveAttribute('aria-disabled', 'false');
    api.state.override = null;
    await user.click(send());
    await screen.findByRole('status', { name: 'Appeal receipt' });
  });

  it('a 500 is shown in words, with the answers kept', async () => {
    const user = userEvent.setup();
    await setup();
    await fillValid(user);
    api.state.override = (method) => (method === 'POST' ? jsonResponse({ error: 'Something went wrong on the server.' }, 500) : null);
    await user.click(send());
    await screen.findByText(/Not sent: Something went wrong on the server\./);
    expect(name()).toHaveValue('  Himass ');
  });
});

describe('when the window is closed', () => {
  it('blocks the button, says why, and does not send a request even if the button is clicked', async () => {
    const user = userEvent.setup();
    await setup('/dossier/himass', { hours: { himass: -1, tanvuu: 48 } });
    await waitFor(() => expect(send()).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getByText('The appeal window is closed. The form can no longer be sent.')).toBeInTheDocument();
    await fillValid(user);
    await user.click(send());
    expect(api.posts()).toHaveLength(0);
  });

  it('the other player, whose window is open, can still send', async () => {
    const user = userEvent.setup();
    await setup('/dossier/tanvuu', { hours: { himass: -1, tanvuu: 48 } });
    expect(send()).toHaveAttribute('aria-disabled', 'false');
    await fillValid(user);
    await user.click(send());
    await screen.findByRole('status', { name: 'Appeal receipt' });
  });
});

describe('the appeal that already exists, and switching player', () => {
  it('shows the receipt and no form when an appeal was already filed', async () => {
    api = fakeApi({ appeals: { himass: { id: 'a77', playerId: 'himass', category: 'other', status: 'received', createdAt: '2026-11-20T10:00:00.000Z' } } });
    vi.stubGlobal('fetch', api.fetchMock);
    render(
      <MemoryRouter initialEntries={['/dossier/himass']}>
        <App />
      </MemoryRouter>
    );
    const receipt = await screen.findByRole('status', { name: 'Appeal receipt' });
    expect(receipt).toHaveTextContent('Reference a77');
    expect(receipt).toHaveTextContent('20 Nov 2026');
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('shows the receipt of ONE player only: the other player still has a form', async () => {
    const user = userEvent.setup();
    api = fakeApi({ appeals: { himass: { id: 'a77', playerId: 'himass', category: 'other', status: 'received', createdAt: '2026-11-20T10:00:00.000Z' } } });
    vi.stubGlobal('fetch', api.fetchMock);
    render(
      <MemoryRouter initialEntries={['/dossier/himass']}>
        <App />
      </MemoryRouter>
    );
    await screen.findByRole('status', { name: 'Appeal receipt' });
    await user.click(screen.getByRole('link', { name: 'TanVuu' }));
    expect(await screen.findByLabelText('Your name')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Appeal receipt' })).toBeNull();
  });

  it('what was typed for one player does not follow the user to the other', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(name(), 'Ada');
    await user.click(screen.getByRole('link', { name: 'TanVuu' }));
    await screen.findByRole('heading', { level: 2, name: 'TanVuu' });
    expect(await screen.findByLabelText('Your name')).toHaveValue('');
  });

  it('a failed check of the appeal is an alert with a retry', async () => {
    const user = userEvent.setup();
    api = fakeApi();
    let failing = true;
    api.state.override = (method, url) => (failing && method === 'GET' && url.startsWith('/api/appeals/') ? jsonResponse({ error: 'Database is down.' }, 500) : null);
    vi.stubGlobal('fetch', api.fetchMock);
    render(
      <MemoryRouter initialEntries={['/dossier/himass']}>
        <App />
      </MemoryRouter>
    );
    const alert = await screen.findByText('Database is down.');
    expect(alert).toBeInTheDocument();
    failing = false;
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0]);
    expect(await screen.findByLabelText('Your name')).toBeInTheDocument();
  });
});

describe('useFormContext', () => {
  it('throws a clear error outside a provider', () => {
    function Probe() {
      useFormContext();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useFormContext must be used inside <FormContext.Provider>.');
    spy.mockRestore();
  });

  it('gives the value to a consumer inside the provider', () => {
    function Probe() {
      return <p>{useFormContext().values.x}</p>;
    }
    render(
      <FormContext.Provider value={{ values: { x: 'hello' } }}>
        <Probe />
      </FormContext.Provider>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

describe('accessibility of the form as a whole', () => {
  it('has no <div> or <span>, and one error line per field in the DOM', async () => {
    await setup();
    expect(document.querySelector('form').querySelectorAll('div, span')).toHaveLength(0);
  });

  it('the checkbox is a real checkbox that can be toggled by the label', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByText('I confirm that my statement is true.'));
    expect(confirm()).toBeChecked();
    fireEvent.click(confirm());
    expect(confirm()).not.toBeChecked();
  });
});
