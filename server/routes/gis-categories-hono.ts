import { Hono } from "hono";
import { mockGisCategories } from "../utils/mock-data";

const app = new Hono();

// Get all GIS categories
app.get("/", async (c) => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return c.json(mockGisCategories);
});

// Get GIS category by ID
app.get("/:id", async (c) => {
  const { id } = c.req.param();
  const category = mockGisCategories.find((cat) => cat.id === id);

  if (!category) {
    return c.json({ error: "GIS category not found" }, 404);
  }

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));
  return c.json(category);
});

export default app;
