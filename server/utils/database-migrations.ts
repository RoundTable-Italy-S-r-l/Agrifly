/**
 * Utility functions for database migrations
 * Handles SQLite and PostgreSQL compatibility
 */

import { query } from './database';
import { isUsingSQLite, isUsingPostgreSQL } from '../config';

/**
 * Apply rate_cards table expansion migration
 * Adds new pricing customization fields
 */
export async function expandRateCardsTable() {
  try {
    if (isUsingSQLite) {
      // SQLite: Add columns with error handling (columns might already exist)
      const columnsToAdd = [
        { name: 'travel_fixed_cents', type: 'INTEGER DEFAULT 0' },
        { name: 'hilly_terrain_multiplier', type: 'REAL' },
        { name: 'hilly_terrain_surcharge_cents', type: 'INTEGER DEFAULT 0' },
        { name: 'custom_multipliers_json', type: 'TEXT' },
        { name: 'custom_surcharges_json', type: 'TEXT' },
      ];

      for (const column of columnsToAdd) {
        try {
          // SQLite doesn't support IF NOT EXISTS, so we try-catch
          await query(`ALTER TABLE rate_cards ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✅ Added column: ${column.name}`);
        } catch (error: any) {
          // Column might already exist, which is fine
          if (error.message && error.message.includes('duplicate column name')) {
            console.log(`ℹ️  Column ${column.name} already exists, skipping`);
          } else {
            throw error;
          }
        }
      }

      // Rename org_id to seller_org_id if needed (SQLite)
      // Note: SQLite doesn't support checking column existence easily
      // We try to rename and catch if it fails
      try {
        await query(`ALTER TABLE rate_cards RENAME COLUMN org_id TO seller_org_id`);
        console.log('✅ Renamed org_id to seller_org_id');
      } catch (error: any) {
        // Column might not exist or already renamed - this is fine
        if (!error.message || (!error.message.includes('no such column') && !error.message.includes('duplicate column'))) {
          console.warn('⚠️  Could not rename org_id column:', error.message);
        }
      }
    } else if (isUsingPostgreSQL) {
      // PostgreSQL: Use proper IF NOT EXISTS logic
      const alterStatements = [
        `ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS travel_fixed_cents INTEGER DEFAULT 0`,
        `ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS hilly_terrain_multiplier REAL`,
        `ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS hilly_terrain_surcharge_cents INTEGER DEFAULT 0`,
        `ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS custom_multipliers_json TEXT`,
        `ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS custom_surcharges_json TEXT`,
      ];

      for (const statement of alterStatements) {
        await query(statement);
        console.log(`✅ Executed: ${statement}`);
      }

      // Rename org_id to seller_org_id if needed (PostgreSQL)
      try {
        const checkColumn = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'rate_cards' 
          AND column_name IN ('org_id', 'seller_org_id')
        `);
        
        const columns = checkColumn.rows.map((row: any) => row.column_name);
        const hasOrgId = columns.includes('org_id');
        const hasSellerOrgId = columns.includes('seller_org_id');

        if (hasOrgId && !hasSellerOrgId) {
          await query(`ALTER TABLE rate_cards RENAME COLUMN org_id TO seller_org_id`);
          console.log('✅ Renamed org_id to seller_org_id');
        }
      } catch (error: any) {
        console.warn('⚠️  Could not rename org_id column:', error.message);
      }
    }

    console.log('✅ Rate cards table expansion migration completed');
  } catch (error: any) {
    console.error('❌ Error applying rate_cards expansion migration:', error);
    throw error;
  }
}

