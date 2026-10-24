import { fireEvent, screen, waitFor } from "@testing-library/react";

export async function selectOption(name: string, label: string) {
  fireEvent.click(screen.getByRole("combobox", { name }));
  const option = await screen.findByRole("option", {
    name: label,
  });
  fireEvent.mouseMove(option);
  fireEvent.click(option);
  await waitFor(() => {
    if (screen.queryByRole("listbox"))
      throw new Error("Le menu est encore ouvert");
  });
}
