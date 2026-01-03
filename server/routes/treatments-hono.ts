import { Hono } from "hono";
import { mockTreatments } from "../utils/mock-data";

const app = new Hono();

// Get all treatments
app.get("/", async (c) => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  return c.json(mockTreatments);
});

// Get treatments by category
app.get("/category/:categoryId", async (c) => {
  const { categoryId } = c.req.param();
  const treatments = mockTreatments.filter((t) => t.categoryId === categoryId);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));
  return c.json(treatments);
});

// Get treatment by ID
app.get("/:id", async (c) => {
  const { id } = c.req.param();
  const treatment = mockTreatments.find((t) => t.id === id);

  if (!treatment) {
    return c.json({ error: "Treatment not found" }, 404);
  }

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));
  return c.json(treatment);
});

export default app;
