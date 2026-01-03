import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { query } from "../utils/database";
import { validateBody, validateParams } from "../middleware/validation";
import {
  CreateSavedFieldSchema,
  DeleteFieldParamsSchema,
} from "../schemas/api.schemas";

const app = new Hono();

// GET / - Get user's saved fields
app.get("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.organizationId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Ensure table exists
    const createTableQuery =
      process.env.DATABASE_URL?.startsWith("postgresql://") ||
      process.env.DATABASE_URL?.startsWith("postgres://")
        ? `
        CREATE TABLE IF NOT EXISTS saved_fields (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          polygon TEXT NOT NULL,
          area_ha DECIMAL(10,2),
          location_json TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
        : `
        CREATE TABLE IF NOT EXISTS saved_fields (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          name TEXT NOT NULL,
          polygon TEXT NOT NULL,
          area_ha REAL,
          location_json TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;

    await query(createTableQuery);

    const result = await query(
      `
      SELECT id, organization_id, name, polygon, area_ha, location_json, created_at, updated_at
      FROM saved_fields
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `,
      [user.organizationId],
    );

    // Deserialize JSON fields for frontend
    const fieldsResponse = result.rows.map((field) => {
      try {
        let polygon;
        if (typeof field.polygon === "string") {
          polygon = JSON.parse(field.polygon);
        } else {
          polygon = field.polygon; // Already parsed or is an array
        }

        let location_json = null;
        if (field.location_json) {
          if (typeof field.location_json === "string") {
            location_json = JSON.parse(field.location_json);
          } else {
            location_json = field.location_json; // Already parsed
          }
        }

        return {
          ...field,
          polygon,
          location_json,
        };
      } catch (error: any) {
        console.error("Error parsing field JSON:", error, "field:", field.id);
        // Return field as-is if parsing fails
        return {
          ...field,
          polygon: field.polygon,
          location_json: field.location_json,
        };
      }
    });

    return c.json({ fields: fieldsResponse });
  } catch (error: any) {
    console.error("Error fetching saved fields:", error);
    return c.json(
      { error: "Internal server error", message: error.message },
      500,
    );
  }
});

// POST / - Save a field
app.post(
  "/",
  authMiddleware,
  validateBody(CreateSavedFieldSchema),
  async (c) => {
    try {
      const user = c.get("user");
      if (!user || !user.organizationId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const validatedBody = c.get("validatedBody") as any;
      const { name, polygon, area_ha, location_json } = validatedBody;

      console.log("💾 Save field request:", {
        hasName: !!name,
        nameType: typeof name,
        hasPolygon: !!polygon,
        polygonType: typeof polygon,
        polygonIsArray: Array.isArray(polygon),
        polygonLength: polygon?.length,
        hasArea: area_ha !== undefined,
        areaValue: area_ha,
      });

      // Validate required fields
      const nameValid =
        name && typeof name === "string" && name.trim().length > 0;
      const polygonValid =
        polygon && Array.isArray(polygon) && polygon.length >= 3;
      const areaValid =
        area_ha !== undefined &&
        area_ha !== null &&
        !isNaN(Number(area_ha)) &&
        Number(area_ha) > 0;

      if (!nameValid || !polygonValid || !areaValid) {
        console.log("❌ Validation failed:", {
          nameValid,
          polygonValid,
          areaValid,
        });
        return c.json(
          {
            error: "Missing or invalid required fields",
            details: {
              name: nameValid ? "valid" : "invalid or empty",
              polygon: polygonValid
                ? "valid"
                : "must be array with at least 3 points",
              area_ha: areaValid ? "valid" : "must be a number greater than 0",
            },
          },
          400,
        );
      }

      // Ensure table exists
      const createTableQuery =
        process.env.DATABASE_URL?.startsWith("postgresql://") ||
        process.env.DATABASE_URL?.startsWith("postgres://")
          ? `
        CREATE TABLE IF NOT EXISTS saved_fields (
          id VARCHAR(255) PRIMARY KEY,
          organization_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          polygon TEXT NOT NULL,
          area_ha DECIMAL(10,2),
          location_json TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
          : `
        CREATE TABLE IF NOT EXISTS saved_fields (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          name TEXT NOT NULL,
          polygon TEXT NOT NULL,
          area_ha REAL,
          location_json TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await query(createTableQuery);

      // Generate ID
      const generateId = () => {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 15);
        return `field_${timestamp}${random}`.substring(0, 30);
      };

      const fieldId = generateId();
      const now = new Date().toISOString();

      // Check if we're using PostgreSQL (supports RETURNING) or SQLite
      const isPostgreSQL =
        process.env.DATABASE_URL?.startsWith("postgresql://") ||
        process.env.DATABASE_URL?.startsWith("postgres://");

      if (isPostgreSQL) {
        // PostgreSQL: use RETURNING
        const result = await query(
          `
        INSERT INTO saved_fields (id, organization_id, name, polygon, area_ha, location_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, organization_id, name, polygon, area_ha, location_json, created_at, updated_at
      `,
          [
            fieldId,
            user.organizationId,
            name,
            JSON.stringify(polygon),
            area_ha,
            location_json ? JSON.stringify(location_json) : null,
            now,
            now,
          ],
        );

        const newField = result.rows[0];

        // Return with deserialized data for frontend
        const fieldResponse = {
          ...newField,
          polygon: JSON.parse(newField.polygon),
          location_json: newField.location_json
            ? JSON.parse(newField.location_json)
            : null,
        };

        return c.json({ field: fieldResponse }, 201);
      } else {
        // SQLite: insert then fetch
        await query(
          `
        INSERT INTO saved_fields (id, organization_id, name, polygon, area_ha, location_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
          [
            fieldId,
            user.organizationId,
            name,
            JSON.stringify(polygon),
            area_ha,
            location_json ? JSON.stringify(location_json) : null,
            now,
            now,
          ],
        );

        // Fetch the inserted field
        const result = await query(
          `
        SELECT id, organization_id, name, polygon, area_ha, location_json, created_at, updated_at
        FROM saved_fields
        WHERE id = $1
      `,
          [fieldId],
        );

        const newField = result.rows[0];

        // Return with deserialized data for frontend
        const fieldResponse = {
          ...newField,
          polygon: JSON.parse(newField.polygon),
          location_json: newField.location_json
            ? JSON.parse(newField.location_json)
            : null,
        };

        return c.json({ field: fieldResponse }, 201);
      }
    } catch (error: any) {
      console.error("Error saving field:", error);
      return c.json(
        { error: "Internal server error", message: error.message },
        500,
      );
    }
  },
);

// DELETE /:fieldId - Delete a saved field
app.delete(
  "/:fieldId",
  authMiddleware,
  validateParams(DeleteFieldParamsSchema),
  async (c) => {
    try {
      const user = c.get("user");
      if (!user || !user.organizationId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { fieldId } = c.get("validatedParams");

      // Check if we're using PostgreSQL or SQLite
      const isPostgreSQL =
        process.env.DATABASE_URL?.startsWith("postgresql://") ||
        process.env.DATABASE_URL?.startsWith("postgres://");

      if (isPostgreSQL) {
        // PostgreSQL: use RETURNING
        const result = await query(
          `
        DELETE FROM saved_fields
        WHERE id = $1 AND organization_id = $2
        RETURNING id
      `,
          [fieldId, user.organizationId],
        );

        if (result.rows.length === 0) {
          return c.json({ error: "Field not found or not authorized" }, 404);
        }
      } else {
        // SQLite: check first, then delete
        const checkResult = await query(
          `
        SELECT id FROM saved_fields
        WHERE id = $1 AND organization_id = $2
      `,
          [fieldId, user.organizationId],
        );

        if (checkResult.rows.length === 0) {
          return c.json({ error: "Field not found or not authorized" }, 404);
        }

        await query(
          `
        DELETE FROM saved_fields
        WHERE id = $1 AND organization_id = $2
      `,
          [fieldId, user.organizationId],
        );
      }

      return c.json({ message: "Field deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting field:", error);
      return c.json(
        { error: "Internal server error", message: error.message },
        500,
      );
    }
  },
);

export default app;
