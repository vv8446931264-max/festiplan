import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetRow } from "@/components/plan/BudgetRow";
import { fixturePlan } from "../fixtures/plan";

const ALLOCATION = fixturePlan().budget[0];

/** One editable budget row inside the table it belongs to. */
function renderRow() {
  const onActual = vi.fn();
  render(
    <table>
      <tbody>
        <BudgetRow
          allocation={ALLOCATION}
          varianceINR={null}
          editable
          highlight={null}
          onHighlight={vi.fn()}
          onActual={onActual}
        />
      </tbody>
    </table>,
  );
  return { onActual, input: screen.getByRole("textbox", { name: /spent so far on/i }) };
}

describe("BudgetRow spent-so-far error", () => {
  it("is announced as an alert on blur and tied to the field", () => {
    const { input, onActual } = renderRow();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(input, { target: { value: "12 lakh" } });
    fireEvent.blur(input);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Enter whole rupees, up to/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", alert.id);
    expect(input).toHaveAccessibleDescription(alert.textContent);
    expect(onActual).not.toHaveBeenCalled();
  });

  it("is announced when Enter checks the value, with focus still in the field", () => {
    const { input } = renderRow();
    input.focus();
    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("goes away, with its description, once the value is valid and is saved", () => {
    const { input, onActual } = renderRow();
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "₹5,000" } });
    fireEvent.blur(input);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(onActual).toHaveBeenCalledExactlyOnceWith(ALLOCATION.category, 5000);
  });
});
