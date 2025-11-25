// scripts/migrate-stock-mappings.js
/**
 * Migration Script: stockMappings Collection Refactoring
 *
 * Changes:
 * 1. Document ID: {brokerage}_{stockName} → {ISIN}
 * 2. Field names:
 *    - brokerageStockName → koName
 *    - brokerageTicker → isin
 *    - systemTicker → symbol
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
    readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateStockMappings() {
    console.log('🚀 Starting stockMappings migration...\n');

    try {
        // Step 1: Read all existing documents
        const snapshot = await db.collection('stockMappings').get();
        console.log(`📊 Found ${snapshot.size} documents to migrate\n`);

        if (snapshot.empty) {
            console.log('✅ No documents to migrate');
            return;
        }

        const batch = db.batch();
        const migratedDocs = [];
        const errors = [];

        // Step 2: Process each document
        for (const doc of snapshot.docs) {
            const oldData = doc.data();
            const oldId = doc.id;

            // Validate required fields
            if (!oldData.brokerageTicker) {
                errors.push({
                    oldId,
                    error: 'Missing brokerageTicker (ISIN)',
                });
                console.log(`⚠️  Skipping ${oldId}: Missing ISIN`);
                continue;
            }

            // Create new document with ISIN as ID
            const newId = oldData.brokerageTicker;
            const newData = {
                brokerage: oldData.brokerage,
                koName: oldData.brokerageStockName,
                isin: oldData.brokerageTicker,
                symbol: oldData.systemTicker,
                stockInfo: oldData.stockInfo || {},
                createdAt: oldData.createdAt || admin.firestore.Timestamp.now(),
                createdBy: oldData.createdBy || 'migration',
                updatedAt: admin.firestore.Timestamp.now(),
            };

            // Add to batch
            const newDocRef = db.collection('stockMappings').doc(newId);
            batch.set(newDocRef, newData);

            migratedDocs.push({
                oldId,
                newId,
                koName: newData.koName,
                symbol: newData.symbol,
            });

            console.log(`✓ Migrating: ${oldId} → ${newId} (${newData.koName})`);
        }

        // Step 3: Commit new documents
        if (migratedDocs.length > 0) {
            console.log(
                `\n📝 Committing ${migratedDocs.length} new documents...`
            );
            await batch.commit();
            console.log('✅ New documents created successfully\n');
        }

        // Step 4: Delete old documents
        console.log('🗑️  Deleting old documents...');
        const deleteBatch = db.batch();

        for (const doc of snapshot.docs) {
            const oldData = doc.data();
            // Only delete if it was successfully migrated
            const wasMigrated = migratedDocs.some((m) => m.oldId === doc.id);
            if (wasMigrated) {
                deleteBatch.delete(doc.ref);
            }
        }

        await deleteBatch.commit();
        console.log('✅ Old documents deleted\n');

        // Step 5: Summary
        console.log('📊 Migration Summary:');
        console.log(`   ✅ Migrated: ${migratedDocs.length}`);
        console.log(`   ⚠️  Errors: ${errors.length}`);

        if (errors.length > 0) {
            console.log('\n⚠️  Documents with errors:');
            errors.forEach((e) => {
                console.log(`   - ${e.oldId}: ${e.error}`);
            });
        }

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        // Cleanup
        await admin.app().delete();
    }
}

// Run migration
migrateStockMappings()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
