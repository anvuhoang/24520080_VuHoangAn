// tests/SimpleForm.test.jsx
import { Profiler, StrictMode } from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SimpleForm from '../src/form/SimpleForm.jsx';

const field = (label) => screen.getByLabelText(label);
const fillValid = async (user) => {
  await user.type(field('Full name'), 'Ada Lovelace');
  await user.type(field('Email'), 'ada@example.com');
  await user.type(field('Password'), 'Secret123!');
  await user.type(field('Confirm password'), 'Secret123!');
};

describe('SimpleForm markup', () => {
  it('is a named section with four labelled fields, a submit and a reset button', () => {
    const { container } = render(<SimpleForm />);
    expect(screen.getByRole('region', { name: 'Sign-up form' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sign-up form');
    for (const label of ['Full name', 'Email', 'Password', 'Confirm password']) expect(field(label)).toBeInTheDocument();
    expect(field('Password')).toHaveAttribute('type', 'password');
    expect(field('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveAttribute('type', 'button');
    const ids = [...container.querySelectorAll('input')].map((input) => input.id);
    expect(new Set(ids).size).toBe(4);
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });

  it('starts quiet: no error, nothing invalid, no inspector', () => {
    render(<SimpleForm />);
    expect(screen.queryByRole('alert')).toBeNull();
    for (const input of screen.getAllByRole('textbox')) expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('region', { name: 'Submitted data' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('survives StrictMode with no console error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StrictMode>
        <SimpleForm />
      </StrictMode>
    );
    await userEvent.type(field('Full name'), 'Al');
    expect(error).not.toHaveBeenCalled();
  });
});

describe('SimpleForm validation (synchronous, derived while rendering)', () => {
  it('shows an error only after the field is left, and removes it as soon as the value is fixed', async () => {
    const user = userEvent.setup();
    render(<SimpleForm />);
    await user.type(field('Email'), 'ada');
    expect(screen.queryByRole('alert')).toBeNull(); // still typing
    await user.tab();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a valid email address.');
    expect(field('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(field('Email')).toHaveAttribute('aria-describedby', alert.id);
    await user.clear(field('Email'));
    await user.type(field('Email'), 'ada@example.com');
    expect(screen.queryByText('Enter a valid email address.')).toBeNull();
    expect(field('Email')).toHaveAttribute('aria-invalid', 'false');
    // leaving the Password field on the way (it was tabbed through) shows ITS error, which is correct
    expect(screen.getByRole('alert')).toHaveTextContent('Password must have at least 8 characters.');
  });

  it('checks the confirmation against the password, and re-checks when only the password changes', async () => {
    const user = userEvent.setup();
    render(<SimpleForm />);
    await user.type(field('Password'), 'Secret123!');
    await user.type(field('Confirm password'), 'Different1');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
    await user.clear(field('Password'));
    await user.type(field('Password'), 'Different1');
    expect(screen.queryByRole('alert')).toBeNull(); // the confirmation was not touched again
  });

  it('shows every error and says how many fields need attention when submitted empty', async () => {
    const user = userEvent.setup();
    render(<SimpleForm />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    expect(screen.getByRole('status')).toHaveTextContent('4 fields need attention.');
    expect(screen.queryByRole('region', { name: 'Submitted data' })).toBeNull();
  });

  it('uses the singular for one field', async () => {
    const user = userEvent.setup();
    render(<SimpleForm />);
    await fillValid(user);
    await user.clear(field('Full name'));
    await user.type(field('Full name'), 'A');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 field needs attention.');
  });
});

describe('SimpleForm submit and inspector', () => {
  it('shows the submitted data in the inspector for a valid form, with the passwords masked', async () => {
    const user = userEvent.setup();
    const { container } = render(<SimpleForm />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('status')).toHaveTextContent('The form is valid and was submitted.');
    const inspector = screen.getByRole('region', { name: 'Submitted data' });
    expect(inspector).toHaveTextContent('Ada Lovelace');
    expect(inspector).toHaveTextContent('ada@example.com');
    expect(container.textContent).not.toContain('Secret123!');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not reload the page: the submit event is prevented', () => {
    const { container } = render(<SimpleForm />);
    const notPrevented = fireEvent.submit(container.querySelector('form'));
    expect(notPrevented).toBe(false); // fireEvent returns false when preventDefault() was called
  });

  it('empties everything on reset', async () => {
    const user = userEvent.setup();
    render(<SimpleForm />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    for (const label of ['Full name', 'Email', 'Password', 'Confirm password']) expect(field(label)).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Submitted data' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SimpleForm rendering', () => {
  it('renders once per typed character (no effect waterfall)', async () => {
    const onRender = vi.fn();
    render(
      <Profiler id="form" onRender={onRender}>
        <SimpleForm />
      </Profiler>
    );
    const user = userEvent.setup();
    await user.click(field('Full name'));
    const base = onRender.mock.calls.length;
    await user.type(field('Full name'), 'Ada');
    expect(onRender.mock.calls.length - base).toBe(3);
  });

  it('keeps validation out of effects: the form files contain no useEffect', () => {
    const files = readdirSync('src/form').filter((name) => /\.(js|jsx)$/.test(name));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const name of files) {
      const code = readFileSync(`src/form/${name}`, 'utf8').replace(/\/\/.*$/gm, ''); // comments do not count
      expect(code, name).not.toMatch(/useEffect/);
    }
  });
});
