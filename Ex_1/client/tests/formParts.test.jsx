// client/tests/formParts.test.jsx
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormContext, useFormContext } from '../src/sprint2-form/FormContext.js';
import InputField from '../src/sprint2-form/InputField.jsx';
import ShowData from '../src/sprint2-form/ShowData.jsx';

function renderField(contextOverrides = {}, props = {}) {
  const context = {
    values: { email: '' },
    errors: {},
    touched: {},
    setValue: vi.fn(),
    touch: vi.fn(),
    ...contextOverrides,
  };
  const view = render(
    <FormContext.Provider value={context}>
      <InputField name="email" label="Email" type="email" {...props} />
    </FormContext.Provider>
  );
  return { ...view, context };
}

describe('useFormContext', () => {
  it('returns the shared value inside a provider', () => {
    const value = { values: { a: 1 } };
    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => <FormContext.Provider value={value}>{children}</FormContext.Provider>,
    });
    expect(result.current).toBe(value);
  });

  it('throws a clear error outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useFormContext())).toThrow('useFormContext must be used inside <FormContext.Provider>.');
  });
});

describe('InputField', () => {
  it('binds its label to its input with a generated id', () => {
    renderField();
    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'email');
    expect(input.id).not.toBe('');
    expect(screen.getByText('Email')).toHaveAttribute('for', input.id);
  });

  it('gives two fields two different ids', () => {
    render(
      <FormContext.Provider value={{ values: {}, errors: {}, touched: {}, setValue() {}, touch() {} }}>
        <InputField name="a" label="A" />
        <InputField name="b" label="B" />
      </FormContext.Provider>
    );
    expect(screen.getByLabelText('A').id).not.toBe(screen.getByLabelText('B').id);
  });

  it('shows no error and is not invalid until the field was touched, even when it is wrong', () => {
    renderField({ errors: { email: 'Enter a valid email address.' }, touched: {} });
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('once touched, shows the error, marks the input invalid and points at the message', () => {
    renderField({ errors: { email: 'Enter a valid email address.' }, touched: { email: true } });
    const input = screen.getByLabelText('Email');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a valid email address.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(input).toHaveAccessibleDescription('✕ Enter a valid email address.'.replace('✕ ', ''));
  });

  it('shows no error for a touched field that is fine', () => {
    renderField({ errors: {}, touched: { email: true } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false');
  });

  it('reports each typed character and the moment the field is left', async () => {
    const user = userEvent.setup();
    const { context } = renderField();
    await user.type(screen.getByLabelText('Email'), 'ab');
    expect(context.setValue.mock.calls).toEqual([
      ['email', 'a'],
      ['email', 'b'],
    ]);
    await user.tab();
    expect(context.touch).toHaveBeenCalledWith('email');
  });

  it('shows the value from the context, and an empty string when the value is missing', () => {
    const { unmount } = renderField({ values: { email: 'a@b.co' } });
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.co');
    unmount();
    renderField({ values: {} });
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('has no <div> or <span>', () => {
    const { container } = renderField({ errors: { email: 'x' }, touched: { email: true } });
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });
});

describe('ShowData', () => {
  it('shows every key and value in a description list', () => {
    const { container } = render(<ShowData data={{ name: 'Ada', age: 36, active: true }} />);
    expect(screen.getByRole('region', { name: 'Submitted data' })).toBeInTheDocument();
    expect([...container.querySelectorAll('dt')].map((n) => n.textContent)).toEqual(['name', 'age', 'active']);
    expect([...container.querySelectorAll('dd')].map((n) => n.textContent)).toEqual(['Ada', '36', 'true']);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });

  it('never shows a password', () => {
    const { container } = render(<ShowData data={{ name: 'Ada', password: 'Secret123!', confirmPassword: 'Secret123!' }} />);
    expect(container.textContent).not.toContain('Secret123!');
    expect([...container.querySelectorAll('dd')].map((n) => n.textContent)).toEqual(['Ada', '••••••••', '••••••••']);
  });

  it('copes with no data at all', () => {
    for (const data of [undefined, null, {}]) {
      const { container, unmount } = render(<ShowData data={data} />);
      expect(container.querySelectorAll('dt')).toHaveLength(0);
      unmount();
    }
  });

  it('prints values as text, never as markup, and gives every pair a key', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<ShowData data={{ bio: '<img src=x onerror=alert(1)>', other: 'x' }} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(error).not.toHaveBeenCalled();
  });

  it('takes another title', () => {
    render(<ShowData data={{ a: 1 }} title="Last submission" />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Last submission');
  });
});
